import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetTime: number; // Unix timestamp
  onComplete?: () => void;
  title?: string;
  subtitle?: string;
  showProgress?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetTime,
  onComplete,
  title = "⏰ Next Spin",
  subtitle = "Get ready for the next slot draw!",
  showProgress = true
}) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, targetTime - now);

      setTimeLeft(remaining);

      // Calculate progress (assuming 5-minute intervals)
      const totalInterval = 300000; // 5 minutes in ms
      const elapsed = totalInterval - remaining;
      setProgress(Math.max(0, Math.min(100, (elapsed / totalInterval) * 100)));

      if (remaining === 0) {
        onComplete?.();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [targetTime, onComplete]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);

    return {
      minutes: minutes.toString().padStart(2, '0'),
      seconds: seconds.toString().padStart(2, '0'),
      centiseconds: centiseconds.toString().padStart(2, '0')
    };
  };

  const time = formatTime(timeLeft);
  const isUrgent = timeLeft < 30000; // Last 30 seconds
  const isVeryUrgent = timeLeft < 10000; // Last 10 seconds

  return (
    <div className={`
      bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl p-6 shadow-xl border
      ${isVeryUrgent ? 'border-red-500 animate-pulse' : isUrgent ? 'border-yellow-500' : 'border-blue-400'}
    `}>
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-blue-200">{subtitle}</p>
      </div>

      {/* Main Timer Display */}
      <div className="text-center mb-6">
        <div className={`
          flex justify-center items-center gap-2 text-6xl font-mono font-bold
          ${isVeryUrgent ? 'text-red-300 animate-bounce' : isUrgent ? 'text-yellow-300' : 'text-white'}
        `}>
          <div className="bg-black/30 rounded-lg px-3 py-2 min-w-[80px]">
            {time.minutes}
          </div>
          <div className={isUrgent ? 'animate-pulse text-red-400' : 'text-blue-300'}>:</div>
          <div className="bg-black/30 rounded-lg px-3 py-2 min-w-[80px]">
            {time.seconds}
          </div>
          <div className="text-2xl text-blue-300 ml-2">
            .{time.centiseconds}
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-3 text-sm text-blue-200">
          <span>MIN</span>
          <span className="ml-8">SEC</span>
        </div>
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="mb-6">
          <div className="h-3 bg-black/30 rounded-full overflow-hidden">
            <div
              className={`
                h-full rounded-full transition-all duration-300
                ${isVeryUrgent
                  ? 'bg-gradient-to-r from-red-400 to-red-600'
                  : isUrgent
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                    : 'bg-gradient-to-r from-blue-400 to-purple-500'
                }
              `}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-center text-xs text-blue-200 mt-2">
            {progress.toFixed(1)}% complete
          </div>
        </div>
      )}

      {/* Status Messages */}
      <div className="text-center">
        {timeLeft === 0 ? (
          <div className="text-lg font-bold text-green-400 animate-pulse">
            🎰 SPINNING NOW! 🎰
          </div>
        ) : isVeryUrgent ? (
          <div className="text-lg font-bold text-red-300 animate-bounce">
            🚨 FINAL COUNTDOWN! 🚨
          </div>
        ) : isUrgent ? (
          <div className="text-lg font-bold text-yellow-300">
            ⚠️ GET READY! ⚠️
          </div>
        ) : (
          <div className="text-blue-200">
            🎟️ Tickets are being counted...
          </div>
        )}
      </div>

      {/* Pulse Animation */}
      {isUrgent && <PulseEffect intensity={isVeryUrgent ? 'high' : 'medium'} />}
    </div>
  );
};

interface PulseEffectProps {
  intensity: 'medium' | 'high';
}

const PulseEffect: React.FC<PulseEffectProps> = ({ intensity }) => {
  return (
    <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
      <div className={`
        absolute inset-0 rounded-xl
        ${intensity === 'high'
          ? 'bg-red-500/20 animate-pulse-fast'
          : 'bg-yellow-500/20 animate-pulse'
        }
      `} />
    </div>
  );
};