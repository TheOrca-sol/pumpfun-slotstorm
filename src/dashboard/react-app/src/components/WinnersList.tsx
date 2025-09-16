import React from 'react';

interface Winner {
  address: string;
  amount: number;
  timestamp: number;
  winType: 'slot' | 'lightning';
  txHash?: string;
}

interface WinnersListProps {
  winners: Winner[];
  stats?: {
    totalWinners: number;
    totalWinnings: number;
    slotWinnings: number;
    lightningWinnings: number;
    lastWinner?: Winner | null;
  } | null;
  maxDisplay?: number;
}

export const WinnersList: React.FC<WinnersListProps> = ({
  winners,
  stats,
  maxDisplay = 15
}) => {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatSOL = (amount: number) => {
    return amount.toFixed(4);
  };

  const formatTimeAgo = (timestamp: number) => {
    const timeDiff = Date.now() - timestamp;
    const minutes = Math.floor(timeDiff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getWinTypeIcon = (winType: string) => {
    switch (winType) {
      case 'slot': return '🎰';
      case 'lightning': return '⚡';
      default: return '🏆';
    }
  };

  const getWinTypeColor = (winType: string) => {
    switch (winType) {
      case 'slot': return 'text-purple-400';
      case 'lightning': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-600">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          🏆 Recent Winners
        </h3>
        {stats && (
          <div className="text-sm text-gray-400">
            {stats.totalWinners} winners
          </div>
        )}
      </div>

      {/* Winner Stats */}
      {stats && stats.totalWinners > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-700/50 rounded-lg">
          <div className="text-center">
            <div className="text-lg font-semibold text-green-400">
              {formatSOL(stats.totalWinnings)} SOL
            </div>
            <div className="text-xs text-gray-400">Total Winnings</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-400">
              {stats.totalWinners}
            </div>
            <div className="text-xs text-gray-400">Total Winners</div>
          </div>
        </div>
      )}

      {/* Winners List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {winners.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">🎰</div>
            <div className="text-sm">No winners yet</div>
            <div className="text-xs mt-1">Winners will appear here when lottery draws occur</div>
          </div>
        ) : (
          winners.slice(0, maxDisplay).map((winner, index) => (
            <div
              key={`${winner.address}-${winner.timestamp}`}
              className={`
                flex items-center justify-between p-3 rounded-lg transition-all
                ${index === 0 ? 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30' : 'bg-gray-700/50 hover:bg-gray-700'}
              `}
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <span className="text-lg">{getWinTypeIcon(winner.winType)}</span>
                  {index === 0 && <span className="text-xs text-yellow-400">Latest</span>}
                </div>

                <div>
                  <div className="font-mono text-sm text-white">
                    {formatAddress(winner.address)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatTimeAgo(winner.timestamp)}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className={`font-semibold ${getWinTypeColor(winner.winType)}`}>
                  {formatSOL(winner.amount)} SOL
                </div>
                <div className="text-xs text-gray-400 capitalize">
                  {winner.winType} win
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {winners.length > maxDisplay && (
        <div className="text-center mt-3 text-xs text-gray-400">
          Showing {maxDisplay} of {winners.length} winners
        </div>
      )}
    </div>
  );
};