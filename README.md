# PumpFun Live Analytics & SlotStorm Lottery

A comprehensive analytics and lottery system for Pump.fun tokens with two distinct services:

1. **Token Sniper Dashboard** - Live analytics for new token launches
2. **SlotStorm Lottery** - Automated lottery system for specific token holders

## 🎰 SlotStorm Lottery System

**SlotStorm** is a standalone lottery system that rewards holders of a specific token (`9zFdsBhgqWd6WRoqVfcMd5bZJdgwmkiMd1ch7UfGpump`) with creator fees from Pump.fun.

### Key Features

- **Holder-Only Participation**: Only holders of the target token can participate
- **Real Blockchain Data**: Fetches live holder data from Solana blockchain via Helius RPC
- **Creator Fee Distribution**: Claims creator fees from Pump.fun and distributes 50% to holders
- **Automated Draws**: Lottery draws occur every 5 minutes automatically
- **Fair Ticket System**: Tickets based on token holdings with square root scaling for fairness
- **Live Streaming Interface**: Visual dashboard perfect for live streams
- **Weather Effects**: Dynamic storm-themed visual effects during draws

### How SlotStorm Works

1. **Holder Detection**: System fetches all holders of token `9zFdsBhgqWd6WRoqVfcMd5bZJdgwmkiMd1ch7UfGpump` from Solana blockchain
2. **Ticket Allocation**: Each holder receives tickets based on their token balance (square root scaling for fairness)
3. **Prize Pool**: 50% of claimed creator fees accumulate in the prize pool
4. **Automated Draws**: Every 5 minutes, the system randomly selects a winner weighted by ticket count
5. **Winner Announcement**: Visual celebration with storm effects when a winner is selected

### Ticket Calculation

```
Tickets = Math.floor(Math.sqrt(tokenBalance / 1000))
```

This ensures larger holders have better odds while preventing complete dominance.

## 📊 Token Sniper Dashboard

Analytics dashboard for monitoring new Pump.fun token launches with real-time data on:

- New token detections
- Trading volume and price movements
- Top holders and whale activity
- Sniper alerts and opportunities

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Helius RPC API key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd pumpfun

# Install dependencies
npm install

# Install React dashboard dependencies
cd src/dashboard/react-app
npm install
cd ../../..
```

### Configuration

The system uses the following RPC endpoint for blockchain data:
```
https://mainnet.helius-rpc.com/?api-key=d8d8052a-72db-4652-8942-9ae97f24cdec
```

Target token: `9zFdsBhgqWd6WRoqVfcMd5bZJdgwmkiMd1ch7UfGpump`

### Running the Services

#### SlotStorm Lottery System

```bash
# Start SlotStorm service (Port 3003)
npm run slotstorm
```

#### Token Sniper Dashboard

```bash
# Start main analytics service (Port 3002)
PORT=3002 npm run dev

# Start React dashboard (Port 3001)
cd src/dashboard/react-app
npm run dev
```

### Access Points

- **SlotStorm Dashboard**: http://localhost:3001 (defaults to SlotStorm view)
- **Token Sniper Dashboard**: http://localhost:3001 (switch view via navigation)
- **SlotStorm API**: http://localhost:3003
- **Analytics API**: http://localhost:3002

## 🔧 API Endpoints

### SlotStorm API (Port 3003)

- `GET /api/slotstorm` - Get lottery overview and current state
- `GET /api/slotstorm/holders` - Get token holders list
- `GET /api/slotstorm/participants` - Get lottery participants with ticket info
- `GET /api/slotstorm/stats` - Get comprehensive statistics
- `GET /api/slotstorm/fees` - Get creator fees information
- `POST /api/slotstorm/draw` - Force manual lottery draw
- `GET /api/slotstorm/obs` - OBS overlay data for streaming

### Analytics API (Port 3002)

- `GET /api/sniper/stats` - Get sniper statistics
- `GET /api/sniper/tokens` - Get recent tokens
- `GET /api/sniper/alerts` - Get sniper alerts
- `GET /api/sniper/whales` - Get top whales

## 🎮 Live Streaming Integration

SlotStorm is designed for live streaming with:

- **OBS Integration**: `/api/slotstorm/obs` endpoint provides overlay data
- **Real-time Updates**: WebSocket support for live data feeds
- **Visual Effects**: Storm-themed animations and weather systems
- **Winner Celebrations**: Dramatic announcements with confetti effects
- **Live Status**: Real-time participant count and prize pool display

## 🏗️ Architecture

### SlotStorm Components

- **SlotStormService**: Core lottery logic and blockchain integration
- **SlotStormAPI**: Fastify server providing REST and WebSocket endpoints
- **SlotStormDashboard**: React frontend with storm-themed UI
- **Helius RPC**: Blockchain data provider for real holder information

### File Structure

```
src/
├── slotstorm.ts                          # SlotStorm entry point
├── services/
│   ├── slotstorm-service.ts             # Core lottery service
│   └── slotstorm-api.ts                 # API server
└── dashboard/react-app/
    └── src/pages/SlotStormDashboard.tsx # React dashboard
```

## 🎯 Target Token Information

- **Mint Address**: `9zFdsBhgqWd6WRoqVfcMd5bZJdgwmkiMd1ch7UfGpump`
- **Current Holders**: 57 detected
- **Top Holder**: 629,169.66 tokens
- **Lottery Frequency**: Every 5 minutes
- **Prize Distribution**: 50% of creator fees

## 🔐 Security Features

- **Holder Verification**: Only real blockchain holders can participate
- **Transparent Draws**: All lottery logic is deterministic and verifiable
- **Creator Fee Validation**: Direct integration with Pump.fun API for fee claiming
- **Rate Limiting**: API endpoints protected against abuse

## 📈 Monitoring

The system provides comprehensive monitoring through:

- Real-time holder tracking
- Prize pool accumulation monitoring
- Draw frequency and winner statistics
- API health checks and status indicators

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start analytics service
- `npm run slotstorm` - Start SlotStorm lottery
- `npm run dashboard` - Start dashboard server
- `npm run build` - Build TypeScript
- `npm start` - Run production build

### Technologies Used

- **Backend**: Node.js, TypeScript, Fastify
- **Frontend**: React, TypeScript, Tailwind CSS
- **Blockchain**: Solana Web3.js, Helius RPC
- **Real-time**: WebSockets, EventEmitter
- **API**: REST, JSON-RPC

## 🎊 Live Demo Features

When running, you'll see:

- ⚡ **Live holder count** updating in real-time
- 💰 **Prize pool** growing with creator fees
- 🎰 **Slot machine** animation during draws
- 🌩️ **Weather effects** creating storm atmosphere
- 🏆 **Winner announcements** with celebration effects
- 📊 **Real-time statistics** and leaderboards

## Support

For issues or questions, please check the console output of each service for detailed logging and error information.