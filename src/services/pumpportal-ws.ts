import WebSocket from 'ws';
import { TradeEvent } from '../types/index.js';
import { EventEmitter } from 'events';

export class PumpPortalClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private subscribedMints = new Set<string>();
  private reconnectTimeout?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(wsUrl = 'wss://pumpportal.fun/api/data') {
    super();
    this.wsUrl = wsUrl;
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('Connecting to PumpPortal WebSocket...');
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log('Connected to PumpPortal WebSocket');
      this.reconnectAttempts = 0;
      this.emit('connected');

      // Resubscribe to existing mints
      if (this.subscribedMints.size > 0) {
        this.subscribeTokenTrades(Array.from(this.subscribedMints));
      }
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing PumpPortal message:', error);
      }
    });

    this.ws.on('close', () => {
      console.log('PumpPortal WebSocket closed');
      this.emit('disconnected');
      this.reconnect();
    });

    this.ws.on('error', (error) => {
      console.error('PumpPortal WebSocket error:', error);
      this.emit('error', error);
    });
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private handleMessage(message: any): void {
    // Handle trade events
    if (message.txType === 'swap' || message.tradeType) {
      const tradeEvent = this.parseTradeEvent(message);
      if (tradeEvent) {
        this.emit('trade', tradeEvent);
      }
    }

    // Handle new token events
    if (message.txType === 'create' || message.type === 'new_token') {
      this.emit('newToken', message);
    }

    // Handle account trade events
    if (message.type === 'account_trade') {
      const tradeEvent = this.parseTradeEvent(message);
      if (tradeEvent) {
        this.emit('accountTrade', tradeEvent);
      }
    }
  }

  private parseTradeEvent(data: any): TradeEvent | null {
    try {
      return {
        signature: data.signature || data.txId,
        mint: data.mint || data.token_address,
        tradeType: data.tradeType === 'buy' || data.type === 'buy' ? 'buy' : 'sell',
        user: data.trader || data.user || data.signer,
        timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
        solAmount: parseFloat(data.sol_amount || data.solAmount || '0'),
        tokenAmount: parseFloat(data.token_amount || data.tokenAmount || '0'),
        newMarketCap: data.market_cap ? parseFloat(data.market_cap) : undefined,
        bondingCurveProgress: data.bonding_curve_progress ? parseFloat(data.bonding_curve_progress) : undefined
      };
    } catch (error) {
      console.error('Error parsing trade event:', error);
      return null;
    }
  }

  subscribeTokenTrades(mints: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready, storing mints for later subscription');
      mints.forEach(mint => this.subscribedMints.add(mint));
      return;
    }

    mints.forEach(mint => this.subscribedMints.add(mint));

    const message = {
      method: 'subscribeTokenTrade',
      keys: mints
    };

    this.ws.send(JSON.stringify(message));
    console.log(`Subscribed to trades for ${mints.length} tokens`);
  }

  subscribeAccountTrades(accounts: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready');
      return;
    }

    const message = {
      method: 'subscribeAccountTrade',
      keys: accounts
    };

    this.ws.send(JSON.stringify(message));
    console.log(`Subscribed to account trades for ${accounts.length} accounts`);
  }

  subscribeNewTokens(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready');
      return;
    }

    const message = {
      method: 'subscribeNewToken'
    };

    this.ws.send(JSON.stringify(message));
    console.log('Subscribed to new token events');
  }

  unsubscribeTokenTrades(mints: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    mints.forEach(mint => this.subscribedMints.delete(mint));

    const message = {
      method: 'unsubscribeTokenTrade',
      keys: mints
    };

    this.ws.send(JSON.stringify(message));
    console.log(`Unsubscribed from trades for ${mints.length} tokens`);
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
    console.log('Disconnected from PumpPortal WebSocket');
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSubscribedMints(): string[] {
    return Array.from(this.subscribedMints);
  }
}

export default PumpPortalClient;