import fetch from 'node-fetch';
import { LiveStream } from '../types/index.js';

export class PumpFunAPI {
  private baseUrl: string;

  constructor(baseUrl = 'https://frontend-api-v3.pump.fun') {
    this.baseUrl = baseUrl;
  }

  async getCurrentlyLiveStreams(): Promise<LiveStream[]> {
    try {
      const response = await fetch(`${this.baseUrl}/coins/currently-live`);
      if (!response.ok) {
        throw new Error(`Failed to fetch live streams: ${response.status}`);
      }

      const data = await response.json() as any[];
      return data.map(this.mapToLiveStream);
    } catch (error) {
      console.error('Error fetching currently live streams:', error);
      return [];
    }
  }

  async getLiveStreamDetails(mint: string): Promise<LiveStream | null> {
    try {
      const response = await fetch(`${this.baseUrl}/livestreams/${mint}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to fetch stream details: ${response.status}`);
      }

      const data = await response.json() as any;
      return this.mapToLiveStream(data);
    } catch (error) {
      console.error(`Error fetching stream details for ${mint}:`, error);
      return null;
    }
  }

  async getLiveKitToken(mint: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/livestreams/livekit/token/participant?mint=${mint}`);
      if (!response.ok) return null;

      const data = await response.json() as any;
      return data.token || null;
    } catch (error) {
      console.error(`Error fetching LiveKit token for ${mint}:`, error);
      return null;
    }
  }

  async getLiveChatToken(mint: string): Promise<{ token: string; channelId: string } | null> {
    try {
      // Get livechat token
      const tokenResponse = await fetch(`${this.baseUrl}/livestreams/stream/livechat-token`);
      if (!tokenResponse.ok) return null;

      const tokenData = await tokenResponse.json() as any;

      // Get or create livechat channel
      const channelResponse = await fetch(`${this.baseUrl}/livestreams/stream/livechat-channel/${mint}`, {
        method: 'POST'
      });
      if (!channelResponse.ok) return null;

      const channelData = await channelResponse.json() as any;

      return {
        token: tokenData.token,
        channelId: channelData.channelId
      };
    } catch (error) {
      console.error(`Error fetching livechat credentials for ${mint}:`, error);
      return null;
    }
  }

  private mapToLiveStream(data: any): LiveStream {
    return {
      mint: data.mint,
      name: data.name || '',
      symbol: data.symbol || '',
      description: data.description || '',
      image: data.image_uri || data.image || '',
      creator: data.creator || '',
      createdTimestamp: data.created_timestamp || Date.now(),
      viewerCount: data.viewer_count,
      roomId: data.room_id,
      livekitUrl: data.livekit_url,
      chatChannelId: data.chat_channel_id
    };
  }
}

export default PumpFunAPI;