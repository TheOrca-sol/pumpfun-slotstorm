#!/usr/bin/env node

import SlotStormAPI from './services/slotstorm-api.js';

const TOKEN_MINT = '9zFdsBhgqWd6WRoqVfcMd5bZJdgwmkiMd1ch7UfGpump';

console.log(`
🎰⚡ SOL SLOT STORM ⚡🎰
=======================

🪙 Token: ${TOKEN_MINT}
🎯 Target: Token holders only
💰 Reward: 50% of creator fees
⏰ Frequency: Every 5 minutes
🔗 RPC: Helius mainnet

Starting SlotStorm service...
`);

const slotStormAPI = new SlotStormAPI(3003);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await slotStormAPI.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await slotStormAPI.stop();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the service
slotStormAPI.start().catch((error) => {
  console.error('💥 Failed to start SlotStorm:', error);
  process.exit(1);
});