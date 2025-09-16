import WebSocket from 'ws';
import { BondingCurveData } from '../types/index.js';
import { EventEmitter } from 'events';

export class SolanaTrackerClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private apiKey: string;
  private subscribedMints = new Set<string>();
  private reconnectTimeout?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(apiKey: string, wsUrl = 'wss://api.solanatracker.io/ws') {
    super();
    this.apiKey = apiKey;
    this.wsUrl = wsUrl;

    // Skip connection if using demo key (SolanaTracker might not be available)
    if (apiKey === 'demo_key') {
      console.warn('⚠️  Using demo SolanaTracker key - bonding curve features disabled');
    }
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    // Don't connect if using demo key
    if (this.apiKey === 'demo_key') {
      console.log('Skipping SolanaTracker connection (demo mode)');
      return;
    }

    console.log('Connecting to SolanaTracker WebSocket...');
    this.ws = new WebSocket(this.wsUrl, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    this.ws.on('open', () => {
      console.log('Connected to SolanaTracker WebSocket');
      this.reconnectAttempts = 0;
      this.emit('connected');

      // Send authentication if needed
      this.authenticate();

      // Resubscribe to existing mints
      if (this.subscribedMints.size > 0) {
        this.subscribePumpfunTokens(Array.from(this.subscribedMints));
      }
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing SolanaTracker message:', error);
      }
    });

    this.ws.on('close', () => {
      console.log('SolanaTracker WebSocket closed');
      this.emit('disconnected');
      this.reconnect();
    });

    this.ws.on('error', (error) => {
      console.error('SolanaTracker WebSocket error:', error);
      // Don't emit error to prevent crash, just log it
      if (error.message.includes('404')) {
        console.warn('⚠️  SolanaTracker endpoint not available, continuing without bonding curve data');
      }
    });
  }

  private authenticate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const authMessage = {
      method: 'authenticate',
      params: {
        api_key: this.apiKey
      }
    };

    this.ws.send(JSON.stringify(authMessage));
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max SolanaTracker reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Reconnecting to SolanaTracker in ${delay}ms... (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private handleMessage(message: any): void {
    const { method, data } = message;

    switch (method) {
      case 'pumpfun_graduating':
        this.handleGraduating(data);
        break;
      case 'pumpfun_graduated':
        this.handleGraduated(data);
        break;
      case 'pumpfun_bonding_curve':
        this.handleBondingCurve(data);
        break;
      case 'token_price_update':
        this.handlePriceUpdate(data);
        break;
      case 'subscription_confirmed':
        console.log('SolanaTracker subscription confirmed:', data);
        break;
      case 'error':
        console.error('SolanaTracker error:', data);
        this.emit('error', new Error(data.message || 'Unknown SolanaTracker error'));
        break;
      default:
        console.log('Unknown SolanaTracker message:', message);
    }
  }

  private handleGraduating(data: any): void {
    console.log(`Token graduating: ${data.token_address}`);
    this.emit('graduating', {
      mint: data.token_address,
      timestamp: Date.now(),
      progress: data.bonding_curve_progress || 100,
      marketCap: data.market_cap,
      liquidityPool: data.liquidity_pool
    });
  }

  private handleGraduated(data: any): void {
    console.log(`Token graduated: ${data.token_address}`);

    const bondingCurveData: BondingCurveData = {
      mint: data.token_address,
      progress: 100,
      marketCap: data.market_cap || 0,
      liquidity: data.liquidity || 0,
      graduated: true,
      graduatedAt: Date.now()
    };

    this.emit('graduated', bondingCurveData);
  }

  private handleBondingCurve(data: any): void {
    const bondingCurveData: BondingCurveData = {
      mint: data.token_address,
      progress: data.progress || 0,
      marketCap: data.market_cap || 0,
      liquidity: data.liquidity || 0,
      graduated: data.graduated || false,
      graduatedAt: data.graduated_at ? new Date(data.graduated_at).getTime() : undefined
    };

    this.emit('bondingCurveUpdate', bondingCurveData);
  }

  private handlePriceUpdate(data: any): void {
    this.emit('priceUpdate', {
      mint: data.token_address,
      price: data.price,
      priceChange24h: data.price_change_24h,
      volume24h: data.volume_24h,
      marketCap: data.market_cap,
      timestamp: Date.now()
    });
  }

  subscribePumpfunTokens(mints: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('SolanaTracker WebSocket not ready, storing mints for later subscription');
      mints.forEach(mint => this.subscribedMints.add(mint));
      return;
    }

    mints.forEach(mint => this.subscribedMints.add(mint));

    // Subscribe to bonding curve updates
    const bondingCurveMessage = {
      method: 'subscribe',
      params: {
        type: 'pumpfun_bonding_curve',
        tokens: mints
      }
    };

    this.ws.send(JSON.stringify(bondingCurveMessage));

    // Subscribe to graduation events
    const graduationMessage = {
      method: 'subscribe',
      params: {
        type: 'pumpfun_graduating',
        tokens: mints
      }
    };

    this.ws.send(JSON.stringify(graduationMessage));

    const graduatedMessage = {
      method: 'subscribe',
      params: {
        type: 'pumpfun_graduated',
        tokens: mints
      }
    };

    this.ws.send(JSON.stringify(graduatedMessage));

    console.log(`Subscribed to SolanaTracker updates for ${mints.length} tokens`);
  }

  subscribeAllPumpfunEvents(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('SolanaTracker WebSocket not ready');
      return;
    }

    // Subscribe to all graduating events
    const graduatingMessage = {
      method: 'subscribe',
      params: {
        type: 'pumpfun_graduating'
      }
    };

    this.ws.send(JSON.stringify(graduatingMessage));

    // Subscribe to all graduated events
    const graduatedMessage = {
      method: 'subscribe',
      params: {
        type: 'pumpfun_graduated'
      }
    };

    this.ws.send(JSON.stringify(graduatedMessage));

    console.log('Subscribed to all Pumpfun graduation events');
  }

  unsubscribePumpfunTokens(mints: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    mints.forEach(mint => this.subscribedMints.delete(mint));

    const unsubscribeMessage = {
      method: 'unsubscribe',
      params: {
        tokens: mints
      }
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
    console.log(`Unsubscribed from SolanaTracker updates for ${mints.length} tokens`);
  }

  // Get historical bonding curve data via REST API
  async getBondingCurveHistory(mint: string, timeframe = '1h'): Promise<BondingCurveData[]> {
    try {
      const response = await fetch(`https://api.solanatracker.io/pumpfun/bonding-curve/${mint}/history?timeframe=${timeframe}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bonding curve history: ${response.status}`);
      }

      const data = await response.json() as any[];
      return data.map(item => ({
        mint,
        progress: item.progress,
        marketCap: item.market_cap,
        liquidity: item.liquidity,
        graduated: item.graduated,
        graduatedAt: item.graduated_at ? new Date(item.graduated_at).getTime() : undefined
      }));
    } catch (error) {
      console.error(`Error fetching bonding curve history for ${mint}:`, error);
      return [];
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscribedMints.clear();
    console.log('Disconnected from SolanaTracker WebSocket');
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSubscribedMints(): string[] {
    return Array.from(this.subscribedMints);
  }
}

export default SolanaTrackerClient;