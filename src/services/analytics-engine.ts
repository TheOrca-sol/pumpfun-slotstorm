import { EventEmitter } from 'events';
import { TradeEvent, ViewerMetrics, BondingCurveData, StreamAnalytics, Alert } from '../types/index.js';

interface StreamData {
  mint: string;
  viewerMetrics: ViewerMetrics[];
  trades: TradeEvent[];
  bondingCurve?: BondingCurveData;
  chatMetrics: {
    messagesPerMinute: number;
    reactionsPerMinute: number;
    uniqueUsers: Set<string>;
  };
  lastUpdated: number;
}

export class AnalyticsEngine extends EventEmitter {
  private streamData = new Map<string, StreamData>();
  private analysisInterval?: NodeJS.Timeout;
  private readonly ANALYSIS_INTERVAL_MS = 30000; // 30 seconds
  private readonly DATA_RETENTION_MS = 3600000; // 1 hour

  constructor() {
    super();
    this.startAnalysis();
  }

  addViewerMetrics(metrics: ViewerMetrics): void {
    const data = this.getOrCreateStreamData(metrics.mint);
    data.viewerMetrics.push(metrics);
    data.lastUpdated = Date.now();
    this.cleanOldData(data);
  }

  addTrade(trade: TradeEvent): void {
    const data = this.getOrCreateStreamData(trade.mint);
    data.trades.push(trade);
    data.lastUpdated = Date.now();
    this.cleanOldData(data);
  }

  addBondingCurveData(bondingCurve: BondingCurveData): void {
    const data = this.getOrCreateStreamData(bondingCurve.mint);
    data.bondingCurve = bondingCurve;
    data.lastUpdated = Date.now();
  }

  addChatMessage(mint: string, userId: string): void {
    const data = this.getOrCreateStreamData(mint);
    data.chatMetrics.uniqueUsers.add(userId);
    data.chatMetrics.messagesPerMinute++;
    data.lastUpdated = Date.now();
  }

  addChatReaction(mint: string, userId: string): void {
    const data = this.getOrCreateStreamData(mint);
    data.chatMetrics.uniqueUsers.add(userId);
    data.chatMetrics.reactionsPerMinute++;
    data.lastUpdated = Date.now();
  }

  private getOrCreateStreamData(mint: string): StreamData {
    if (!this.streamData.has(mint)) {
      this.streamData.set(mint, {
        mint,
        viewerMetrics: [],
        trades: [],
        chatMetrics: {
          messagesPerMinute: 0,
          reactionsPerMinute: 0,
          uniqueUsers: new Set()
        },
        lastUpdated: Date.now()
      });
    }
    return this.streamData.get(mint)!;
  }

  private cleanOldData(data: StreamData): void {
    const cutoff = Date.now() - this.DATA_RETENTION_MS;

    data.viewerMetrics = data.viewerMetrics.filter(m => m.timestamp > cutoff);
    data.trades = data.trades.filter(t => t.timestamp > cutoff);
  }

  private startAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.performAnalysis();
    }, this.ANALYSIS_INTERVAL_MS);
  }

  private performAnalysis(): void {
    for (const [mint, data] of this.streamData) {
      try {
        const analytics = this.analyzeStream(data);
        this.emit('analytics', analytics);

        // Check for alerts
        const alerts = this.checkForAlerts(data, analytics);
        alerts.forEach(alert => this.emit('alert', alert));

      } catch (error) {
        console.error(`Error analyzing stream ${mint}:`, error);
      }
    }

    // Reset per-minute counters
    this.resetPerMinuteCounters();
  }

  private analyzeStream(data: StreamData): StreamAnalytics {
    const now = Date.now();
    const last5MinCutoff = now - 300000; // 5 minutes
    const last1MinCutoff = now - 60000; // 1 minute

    // Get recent data
    const recentViewerMetrics = data.viewerMetrics.filter(m => m.timestamp > last5MinCutoff);
    const recentTrades = data.trades.filter(t => t.timestamp > last1MinCutoff);
    const recentBuys = recentTrades.filter(t => t.tradeType === 'buy');
    const recentSells = recentTrades.filter(t => t.tradeType === 'sell');

    // Calculate metrics
    const avgViewersLast5Min = recentViewerMetrics.length > 0
      ? recentViewerMetrics.reduce((sum, m) => sum + m.viewerCount, 0) / recentViewerMetrics.length
      : 0;

    const buysPerMinute = recentBuys.length;
    const sellsPerMinute = recentSells.length;

    const totalBuyVolume = recentBuys.reduce((sum, t) => sum + t.solAmount, 0);
    const totalSellVolume = recentSells.reduce((sum, t) => sum + t.solAmount, 0);
    const netBuyPressure = totalBuyVolume - totalSellVolume;

    // Calculate viewer to buyer conversion
    const uniqueBuyers = new Set(recentBuys.map(t => t.user)).size;
    const viewerToBuyerConversion = avgViewersLast5Min > 0 ? uniqueBuyers / avgViewersLast5Min : 0;

    // Calculate graduation probability (simplified algorithm)
    const gradProbabilityScore = this.calculateGradProbability(data, recentTrades);

    // Calculate whale influence
    const whaleInfluence = this.calculateWhaleInfluence(recentTrades);

    return {
      mint: data.mint,
      viewerToBuyerConversion,
      avgViewersLast5Min,
      buysPerMinute,
      sellsPerMinute,
      netBuyPressure,
      gradProbabilityScore,
      whaleInfluence
    };
  }

  private calculateGradProbability(data: StreamData, recentTrades: TradeEvent[]): number {
    // Factors that increase graduation probability:
    // 1. High bonding curve progress
    // 2. Increasing buy pressure
    // 3. High viewer count
    // 4. Strong chat engagement

    let score = 0;

    // Bonding curve progress (40% weight)
    if (data.bondingCurve) {
      score += data.bondingCurve.progress * 0.4;
    }

    // Buy pressure (30% weight)
    const buyVolume = recentTrades.filter(t => t.tradeType === 'buy').reduce((sum, t) => sum + t.solAmount, 0);
    const sellVolume = recentTrades.filter(t => t.tradeType === 'sell').reduce((sum, t) => sum + t.solAmount, 0);
    const buyRatio = buyVolume / (buyVolume + sellVolume) || 0;
    score += buyRatio * 30;

    // Viewer engagement (20% weight)
    const recentViewers = data.viewerMetrics.slice(-5);
    const avgViewers = recentViewers.length > 0
      ? recentViewers.reduce((sum, m) => sum + m.viewerCount, 0) / recentViewers.length
      : 0;
    const viewerScore = Math.min(avgViewers / 100, 1); // Normalize to 0-1
    score += viewerScore * 20;

    // Chat engagement (10% weight)
    const chatEngagement = (data.chatMetrics.messagesPerMinute + data.chatMetrics.reactionsPerMinute) / 10;
    score += Math.min(chatEngagement, 1) * 10;

    return Math.min(score, 100);
  }

  private calculateWhaleInfluence(trades: TradeEvent[]): number {
    if (trades.length === 0) return 0;

    // Identify whale trades (top 10% by volume)
    const sortedTrades = trades.sort((a, b) => b.solAmount - a.solAmount);
    const whaleThreshold = Math.floor(trades.length * 0.1) || 1;
    const whaleTrades = sortedTrades.slice(0, whaleThreshold);

    const whaleVolume = whaleTrades.reduce((sum, t) => sum + t.solAmount, 0);
    const totalVolume = trades.reduce((sum, t) => sum + t.solAmount, 0);

    return totalVolume > 0 ? (whaleVolume / totalVolume) * 100 : 0;
  }

  private checkForAlerts(data: StreamData, analytics: StreamAnalytics): Alert[] {
    const alerts: Alert[] = [];
    const now = Date.now();

    // Viewer spike alert
    if (analytics.avgViewersLast5Min > 100) {
      const recentGrowth = this.getViewerGrowth(data);
      if (recentGrowth > 50) { // 50% growth
        alerts.push({
          id: `viewer-spike-${data.mint}-${now}`,
          mint: data.mint,
          type: 'viewer_spike',
          message: `Viewer count spiked by ${recentGrowth.toFixed(1)}% to ${analytics.avgViewersLast5Min.toFixed(0)}`,
          timestamp: now,
          metadata: {
            currentViewers: analytics.avgViewersLast5Min,
            growthPercent: recentGrowth
          }
        });
      }
    }

    // Buy spike alert
    if (analytics.buysPerMinute > 10 && analytics.netBuyPressure > 5) {
      alerts.push({
        id: `buy-spike-${data.mint}-${now}`,
        mint: data.mint,
        type: 'buy_spike',
        message: `High buy pressure: ${analytics.buysPerMinute} buys/min, net +${analytics.netBuyPressure.toFixed(2)} SOL`,
        timestamp: now,
        metadata: {
          buysPerMinute: analytics.buysPerMinute,
          netBuyPressure: analytics.netBuyPressure
        }
      });
    }

    // Graduation imminent alert
    if (analytics.gradProbabilityScore > 80 && data.bondingCurve && !data.bondingCurve.graduated) {
      alerts.push({
        id: `grad-imminent-${data.mint}-${now}`,
        mint: data.mint,
        type: 'grad_imminent',
        message: `Graduation probability: ${analytics.gradProbabilityScore.toFixed(1)}% (${data.bondingCurve.progress.toFixed(1)}% progress)`,
        timestamp: now,
        metadata: {
          gradProbability: analytics.gradProbabilityScore,
          bondingCurveProgress: data.bondingCurve.progress
        }
      });
    }

    // Whale activity alert
    if (analytics.whaleInfluence > 70) {
      alerts.push({
        id: `whale-entry-${data.mint}-${now}`,
        mint: data.mint,
        type: 'whale_entry',
        message: `High whale influence: ${analytics.whaleInfluence.toFixed(1)}% of recent volume`,
        timestamp: now,
        metadata: {
          whaleInfluence: analytics.whaleInfluence
        }
      });
    }

    return alerts;
  }

  private getViewerGrowth(data: StreamData): number {
    const metrics = data.viewerMetrics.slice(-10); // Last 10 data points
    if (metrics.length < 2) return 0;

    const recent = metrics.slice(-3).reduce((sum, m) => sum + m.viewerCount, 0) / 3;
    const older = metrics.slice(-10, -7).reduce((sum, m) => sum + m.viewerCount, 0) / 3;

    return older > 0 ? ((recent - older) / older) * 100 : 0;
  }

  private resetPerMinuteCounters(): void {
    for (const data of this.streamData.values()) {
      data.chatMetrics.messagesPerMinute = 0;
      data.chatMetrics.reactionsPerMinute = 0;
    }
  }

  getAnalytics(mint: string): StreamAnalytics | null {
    const data = this.streamData.get(mint);
    if (!data) return null;

    return this.analyzeStream(data);
  }

  getAllActiveStreams(): string[] {
    const cutoff = Date.now() - 300000; // 5 minutes
    return Array.from(this.streamData.entries())
      .filter(([_, data]) => data.lastUpdated > cutoff)
      .map(([mint, _]) => mint);
  }

  cleanup(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    // Remove stale stream data
    const cutoff = Date.now() - this.DATA_RETENTION_MS * 2; // 2 hours
    for (const [mint, data] of this.streamData) {
      if (data.lastUpdated < cutoff) {
        this.streamData.delete(mint);
      }
    }
  }
}

export default AnalyticsEngine;