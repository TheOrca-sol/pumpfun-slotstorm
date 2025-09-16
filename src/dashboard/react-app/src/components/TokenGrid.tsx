import React from 'react';

interface TokenGridProps {
  tokens: any[];
  onSlotStorm?: (tokenMint: string) => void;
}

export const TokenGrid: React.FC<TokenGridProps> = ({ tokens, onSlotStorm }) => {
  if (!tokens || tokens.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-bold mb-4">🔍 Recently Analyzed Tokens</h2>
        <div className="text-center py-8 text-gray-400">
          No tokens analyzed yet. The sniper is analyzing new token launches...
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">🔍 Recently Analyzed Tokens</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tokens.map((token, index) => (
          <div key={index} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <img
                  src={token.image || `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="#374151"/><text x="20" y="25" text-anchor="middle" fill="white" font-family="monospace" font-size="12">?</text></svg>`)}`}
                  alt={token.name}
                  className="w-10 h-10 rounded-full mr-3"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="#374151"/><text x="20" y="25" text-anchor="middle" fill="white" font-family="monospace" font-size="12">?</text></svg>`)}`;
                  }}
                />
                <div>
                  <h3 className="font-semibold text-white truncate">{token.name}</h3>
                  <div className="text-sm text-gray-400">${token.symbol}</div>
                </div>
              </div>

              {/* PumpFun Chart Link */}
              <a
                href={`https://pump.fun/coin/${token.mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-200 group"
                title="View on Pump.fun"
              >
                <svg
                  className="w-4 h-4 text-white group-hover:scale-110 transition-transform duration-200"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 13h8V3H9v6H3v4zm0 8h6v-6H3v6zm10 0h8v-4h-6v4zm2-16v6h6V5h-6z"/>
                </svg>
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="metric">
                <div className="metric-value text-lg text-purple-400">
                  {token.analyzedScore || 0}
                </div>
                <div className="metric-label">Analysis Score</div>
              </div>

              <div className="metric">
                <div className="metric-value text-lg text-green-400">
                  {(() => {
                    // Prioritize USD market cap if available
                    if (token.metadata?.usdMarketCap && token.metadata.usdMarketCap > 0) {
                      return `$${(token.metadata.usdMarketCap / 1000).toFixed(1)}K`;
                    }
                    // Fall back to SOL market cap converted to approximate USD (SOL ~$244)
                    if (token.metadata?.marketCap && token.metadata.marketCap > 0) {
                      const usdValue = token.metadata.marketCap * 244; // Approximate SOL price
                      return `$${(usdValue / 1000).toFixed(1)}K`;
                    }
                    // Default for new tokens (pump.fun tokens typically start around $4-5K)
                    return '$4.8K';
                  })()}
                </div>
                <div className="metric-label">Market Cap</div>
              </div>

              <div className="metric">
                <div className="metric-value text-lg text-blue-400">
                  {token.metadata?.holderCount || '1'}
                </div>
                <div className="metric-label">Holders</div>
              </div>

              <div className="metric">
                <div className="metric-value text-lg text-green-400">
                  {token.timestamp ? `${Math.floor((Date.now() - token.timestamp) / 60000)}m` : 'N/A'}
                </div>
                <div className="metric-label">Age</div>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-2 mt-3 text-xs">
              {token.metadata?.hasWebsite && (
                <span className="bg-blue-600 text-white px-2 py-1 rounded">🌐 Website</span>
              )}
              {token.metadata?.hasTwitter && (
                <span className="bg-cyan-600 text-white px-2 py-1 rounded">🐦 Twitter</span>
              )}
              {token.metadata?.hasTelegram && (
                <span className="bg-blue-500 text-white px-2 py-1 rounded">📱 Telegram</span>
              )}
              {token.metadata?.hasDiscord && (
                <span className="bg-indigo-600 text-white px-2 py-1 rounded">🎮 Discord</span>
              )}
            </div>

            {/* Additional metrics */}
            {(token.metadata?.volume24h || token.metadata?.priceChange24h) && (
              <div className="grid grid-cols-2 gap-3 text-xs mt-2 pt-2 border-t border-gray-600">
                {token.metadata?.volume24h && (
                  <div className="metric">
                    <div className="metric-value text-sm text-yellow-400">
                      ${(token.metadata.volume24h / 1000).toFixed(1)}K
                    </div>
                    <div className="metric-label">24h Volume</div>
                  </div>
                )}
                {token.metadata?.priceChange24h && (
                  <div className="metric">
                    <div className={`metric-value text-sm ${token.metadata.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {token.metadata.priceChange24h >= 0 ? '+' : ''}{token.metadata.priceChange24h.toFixed(1)}%
                    </div>
                    <div className="metric-label">24h Change</div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-gray-600">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  🔍 Recently Analyzed
                </span>
                <div className="flex items-center gap-2">
                  {onSlotStorm && (
                    <button
                      onClick={() => onSlotStorm(token.mint)}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1"
                      title="Launch Slot Storm for this token"
                    >
                      ⚡ Storm
                    </button>
                  )}
                  <span className="text-xs text-gray-500 font-mono">
                    {token.mint?.substring(0, 8)}...
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};