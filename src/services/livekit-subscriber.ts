import { Room, RoomEvent, RemoteTrack, RemoteParticipant, DataPacket_Kind, Track } from 'livekit-client';
import { ViewerMetrics } from '../types/index.js';
import { EventEmitter } from 'events';

export class LiveKitSubscriber extends EventEmitter {
  private room: Room | null = null;
  private mint: string;
  private wsUrl: string;
  private token: string;
  private metricsInterval?: NodeJS.Timeout;

  constructor(mint: string, wsUrl: string, token: string) {
    super();
    this.mint = mint;
    this.wsUrl = wsUrl;
    this.token = token;
  }

  async connect(): Promise<void> {
    try {
      console.log(`Connecting to LiveKit room for ${this.mint}...`);

      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      this.setupEventHandlers();

      await this.room.connect(this.wsUrl, this.token);
      console.log(`Connected to LiveKit room for ${this.mint}`);

      // Start metrics collection
      this.startMetricsCollection();
    } catch (error) {
      console.error(`Failed to connect to LiveKit room for ${this.mint}:`, error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.room) return;

    this.room.on(RoomEvent.Connected, () => {
      console.log(`LiveKit room connected for ${this.mint}`);
      this.emit('connected', this.mint);
    });

    this.room.on(RoomEvent.Disconnected, (reason) => {
      console.log(`LiveKit room disconnected for ${this.mint}:`, reason);
      this.emit('disconnected', this.mint);
      this.cleanup();
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log(`Participant joined room ${this.mint}:`, participant.identity);
      this.emit('participantJoined', {
        mint: this.mint,
        participant: participant.identity,
        timestamp: Date.now()
      });
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log(`Participant left room ${this.mint}:`, participant.identity);
      this.emit('participantLeft', {
        mint: this.mint,
        participant: participant.identity,
        timestamp: Date.now()
      });
    });

    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
      console.log(`Track subscribed in ${this.mint}:`, track.kind);

      if (track.kind === 'video') {
        this.emit('videoTrackSubscribed', {
          mint: this.mint,
          participant: participant.identity,
          timestamp: Date.now()
        });
      }
    });

    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant, kind?: DataPacket_Kind) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        this.handleDataReceived(data, participant?.identity);
      } catch (error) {
        console.error(`Error parsing data received in room ${this.mint}:`, error);
      }
    });

    this.room.on(RoomEvent.RoomMetadataChanged, (metadata: string) => {
      try {
        const data = JSON.parse(metadata);
        this.emit('roomMetadataChanged', {
          mint: this.mint,
          metadata: data,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error(`Error parsing room metadata for ${this.mint}:`, error);
      }
    });
  }

  private handleDataReceived(data: any, participantId?: string): void {
    // Handle different types of data messages
    if (data.type === 'viewer_count') {
      this.emit('viewerCountUpdate', {
        mint: this.mint,
        viewerCount: data.count,
        timestamp: Date.now()
      });
    } else if (data.type === 'reaction') {
      this.emit('reaction', {
        mint: this.mint,
        participant: participantId,
        reaction: data.reaction,
        timestamp: Date.now()
      });
    } else if (data.type === 'follow') {
      this.emit('follow', {
        mint: this.mint,
        participant: participantId,
        timestamp: Date.now()
      });
    } else if (data.type === 'chat_message') {
      this.emit('chatMessage', {
        mint: this.mint,
        participant: participantId,
        message: data.message,
        timestamp: Date.now()
      });
    }
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000); // Collect metrics every 5 seconds
  }

  private collectMetrics(): void {
    if (!this.room) return;

    const participants = this.room.remoteParticipants;
    const viewerCount = participants.size + 1; // +1 for host

    // Get recent events (this would typically be stored in memory or cache)
    const metrics: ViewerMetrics = {
      mint: this.mint,
      timestamp: Date.now(),
      viewerCount,
      chatMessagesPerMinute: this.getChatMessagesPerMinute(),
      reactionsPerMinute: this.getReactionsPerMinute(),
      followEvents: this.getFollowEvents()
    };

    this.emit('metrics', metrics);
  }

  private getChatMessagesPerMinute(): number {
    // This would track chat messages in a sliding window
    // For now, return a placeholder
    return 0;
  }

  private getReactionsPerMinute(): number {
    // This would track reactions in a sliding window
    // For now, return a placeholder
    return 0;
  }

  private getFollowEvents(): number {
    // This would track follow events in a sliding window
    // For now, return a placeholder
    return 0;
  }

  async disconnect(): Promise<void> {
    console.log(`Disconnecting from LiveKit room for ${this.mint}`);
    this.cleanup();

    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
  }

  private cleanup(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  isConnected(): boolean {
    return this.room?.state === 'connected';
  }

  getParticipantCount(): number {
    return this.room ? this.room.remoteParticipants.size + 1 : 0;
  }
}

export default LiveKitSubscriber;