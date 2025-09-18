import { EventEmitter } from 'events';

export interface SlotResult {
  symbols: string[];
  winner: string | null;
  prize: number;
  multiplier: number;
  timestamp: number;
  winType: 'small' | 'medium' | 'large' | 'jackpot' | 'none';
}

export interface WeatherEvent {
  type: 'sunny' | 'rainy' | 'storm' | 'lightning';
  multiplier: number;
  duration: number;
  startTime: number;
}

export interface Holder {
  wallet: string;
  balance: number;
  holdDuration: number; // in minutes
  tickets: number;
}

export interface PendingReward {
  winner: string;
  amount: number;
  winType: 'slot' | 'lightning';
  txHash?: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export class SlotStormLottery extends EventEmitter {
  private holders: Map<string, Holder> = new Map();
  private currentWeather: WeatherEvent;
  private prizePool: number = 0;
  private estimatedPrizePool: number = 0; // Volume-based estimate
  private actualClaimedAmount: number = 0; // Real claimed amount for distribution
  private isRunning: boolean = false;
  private canStartNewRound: boolean = true; // New: Controls countdown start
  private hasNewCreatorFees: boolean = false; // Track if new creator fees have been added since last draw
  private slotInterval: NodeJS.Timeout | null = null;
  private weatherInterval: NodeJS.Timeout | null = null;
  private lightningInterval: NodeJS.Timeout | null = null;
  private pendingRewards: PendingReward[] = []; // Track pending transactions

  // Slot symbols with different rarities
  private readonly symbols = {
    common: ['🍎', '🍊', '🍇', '🍒'],
    rare: ['💎', '⭐', '🔥', '⚡'],
    legendary: ['👑', '🏆', '💰', '🎰']
  };

  constructor(private tokenMint: string) {
    super();
    this.currentWeather = {
      type: 'sunny',
      multiplier: 1,
      duration: 300000, // 5 minutes
      startTime: Date.now()
    };
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log(`🎰 Starting SOL Slot Storm for token ${this.tokenMint}`);

    // Check if we can start new rounds (no pending rewards)
    this.checkPendingRewards();

    // Main slot machine - runs every 5 minutes, but only if canStartNewRound is true
    this.slotInterval = setInterval(() => {
      if (this.canStartNewRound) {
        this.spinSlots();
      } else {
        console.log(`⏸️ Slot round paused - waiting for reward distribution confirmation`);
        this.checkPendingRewards(); // Re-check pending rewards
      }
    }, 300000); // 5 minutes

    // Weather changes - every 10-30 minutes
    this.weatherInterval = setInterval(() => {
      this.changeWeather();
    }, this.getRandomInterval(600000, 1800000)); // 10-30 minutes

    // Lightning strikes - random between slot spins
    this.scheduleLightningStrike();

    this.emit('lottery-started', { tokenMint: this.tokenMint });
  }

  stop(): void {
    this.isRunning = false;
    if (this.slotInterval) clearInterval(this.slotInterval);
    if (this.weatherInterval) clearInterval(this.weatherInterval);
    if (this.lightningInterval) clearTimeout(this.lightningInterval);

    console.log(`🛑 Stopped SOL Slot Storm for token ${this.tokenMint}`);
    this.emit('lottery-stopped', { tokenMint: this.tokenMint });
  }

  updateHolders(holders: Holder[]): void {
    this.holders.clear();
    holders.forEach(holder => {
      // Calculate tickets based on holdings only (removed hold duration to avoid RPC consumption)
      const baseTickets = Math.floor(holder.balance / 1000); // 1 ticket per 1000 tokens
      const totalTickets = Math.max(1, baseTickets);

      this.holders.set(holder.wallet, {
        ...holder,
        tickets: totalTickets
      });
    });

    console.log(`📊 Updated ${holders.length} holders for ${this.tokenMint}`);
  }

  addToPrizePool(amount: number): void {
    this.prizePool += amount;
    this.emit('prize-pool-updated', {
      tokenMint: this.tokenMint,
      prizePool: this.prizePool
    });
  }

  private async spinSlots(): Promise<void> {
    if (this.holders.size === 0) {
      console.log('🎰 No holders for slot spin');
      return;
    }

    // Check if new creator fees have been added since last draw
    if (!this.hasNewCreatorFees && this.prizePool > 0) {
      console.log('🚫 No new creator fees claimed since last draw - skipping this round');
      console.log(`💰 Existing balance: ${this.prizePool.toFixed(6)} SOL (not eligible for distribution)`);
      return;
    }

    if (this.prizePool <= 0) {
      console.log('🎰 No prize pool available for slot spin');
      return;
    }

    console.log(`🎰 Spinning slots for ${this.tokenMint}! Weather: ${this.currentWeather.type}`);

    // Generate slot symbols
    const symbols = this.generateSlotSymbols();

    // Determine if it's a win and what type
    const winResult = this.evaluateSlotResult(symbols);

    // Select winner if there's a win
    let winner: string | null = null;
    let prize = 0;

    if (winResult.type !== 'none') {
      winner = this.selectWeightedWinner();
      prize = this.calculatePrize(winResult.type, winResult.multiplier);

      if (winner && prize > 0) {
        // Create pending reward instead of immediately awarding
        const rewardId = this.createPendingReward(winner, prize, 'slot');
        console.log(`🎉 WINNER! ${winner} won ${prize} SOL with ${winResult.type} win! (Pending: ${rewardId})`);

        // Don't deduct from prize pool yet - wait for transaction confirmation
        // this.prizePool = Math.max(0, this.prizePool - prize);
      }
    }

    const result: SlotResult = {
      symbols,
      winner,
      prize,
      multiplier: winResult.multiplier * this.currentWeather.multiplier,
      timestamp: Date.now(),
      winType: winResult.type
    };

    // Mark that creator fees have been used for this draw
    this.hasNewCreatorFees = false;
    this.prizePool = 0; // Reset prize pool display since fees have been consumed
    this.actualClaimedAmount = 0; // Reset claimed amount tracking
    console.log(`🎯 Draw completed - new creator fees flag reset (requires fresh fees for next draw)`);

    this.emit('slot-result', result);
  }

  private generateSlotSymbols(): string[] {
    const symbols: string[] = [];

    for (let i = 0; i < 3; i++) {
      const rand = Math.random();
      let symbolPool: string[];

      if (rand < 0.7) {
        symbolPool = this.symbols.common;
      } else if (rand < 0.95) {
        symbolPool = this.symbols.rare;
      } else {
        symbolPool = this.symbols.legendary;
      }

      symbols.push(symbolPool[Math.floor(Math.random() * symbolPool.length)]);
    }

    return symbols;
  }

  private evaluateSlotResult(symbols: string[]): { type: SlotResult['winType'], multiplier: number } {
    // Jackpot - all three legendary symbols match
    if (symbols.every(s => s === symbols[0]) && this.symbols.legendary.includes(symbols[0])) {
      return { type: 'jackpot', multiplier: 50 };
    }

    // Large win - all three symbols match
    if (symbols.every(s => s === symbols[0])) {
      if (this.symbols.rare.includes(symbols[0])) {
        return { type: 'large', multiplier: 10 };
      } else {
        return { type: 'medium', multiplier: 5 };
      }
    }

    // Medium win - two symbols match
    if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
      return { type: 'small', multiplier: 2 };
    }

    // Special combinations
    if (symbols.includes('⚡') && symbols.includes('🔥')) {
      return { type: 'medium', multiplier: 8 };
    }

    return { type: 'none', multiplier: 0 };
  }

  private selectWeightedWinner(): string | null {
    const totalTickets = Array.from(this.holders.values()).reduce((sum, h) => sum + h.tickets, 0);
    if (totalTickets === 0) return null;

    let randomNum = Math.random() * totalTickets;

    for (const [wallet, holder] of this.holders) {
      randomNum -= holder.tickets;
      if (randomNum <= 0) {
        return wallet;
      }
    }

    return null;
  }

  private calculatePrize(winType: SlotResult['winType'], multiplier: number): number {
    const baseAmount = Math.min(this.prizePool * 0.1, 1); // Max 1 SOL or 10% of pool

    let prizeMultiplier = 1;
    switch (winType) {
      case 'small': prizeMultiplier = 0.5; break;
      case 'medium': prizeMultiplier = 1; break;
      case 'large': prizeMultiplier = 3; break;
      case 'jackpot': prizeMultiplier = 10; break;
    }

    return baseAmount * prizeMultiplier * multiplier * this.currentWeather.multiplier;
  }

  private changeWeather(): void {
    const weatherTypes: WeatherEvent['type'][] = ['sunny', 'rainy', 'storm'];
    const rand = Math.random();

    let newWeather: WeatherEvent['type'];
    if (rand < 0.6) {
      newWeather = 'sunny';
    } else if (rand < 0.85) {
      newWeather = 'rainy';
    } else {
      newWeather = 'storm';
    }

    const weatherConfig = {
      sunny: { multiplier: 1, duration: 600000 }, // 10 minutes
      rainy: { multiplier: 1.5, duration: 480000 }, // 8 minutes
      storm: { multiplier: 3, duration: 180000 } // 3 minutes
    };

    this.currentWeather = {
      type: newWeather,
      multiplier: weatherConfig[newWeather].multiplier,
      duration: weatherConfig[newWeather].duration,
      startTime: Date.now()
    };

    console.log(`🌤️ Weather changed to ${newWeather} (${this.currentWeather.multiplier}x multiplier)`);
    this.emit('weather-changed', this.currentWeather);

    // Schedule next weather change
    if (this.weatherInterval) {
      clearInterval(this.weatherInterval);
    }
    this.weatherInterval = setInterval(() => {
      this.changeWeather();
    }, this.getRandomInterval(600000, 1800000));
  }

  private scheduleLightningStrike(): void {
    if (!this.isRunning) return;

    // Random lightning between 30 seconds and 4 minutes
    const delay = this.getRandomInterval(30000, 240000);

    this.lightningInterval = setTimeout(() => {
      this.lightningStrike();
      this.scheduleLightningStrike(); // Schedule next lightning
    }, delay);
  }

  private lightningStrike(): void {
    if (this.holders.size === 0) return;
    if (!this.canStartNewRound) return; // Lightning also waits for pending rewards

    // Check if new creator fees have been added since last draw
    if (!this.hasNewCreatorFees && this.prizePool > 0) {
      console.log('⚡ No new creator fees claimed since last draw - skipping lightning strike');
      console.log(`💰 Existing balance: ${this.prizePool.toFixed(6)} SOL (not eligible for lightning distribution)`);
      return;
    }

    if (this.prizePool <= 0) {
      console.log('⚡ No prize pool available for lightning strike');
      return;
    }

    const winner = this.selectWeightedWinner();
    if (!winner) return;

    const prize = Math.min(this.prizePool * 0.05, 0.5); // Max 0.5 SOL or 5% of pool
    if (prize < 0.01) return; // Minimum 0.01 SOL

    // Create pending reward instead of immediately awarding
    const rewardId = this.createPendingReward(winner, prize, 'lightning');
    console.log(`⚡ LIGHTNING STRIKE! ${winner} won ${prize} SOL! (Pending: ${rewardId})`);

    // Don't deduct from prize pool yet - wait for transaction confirmation
    // this.prizePool = Math.max(0, this.prizePool - prize);

    // Mark that creator fees have been used for this lightning strike
    this.hasNewCreatorFees = false;
    this.prizePool = 0; // Reset prize pool display since fees have been consumed
    this.actualClaimedAmount = 0; // Reset claimed amount tracking
    console.log(`⚡ Lightning strike completed - new creator fees flag reset (requires fresh fees for next draw)`);

    this.emit('lightning-strike', {
      winner,
      prize,
      timestamp: Date.now(),
      rewardId
    });
  }

  private getRandomInterval(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Getters for current state
  getCurrentWeather(): WeatherEvent {
    return this.currentWeather;
  }

  getPrizePool(): number {
    return this.prizePool;
  }

  getHolderCount(): number {
    return this.holders.size;
  }

  getHolders(): Holder[] {
    return Array.from(this.holders.values());
  }

  getNextSlotTime(): number {
    // Calculate next slot time (every 5 minutes) - only if rounds can start
    if (!this.canStartNewRound) {
      return -1; // Indicates countdown is paused
    }
    const now = Date.now();
    const slotInterval = 300000; // 5 minutes
    const nextSlot = Math.ceil(now / slotInterval) * slotInterval;
    return nextSlot;
  }

  // New methods for reward distribution system

  addEstimatedRewards(amount: number): void {
    this.estimatedPrizePool += amount;
    console.log(`💰 Added ${amount} SOL to estimated prize pool (Total estimated: ${this.estimatedPrizePool})`);
  }

  setActualClaimedAmount(amount: number): void {
    this.actualClaimedAmount = amount;
    this.prizePool = amount; // Update actual prize pool with claimed amount
    this.hasNewCreatorFees = true; // Mark that new creator fees have been added
    console.log(`✅ Real claimed amount set: ${amount} SOL - This will be used for distribution`);
    this.emit('actual-amount-set', { amount });
  }

  resetPrizePool(): void {
    this.actualClaimedAmount = 0;
    this.prizePool = 0;
    this.hasNewCreatorFees = false; // No new creator fees available
    console.log(`💰 Prize pool reset to 0 SOL - no creator fees available`);
    this.emit('prize-pool-reset', { prizePool: 0 });
  }

  private checkPendingRewards(): void {
    const pendingCount = this.pendingRewards.filter(r => r.status === 'pending').length;
    const failedCount = this.pendingRewards.filter(r => r.status === 'failed').length;

    if (pendingCount > 0 || failedCount > 0) {
      this.canStartNewRound = false;
      console.log(`🚫 Cannot start new round: ${pendingCount} pending, ${failedCount} failed rewards`);
    } else {
      this.canStartNewRound = true;
      console.log(`✅ All rewards distributed - new rounds can start`);
    }
  }

  createPendingReward(winner: string, amount: number, winType: 'slot' | 'lightning'): string {
    const reward: PendingReward = {
      winner,
      amount,
      winType,
      timestamp: Date.now(),
      status: 'pending'
    };

    this.pendingRewards.push(reward);
    this.canStartNewRound = false; // Stop new rounds until this is confirmed

    console.log(`💸 Created pending reward: ${amount} SOL for ${winner} (${winType})`);
    this.emit('reward-pending', reward);

    return `${reward.timestamp}-${reward.winner.slice(0, 8)}`;
  }

  confirmRewardTransaction(rewardId: string, txHash: string): boolean {
    const reward = this.pendingRewards.find(r =>
      `${r.timestamp}-${r.winner.slice(0, 8)}` === rewardId && r.status === 'pending'
    );

    if (reward) {
      reward.status = 'confirmed';
      reward.txHash = txHash;
      console.log(`✅ Reward confirmed: ${reward.amount} SOL to ${reward.winner} - TX: ${txHash}`);

      this.checkPendingRewards(); // Check if we can start new rounds
      this.emit('reward-confirmed', reward);
      return true;
    }
    return false;
  }

  failRewardTransaction(rewardId: string, error: string): boolean {
    const reward = this.pendingRewards.find(r =>
      `${r.timestamp}-${r.winner.slice(0, 8)}` === rewardId && r.status === 'pending'
    );

    if (reward) {
      reward.status = 'failed';
      console.log(`❌ Reward failed: ${reward.amount} SOL to ${reward.winner} - Error: ${error}`);

      // Failed transactions prevent new rounds until resolved
      this.canStartNewRound = false;
      this.emit('reward-failed', { ...reward, error });
      return true;
    }
    return false;
  }

  retryFailedReward(rewardId: string): boolean {
    const reward = this.pendingRewards.find(r =>
      `${r.timestamp}-${r.winner.slice(0, 8)}` === rewardId && r.status === 'failed'
    );

    if (reward) {
      reward.status = 'pending';
      console.log(`🔄 Retrying failed reward: ${reward.amount} SOL to ${reward.winner}`);
      this.emit('reward-retry', reward);
      return true;
    }
    return false;
  }

  getPendingRewards(): PendingReward[] {
    return [...this.pendingRewards];
  }

  getEstimatedPrizePool(): number {
    return this.estimatedPrizePool;
  }

  getActualClaimedAmount(): number {
    return this.actualClaimedAmount;
  }

  canStartRounds(): boolean {
    return this.canStartNewRound;
  }

  hasNewCreatorFeesAvailable(): boolean {
    return this.hasNewCreatorFees;
  }

  // Override the existing spinSlots method to use the reward system
  async spinSlot(): Promise<any> {
    if (!this.canStartNewRound) {
      console.log(`🚫 Cannot spin - waiting for reward distribution confirmation`);
      return null;
    }

    return this.spinSlots();
  }
}