import React, { useState, useEffect } from 'react';
import { SoundEffects, useSoundEffects } from './SoundEffects';

interface SlotMachineProps {
  symbols: string[];
  isSpinning: boolean;
  onSpinComplete?: () => void;
  winner?: string | null;
  prize?: number;
  winType?: 'small' | 'medium' | 'large' | 'jackpot' | 'none';
}

export const SlotMachine: React.FC<SlotMachineProps> = ({
  symbols = ['🍎', '🍎', '🍎'],
  isSpinning,
  onSpinComplete,
  winner,
  prize,
  winType
}) => {
  const [displaySymbols, setDisplaySymbols] = useState(symbols);
  const [spinningReels, setSpinningReels] = useState([false, false, false]);
  const { soundState, playSpinSound, playWinSound } = useSoundEffects(0.3);

  // All possible symbols for spinning animation
  const allSymbols = ['🍎', '🍊', '🍇', '🍒', '💎', '⭐', '🔥', '⚡', '👑', '🏆', '💰', '🎰'];

  useEffect(() => {
    if (isSpinning) {
      startSpin();
    }
  }, [isSpinning]);

  const startSpin = () => {
    setSpinningReels([true, true, true]);
    playSpinSound(); // Play spinning sound

    // Stagger the reel stops for dramatic effect
    setTimeout(() => stopReel(0), 2000);
    setTimeout(() => stopReel(1), 2500);
    setTimeout(() => stopReel(2), 3000);
  };

  const stopReel = (reelIndex: number) => {
    setSpinningReels(prev => {
      const newSpinning = [...prev];
      newSpinning[reelIndex] = false;
      return newSpinning;
    });

    setDisplaySymbols(prev => {
      const newSymbols = [...prev];
      newSymbols[reelIndex] = symbols[reelIndex];
      return newSymbols;
    });

    // Check if all reels have stopped
    if (reelIndex === 2) {
      setTimeout(() => {
        if (winner && winType !== 'none') {
          playWinSound(); // Play win sound if there's a winner
        }
        onSpinComplete?.();
      }, 500);
    }
  };

  const getWinHighlight = () => {
    if (!winner || winType === 'none') return '';

    const winColors = {
      small: 'shadow-yellow-400',
      medium: 'shadow-orange-400',
      large: 'shadow-purple-400',
      jackpot: 'shadow-pink-400'
    };

    return `${winColors[winType]} shadow-2xl animate-pulse`;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Slot Machine Frame */}
      <div className={`
        relative bg-gradient-to-b from-yellow-400 to-yellow-600
        rounded-3xl p-8 shadow-2xl border-4 border-yellow-500
        ${getWinHighlight()}
      `}>
        {/* Machine Top */}
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-16 h-8 bg-red-500 rounded-full border-2 border-red-600"></div>

        {/* Display Screen */}
        <div className="bg-black rounded-lg p-6 mb-6 border-4 border-gray-800">
          <div className="flex justify-center gap-4">
            {displaySymbols.map((symbol, index) => (
              <ReelDisplay
                key={index}
                symbol={symbol}
                isSpinning={spinningReels[index]}
                allSymbols={allSymbols}
              />
            ))}
          </div>
        </div>

        {/* Prize Display */}
        {winner && prize && winType !== 'none' && (
          <div className="text-center mb-4">
            <div className="text-2xl font-bold text-white mb-2 animate-bounce">
              🎉 WINNER! 🎉
            </div>
            <div className="text-lg text-yellow-200">
              {prize.toFixed(3)} SOL
            </div>
            <div className="text-sm text-yellow-300 truncate">
              {winner.slice(0, 8)}...{winner.slice(-4)}
            </div>
          </div>
        )}

        {/* Control Panel */}
        <div className="flex justify-center">
          <div className="bg-red-600 rounded-full w-20 h-20 border-4 border-red-700 flex items-center justify-center">
            <div className="text-white font-bold text-sm">SPIN</div>
          </div>
        </div>
      </div>

      {/* Machine Base */}
      <div className="w-32 h-8 bg-gradient-to-b from-yellow-600 to-yellow-800 rounded-b-lg border-4 border-yellow-700 border-t-0"></div>
    </div>
  );
};

interface ReelDisplayProps {
  symbol: string;
  isSpinning: boolean;
  allSymbols: string[];
}

const ReelDisplay: React.FC<ReelDisplayProps> = ({ symbol, isSpinning, allSymbols }) => {
  const [currentSymbol, setCurrentSymbol] = useState(symbol);

  useEffect(() => {
    if (isSpinning) {
      const interval = setInterval(() => {
        setCurrentSymbol(allSymbols[Math.floor(Math.random() * allSymbols.length)]);
      }, 100);

      return () => clearInterval(interval);
    } else {
      setCurrentSymbol(symbol);
    }
  }, [isSpinning, symbol, allSymbols]);

  return (
    <div className={`
      w-20 h-20 bg-white rounded-lg border-2 border-gray-300
      flex items-center justify-center text-4xl
      transition-all duration-100
      ${isSpinning ? 'animate-pulse' : ''}
    `}>
      <span className={isSpinning ? 'blur-sm' : 'filter-none'}>
        {currentSymbol}
      </span>
    </div>
  );
};

// Add the SoundEffects component
const SlotMachineWithSounds: React.FC<SlotMachineProps> = (props) => {
  const { soundState } = useSoundEffects();

  return (
    <>
      <SlotMachine {...props} />
      <SoundEffects {...soundState} />
    </>
  );
};

export default SlotMachineWithSounds;