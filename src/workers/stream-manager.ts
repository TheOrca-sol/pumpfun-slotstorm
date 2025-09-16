import { EventEmitter } from 'events';
import { PumpFunAPI } from '../services/pumpfun-api.js';
import { PumpPortalClient } from '../services/pumpportal-ws.js';
import { SolanaTrackerClient } from '../services/solanatracker-ws.js';
import { LiveKitSubscriber } from '../services/livekit-subscriber.js';
import { ChatMonitor } from '../services/chat-monitor.js';
import { AnalyticsEngine } from '../services/analytics-engine.js';
import { TokenSniper } from '../services/token-sniper.js';
import { LiveStream } from '../types/index.js';

interface ActiveStream {
  mint: string;
  livekitSubscriber?: LiveKitSubscriber;
  chatMonitor?: ChatMonitor;
  lastSeen: number;
}

export class StreamManager extends EventEmitter {
  private pumpfunAPI: PumpFunAPI;
  private pumpportalClient: PumpPortalClient;
  private solanaTrackerClient: SolanaTrackerClient;
  private analytics: AnalyticsEngine;
  private tokenSniper: TokenSniper;
  private activeStreams = new Map<string, ActiveStream>();
  private discoveryInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    pumpfunAPI: PumpFunAPI,
    pumpportalClient: PumpPortalClient,
    solanaTrackerClient: SolanaTrackerClient,
    analytics: AnalyticsEngine
  ) {
    super();
    this.pumpfunAPI = pumpfunAPI;
    this.pumpportalClient = pumpportalClient;
    this.solanaTrackerClient = solanaTrackerClient;
    this.analytics = analytics;
    this.tokenSniper = new TokenSniper();
  }

  async start(): Promise<void> {
    console.log('Starting Stream Manager...');

    // Connect to WebSocket clients
    await this.connectClients();

    // Set up event handlers
    this.setupEventHandlers();

    // Start stream discovery
    this.startStreamDiscovery();

    // Start cleanup process
    this.startCleanupProcess();

    console.log('Stream Manager started successfully');
  }

  private async connectClients(): Promise<void> {
    // Connect to PumpPortal for trades
    this.pumpportalClient.connect();
    await this.waitForConnection(this.pumpportalClient, 'PumpPortal');

    // Subscribe to new tokens to catch new streams
    this.pumpportalClient.subscribeNewTokens();

    // Connect to SolanaTracker for bonding curve data (optional)
    try {
      this.solanaTrackerClient.connect();
      await this.waitForConnection(this.solanaTrackerClient, 'SolanaTracker', 5000); // 5 second timeout
      this.solanaTrackerClient.subscribeAllPumpfunEvents();
      console.log('✅ SolanaTracker connected successfully');
    } catch (error) {
      console.warn('⚠️  SolanaTracker connection failed, continuing without it:', error.message);
      // Continue without SolanaTracker - we'll use mock data or skip bonding curve features
    }
  }

  private async waitForConnection(client: any, name: string, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${name} connection timeout`));
      }, timeoutMs);

      const onConnected = () => {
        clearTimeout(timeout);
        client.off('connected', onConnected);
        client.off('error', onError);
        resolve();
      };

      const onError = (error: Error) => {
        clearTimeout(timeout);
        client.off('connected', onConnected);
        client.off('error', onError);
        reject(error);
      };

      if (client.isConnected && client.isConnected()) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      client.on('connected', onConnected);
      client.on('error', onError);
    });
  }

  private setupEventHandlers(): void {
    // Handle trades from PumpPortal
    this.pumpportalClient.on('trade', (trade) => {
      this.analytics.addTrade(trade);
      // Analyze trade for sniper alerts
      this.tokenSniper.analyzeTrade(trade);
    });

    // Handle new tokens
    this.pumpportalClient.on('newToken', async (tokenData) => {
      console.log('New token detected:', tokenData.mint);
      // Analyze new token for viral potential (now async)
      try {
        console.log(`📋 About to analyze token: ${tokenData.mint}`);
        await this.tokenSniper.analyzeNewToken(tokenData);
        console.log(`✅ Finished analyzing token: ${tokenData.mint}`);
      } catch (error) {
        console.error(`❌ Error analyzing token ${tokenData.mint}:`, error);
      }
      // Check if this token has a live stream
      this.checkForNewStream(tokenData.mint);
    });

    // Handle sniper alerts
    this.tokenSniper.on('tokenAlert', (alert) => {
      console.log(`🎯 TOKEN ALERT: ${alert.symbol} (${alert.mint.slice(0, 8)}) - Score: ${alert.score}`);
      console.log(`   Triggers: ${alert.triggers.map(t => t.reason).join(', ')}`);
      this.emit('sniperAlert', alert);
    });

    this.tokenSniper.on('whaleAlert', (alert) => {
      console.log(`🐋 WHALE ALERT: ${alert.nickname} ${alert.tradeType} ${alert.amount} SOL`);
      this.emit('whaleAlert', alert);
    });

    this.tokenSniper.on('volumeSpike', (spike) => {
      console.log(`📈 VOLUME SPIKE: ${spike.mint.slice(0, 8)} - ${spike.spikeRatio.toFixed(1)}x`);
      this.emit('volumeSpike', spike);
    });

    // Handle bonding curve updates
    this.solanaTrackerClient.on('bondingCurveUpdate', (data) => {
      this.analytics.addBondingCurveData(data);
    });

    this.solanaTrackerClient.on('graduated', (data) => {
      console.log(`Token graduated: ${data.mint}`);
      this.analytics.addBondingCurveData(data);

      // Clean up this stream since it graduated
      this.removeStream(data.mint);
    });

    this.solanaTrackerClient.on('graduating', (data) => {
      console.log(`Token graduating: ${data.mint}`);
      this.analytics.addBondingCurveData({
        mint: data.mint,
        progress: data.progress,
        marketCap: data.marketCap,
        liquidity: data.liquidityPool || 0,
        graduated: false
      });
    });
  }

  private startStreamDiscovery(): void {
    // Discover new streams every 60 seconds
    this.discoveryInterval = setInterval(() => {
      this.discoverStreams();
    }, 60000);

    // Initial discovery
    this.discoverStreams();
  }

  private async discoverStreams(): Promise<void> {
    try {
      console.log('Discovering live streams...');
      const liveStreams = await this.pumpfunAPI.getCurrentlyLiveStreams();

      console.log(`Found ${liveStreams.length} live streams`);

      // Track all current mints for trades
      const currentMints = liveStreams.map(s => s.mint);
      if (currentMints.length > 0) {
        this.pumpportalClient.subscribeTokenTrades(currentMints);

        // Only subscribe to SolanaTracker if connected
        if (this.solanaTrackerClient.isConnected()) {
          this.solanaTrackerClient.subscribePumpfunTokens(currentMints);
        }
      }

      // Process each stream
      for (const stream of liveStreams) {
        await this.processStream(stream);
      }

      // Mark discovery time
      const now = Date.now();
      for (const mint of currentMints) {
        const activeStream = this.activeStreams.get(mint);
        if (activeStream) {
          activeStream.lastSeen = now;
        }
      }

    } catch (error) {
      console.error('Error discovering streams:', error);
    }
  }

  private async processStream(stream: LiveStream): Promise<void> {
    const existingStream = this.activeStreams.get(stream.mint);

    if (existingStream) {
      // Update last seen time
      existingStream.lastSeen = Date.now();
      return;
    }

    console.log(`Adding new stream: ${stream.name || stream.mint}`);

    const activeStream: ActiveStream = {
      mint: stream.mint,
      lastSeen: Date.now()
    };

    try {
      // Get LiveKit token and connect
      const livekitToken = await this.pumpfunAPI.getLiveKitToken(stream.mint);
      if (livekitToken && stream.livekitUrl) {
        const livekitSubscriber = new LiveKitSubscriber(stream.mint, stream.livekitUrl, livekitToken);

        // Set up LiveKit event handlers
        livekitSubscriber.on('metrics', (metrics) => {
          this.analytics.addViewerMetrics(metrics);
        });

        livekitSubscriber.on('participantJoined', () => {
          // Update viewer count
        });

        livekitSubscriber.on('reaction', (data) => {
          this.analytics.addChatReaction(stream.mint, data.participant || 'unknown');
        });

        await livekitSubscriber.connect();
        activeStream.livekitSubscriber = livekitSubscriber;
      }

      // Get chat credentials and connect
      const chatCreds = await this.pumpfunAPI.getLiveChatToken(stream.mint);
      if (chatCreds) {
        const chatMonitor = new ChatMonitor(stream.mint, chatCreds.token, chatCreds.channelId);

        // Set up chat event handlers
        chatMonitor.on('message', (message) => {
          this.analytics.addChatMessage(stream.mint, message.userId);
        });

        chatMonitor.on('reaction', (data) => {
          this.analytics.addChatReaction(stream.mint, data.userId);
        });

        await chatMonitor.connect();
        activeStream.chatMonitor = chatMonitor;
      }

    } catch (error) {
      console.error(`Error setting up stream ${stream.mint}:`, error);
    }

    this.activeStreams.set(stream.mint, activeStream);
    this.emit('streamAdded', stream);
  }

  private async checkForNewStream(mint: string): Promise<void> {
    try {
      const streamDetails = await this.pumpfunAPI.getLiveStreamDetails(mint);
      if (streamDetails) {
        await this.processStream(streamDetails);
      }
    } catch (error) {
      console.error(`Error checking for new stream ${mint}:`, error);
    }
  }

  private removeStream(mint: string): void {
    const activeStream = this.activeStreams.get(mint);
    if (!activeStream) return;

    console.log(`Removing stream: ${mint}`);

    // Disconnect and cleanup
    if (activeStream.livekitSubscriber) {
      activeStream.livekitSubscriber.disconnect().catch(console.error);
    }

    if (activeStream.chatMonitor) {
      activeStream.chatMonitor.disconnect().catch(console.error);
    }

    // Unsubscribe from trades and bonding curve updates
    this.pumpportalClient.unsubscribeTokenTrades([mint]);

    // Only unsubscribe from SolanaTracker if connected
    if (this.solanaTrackerClient.isConnected()) {
      this.solanaTrackerClient.unsubscribePumpfunTokens([mint]);
    }

    this.activeStreams.delete(mint);
    this.emit('streamRemoved', mint);
  }

  private startCleanupProcess(): void {
    // Clean up stale streams every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleStreams();
    }, 300000);
  }

  private cleanupStaleStreams(): void {
    const staleThreshold = Date.now() - 600000; // 10 minutes

    for (const [mint, stream] of this.activeStreams) {
      if (stream.lastSeen < staleThreshold) {
        console.log(`Removing stale stream: ${mint}`);
        this.removeStream(mint);
      }
    }
  }

  getActiveStreamsCount(): number {
    return this.activeStreams.size;
  }

  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  getTokenSniper(): TokenSniper {
    return this.tokenSniper;
  }

  async stop(): Promise<void> {
    console.log('Stopping Stream Manager...');

    // Clear intervals
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Disconnect all streams
    for (const mint of this.activeStreams.keys()) {
      this.removeStream(mint);
    }

    // Disconnect WebSocket clients
    this.pumpportalClient.disconnect();
    this.solanaTrackerClient.disconnect();

    console.log('Stream Manager stopped');
  }
}

export default StreamManager;