import { EventEmitter } from 'events';
import { SlotStormLottery } from './slot-storm-lottery.js';

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
}

export class SlotStormService extends EventEmitter {
  private tokenMint: string;
  private heliusRpcUrl: string;
  private lottery: SlotStormLottery;
  private holders: TokenHolder[] = [];
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

    // Initialize lottery for this specific token
    this.lottery = new SlotStormLottery(this.tokenMint);

    this.setupLotteryListeners();
    console.log(`🎰 SlotStorm service initialized for token: ${this.tokenMint}`);
  }

  private setupLotteryListeners(): void {
    this.lottery.on('winner-announced', (winner) => {
      console.log(`🏆 SlotStorm Winner: ${winner.address} won ${winner.prize} SOL`);
      this.emit('winner-announced', {
        tokenMint: this.tokenMint,
        ...winner
      });
    });

    this.lottery.on('weather-changed', (weather) => {
      console.log(`🌤️ SlotStorm Weather: ${weather.type} (${weather.multiplier}x multiplier)`);
      this.emit('weather-changed', {
        tokenMint: this.tokenMint,
        ...weather
      });
    });

    this.lottery.on('slot-completed', (result) => {
      console.log(`🎰 SlotStorm Draw Complete: ${result.symbols.join(' - ')}`);
      this.emit('slot-completed', {
        tokenMint: this.tokenMint,
        ...result
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

      // Pool address to exclude from holders
      const POOL_ADDRESS = 'DoZfhQgZDrJz16wqFa48WQHRiqpV645LSrgkajEcnH5B';

      this.holders = tokenAccounts.map((account: any) => ({
        address: account.owner,
        balance: parseInt(account.amount),
        uiAmount: parseFloat(account.amount) / Math.pow(10, account.decimals || 9)
      })).filter((holder: TokenHolder) =>
        holder.balance > 0 &&
        holder.address !== POOL_ADDRESS
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
      holdDuration: Math.floor(Math.random() * 1440) + 60, // Random 1-24 hours for now
      tickets: Math.floor(Math.sqrt(holder.uiAmount / 1000)) + 1 // Square root scaling for fairer distribution
    }));

    this.lottery.updateHolders(lotteryHolders);
    console.log(`🎟️ Updated lottery with ${lotteryHolders.length} participants`);
  }

  private async checkCreatorFees(): Promise<void> {
    try {
      // Get real trading volume from DexScreener API
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${this.tokenMint}`);

      if (!dexResponse.ok) {
        throw new Error('DexScreener API not available');
      }

      const dexData = await dexResponse.json();
      const pairs = dexData.pairs || [];

      // Find the main SOL pair (highest volume)
      const mainPair = pairs.find((pair: any) =>
        pair.quoteToken?.symbol === 'SOL' || pair.quoteToken?.symbol === 'WSOL'
      ) || pairs[0]; // Fallback to first pair if no SOL pair

      if (!mainPair) {
        console.log(`⚠️ Token ${this.tokenMint} not found on DexScreener`);
        console.log(`📈 No trading pairs found - no fees to process`);
        console.log(`🎰 Lottery continues with existing prize pool`);
        return;
      }

      // Get 5-minute volume data from DexScreener (perfect for 5-minute fee checks)
      const volume5mUSD = parseFloat(mainPair.volume?.m5 || '0');
      const currentPriceUSD = parseFloat(mainPair.priceUsd || '0');

      console.log(`🔍 DexScreener pair: ${mainPair.pairAddress}`);
      console.log(`💹 Price: $${currentPriceUSD.toFixed(8)}, 5min Vol: $${volume5mUSD.toFixed(2)}`);

      // Update total volume tracking
      this.creatorFees.totalVolumeUSD += volume5mUSD;

      if (volume5mUSD > 0) {
        // Convert USD volume to SOL (approximate rate: 1 SOL = $150)
        const solPrice = 150; // Simplified conversion rate
        const volume5mSOL = volume5mUSD / solPrice;

        // Calculate creator fees based on PumpFun fee structure
        // PumpFun charges 1% on each trade, and we're looking at 5-minute volume
        const fees5m = volume5mSOL * 0.01;

        // Minimum threshold for fee claiming: $15 volume (~0.001 SOL fees)
        // This covers PumpPortal 1% fee + bonding curve fees + transaction costs
        const MINIMUM_VOLUME_THRESHOLD = 15; // $15 USD

        if (volume5mUSD >= MINIMUM_VOLUME_THRESHOLD) {
          // Volume above threshold - process real fees
          console.log(`💰 Real creator fees from DexScreener: ${fees5m.toFixed(6)} SOL`);
          console.log(`📊 Volume above $${MINIMUM_VOLUME_THRESHOLD} threshold - processing real fees`);
          console.log(`💵 5min Vol: $${volume5mUSD.toFixed(2)} (~${volume5mSOL.toFixed(6)} SOL)`);

          // Add any accumulated fees to this batch
          const totalFeesToProcess = fees5m + this.creatorFees.accumulatedFees;
          console.log(`📈 Including ${this.creatorFees.accumulatedFees.toFixed(6)} SOL accumulated fees`);

          // Split total fees: 50% to dev wallet, 50% to lottery prize pool
          const devShare = totalFeesToProcess * 0.5;
          const lotteryShare = totalFeesToProcess * 0.5;

          // Add lottery share to prize pool
          this.lottery.addToPrizePool(lotteryShare);

          // Update fee tracking
          this.creatorFees.totalFees += totalFeesToProcess;
          this.creatorFees.availableFees += devShare; // Dev's share ready for claiming
          this.creatorFees.totalDevShare += devShare;
          this.creatorFees.totalLotteryShare += lotteryShare;
          this.creatorFees.accumulatedFees = 0; // Reset accumulated fees
          this.creatorFees.lastClaimed = Date.now();

          console.log(`👨‍💻 Dev share: ${devShare.toFixed(6)} SOL (to ${this.creatorFees.devWallet})`);
          console.log(`🎰 Lottery share: ${lotteryShare.toFixed(6)} SOL added to prize pool (Total: ${this.lottery.getPrizePool().toFixed(6)})`);

          this.emit('fees-updated', {
            tokenMint: this.tokenMint,
            newFees: totalFeesToProcess,
            devShare,
            lotteryShare,
            totalPrizePool: this.lottery.getPrizePool(),
            volume5mUSD,
            pairAddress: mainPair.pairAddress,
            wasAccumulated: this.creatorFees.accumulatedFees > 0
          });

        } else if (fees5m > 0.00001) {
          // Volume below threshold but meaningful - accumulate for later
          this.creatorFees.accumulatedFees += fees5m;
          console.log(`📊 Volume below $${MINIMUM_VOLUME_THRESHOLD} threshold - accumulating fees`);
          console.log(`💵 5min Vol: $${volume5mUSD.toFixed(2)} - fees: ${fees5m.toFixed(6)} SOL`);
          console.log(`🏦 Accumulated fees: ${this.creatorFees.accumulatedFees.toFixed(6)} SOL`);
          console.log(`⏳ Waiting for higher volume to claim accumulated fees`);

        } else {
          console.log(`📊 Very low 5min volume: $${volume5mUSD.toFixed(2)} - no fees to process`);
        }
      } else {
        // No trading volume - no fake fees added
        console.log(`📈 No 5min volume detected - no fees to process`);
        console.log(`🎰 Lottery continues with existing prize pool`);
      }

    } catch (error) {
      console.error('❌ Failed to check creator fees:', error);
      console.log(`🔄 DexScreener API error - no fees processed this round`);
      console.log(`🎰 Lottery continues with existing prize pool`);
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
}

export default SlotStormService;