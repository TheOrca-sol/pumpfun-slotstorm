import 'dotenv/config';
import { StreamManager } from './stream-manager.js';
import { PumpFunAPI } from '../services/pumpfun-api.js';
import { PumpPortalClient } from '../services/pumpportal-ws.js';
import { SolanaTrackerClient } from '../services/solanatracker-ws.js';
import { AnalyticsEngine } from '../services/analytics-engine.js';

// Standalone worker process for stream management
const main = async () => {
  console.log('🔧 Starting PumpFun Analytics Worker...');

  const pumpfunAPI = new PumpFunAPI();
  const pumpportalClient = new PumpPortalClient();
  const solanaTrackerClient = new SolanaTrackerClient(
    process.env.SOLANATRACKER_API_KEY || 'demo_key'
  );
  const analytics = new AnalyticsEngine();

  const streamManager = new StreamManager(
    pumpfunAPI,
    pumpportalClient,
    solanaTrackerClient,
    analytics
  );

  try {
    await streamManager.start();

    // Set up analytics event logging
    analytics.on('analytics', (data) => {
      console.log(`📊 Analytics update for ${data.mint}:`, {
        viewers: data.avgViewersLast5Min,
        buysPerMinute: data.buysPerMinute,
        gradProbability: data.gradProbabilityScore,
        conversion: (data.viewerToBuyerConversion * 100).toFixed(1) + '%'
      });
    });

    analytics.on('alert', (alert) => {
      console.log(`🚨 ALERT [${alert.type}]: ${alert.message} (${alert.mint})`);
    });

    streamManager.on('streamAdded', (stream) => {
      console.log(`➕ Stream added: ${stream.name || stream.mint}`);
    });

    streamManager.on('streamRemoved', (mint) => {
      console.log(`➖ Stream removed: ${mint}`);
    });

    console.log('✅ Worker is running!');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Worker received ${signal}, shutting down...`);
      await streamManager.stop();
      analytics.cleanup();
      console.log('✅ Worker shutdown completed');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ Worker failed to start:', error);
    process.exit(1);
  }
};

main();