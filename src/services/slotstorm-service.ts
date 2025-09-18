import { EventEmitter } from 'events';
import { SlotStormLottery } from './slot-storm-lottery.js';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

interface TokenHolder {
  address: string;
  balance: number;
  uiAmount: number;
}

interface CreatorFeeData {
  totalFees: number;
  availableFees: number; // Dev's share ready for claiming
  devWallet: string;
  totalDevShare: number;
  totalLotteryShare: number;
  lastClaimed: number;
  accumulatedFees: number; // Unclaimed fees below threshold
  totalVolumeUSD: number; // Track total volume for analytics
  lastCreatorFeesCheck?: number; // Track when we last checked for available creator fees
}

interface Winner {
  address: string;
  amount: number;
  timestamp: number;
  winType: 'slot' | 'lightning';
  txHash?: string;
}

export class SlotStormService extends EventEmitter {
  private tokenMint: string;
  private heliusRpcUrl: string;
  private connection: Connection;
  private lottery: SlotStormLottery;
  private holders: TokenHolder[] = [];
  private winners: Winner[] = [];
  private creatorFees: CreatorFeeData = {
    totalFees: 0,
    availableFees: 0,
    devWallet: 'BKivcgVMdprDPZ6M96Jz4f5ErvyZpRGuTb5Un4UUuWux',
    totalDevShare: 0,
    totalLotteryShare: 0,
    lastClaimed: 0,
    accumulatedFees: 0,
    totalVolumeUSD: 0
  };
  private fetchInterval: NodeJS.Timeout | null = null;
  private feeCheckInterval: NodeJS.Timeout | null = null;

  constructor(tokenMint: string = '9zFdsBhgqWd6WRoqVfcMd5bZJdgwmkiMd1ch7UfGpump') {
    super();
    this.tokenMint = tokenMint;
    this.heliusRpcUrl = 'https://mainnet.helius-rpc.com/?api-key=d8d8052a-72db-4652-8942-9ae97f24cdec';
    this.connection = new Connection(this.heliusRpcUrl, 'confirmed');

    // Initialize lottery for this specific token
    this.lottery = new SlotStormLottery(this.tokenMint);

    this.setupLotteryListeners();
    console.log(`🎰 SlotStorm service initialized for token: ${this.tokenMint}`);
  }

  private setupLotteryListeners(): void {
    this.lottery.on('slot-result', (result) => {
      console.log(`🎰 SlotStorm Draw Complete: ${result.symbols.join(' - ')}`);

      // If there's a winner, track it
      if (result.winner && result.prize > 0) {
        console.log(`🏆 SlotStorm Winner: ${result.winner} won ${result.prize} SOL`);
        this.addWinner({
          address: result.winner,
          amount: result.prize,
          timestamp: result.timestamp,
          winType: 'slot'
        });
        this.emit('winner-announced', {
          tokenMint: this.tokenMint,
          address: result.winner,
          prize: result.prize,
          winType: result.winType,
          symbols: result.symbols
        });
      }

      this.emit('slot-completed', {
        tokenMint: this.tokenMint,
        ...result
      });
    });

    this.lottery.on('lightning-strike', (strike) => {
      console.log(`⚡ Lightning Strike Winner: ${strike.winner} won ${strike.prize} SOL`);
      this.addWinner({
        address: strike.winner,
        amount: strike.prize,
        timestamp: strike.timestamp,
        winType: 'lightning'
      });
      this.emit('lightning-strike', {
        tokenMint: this.tokenMint,
        ...strike
      });
    });

    this.lottery.on('weather-changed', (weather) => {
      console.log(`🌤️ SlotStorm Weather: ${weather.type} (${weather.multiplier}x multiplier)`);
      this.emit('weather-changed', {
        tokenMint: this.tokenMint,
        ...weather
      });
    });

    // New reward distribution event listeners
    this.lottery.on('reward-pending', async (reward) => {
      console.log(`💸 Reward pending distribution: ${reward.amount} SOL to ${reward.winner}`);
      this.emit('reward-pending', {
        tokenMint: this.tokenMint,
        ...reward
      });

      // Automatically attempt to distribute the reward
      await this.distributeReward(reward);
    });

    this.lottery.on('reward-confirmed', (reward) => {
      console.log(`✅ Reward confirmed: ${reward.amount} SOL to ${reward.winner} - TX: ${reward.txHash}`);
      this.emit('reward-confirmed', {
        tokenMint: this.tokenMint,
        ...reward
      });
    });

    this.lottery.on('reward-failed', (reward) => {
      console.log(`❌ Reward failed: ${reward.amount} SOL to ${reward.winner}`);
      this.emit('reward-failed', {
        tokenMint: this.tokenMint,
        ...reward
      });
    });

    this.lottery.on('actual-amount-set', (data) => {
      console.log(`✅ Actual claimed amount set for distribution: ${data.amount} SOL`);
      this.emit('actual-amount-set', {
        tokenMint: this.tokenMint,
        ...data
      });
    });
  }

  async start(): Promise<void> {
    try {
      console.log(`🚀 Starting SlotStorm for ${this.tokenMint}`);

      // Initial data fetch
      await this.fetchTokenHolders();

      // Prize pool starts at zero - only real trading fees will be added
      console.log(`💰 Prize pool initialized at 0 SOL - waiting for trading fees`);

      await this.checkCreatorFees();

      // Start lottery
      this.lottery.start();

      // Set up periodic updates
      this.fetchInterval = setInterval(() => {
        this.fetchTokenHolders();
      }, 60000); // Update holders every minute

      this.feeCheckInterval = setInterval(() => {
        console.log(`🔄 Checking creator fees... (every 5 minutes)`);
        this.checkCreatorFees();
      }, 300000); // Check fees every 5 minutes to match volume data

      console.log(`✅ SlotStorm started with ${this.holders.length} token holders`);
    } catch (error) {
      console.error('❌ Failed to start SlotStorm:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping SlotStorm...');

    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
      this.fetchInterval = null;
    }

    if (this.feeCheckInterval) {
      clearInterval(this.feeCheckInterval);
      this.feeCheckInterval = null;
    }

    this.lottery.stop();
    console.log('✅ SlotStorm stopped');
  }

  private async fetchTokenHolders(): Promise<void> {
    try {
      console.log(`🔍 Fetching holders for ${this.tokenMint}...`);

      const response = await fetch(this.heliusRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'helius-test',
          method: 'getTokenAccounts',
          params: {
            page: 1,
            limit: 1000,
            displayOptions: {
              showZeroBalance: false,
            },
            mint: this.tokenMint,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      const tokenAccounts = data.result?.token_accounts || [];

      // Addresses to exclude from holders
      const POOL_ADDRESS = 'DoZfhQgZDrJz16wqFa48WQHRiqpV645LSrgkajEcnH5B';
      const DEV_WALLET = 'DQMwHbduxUEEW4MPJWF6PbLhcPJBiLm5XTie4pwUPbuV';
      const LIQUIDITY_POOL_WALLET = '7pF17VmV73mFFYvEpyHSE1LrxYF8qt52SuPU6hdeqkqS';

      this.holders = tokenAccounts.map((account: any) => ({
        address: account.owner,
        balance: parseInt(account.amount),
        uiAmount: parseFloat(account.amount) / Math.pow(10, account.decimals || 9)
      })).filter((holder: TokenHolder) =>
        holder.balance > 0 &&
        holder.address !== POOL_ADDRESS &&
        holder.address !== DEV_WALLET &&
        holder.address !== LIQUIDITY_POOL_WALLET
      );

      // Sort by balance (largest holders first)
      this.holders.sort((a, b) => b.balance - a.balance);

      console.log(`✅ Found ${this.holders.length} token holders`);
      console.log(`📊 Top holder: ${this.holders[0]?.address} with ${this.holders[0]?.uiAmount.toFixed(2)} tokens`);

      // Update lottery with current holders
      this.updateLotteryHolders();

    } catch (error) {
      console.error('❌ Failed to fetch token holders:', error);
    }
  }

  private updateLotteryHolders(): void {
    const lotteryHolders = this.holders.map(holder => ({
      wallet: holder.address,
      balance: holder.uiAmount,
      holdDuration: 0, // Remove hold duration logic to avoid RPC consumption
      tickets: Math.max(1, Math.floor(holder.uiAmount / 1000)) // Simple linear scaling: 1 ticket per 1000 tokens
    }));

    this.lottery.updateHolders(lotteryHolders);
    console.log(`🎟️ Updated lottery with ${lotteryHolders.length} participants`);
  }

  private async checkCreatorFees(): Promise<void> {
    try {
      // Check and automatically claim creator fees when available
      console.log(`🔍 Checking actual creator fees available for ${this.tokenMint}...`);

      const creatorWallet = process.env.CREATOR_WALLET_PUBLIC_KEY;
      const privateKey = process.env.CREATOR_WALLET_PRIVATE_KEY;

      if (!creatorWallet || !privateKey) {
        console.log(`⚠️ No creator wallet configured - skipping fee check`);
        console.log(`🎰 Lottery continues with existing prize pool: ${this.lottery.getPrizePool().toFixed(6)} SOL`);
        return;
      }

      // Try to automatically claim creator fees (always attempt the claim to get accurate result)
      try {
        const lastCheck = this.creatorFees.lastCreatorFeesCheck || 0;
        const now = Date.now();

        if (now - lastCheck > 300000) { // Only claim every 5 minutes to avoid spam
          console.log(`🔍 Attempting to claim creator fees for ${this.tokenMint}...`);

          // Directly attempt to claim - this will tell us if fees were actually available
          const claimResult = await this.claimRealCreatorFees(creatorWallet, privateKey);

          if (claimResult.success && claimResult.claimedAmount && claimResult.claimedAmount > 0) {
            console.log(`💰 Creator fees available for ${this.tokenMint} - claiming automatically...`);
            console.log(`✅ Successfully auto-claimed ${claimResult.claimedAmount} SOL creator fees!`);
            console.log(`🎰 Prize pool updated to ${this.lottery.getPrizePool().toFixed(6)} SOL`);
            this.creatorFees.lastCreatorFeesCheck = now;

            this.emit('fees-updated', {
              tokenMint: this.tokenMint,
              newFees: claimResult.claimedAmount,
              totalPrizePool: this.lottery.getPrizePool(),
              wasAutoClaimed: true
            });
          } else {
            console.log(`📊 No creator fees currently available for ${this.tokenMint}`);
            // Reset prize pool to 0 when no creator fees are available
            this.lottery.resetPrizePool();
          }
        } else {
          console.log(`📊 No creator fees currently available for ${this.tokenMint}`);
          // Reset prize pool to 0 when no creator fees are available
          this.lottery.resetPrizePool();
        }
      } catch (feeCheckError) {
        // Fee check failed - probably no fees available
        console.log(`📊 No creator fees available for ${this.tokenMint} (${feeCheckError.message})`);
        // Reset prize pool to 0 when no creator fees are available
        this.lottery.resetPrizePool();
      }

      console.log(`🎰 Lottery continues with prize pool: ${this.lottery.getPrizePool().toFixed(6)} SOL`);

    } catch (error) {
      console.error('❌ Failed to check creator fees:', error);
      console.log(`🔄 Creator fee check error - no fees processed this round`);
      console.log(`🎰 Lottery continues with existing prize pool: ${this.lottery.getPrizePool().toFixed(6)} SOL`);
    }
  }

  // Real creator fee claiming via PumpPortal
  async claimRealCreatorFees(creatorWallet: string, privateKey?: string): Promise<{ success: boolean, txSignature?: string, claimedAmount?: number, error?: string }> {
    try {
      console.log(`🔄 Attempting to claim real creator fees for wallet: ${creatorWallet}`);

      if (!privateKey) {
        return {
          success: false,
          error: 'Private key is required for transaction signing'
        };
      }

      // Import required Solana packages
      const { VersionedTransaction, Connection, Keypair } = await import('@solana/web3.js');
      const bs58 = await import('bs58');

      // Setup connection to Solana
      const connection = new Connection(
        process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      // Use PumpPortal trade-local API to get the transaction
      const response = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          publicKey: creatorWallet,
          action: "collectCreatorFee",
          priorityFee: 0.000001
        })
      });

      if (response.status !== 200) {
        const errorText = await response.text();
        console.error('❌ PumpPortal API error:', response.status, errorText);
        return {
          success: false,
          error: `PumpPortal API error: ${response.status} - ${errorText}`
        };
      }

      // Get the binary transaction data
      const data = await response.arrayBuffer();
      console.log(`📦 Received transaction data: ${data.byteLength} bytes`);

      // Deserialize the transaction
      const tx = VersionedTransaction.deserialize(new Uint8Array(data));
      console.log('🔓 Transaction deserialized successfully');

      // Create keypair and check balance before transaction
      const keypair = Keypair.fromSecretKey(bs58.default.decode(privateKey));
      const balanceBefore = await connection.getBalance(keypair.publicKey);

      // Sign the transaction with the creator's private key
      tx.sign([keypair]);
      console.log('✍️ Transaction signed');

      // Send the transaction
      const signature = await connection.sendTransaction(tx);
      console.log(`🎉 Creator fees claimed successfully! TX: ${signature}`);

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`✅ Transaction confirmed: https://solscan.io/tx/${signature}`);

      // Get the actual claimed amount by checking wallet balance change
      const balanceAfter = await connection.getBalance(keypair.publicKey);
      const claimedAmount = (balanceAfter - balanceBefore) / 1000000000; // Convert lamports to SOL

      console.log(`💰 Balance before: ${(balanceBefore / 1000000000).toFixed(6)} SOL`);
      console.log(`💰 Balance after: ${(balanceAfter / 1000000000).toFixed(6)} SOL`);
      console.log(`💰 Actual claimed amount: ${claimedAmount.toFixed(6)} SOL`);

      // Only update lottery if we actually claimed something
      if (claimedAmount > 0) {
        this.lottery.setActualClaimedAmount(claimedAmount);
      }

      // Mark fees as claimed in our tracking
      this.markDevFeesClaimed();

      return {
        success: true,
        txSignature: signature,
        claimedAmount
      };

    } catch (error) {
      console.error('❌ Error claiming real creator fees:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Public API methods
  getTokenMint(): string {
    return this.tokenMint;
  }

  getHolders(): TokenHolder[] {
    return [...this.holders];
  }

  getTopHolders(limit: number = 20): TokenHolder[] {
    return this.holders.slice(0, limit);
  }

  getLotteryData() {
    const lotteryHolders = this.lottery.getHolders();
    const totalTickets = lotteryHolders.reduce((sum, holder) => sum + holder.tickets, 0);

    return {
      tokenMint: this.tokenMint,
      prizePool: this.lottery.getPrizePool(),
      weather: this.lottery.getCurrentWeather(),
      holderCount: this.holders.length,
      nextSlotTime: this.lottery.getNextSlotTime(),
      participants: lotteryHolders.map(holder => ({
        address: holder.wallet,
        balance: holder.balance,
        tickets: holder.tickets,
        holdDuration: holder.holdDuration,
        winChance: totalTickets > 0 ? (holder.tickets / totalTickets * 100) : 0
      })),
      isActive: true
    };
  }

  getCreatorFees(): CreatorFeeData {
    return { ...this.creatorFees };
  }

  markDevFeesClaimed(): { claimedAmount: number; remainingFees: number; devWallet: string } {
    const claimedAmount = this.creatorFees.availableFees;
    this.creatorFees.availableFees = 0;
    this.creatorFees.lastClaimed = Date.now();

    console.log(`✅ Dev fees claimed: ${claimedAmount.toFixed(6)} SOL to ${this.creatorFees.devWallet}`);

    return {
      claimedAmount,
      remainingFees: this.creatorFees.availableFees,
      devWallet: this.creatorFees.devWallet
    };
  }

  getStats() {
    const totalTokens = this.holders.reduce((sum, holder) => sum + holder.uiAmount, 0);
    const averageHolding = totalTokens / this.holders.length;

    return {
      tokenMint: this.tokenMint,
      totalHolders: this.holders.length,
      totalTokensHeld: totalTokens,
      averageHolding,
      prizePool: this.lottery.getPrizePool(),
      totalFeesCollected: this.creatorFees.totalFees,
      nextDrawTime: this.lottery.getNextSlotTime(),
      currentWeather: this.lottery.getCurrentWeather()
    };
  }

  // Force lottery draw (for testing)
  async forceDraw() {
    return this.lottery.spinSlot();
  }

  // Winner management methods
  private addWinner(winner: Winner): void {
    this.winners.unshift(winner); // Add to beginning for newest first

    // Keep only last 50 winners to prevent memory bloat
    if (this.winners.length > 50) {
      this.winners = this.winners.slice(0, 50);
    }

    console.log(`📈 Total winners tracked: ${this.winners.length}`);
  }

  getWinners(limit: number = 20): Winner[] {
    return this.winners.slice(0, limit);
  }

  getWinnerStats() {
    const totalWinnings = this.winners.reduce((sum, winner) => sum + winner.amount, 0);
    const slotWinnings = this.winners.filter(w => w.winType === 'slot').reduce((sum, w) => sum + w.amount, 0);
    const lightningWinnings = this.winners.filter(w => w.winType === 'lightning').reduce((sum, w) => sum + w.amount, 0);

    return {
      totalWinners: this.winners.length,
      totalWinnings,
      slotWinnings,
      lightningWinnings,
      lastWinner: this.winners[0] || null
    };
  }

  // New reward distribution management methods

  setActualClaimedAmount(amount: number): void {
    this.lottery.setActualClaimedAmount(amount);
    console.log(`✅ Set actual claimed amount: ${amount} SOL - lottery can now distribute rewards`);
  }

  confirmRewardTransaction(rewardId: string, txHash: string): boolean {
    return this.lottery.confirmRewardTransaction(rewardId, txHash);
  }

  failRewardTransaction(rewardId: string, error: string): boolean {
    return this.lottery.failRewardTransaction(rewardId, error);
  }

  retryFailedReward(rewardId: string): boolean {
    return this.lottery.retryFailedReward(rewardId);
  }

  getPendingRewards() {
    return this.lottery.getPendingRewards();
  }

  canStartRounds() {
    return this.lottery.canStartRounds();
  }

  getRewardDistributionStatus() {
    return {
      canStartNewRounds: this.lottery.canStartRounds(),
      estimatedPrizePool: this.lottery.getEstimatedPrizePool(),
      actualClaimedAmount: this.lottery.getActualClaimedAmount(),
      pendingRewards: this.lottery.getPendingRewards(),
      nextSlotTime: this.lottery.getNextSlotTime() // Returns -1 if paused
    };
  }

  // Automatically distribute SOL rewards to winners
  private async distributeReward(reward: any): Promise<void> {
    try {
      const rewardId = `${reward.timestamp}-${reward.winner.slice(0, 8)}`;
      console.log(`🎯 Attempting to distribute ${reward.amount} SOL to ${reward.winner}...`);

      // Get creator wallet credentials from environment
      const creatorWalletPublicKey = process.env.CREATOR_WALLET_PUBLIC_KEY;
      const creatorWalletPrivateKey = process.env.CREATOR_WALLET_PRIVATE_KEY;

      if (!creatorWalletPublicKey || !creatorWalletPrivateKey) {
        console.error('❌ Creator wallet credentials not found in environment variables');
        this.lottery.failRewardTransaction(rewardId, 'Creator wallet credentials not configured');
        return;
      }

      // Create sender keypair from private key
      const senderKeypair = Keypair.fromSecretKey(bs58.decode(creatorWalletPrivateKey));

      // Create receiver public key
      const receiverPubkey = new PublicKey(reward.winner);

      // Convert SOL amount to lamports
      const lamports = Math.floor(reward.amount * LAMPORTS_PER_SOL);

      console.log(`💰 Sending ${lamports} lamports (${reward.amount} SOL) from ${senderKeypair.publicKey.toString()} to ${receiverPubkey.toString()}`);

      // Create the transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: receiverPubkey,
          lamports: lamports,
        }),
      );

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = senderKeypair.publicKey;

      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [senderKeypair],
        {
          commitment: 'confirmed',
          maxRetries: 3
        }
      );

      console.log(`✅ Reward distributed successfully! TX: ${signature}`);
      console.log(`🔗 View transaction: https://solscan.io/tx/${signature}`);

      // Mark the reward as confirmed in the lottery system
      this.lottery.confirmRewardTransaction(rewardId, signature);

      // Deduct the amount from the prize pool since it was successfully distributed
      const currentPrizePool = this.lottery.getPrizePool();
      const newPrizePool = Math.max(0, currentPrizePool - reward.amount);

      // Update the actual prize pool after successful distribution
      this.lottery.addToPrizePool(-reward.amount); // Subtract the distributed amount

      console.log(`💰 Prize pool updated: ${currentPrizePool.toFixed(6)} → ${newPrizePool.toFixed(6)} SOL`);

    } catch (error) {
      const rewardId = `${reward.timestamp}-${reward.winner.slice(0, 8)}`;
      console.error(`❌ Failed to distribute reward to ${reward.winner}:`, error);

      // Mark the reward as failed
      this.lottery.failRewardTransaction(rewardId, error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

export default SlotStormService;