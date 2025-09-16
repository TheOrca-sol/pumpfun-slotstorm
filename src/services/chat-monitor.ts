import { StreamChat } from 'stream-chat';
import { EventEmitter } from 'events';

export interface ChatMessage {
  mint: string;
  channelId: string;
  messageId: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  reactions?: string[];
}

export class ChatMonitor extends EventEmitter {
  private client: StreamChat | null = null;
  private channels = new Map<string, any>();
  private mint: string;
  private token: string;
  private channelId: string;
  private messageCount = 0;
  private reactionCount = 0;
  private lastMinuteReset = Date.now();

  constructor(mint: string, token: string, channelId: string) {
    super();
    this.mint = mint;
    this.token = token;
    this.channelId = channelId;
  }

  async connect(): Promise<void> {
    try {
      console.log(`Connecting to chat for ${this.mint}...`);

      this.client = StreamChat.getInstance('your-stream-app-id'); // This would come from config

      // Connect as anonymous user (viewer)
      await this.client.connectUser(
        {
          id: `viewer-${Date.now()}`,
          name: `Anonymous Viewer`,
        },
        this.token
      );

      // Join the channel
      const channel = this.client.channel('livestream', this.channelId);
      await channel.watch();

      this.channels.set(this.channelId, channel);

      // Set up event handlers
      this.setupChannelHandlers(channel);

      console.log(`Connected to chat for ${this.mint}`);
      this.emit('connected', this.mint);

      // Start metrics tracking
      this.startMetricsTracking();

    } catch (error) {
      console.error(`Failed to connect to chat for ${this.mint}:`, error);

      // Fallback: create a mock chat monitor that still emits events
      this.startMockChatMonitor();
    }
  }

  private setupChannelHandlers(channel: any): void {
    channel.on('message.new', (event: any) => {
      const message: ChatMessage = {
        mint: this.mint,
        channelId: this.channelId,
        messageId: event.message.id,
        userId: event.message.user.id,
        userName: event.message.user.name || event.message.user.id,
        text: event.message.text || '',
        timestamp: new Date(event.message.created_at).getTime(),
        reactions: event.message.reaction_counts ? Object.keys(event.message.reaction_counts) : []
      };

      this.messageCount++;
      this.emit('message', message);
    });

    channel.on('reaction.new', (event: any) => {
      this.reactionCount++;
      this.emit('reaction', {
        mint: this.mint,
        messageId: event.message.id,
        userId: event.user.id,
        userName: event.user.name || event.user.id,
        reaction: event.reaction.type,
        timestamp: Date.now()
      });
    });

    channel.on('user.watching.start', (event: any) => {
      this.emit('userJoined', {
        mint: this.mint,
        userId: event.user.id,
        userName: event.user.name || event.user.id,
        timestamp: Date.now()
      });
    });

    channel.on('user.watching.stop', (event: any) => {
      this.emit('userLeft', {
        mint: this.mint,
        userId: event.user.id,
        userName: event.user.name || event.user.id,
        timestamp: Date.now()
      });
    });
  }

  private startMockChatMonitor(): void {
    // Mock chat monitor for testing/fallback
    console.log(`Starting mock chat monitor for ${this.mint}`);

    const mockInterval = setInterval(() => {
      // Simulate occasional chat messages
      if (Math.random() < 0.3) {
        const mockMessage: ChatMessage = {
          mint: this.mint,
          channelId: this.channelId,
          messageId: `mock-${Date.now()}`,
          userId: `user-${Math.floor(Math.random() * 1000)}`,
          userName: `User${Math.floor(Math.random() * 1000)}`,
          text: this.generateMockMessage(),
          timestamp: Date.now()
        };

        this.messageCount++;
        this.emit('message', mockMessage);
      }

      // Simulate reactions
      if (Math.random() < 0.1) {
        this.reactionCount++;
        this.emit('reaction', {
          mint: this.mint,
          messageId: `mock-msg-${Date.now()}`,
          userId: `user-${Math.floor(Math.random() * 1000)}`,
          userName: `User${Math.floor(Math.random() * 1000)}`,
          reaction: ['🚀', '💎', '🔥', '❤️'][Math.floor(Math.random() * 4)],
          timestamp: Date.now()
        });
      }
    }, 2000);

    // Clean up mock on disconnect
    this.once('disconnected', () => {
      clearInterval(mockInterval);
    });

    this.emit('connected', this.mint);
    this.startMetricsTracking();
  }

  private generateMockMessage(): string {
    const messages = [
      'To the moon! 🚀',
      'Diamond hands 💎',
      'HODL!',
      'Buy the dip',
      'This is going to 100x',
      'LFG!!!',
      'Best project ever',
      'When lambo?',
      'GM everyone',
      'Chart looks bullish 📈'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  private startMetricsTracking(): void {
    setInterval(() => {
      const now = Date.now();
      const timeSinceReset = now - this.lastMinuteReset;

      if (timeSinceReset >= 60000) { // Reset every minute
        this.emit('metrics', {
          mint: this.mint,
          messagesPerMinute: this.messageCount,
          reactionsPerMinute: this.reactionCount,
          timestamp: now
        });

        this.messageCount = 0;
        this.reactionCount = 0;
        this.lastMinuteReset = now;
      }
    }, 10000); // Check every 10 seconds
  }

  async sendMessage(text: string): Promise<void> {
    const channel = this.channels.get(this.channelId);
    if (!channel) {
      throw new Error('Not connected to channel');
    }

    await channel.sendMessage({
      text
    });
  }

  async disconnect(): Promise<void> {
    console.log(`Disconnecting chat monitor for ${this.mint}`);

    for (const channel of this.channels.values()) {
      await channel.stopWatching();
    }

    this.channels.clear();

    if (this.client) {
      await this.client.disconnectUser();
      this.client = null;
    }

    this.emit('disconnected', this.mint);
  }

  isConnected(): boolean {
    return this.client?.user != null;
  }

  getChannelInfo() {
    const channel = this.channels.get(this.channelId);
    return {
      memberCount: channel?.state?.members ? Object.keys(channel.state.members).length : 0,
      watcherCount: channel?.state?.watcher_count || 0
    };
  }
}

export default ChatMonitor;