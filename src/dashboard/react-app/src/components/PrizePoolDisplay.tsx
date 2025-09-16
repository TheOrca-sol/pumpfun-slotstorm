import React, { useState, useEffect } from 'react';

interface PrizePoolDisplayProps {
  prizePool: number;
  growthRate?: number; // SOL per minute growth
  lastWinner?: {
    address: string;
    amount: number;
    timestamp: number;
  };
}

export const PrizePoolDisplay: React.FC<PrizePoolDisplayProps> = ({
  prizePool,
  growthRate = 0,
  lastWinner
}) => {
  const [displayAmount, setDisplayAmount] = useState(prizePool);
  const [isGrowing, setIsGrowing] = useState(false);

  useEffect(() => {
    setDisplayAmount(prizePool);
  }, [prizePool]);

  useEffect(() => {
    if (growthRate > 0) {
      const interval = setInterval(() => {
        setDisplayAmount(prev => prev + (growthRate / 60)); // Per second growth
        setIsGrowing(true);
        setTimeout(() => setIsGrowing(false), 200);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [growthRate]);

  const formatSOL = (amount: number) => {
    return amount.toFixed(3);
  };

  const formatUSD = (amount: number) => {
    return (amount * 244).toFixed(2); // Approximate SOL price
  };

  const getLastWinnerTime = () => {
    if (!lastWinner) return '';
    const timeDiff = Date.now() - lastWinner.timestamp;
    const minutes = Math.floor(timeDiff / 60000);
    const seconds = Math.floor((timeDiff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s ago`;
    }
    return `${seconds}s ago`;
  };

  return (
    <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-xl p-6 shadow-xl border border-green-400">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">💰 Prize Pool</h2>
        <div className="text-sm text-green-200">Auto-growing from trading fees</div>
      </div>

      {/* Main Prize Amount */}
      <div className="text-center mb-6">
        <div className={`
          text-6xl font-bold text-yellow-300 mb-2
          transition-all duration-200
          ${isGrowing ? 'scale-105 text-yellow-200' : 'scale-100'}
        `}>
          {formatSOL(displayAmount)} SOL
        </div>

        <div className="text-2xl text-green-200">
          ≈ ${formatUSD(displayAmount)} USD
        </div>

        {/* Growth Indicator */}
        {growthRate > 0 && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="text-green-300">📈</div>
            <div className="text-sm text-green-300">
              +{formatSOL(growthRate)}/min
            </div>
          </div>
        )}
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-black/20 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-yellow-300">
            {Math.floor(displayAmount / 0.1)}
          </div>
          <div className="text-xs text-green-200">Possible Winners</div>
        </div>

        <div className="bg-black/20 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-yellow-300">
            {(displayAmount * 0.4).toFixed(2)}
          </div>
          <div className="text-xs text-green-200">Next Big Win</div>
        </div>
      </div>

      {/* Last Winner */}
      {lastWinner && (
        <div className="bg-black/30 rounded-lg p-3">
          <div className="text-sm font-semibold text-white mb-1">🏆 Last Winner</div>
          <div className="text-xs text-green-200 mb-1">
            {lastWinner.address.slice(0, 8)}...{lastWinner.address.slice(-4)}
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-yellow-300">{formatSOL(lastWinner.amount)} SOL</span>
            <span className="text-green-300">{getLastWinnerTime()}</span>
          </div>
        </div>
      )}

      {/* Pool Growth Animation */}
      <div className="mt-4 relative">
        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-green-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (displayAmount / 10) * 100)}%` }}
          />
        </div>
        <div className="text-xs text-green-200 mt-1 text-center">
          Pool Growth Progress
        </div>
      </div>

      {/* Floating Coins Animation */}
      <FloatingCoins />
    </div>
  );
};

const FloatingCoins: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="absolute text-2xl animate-float-coin"
          style={{
            left: `${10 + (i * 12)}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${3 + Math.random() * 2}s`
          }}
        >
          🪙
        </div>
      ))}
    </div>
  );
};