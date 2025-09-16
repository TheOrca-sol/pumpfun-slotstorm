import React, { useEffect, useRef } from 'react';

interface SoundEffectsProps {
  playSpinSound?: boolean;
  playWinSound?: boolean;
  playTickSound?: boolean;
  playBackgroundMusic?: boolean;
  volume?: number;
}

export const SoundEffects: React.FC<SoundEffectsProps> = ({
  playSpinSound = false,
  playWinSound = false,
  playTickSound = false,
  playBackgroundMusic = false,
  volume = 0.5
}) => {
  const spinAudioRef = useRef<HTMLAudioElement>(null);
  const winAudioRef = useRef<HTMLAudioElement>(null);
  const tickAudioRef = useRef<HTMLAudioElement>(null);
  const backgroundMusicRef = useRef<HTMLAudioElement>(null);

  // Create audio data URLs using Web Audio API for synthetic sounds
  const createTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  };

  const playSlotSpinSound = () => {
    // Create spinning reel sound effect
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.5);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 3);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2000, audioContext.currentTime + 0.5);
    filter.frequency.exponentialRampToValueAtTime(500, audioContext.currentTime + 3);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.2, audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 3);
  };

  const playWinnerSound = () => {
    // Create victory fanfare
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      setTimeout(() => {
        createTone(freq, 0.5, 'square');
      }, index * 150);
    });

    // Add sparkle effect
    setTimeout(() => {
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          createTone(1000 + Math.random() * 1000, 0.1, 'sine');
        }, i * 50);
      }
    }, 600);
  };

  const playTickingSound = () => {
    // Short tick sound
    createTone(800, 0.05, 'square');
  };

  const playAmbientMusic = () => {
    // Create ambient casino-like background music
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator1.type = 'sine';
    oscillator2.type = 'sine';
    oscillator1.frequency.setValueAtTime(220, audioContext.currentTime); // A3
    oscillator2.frequency.setValueAtTime(330, audioContext.currentTime); // E4

    gainNode.gain.setValueAtTime(volume * 0.1, audioContext.currentTime);

    oscillator1.start(audioContext.currentTime);
    oscillator2.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 5);
    oscillator2.stop(audioContext.currentTime + 5);
  };

  useEffect(() => {
    if (playSpinSound) {
      playSlotSpinSound();
    }
  }, [playSpinSound]);

  useEffect(() => {
    if (playWinSound) {
      playWinnerSound();
    }
  }, [playWinSound]);

  useEffect(() => {
    if (playTickSound) {
      playTickingSound();
    }
  }, [playTickSound]);

  useEffect(() => {
    if (playBackgroundMusic) {
      playAmbientMusic();
    }
  }, [playBackgroundMusic]);

  return (
    <div className="hidden">
      {/* Hidden audio elements for fallback */}
      <audio ref={spinAudioRef} preload="auto" />
      <audio ref={winAudioRef} preload="auto" />
      <audio ref={tickAudioRef} preload="auto" />
      <audio ref={backgroundMusicRef} preload="auto" loop />
    </div>
  );
};

// Custom hook for easier sound management
export const useSoundEffects = (volume = 0.5) => {
  const [soundState, setSoundState] = React.useState({
    playSpinSound: false,
    playWinSound: false,
    playTickSound: false,
    playBackgroundMusic: false
  });

  const playSpinSound = React.useCallback(() => {
    setSoundState(prev => ({ ...prev, playSpinSound: true }));
    setTimeout(() => setSoundState(prev => ({ ...prev, playSpinSound: false })), 100);
  }, []);

  const playWinSound = React.useCallback(() => {
    setSoundState(prev => ({ ...prev, playWinSound: true }));
    setTimeout(() => setSoundState(prev => ({ ...prev, playWinSound: false })), 100);
  }, []);

  const playTickSound = React.useCallback(() => {
    setSoundState(prev => ({ ...prev, playTickSound: true }));
    setTimeout(() => setSoundState(prev => ({ ...prev, playTickSound: false })), 100);
  }, []);

  const toggleBackgroundMusic = React.useCallback(() => {
    setSoundState(prev => ({ ...prev, playBackgroundMusic: !prev.playBackgroundMusic }));
  }, []);

  return {
    soundState,
    playSpinSound,
    playWinSound,
    playTickSound,
    toggleBackgroundMusic
  };
};