import React, { useEffect, useState } from 'react';

interface WeatherSystemProps {
  weatherType: 'sunny' | 'rainy' | 'storm' | 'lightning';
  multiplier: number;
  duration: number;
  startTime: number;
}

export const WeatherSystem: React.FC<WeatherSystemProps> = ({
  weatherType,
  multiplier,
  duration,
  startTime
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, duration]);

  const getWeatherIcon = () => {
    switch (weatherType) {
      case 'sunny': return '☀️';
      case 'rainy': return '🌧️';
      case 'storm': return '⛈️';
      case 'lightning': return '⚡';
      default: return '☀️';
    }
  };

  const getWeatherBg = () => {
    switch (weatherType) {
      case 'sunny': return 'from-yellow-400 to-orange-400';
      case 'rainy': return 'from-blue-400 to-gray-500';
      case 'storm': return 'from-purple-600 to-gray-800';
      case 'lightning': return 'from-yellow-300 to-purple-600';
      default: return 'from-yellow-400 to-orange-400';
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative">
      {/* Weather Background */}
      <div className={`
        absolute inset-0 bg-gradient-to-br ${getWeatherBg()}
        opacity-20 rounded-xl pointer-events-none
        ${weatherType === 'storm' ? 'animate-pulse' : ''}
      `} />

      {/* Weather Particles */}
      {weatherType === 'rainy' && <RainEffect />}
      {weatherType === 'storm' && <StormEffect />}
      {weatherType === 'lightning' && <LightningEffect />}

      {/* Weather Display */}
      <div className="relative z-10 bg-black/50 backdrop-blur-sm rounded-xl p-4 border border-white/20">
        <div className="text-center">
          <div className="text-6xl mb-2 animate-bounce">
            {getWeatherIcon()}
          </div>

          <div className="text-xl font-bold text-white mb-2 capitalize">
            {weatherType} Weather
          </div>

          <div className="text-lg text-yellow-400 mb-2">
            {multiplier}x Multiplier
          </div>

          <div className="text-sm text-gray-300">
            {timeRemaining > 0 ? formatTime(timeRemaining) : 'Changing...'}
          </div>
        </div>
      </div>
    </div>
  );
};

const RainEffect: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-0.5 h-8 bg-blue-400 opacity-60 animate-fall"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${0.5 + Math.random() * 1}s`
          }}
        />
      ))}
    </div>
  );
};

const StormEffect: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {/* Heavy Rain */}
      {Array.from({ length: 80 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-12 bg-gray-400 opacity-80 animate-fall-fast"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 1}s`,
            animationDuration: `${0.3 + Math.random() * 0.5}s`
          }}
        />
      ))}

      {/* Lightning Flashes */}
      <div className="absolute inset-0 bg-white opacity-0 animate-lightning" />
    </div>
  );
};

const LightningEffect: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      <div className="absolute inset-0 bg-yellow-200 opacity-0 animate-lightning-fast" />

      {/* Lightning Bolts */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="absolute text-4xl text-yellow-300 animate-flash"
          style={{
            left: `${20 + i * 30}%`,
            top: `${10 + Math.random() * 50}%`,
            animationDelay: `${i * 0.3}s`
          }}
        >
          ⚡
        </div>
      ))}
    </div>
  );
};