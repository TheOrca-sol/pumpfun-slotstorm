export interface EnhancedTokenData {
  // Basic token info
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image?: string;

  // Creator/Launch info
  creator?: string;
  createdTimestamp?: number;

  // Social links
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;

  // Market data
  marketCap?: number;
  usdMarketCap?: number;
  liquidity?: number;
  price?: number;
  volume24h?: number;
  priceChange24h?: number;

  // Bonding curve info
  bondingCurveProgress?: number;
  virtualSolReserves?: number;
  virtualTokenReserves?: number;
  realSolReserves?: number;
  realTokenReserves?: number;

  // Trading stats
  buys?: number;
  sells?: number;
  txns24h?: number;
  holderCount?: number;

  // Additional metadata
  supply?: number;
  decimals?: number;
  migrated?: boolean;
  complete?: boolean;
  raydiumPool?: string;

  // Analysis flags
  hasRuggedBefore?: boolean;
  suspiciousActivity?: boolean;
  honeypot?: boolean;
}

export class TokenMetadataService {
  private cache = new Map<string, { data: EnhancedTokenData; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getTokenData(mint: string): Promise<EnhancedTokenData | null> {
    // Check cache first
    const cached = this.cache.get(mint);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      // Fetch from multiple sources
      const [pumpFunData, metaplexData] = await Promise.allSettled([
        this.fetchFromPumpFun(mint),
        this.fetchFromMetaplex(mint)
      ]);

      let tokenData: EnhancedTokenData = { mint };

      // Merge data from pump.fun API
      if (pumpFunData.status === 'fulfilled' && pumpFunData.value) {
        tokenData = { ...tokenData, ...pumpFunData.value };
      }

      // Merge data from Metaplex (for additional metadata)
      if (metaplexData.status === 'fulfilled' && metaplexData.value) {
        tokenData = { ...tokenData, ...metaplexData.value };
      }

      // Cache the result
      this.cache.set(mint, { data: tokenData, timestamp: Date.now() });
      return tokenData;
    } catch (error) {
      console.error(`Error fetching token data for ${mint}:`, error);
      return null;
    }
  }

  private async fetchFromPumpFun(mint: string): Promise<Partial<EnhancedTokenData> | null> {
    try {
      console.log(`🔍 Fetching token data from pump.fun for ${mint}`);

      // Try different pump.fun API endpoints
      const endpoints = [
        `https://frontend-api-v3.pump.fun/coins/${mint}`,
        `https://frontend-api.pump.fun/coins/${mint}`,
        `https://api.pump.fun/coins/${mint}`
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🌐 Trying endpoint: ${endpoint}`);
          const response = await fetch(endpoint, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; TokenSniper/1.0)',
              'Accept': 'application/json'
            }
          });

          console.log(`📡 Response status: ${response.status}`);

          if (response.ok) {
            const data = await response.json();
            console.log(`✅ Fetched data from ${endpoint}:`, {
              hasMarketCap: !!data.market_cap,
              marketCap: data.market_cap,
              hasUsdMarketCap: !!data.usd_market_cap,
              usdMarketCap: data.usd_market_cap,
              name: data.name,
              symbol: data.symbol
            });
            return this.parsePumpFunData(data);
          } else {
            console.log(`❌ Endpoint ${endpoint} failed with status ${response.status}`);
          }
        } catch (err) {
          console.log(`❌ Endpoint ${endpoint} error:`, err.message);
          continue; // Try next endpoint
        }
      }

      console.log(`❌ All pump.fun endpoints failed for ${mint}`);
      return null;
    } catch (error) {
      console.error('Error fetching from pump.fun:', error);
      return null;
    }
  }

  private async fetchFromMetaplex(mint: string): Promise<Partial<EnhancedTokenData> | null> {
    try {
      // Try to fetch token metadata from Metaplex
      const response = await fetch(`https://api.metaplex.com/v1/tokens/${mint}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return this.parseMetaplexData(data);
      }

      return null;
    } catch (error) {
      // Metaplex might not have data for all tokens, that's ok
      return null;
    }
  }

  private parsePumpFunData(data: any): Partial<EnhancedTokenData> {
    const result: Partial<EnhancedTokenData> = {};

    // Basic info
    if (data.mint) result.mint = data.mint;
    if (data.name) result.name = data.name;
    if (data.symbol) result.symbol = data.symbol;
    if (data.description) result.description = data.description;
    if (data.image_uri || data.image) result.image = data.image_uri || data.image;

    // Creator
    if (data.creator) result.creator = data.creator;
    if (data.created_timestamp) result.createdTimestamp = data.created_timestamp;

    // Social links
    if (data.website) result.website = data.website;
    if (data.twitter) result.twitter = data.twitter;
    if (data.telegram) result.telegram = data.telegram;
    if (data.discord) result.discord = data.discord;

    // Market data
    if (data.market_cap) result.marketCap = parseFloat(data.market_cap);
    if (data.usd_market_cap) result.usdMarketCap = parseFloat(data.usd_market_cap);
    if (data.liquidity) result.liquidity = parseFloat(data.liquidity);
    if (data.price) result.price = parseFloat(data.price);
    if (data.volume_24h) result.volume24h = parseFloat(data.volume_24h);
    if (data.price_change_24h) result.priceChange24h = parseFloat(data.price_change_24h);

    // Bonding curve
    if (data.bonding_curve) {
      result.bondingCurveProgress = data.bonding_curve.progress;
      result.virtualSolReserves = data.bonding_curve.virtual_sol_reserves;
      result.virtualTokenReserves = data.bonding_curve.virtual_token_reserves;
      result.realSolReserves = data.bonding_curve.real_sol_reserves;
      result.realTokenReserves = data.bonding_curve.real_token_reserves;
    }

    // Trading stats
    if (data.buys) result.buys = data.buys;
    if (data.sells) result.sells = data.sells;
    if (data.txns_24h) result.txns24h = data.txns_24h;
    if (data.holder_count) result.holderCount = data.holder_count;

    // Token info
    if (data.total_supply) result.supply = parseFloat(data.total_supply);
    if (data.decimals) result.decimals = data.decimals;
    if (data.complete !== undefined) result.complete = data.complete;
    if (data.migrated !== undefined) result.migrated = data.migrated;
    if (data.raydium_pool) result.raydiumPool = data.raydium_pool;

    return result;
  }

  private parseMetaplexData(data: any): Partial<EnhancedTokenData> {
    const result: Partial<EnhancedTokenData> = {};

    // Extract additional metadata from Metaplex
    if (data.metadata) {
      if (data.metadata.name && !result.name) result.name = data.metadata.name;
      if (data.metadata.symbol && !result.symbol) result.symbol = data.metadata.symbol;
      if (data.metadata.description && !result.description) result.description = data.metadata.description;
      if (data.metadata.image && !result.image) result.image = data.metadata.image;
    }

    return result;
  }

  // Clean up old cache entries
  cleanupCache(): void {
    const now = Date.now();
    for (const [mint, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(mint);
      }
    }
  }
}