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

export class SlotStormLottery extends EventEmitter {
  private holders: Map<string, Holder> = new Map();
  private currentWeather: WeatherEvent;
  private prizePool: number = 0;
  private isRunning: boolean = false;
  private slotInterval: NodeJS.Timeout | null = null;
  private weatherInterval: NodeJS.Timeout | null = null;
  private lightningInterval: NodeJS.Timeout | null = null;

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

    // Main slot machine - runs every 5 minutes
    this.slotInterval = setInterval(() => {
      this.spinSlots();
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
      // Calculate tickets based on holdings and loyalty
      const baseTickets = Math.floor(holder.balance / 1000); // 1 ticket per 1000 tokens
      const loyaltyBonus = Math.min(holder.holdDuration / 60, 24) * 0.1; // Max 2.4x for 24h+
      const totalTickets = Math.max(1, Math.floor(baseTickets * (1 + loyaltyBonus)));

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
        this.prizePool = Math.max(0, this.prizePool - prize);
        console.log(`🎉 WINNER! ${winner} won ${prize} SOL with ${winResult.type} win!`);
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

    const winner = this.selectWeightedWinner();
    if (!winner) return;

    const prize = Math.min(this.prizePool * 0.05, 0.5); // Max 0.5 SOL or 5% of pool
    if (prize < 0.01) return; // Minimum 0.01 SOL

    this.prizePool = Math.max(0, this.prizePool - prize);

    console.log(`⚡ LIGHTNING STRIKE! ${winner} won ${prize} SOL!`);

    this.emit('lightning-strike', {
      winner,
      prize,
      timestamp: Date.now()
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
    // Calculate next slot time (every 5 minutes)
    const now = Date.now();
    const slotInterval = 300000; // 5 minutes
    const nextSlot = Math.ceil(now / slotInterval) * slotInterval;
    return nextSlot;
  }
}