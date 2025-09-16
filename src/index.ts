import 'dotenv/config';
import { PumpFunAPI } from './services/pumpfun-api.js';
import { PumpPortalClient } from './services/pumpportal-ws.js';
import { SolanaTrackerClient } from './services/solanatracker-ws.js';
import { AnalyticsEngine } from './services/analytics-engine.js';
import { APIServer } from './services/api-server.js';
import { StreamManager } from './workers/stream-manager.js';

class PumpFunLiveAnalytics {
  private pumpfunAPI: PumpFunAPI;
  private pumpportalClient: PumpPortalClient;
  private solanaTrackerClient: SolanaTrackerClient;
  private analytics: AnalyticsEngine;
  private apiServer: APIServer;
  private streamManager: StreamManager;

  constructor() {
    // Initialize services
    this.pumpfunAPI = new PumpFunAPI(
      process.env.PUMPFUN_API_BASE || 'https://frontend-api-v3.pump.fun'
    );

    this.pumpportalClient = new PumpPortalClient(
      process.env.PUMPPORTAL_WS || 'wss://pumpportal.fun/api/data'
    );

    this.solanaTrackerClient = new SolanaTrackerClient(
      process.env.SOLANATRACKER_API_KEY || 'demo_key',
      process.env.SOLANATRACKER_WS || 'wss://api.solanatracker.io/ws'
    );

    this.analytics = new AnalyticsEngine();

    this.apiServer = new APIServer(
      this.analytics,
      this.pumpfunAPI,
      parseInt(process.env.PORT || '3000')
    );

    this.streamManager = new StreamManager(
      this.pumpfunAPI,
      this.pumpportalClient,
      this.solanaTrackerClient,
      this.analytics
    );
  }

  async start(): Promise<void> {
    console.log('🚀 Starting PumpFun Live Analytics...');

    try {
      // Start analytics engine first
      console.log('📊 Starting analytics engine...');

      // Start stream manager
      console.log('🎥 Starting stream manager...');
      await this.streamManager.start();

      // Connect TokenSniper to API server
      console.log('🎯 Connecting Token Sniper to API server...');
      const tokenSniper = this.streamManager.getTokenSniper();
      this.apiServer.setTokenSniper(tokenSniper);

      // Start API server
      console.log('🌐 Starting API server...');
      await this.apiServer.start();

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      console.log('✅ PumpFun Live Analytics is running!');
      console.log(`📡 API Server: http://localhost:${process.env.PORT || 3000}`);
      console.log(`📊 Dashboard: http://localhost:3001 (run 'npm run dashboard' separately)`);
      console.log(`📈 WebSocket: ws://localhost:${process.env.PORT || 3000}/api/ws`);

      // Print some useful endpoints
      console.log('\n🔗 Available Endpoints:');
      console.log(`  GET  /api/streams/live - Currently live streams`);
      console.log(`  GET  /api/analytics/overview - Stream analytics overview`);
      console.log(`  GET  /api/analytics/top - Top performing streams`);
      console.log(`  GET  /api/alerts - Recent alerts`);
      console.log(`  GET  /api/market/stats - Market statistics`);
      console.log(`  GET  /api/obs/:mint - OBS overlay data`);
      console.log('\n🎯 Token Sniper Endpoints:');
      console.log(`  GET  /api/sniper/alerts - Active sniper alerts`);
      console.log(`  GET  /api/sniper/whales - Top whale wallets`);
      console.log(`  GET  /api/sniper/activity - Recent sniper activity`);
      console.log(`  GET  /api/sniper/stats - Sniper statistics`);
      console.log(`  GET  /api/sniper/token/:mint - Token-specific alerts`);

    } catch (error) {
      console.error('❌ Failed to start PumpFun Live Analytics:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

      try {
        await this.streamManager.stop();
        await this.apiServer.stop();
        this.analytics.cleanup();

        console.log('✅ Shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }
}

// Start the application
const app = new PumpFunLiveAnalytics();
app.start().catch((error) => {
  console.error('💥 Application failed to start:', error);
  process.exit(1);
});