import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { AnalyticsEngine } from './analytics-engine.js';
import { PumpFunAPI } from './pumpfun-api.js';
import { TokenSniper } from './token-sniper.js';
import { Alert, StreamAnalytics } from '../types/index.js';
import { TokenAlert } from '../types/sniper.js';

interface AlertsStore {
  alerts: Alert[];
  sniperAlerts: TokenAlert[];
  subscribers: ((alert: Alert) => void)[];
}

export class APIServer {
  private server: FastifyInstance;
  private analytics: AnalyticsEngine;
  private pumpfunAPI: PumpFunAPI;
  private tokenSniper?: TokenSniper;
  private alertsStore: AlertsStore;
  private port: number;

  constructor(analytics: AnalyticsEngine, pumpfunAPI: PumpFunAPI, port = 3000) {
    this.server = Fastify({ logger: true });
    this.analytics = analytics;
    this.pumpfunAPI = pumpfunAPI;
    this.port = port;
    this.alertsStore = {
      alerts: [],
      sniperAlerts: [],
      subscribers: []
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.setupAnalyticsListeners();
  }

  setTokenSniper(sniper: TokenSniper): void {
    this.tokenSniper = sniper;
    this.setupSniperListeners();
  }

  private async setupMiddleware(): Promise<void> {
    await this.server.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    });
  }

  private setupRoutes(): void {
    // Health check
    this.server.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: Date.now() };
    });

    // Get currently live streams
    this.server.get('/api/streams/live', async (request, reply) => {
      try {
        const liveStreams = await this.pumpfunAPI.getCurrentlyLiveStreams();
        return {
          streams: liveStreams,
          count: liveStreams.length,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch live streams' });
      }
    });

    // Get stream details
    this.server.get<{
      Params: { mint: string }
    }>('/api/streams/:mint', async (request, reply) => {
      try {
        const { mint } = request.params;
        const streamDetails = await this.pumpfunAPI.getLiveStreamDetails(mint);

        if (!streamDetails) {
          return reply.status(404).send({ error: 'Stream not found' });
        }

        return streamDetails;
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch stream details' });
      }
    });

    // Get stream analytics
    this.server.get<{
      Params: { mint: string }
    }>('/api/analytics/:mint', async (request, reply) => {
      try {
        const { mint } = request.params;
        const analytics = this.analytics.getAnalytics(mint);

        if (!analytics) {
          return reply.status(404).send({ error: 'Analytics not found for this stream' });
        }

        return analytics;
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch analytics' });
      }
    });

    // Get all active streams with analytics
    this.server.get('/api/analytics/overview', async (request, reply) => {
      try {
        const activeStreams = this.analytics.getAllActiveStreams();
        const overview = [];

        for (const mint of activeStreams) {
          const analytics = this.analytics.getAnalytics(mint);
          const streamDetails = await this.pumpfunAPI.getLiveStreamDetails(mint);

          if (analytics && streamDetails) {
            overview.push({
              ...streamDetails,
              analytics
            });
          }
        }

        // Sort by viewer to buyer conversion or grad probability
        overview.sort((a, b) => b.analytics.gradProbabilityScore - a.analytics.gradProbabilityScore);

        return {
          streams: overview,
          count: overview.length,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch analytics overview' });
      }
    });

    // Get top performing streams
    this.server.get('/api/analytics/top', async (request, reply) => {
      try {
        const activeStreams = this.analytics.getAllActiveStreams();
        const topStreams: Array<{ mint: string; analytics: StreamAnalytics; score: number }> = [];

        for (const mint of activeStreams) {
          const analytics = this.analytics.getAnalytics(mint);
          if (analytics) {
            // Calculate composite score
            const score =
              analytics.gradProbabilityScore * 0.3 +
              analytics.viewerToBuyerConversion * 100 * 0.3 +
              Math.min(analytics.avgViewersLast5Min / 10, 10) * 0.2 +
              Math.min(analytics.buysPerMinute, 20) * 0.2;

            topStreams.push({ mint, analytics, score });
          }
        }

        topStreams.sort((a, b) => b.score - a.score);

        return {
          streams: topStreams.slice(0, 10),
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch top streams' });
      }
    });

    // Get recent alerts
    this.server.get('/api/alerts', async (request, reply) => {
      const limit = request.query ? Number((request.query as any).limit) || 50 : 50;
      const type = request.query ? (request.query as any).type : undefined;

      let alerts = this.alertsStore.alerts;

      if (type) {
        alerts = alerts.filter(alert => alert.type === type);
      }

      // Sort by timestamp descending and limit
      alerts = alerts
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      return {
        alerts,
        count: alerts.length,
        timestamp: Date.now()
      };
    });

    // Get alerts for specific mint
    this.server.get<{
      Params: { mint: string }
    }>('/api/alerts/:mint', async (request, reply) => {
      const { mint } = request.params;
      const limit = request.query ? Number((request.query as any).limit) || 20 : 20;

      const alerts = this.alertsStore.alerts
        .filter(alert => alert.mint === mint)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      return {
        alerts,
        count: alerts.length,
        mint,
        timestamp: Date.now()
      };
    });

    // WebSocket endpoint for real-time updates
    this.server.register(async function (fastify) {
      fastify.get('/api/ws', { websocket: true }, (connection, request) => {
        connection.socket.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());

            if (data.type === 'subscribe_alerts') {
              // Add subscriber for real-time alerts
              const subscriber = (alert: Alert) => {
                connection.socket.send(JSON.stringify({
                  type: 'alert',
                  data: alert
                }));
              };

              connection.socket.send(JSON.stringify({
                type: 'subscribed',
                message: 'Successfully subscribed to alerts'
              }));

              // Store subscriber (in production, use a more robust system)
              // this.alertsStore.subscribers.push(subscriber);
            }
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        });

        connection.socket.on('close', () => {
          console.log('WebSocket connection closed');
        });
      });
    });

    // OBS overlay endpoint
    this.server.get<{
      Params: { mint: string }
    }>('/api/obs/:mint', async (request, reply) => {
      try {
        const { mint } = request.params;
        const analytics = this.analytics.getAnalytics(mint);

        if (!analytics) {
          return reply.status(404).send({ error: 'Stream not found' });
        }

        // Return data formatted for OBS overlay
        const overlayData = {
          mint,
          viewers: Math.round(analytics.avgViewersLast5Min),
          buysPerMinute: analytics.buysPerMinute,
          gradProbability: Math.round(analytics.gradProbabilityScore),
          netBuyPressure: analytics.netBuyPressure.toFixed(2),
          conversionRate: (analytics.viewerToBuyerConversion * 100).toFixed(1),
          whaleInfluence: Math.round(analytics.whaleInfluence),
          timestamp: Date.now()
        };

        reply.type('application/json');
        return overlayData;
      } catch (error) {
        reply.status(500).send({ error: 'Failed to generate OBS data' });
      }
    });

    // Market stats endpoint
    this.server.get('/api/market/stats', async (request, reply) => {
      try {
        const activeStreams = this.analytics.getAllActiveStreams();
        let totalViewers = 0;
        let totalTrades = 0;
        let totalGradCandidates = 0;

        for (const mint of activeStreams) {
          const analytics = this.analytics.getAnalytics(mint);
          if (analytics) {
            totalViewers += analytics.avgViewersLast5Min;
            totalTrades += analytics.buysPerMinute + analytics.sellsPerMinute;
            if (analytics.gradProbabilityScore > 70) {
              totalGradCandidates++;
            }
          }
        }

        const sniperStats = this.tokenSniper ? {
          activeAlerts: this.tokenSniper.getActiveAlerts().length,
          whalesTracked: this.tokenSniper.getTopWhales().length,
          totalAlerts: this.alertsStore.sniperAlerts.length
        } : {};

        return {
          activeStreams: activeStreams.length,
          totalViewers: Math.round(totalViewers),
          tradesPerMinute: totalTrades,
          gradCandidates: totalGradCandidates,
          ...sniperStats,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch market stats' });
      }
    });

    // === SNIPER ENDPOINTS ===

    // Get active sniper alerts
    this.server.get('/api/sniper/alerts', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const limit = request.query ? Number((request.query as any).limit) || 20 : 20;
        const minScore = request.query ? Number((request.query as any).minScore) || 0 : 0;

        let alerts = this.tokenSniper.getActiveAlerts(100);

        if (minScore > 0) {
          alerts = alerts.filter(alert => alert.score >= minScore);
        }

        alerts = alerts.slice(0, limit);

        return {
          alerts,
          count: alerts.length,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch sniper alerts' });
      }
    });

    // Get top whales
    this.server.get('/api/sniper/whales', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const limit = request.query ? Number((request.query as any).limit) || 20 : 20;
        const whales = this.tokenSniper.getTopWhales(limit);

        return {
          whales,
          count: whales.length,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch whale data' });
      }
    });

    // Get recent sniper activity
    this.server.get('/api/sniper/activity', async (request, reply) => {
      try {
        const limit = request.query ? Number((request.query as any).limit) || 50 : 50;
        const type = request.query ? (request.query as any).type : undefined;

        let alerts = this.alertsStore.sniperAlerts;

        if (type) {
          alerts = alerts.filter(alert =>
            alert.triggers.some(trigger => trigger.type === type)
          );
        }

        alerts = alerts
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);

        return {
          alerts,
          count: alerts.length,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch sniper activity' });
      }
    });

    // Get alert by token mint
    this.server.get<{
      Params: { mint: string }
    }>('/api/sniper/token/:mint', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const { mint } = request.params;
        const alerts = this.tokenSniper.getActiveAlerts().filter(alert => alert.mint === mint);

        if (alerts.length === 0) {
          return reply.status(404).send({ error: 'No alerts found for this token' });
        }

        return {
          alert: alerts[0], // Most recent alert for this token
          allAlerts: alerts,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch token alert' });
      }
    });

    // Get sniper statistics
    this.server.get('/api/sniper/stats', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const activeAlerts = this.tokenSniper.getActiveAlerts();
        const whales = this.tokenSniper.getTopWhales();
        const recentAlerts = this.alertsStore.sniperAlerts.filter(
          alert => Date.now() - alert.timestamp < 3600000 // Last hour
        );
        const tokensCount = this.tokenSniper.getTokensCount();

        // Calculate trigger type distribution
        const triggerStats = recentAlerts.reduce((acc, alert) => {
          alert.triggers.forEach(trigger => {
            acc[trigger.type] = (acc[trigger.type] || 0) + 1;
          });
          return acc;
        }, {} as Record<string, number>);

        // Calculate average score
        const avgScore = activeAlerts.length > 0
          ? activeAlerts.reduce((sum, alert) => sum + alert.score, 0) / activeAlerts.length
          : 0;

        return {
          activeAlerts: activeAlerts.length,
          whalesTracked: whales.length,
          tokensAnalyzed: tokensCount,
          recentAlertsHour: recentAlerts.length,
          averageScore: Math.round(avgScore),
          triggerDistribution: triggerStats,
          topScoreAlert: activeAlerts.length > 0 ? activeAlerts[0] : null,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch sniper stats' });
      }
    });

    // Get recent analyzed tokens
    this.server.get('/api/sniper/tokens', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const limit = request.query ? Number((request.query as any).limit) || 20 : 20;
        const tokens = this.tokenSniper.getRecentTokens(limit);

        return {
          tokens,
          count: tokens.length,
          totalAnalyzed: this.tokenSniper.getTokensCount(),
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch recent tokens' });
      }
    });

    // === SLOT STORM LOTTERY ENDPOINTS ===

    // Get active lotteries
    this.server.get('/api/sniper/lotteries', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const lotteries = this.tokenSniper.getActiveLotteries();
        return {
          lotteries,
          count: lotteries.length,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch active lotteries' });
      }
    });

    // Get lottery details for specific token
    this.server.get<{
      Params: { mint: string }
    }>('/api/sniper/lottery/:mint', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const { mint } = request.params;
        const lottery = this.tokenSniper.getLotteryDetails(mint);

        if (!lottery) {
          return reply.status(404).send({ error: 'Lottery not found for this token' });
        }

        return lottery;
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch lottery details' });
      }
    });

    // Start lottery for token
    this.server.post<{
      Params: { mint: string }
    }>('/api/sniper/lottery/:mint/start', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const { mint } = request.params;
        const config = request.body as any;

        const success = this.tokenSniper.createLottery(mint, config);

        if (!success) {
          return reply.status(400).send({ error: 'Failed to start lottery' });
        }

        return {
          success: true,
          message: 'Lottery started successfully',
          mint,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to start lottery' });
      }
    });

    // Stop lottery for token
    this.server.post<{
      Params: { mint: string }
    }>('/api/sniper/lottery/:mint/stop', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const { mint } = request.params;
        const success = this.tokenSniper.stopLottery(mint);

        if (!success) {
          return reply.status(404).send({ error: 'Lottery not found or already stopped' });
        }

        return {
          success: true,
          message: 'Lottery stopped successfully',
          mint,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to stop lottery' });
      }
    });

    // Get lottery participants
    this.server.get<{
      Params: { mint: string }
    }>('/api/sniper/lottery/:mint/participants', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const { mint } = request.params;
        const limit = request.query ? Number((request.query as any).limit) || 50 : 50;

        const participants = this.tokenSniper.getLotteryParticipants(mint, limit);

        if (!participants) {
          return reply.status(404).send({ error: 'Lottery not found' });
        }

        return {
          participants,
          count: participants.length,
          mint,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch lottery participants' });
      }
    });

    // Get lottery history
    this.server.get<{
      Params: { mint: string }
    }>('/api/sniper/lottery/:mint/history', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const { mint } = request.params;
        const limit = request.query ? Number((request.query as any).limit) || 20 : 20;

        const history = this.tokenSniper.getLotteryHistory(mint, limit);

        return {
          history,
          count: history.length,
          mint,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch lottery history' });
      }
    });

    // Get lottery statistics
    this.server.get<{
      Params: { mint: string }
    }>('/api/sniper/lottery/:mint/stats', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const { mint } = request.params;
        const stats = this.tokenSniper.getLotteryStats(mint);

        if (!stats) {
          return reply.status(404).send({ error: 'Lottery not found' });
        }

        return {
          ...stats,
          mint,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch lottery statistics' });
      }
    });

    // Update lottery configuration
    this.server.put<{
      Params: { mint: string }
    }>('/api/sniper/lottery/:mint/config', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const { mint } = request.params;
        const config = request.body as any;

        const success = this.tokenSniper.updateLotteryConfig(mint, config);

        if (!success) {
          return reply.status(404).send({ error: 'Lottery not found' });
        }

        return {
          success: true,
          message: 'Lottery configuration updated',
          mint,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to update lottery configuration' });
      }
    });

    // Force lottery draw (admin endpoint)
    this.server.post<{
      Params: { mint: string }
    }>('/api/sniper/lottery/:mint/draw', async (request, reply) => {
      if (!this.tokenSniper) {
        return reply.status(503).send({ error: 'Sniper not available' });
      }

      try {
        const { mint } = request.params;
        const result = this.tokenSniper.forceLotteryDraw(mint);

        if (!result) {
          return reply.status(404).send({ error: 'Lottery not found or draw failed' });
        }

        return {
          success: true,
          draw: result,
          mint,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to execute lottery draw' });
      }
    });
  }

  private setupAnalyticsListeners(): void {
    this.analytics.on('alert', (alert: Alert) => {
      // Store alert
      this.alertsStore.alerts.push(alert);

      // Keep only last 1000 alerts
      if (this.alertsStore.alerts.length > 1000) {
        this.alertsStore.alerts = this.alertsStore.alerts.slice(-1000);
      }

      // Notify WebSocket subscribers
      this.alertsStore.subscribers.forEach(subscriber => {
        try {
          subscriber(alert);
        } catch (error) {
          console.error('Error notifying alert subscriber:', error);
        }
      });
    });
  }

  private setupSniperListeners(): void {
    if (!this.tokenSniper) return;

    this.tokenSniper.on('tokenAlert', (alert: TokenAlert) => {
      // Store sniper alert
      this.alertsStore.sniperAlerts.push(alert);

      // Keep only last 1000 sniper alerts
      if (this.alertsStore.sniperAlerts.length > 1000) {
        this.alertsStore.sniperAlerts = this.alertsStore.sniperAlerts.slice(-1000);
      }
    });
  }

  async start(): Promise<void> {
    try {
      await this.server.listen({ port: this.port, host: '0.0.0.0' });
      console.log(`API server listening on port ${this.port}`);
    } catch (error) {
      console.error('Error starting server:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    await this.server.close();
    console.log('API server stopped');
  }
}

export default APIServer;