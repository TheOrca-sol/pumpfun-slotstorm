import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import SlotStormService from './slotstorm-service.js';

export class SlotStormAPI {
  private server: FastifyInstance;
  private slotStormService: SlotStormService;
  private port: number;

  constructor(port = 3003) {
    this.server = Fastify({ logger: true });
    this.port = port;

    // Initialize SlotStorm for the specific token
    this.slotStormService = new SlotStormService('9zFdsBhgqWd6WRoqVfcMd5bZJdgwmkiMd1ch7UfGpump');

    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventListeners();
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
      return {
        status: 'ok',
        service: 'SlotStorm API',
        tokenMint: this.slotStormService.getTokenMint(),
        timestamp: Date.now()
      };
    });

    // Get SlotStorm overview
    this.server.get('/api/slotstorm', async (request, reply) => {
      try {
        const data = this.slotStormService.getLotteryData();
        return data;
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch SlotStorm data' });
      }
    });

    // Get token holders
    this.server.get('/api/slotstorm/holders', async (request, reply) => {
      try {
        const limit = request.query ? Number((request.query as any).limit) || 50 : 50;
        const holders = this.slotStormService.getTopHolders(limit);

        return {
          holders,
          totalCount: this.slotStormService.getHolders().length,
          tokenMint: this.slotStormService.getTokenMint(),
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch holders' });
      }
    });

    // Get lottery participants (holders with ticket info)
    this.server.get('/api/slotstorm/participants', async (request, reply) => {
      try {
        const limit = request.query ? Number((request.query as any).limit) || 20 : 20;
        const lotteryData = this.slotStormService.getLotteryData();

        return {
          participants: lotteryData.participants.slice(0, limit),
          totalCount: lotteryData.participants.length,
          tokenMint: this.slotStormService.getTokenMint(),
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch participants' });
      }
    });

    // Get creator fees information
    this.server.get('/api/slotstorm/fees', async (request, reply) => {
      try {
        const fees = this.slotStormService.getCreatorFees();
        const lotteryData = this.slotStormService.getLotteryData();

        return {
          ...fees,
          currentPrizePool: lotteryData.prizePool,
          tokenMint: this.slotStormService.getTokenMint(),
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch fee data' });
      }
    });

    // Get lottery winners
    this.server.get('/api/slotstorm/winners', async (request, reply) => {
      try {
        const limit = request.query ? Number((request.query as any).limit) || 20 : 20;
        const winners = this.slotStormService.getWinners(limit);
        const stats = this.slotStormService.getWinnerStats();

        return {
          winners,
          stats,
          tokenMint: this.slotStormService.getTokenMint(),
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch winners' });
      }
    });

    // Mark dev fees as claimed (for tracking purposes)
    this.server.post('/api/slotstorm/claim-dev-fees', async (request, reply) => {
      try {
        const result = this.slotStormService.markDevFeesClaimed();
        return {
          success: true,
          claimedAmount: result.claimedAmount,
          remainingFees: result.remainingFees,
          devWallet: result.devWallet,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to mark dev fees as claimed' });
      }
    });

    // Get comprehensive stats
    this.server.get('/api/slotstorm/stats', async (request, reply) => {
      try {
        const stats = this.slotStormService.getStats();
        return {
          ...stats,
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to fetch stats' });
      }
    });

    // Force lottery draw (for testing/admin)
    this.server.post('/api/slotstorm/draw', async (request, reply) => {
      try {
        const result = await this.slotStormService.forceDraw();
        return {
          success: true,
          draw: result,
          tokenMint: this.slotStormService.getTokenMint(),
          timestamp: Date.now()
        };
      } catch (error) {
        reply.status(500).send({ error: 'Failed to execute draw' });
      }
    });

    // WebSocket endpoint for real-time updates
    this.server.register(async function (fastify) {
      fastify.get('/api/slotstorm/ws', { websocket: true }, (connection, request) => {
        console.log('🔌 SlotStorm WebSocket connection established');

        // Send initial data
        const initialData = {
          type: 'initial-data',
          data: this.slotStormService.getLotteryData()
        };
        connection.socket.send(JSON.stringify(initialData));

        connection.socket.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());

            if (data.type === 'subscribe') {
              connection.socket.send(JSON.stringify({
                type: 'subscribed',
                message: 'Successfully subscribed to SlotStorm updates'
              }));
            }
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        });

        connection.socket.on('close', () => {
          console.log('🔌 SlotStorm WebSocket connection closed');
        });
      });
    }.bind(this));

    // OBS overlay endpoint for streaming
    this.server.get('/api/slotstorm/obs', async (request, reply) => {
      try {
        const lotteryData = this.slotStormService.getLotteryData();
        const stats = this.slotStormService.getStats();
        const fees = this.slotStormService.getCreatorFees();

        // Format data for OBS overlay
        const overlayData = {
          tokenMint: this.slotStormService.getTokenMint(),
          prizePool: lotteryData.prizePool.toFixed(3),
          participants: lotteryData.holderCount,
          weather: lotteryData.weather.type,
          nextDraw: new Date(lotteryData.nextSlotTime).toLocaleTimeString(),
          totalFees: fees.totalFees.toFixed(3),
          topHolder: stats.totalHolders > 0 ? this.slotStormService.getTopHolders(1)[0] : null,
          timestamp: Date.now()
        };

        reply.type('application/json');
        return overlayData;
      } catch (error) {
        reply.status(500).send({ error: 'Failed to generate OBS data' });
      }
    });
  }

  private setupEventListeners(): void {
    this.slotStormService.on('winner-announced', (data) => {
      console.log(`🏆 Broadcasting winner: ${data.address}`);
      // Here you would broadcast to WebSocket clients
    });

    this.slotStormService.on('weather-changed', (data) => {
      console.log(`🌤️ Broadcasting weather change: ${data.type}`);
      // Here you would broadcast to WebSocket clients
    });

    this.slotStormService.on('fees-updated', (data) => {
      console.log(`💰 Broadcasting fee update: +${data.prizePoolAddition} SOL`);
      // Here you would broadcast to WebSocket clients
    });
  }

  async start(): Promise<void> {
    try {
      // Start the SlotStorm service first
      await this.slotStormService.start();

      // Then start the API server
      await this.server.listen({ port: this.port, host: '0.0.0.0' });

      console.log(`🎰 SlotStorm API server listening on port ${this.port}`);
      console.log(`🌐 SlotStorm Dashboard: http://localhost:${this.port}`);
      console.log(`📡 Token: ${this.slotStormService.getTokenMint()}`);
      console.log(`📊 Participants: ${this.slotStormService.getHolders().length}`);
    } catch (error) {
      console.error('❌ Error starting SlotStorm API server:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    await this.slotStormService.stop();
    await this.server.close();
    console.log('🛑 SlotStorm API server stopped');
  }
}

export default SlotStormAPI;