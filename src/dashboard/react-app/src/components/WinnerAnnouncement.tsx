import React, { useState, useEffect } from 'react';

interface WinnerAnnouncementProps {
  winner: string | null;
  prize: number;
  winType: 'small' | 'medium' | 'large' | 'jackpot' | 'lightning' | 'none';
  isVisible: boolean;
  onComplete?: () => void;
}

export const WinnerAnnouncement: React.FC<WinnerAnnouncementProps> = ({
  winner,
  prize,
  winType,
  isVisible,
  onComplete
}) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    if (isVisible && winner) {
      setShowConfetti(true);
      setAnimationPhase(1);

      // Animation sequence
      const timer1 = setTimeout(() => setAnimationPhase(2), 1000);
      const timer2 = setTimeout(() => setAnimationPhase(3), 3000);
      const timer3 = setTimeout(() => {
        setShowConfetti(false);
        setAnimationPhase(0);
        onComplete?.();
      }, 6000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isVisible, winner, onComplete]);

  if (!isVisible || !winner) return null;

  const getWinConfig = () => {
    switch (winType) {
      case 'jackpot':
        return {
          title: '🎰 JACKPOT! 🎰',
          color: 'from-pink-500 to-purple-600',
          textColor: 'text-pink-200',
          titleSize: 'text-6xl',
          animation: 'animate-bounce'
        };
      case 'large':
        return {
          title: '🏆 BIG WIN! 🏆',
          color: 'from-purple-500 to-blue-600',
          textColor: 'text-purple-200',
          titleSize: 'text-5xl',
          animation: 'animate-pulse'
        };
      case 'medium':
        return {
          title: '⭐ WINNER! ⭐',
          color: 'from-orange-500 to-red-600',
          textColor: 'text-orange-200',
          titleSize: 'text-4xl',
          animation: 'animate-bounce'
        };
      case 'small':
        return {
          title: '🎉 WIN! 🎉',
          color: 'from-yellow-500 to-orange-600',
          textColor: 'text-yellow-200',
          titleSize: 'text-3xl',
          animation: 'animate-pulse'
        };
      case 'lightning':
        return {
          title: '⚡ LIGHTNING STRIKE! ⚡',
          color: 'from-yellow-400 to-purple-600',
          textColor: 'text-yellow-200',
          titleSize: 'text-5xl',
          animation: 'animate-flash'
        };
      default:
        return {
          title: '🎉 WIN! 🎉',
          color: 'from-green-500 to-blue-600',
          textColor: 'text-green-200',
          titleSize: 'text-3xl',
          animation: 'animate-pulse'
        };
    }
  };

  const config = getWinConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Confetti */}
      {showConfetti && <ConfettiEffect />}

      {/* Main Announcement */}
      <div className={`
        relative z-10 bg-gradient-to-br ${config.color}
        rounded-3xl p-8 shadow-2xl border-4 border-white/30
        transform transition-all duration-1000
        ${animationPhase >= 1 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
        ${animationPhase >= 2 ? config.animation : ''}
      `}>
        <div className="text-center">
          {/* Win Title */}
          <div className={`${config.titleSize} font-bold text-white mb-6 ${config.animation}`}>
            {config.title}
          </div>

          {/* Prize Amount */}
          <div className="text-4xl font-bold text-white mb-4">
            🪙 {prize.toFixed(3)} SOL
          </div>

          {/* Winner Address */}
          <div className={`text-xl ${config.textColor} mb-4`}>
            Winner: {winner.slice(0, 8)}...{winner.slice(-4)}
          </div>

          {/* Prize in USD (approximate) */}
          <div className="text-lg text-white/80">
            ≈ ${(prize * 244).toFixed(2)} USD
          </div>

          {/* Celebration Message */}
          {animationPhase >= 3 && (
            <div className="mt-6 text-lg text-white/90 animate-fade-in">
              Congratulations! 🎊
            </div>
          )}
        </div>
      </div>

      {/* Side Fireworks */}
      {winType === 'jackpot' && <FireworksEffect />}
    </div>
  );
};

const ConfettiEffect: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 100 }).map((_, i) => (
        <div
          key={i}
          className={`
            absolute w-3 h-3 rounded-sm animate-confetti
            ${['bg-pink-400', 'bg-purple-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-400'][i % 5]}
          `}
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${2 + Math.random() * 2}s`
          }}
        />
      ))}
    </div>
  );
};

const FireworksEffect: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Left firework */}
      <div className="absolute top-1/4 left-1/4 text-6xl animate-firework">
        🎆
      </div>

      {/* Right firework */}
      <div className="absolute top-1/3 right-1/4 text-6xl animate-firework" style={{ animationDelay: '0.5s' }}>
        🎆
      </div>

      {/* Top firework */}
      <div className="absolute top-1/6 left-1/2 text-6xl animate-firework" style={{ animationDelay: '1s' }}>
        🎆
      </div>

      {/* Bottom fireworks */}
      <div className="absolute bottom-1/4 left-1/3 text-4xl animate-firework" style={{ animationDelay: '1.5s' }}>
        🎇
      </div>
      <div className="absolute bottom-1/4 right-1/3 text-4xl animate-firework" style={{ animationDelay: '2s' }}>
        🎇
      </div>
    </div>
  );
};