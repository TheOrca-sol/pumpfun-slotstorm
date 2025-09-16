export interface LiveStream {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  creator: string;
  createdTimestamp: number;
  viewerCount?: number;
  roomId?: string;
  livekitUrl?: string;
  chatChannelId?: string;
}

export interface TradeEvent {
  signature: string;
  mint: string;
  tradeType: 'buy' | 'sell';
  user: string;
  timestamp: number;
  solAmount: number;
  tokenAmount: number;
  newMarketCap?: number;
  bondingCurveProgress?: number;
}

export interface ViewerMetrics {
  mint: string;
  timestamp: number;
  viewerCount: number;
  chatMessagesPerMinute: number;
  reactionsPerMinute: number;
  followEvents: number;
}

export interface BondingCurveData {
  mint: string;
  progress: number;
  marketCap: number;
  liquidity: number;
  graduated: boolean;
  graduatedAt?: number;
}

export interface StreamAnalytics {
  mint: string;
  viewerToBuyerConversion: number;
  avgViewersLast5Min: number;
  buysPerMinute: number;
  sellsPerMinute: number;
  netBuyPressure: number;
  gradProbabilityScore: number;
  whaleInfluence: number;
}

export interface Alert {
  id: string;
  mint: string;
  type: 'viewer_spike' | 'buy_spike' | 'grad_imminent' | 'whale_entry';
  message: string;
  timestamp: number;
  metadata: Record<string, any>;
}