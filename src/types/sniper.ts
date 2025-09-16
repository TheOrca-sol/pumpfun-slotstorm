export interface TokenAlert {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  description?: string;
  image?: string;
  creator: string;
  timestamp: number;
  score: number;
  triggers: AlertTrigger[];
  metadata: TokenMetadata;
  firstTradeTime?: number;
  isActive: boolean;
}

export interface AlertTrigger {
  type: 'viral_keyword' | 'whale_buy' | 'volume_spike' | 'smart_money' | 'dev_activity';
  reason: string;
  confidence: number;
  data?: any;
}

export interface TokenMetadata {
  hasWebsite?: boolean;
  hasTwitter?: boolean;
  hasTelegram?: boolean;
  marketCap?: number;
  liquidity?: number;
  holderCount?: number;
  creatorRep?: number;
  bondingCurveProgress?: number;
}

export interface WhaleWallet {
  address: string;
  nickname?: string;
  successRate: number;
  totalTrades: number;
  avgProfitPercent: number;
  recentActivity: WhaleTrade[];
  isTracked: boolean;
  addedAt: number;
}

export interface WhaleTrade {
  mint: string;
  symbol?: string;
  tradeType: 'buy' | 'sell';
  amount: number;
  timestamp: number;
  profitLoss?: number;
  profitPercent?: number;
}

export interface SniperConfig {
  viralKeywords: {
    high: string[];    // 10x multiplier
    medium: string[];  // 5x multiplier
    low: string[];     // 2x multiplier
  };
  volumeThresholds: {
    minTradesPerMinute: number;
    minSolVolume: number;
    spikeMultiplier: number;
  };
  whaleThresholds: {
    minTradeAmount: number;
    minSuccessRate: number;
    maxWallets: number;
  };
  alertSettings: {
    minScore: number;
    maxAlertsPerMinute: number;
    cooldownMinutes: number;
  };
}

export interface VolumeSpike {
  mint: string;
  currentVolume: number;
  previousVolume: number;
  spikeRatio: number;
  timestamp: number;
  trades: {
    buys: number;
    sells: number;
    uniqueBuyers: number;
  };
}

export interface SmartMoneyWallet {
  address: string;
  reputation: number;
  recentWins: number;
  totalTrades: number;
  avgHoldTime: number;
  preferredCategories: string[];
  lastActive: number;
}