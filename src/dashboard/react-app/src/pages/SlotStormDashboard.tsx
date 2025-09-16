import React, { useState, useEffect } from 'react';
import SlotMachineWithSounds from '../components/SlotMachine';
import { WeatherSystem } from '../components/WeatherSystem';
import { WinnerAnnouncement } from '../components/WinnerAnnouncement';
import { PrizePoolDisplay } from '../components/PrizePoolDisplay';
import { WinnersList } from '../components/WinnersList';
import { CountdownTimer } from '../components/CountdownTimer';

interface SlotStormState {
  isSpinning: boolean;
  nextSpinTime: number;
  prizePool: number;
  weather: 'clear' | 'cloudy' | 'rainy' | 'stormy';
  participants: any[];
  recentWinner?: {
    address: string;
    amount: number;
    timestamp: number;
  };
  showWinnerAnnouncement: boolean;
}

const TOKEN_MINT = '9zFdsBhgqWd6WRoqVfcMd5bZJdgwmkiMd1ch7UfGpump';

export const SlotStormDashboard: React.FC = () => {
  const [state, setState] = useState<SlotStormState>({
    isSpinning: false,
    nextSpinTime: Date.now() + 300000, // 5 minutes from now
    prizePool: 0,
    weather: 'clear',
    participants: [],
    showWinnerAnnouncement: false
  });

  const [slotStormData, setSlotStormData] = useState<any>(null);
  const [holders, setHolders] = useState<any[]>([]);
  const [winners, setWinners] = useState<any[]>([]);
  const [winnerStats, setWinnerStats] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSlotStormData();
    const interval = setInterval(fetchSlotStormData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const countdownInterval = setInterval(() => {
      if (Date.now() >= state.nextSpinTime && !state.isSpinning) {
        handleAutomaticSpin();
      }
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [state.nextSpinTime, state.isSpinning]);

  const fetchSlotStormData = async () => {
    try {
      setError('');

      // Fetch main SlotStorm data
      const [slotStormResponse, holdersResponse, winnersResponse, statsResponse] = await Promise.all([
        fetch('http://localhost:3003/api/slotstorm'),
        fetch('http://localhost:3003/api/slotstorm/holders?limit=50'),
        fetch('http://localhost:3003/api/slotstorm/winners?limit=20'),
        fetch('http://localhost:3003/api/slotstorm/stats')
      ]);

      if (!slotStormResponse.ok) {
        throw new Error('SlotStorm service not available');
      }

      const slotStormData = await slotStormResponse.json();
      const holdersData = holdersResponse.ok ? await holdersResponse.json() : { holders: [] };
      const winnersData = winnersResponse.ok ? await winnersResponse.json() : { winners: [], stats: null };
      const statsData = statsResponse.ok ? await statsResponse.json() : {};

      setSlotStormData(slotStormData);
      setHolders(holdersData.holders || []);
      setWinners(winnersData.winners || []);
      setWinnerStats(winnersData.stats);
      setStats(statsData);

      // Update state
      setState(prev => ({
        ...prev,
        prizePool: slotStormData.prizePool || 0,
        participants: slotStormData.participants || [],
        nextSpinTime: slotStormData.nextSlotTime || (Date.now() + 300000),
        weather: getWeatherType(slotStormData.weather?.type || 'sunny')
      }));

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch SlotStorm data:', error);
      setError('Failed to connect to SlotStorm service. Make sure it\'s running on port 3003.');
      setLoading(false);
    }
  };

  const getWeatherType = (type: string): 'clear' | 'cloudy' | 'rainy' | 'stormy' => {
    switch (type) {
      case 'sunny': return 'clear';
      case 'cloudy': return 'cloudy';
      case 'rainy': return 'rainy';
      case 'stormy': return 'stormy';
      default: return 'clear';
    }
  };

  const handleAutomaticSpin = async () => {
    setState(prev => ({ ...prev, isSpinning: true }));

    try {
      // Trigger lottery draw
      const response = await fetch('http://localhost:3003/api/slotstorm/draw', {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();

        // Simulate weather change during spin
        const weatherStates: Array<'clear' | 'cloudy' | 'rainy' | 'stormy'> = ['cloudy', 'rainy', 'stormy'];
        const newWeather = weatherStates[Math.floor(Math.random() * weatherStates.length)];

        setState(prev => ({ ...prev, weather: newWeather }));

        // After spin animation completes (3 seconds)
        setTimeout(() => {
          if (result.draw && result.draw.winner) {
            setState(prev => ({
              ...prev,
              isSpinning: false,
              recentWinner: {
                address: result.draw.winner.address,
                amount: result.draw.winner.prize,
                timestamp: Date.now()
              },
              showWinnerAnnouncement: true,
              nextSpinTime: Date.now() + 300000, // Next spin in 5 minutes
              weather: 'clear'
            }));
          } else {
            // No winner this round
            setState(prev => ({
              ...prev,
              isSpinning: false,
              nextSpinTime: Date.now() + 300000,
              weather: 'clear'
            }));
          }

          // Refresh data after draw
          fetchSlotStormData();
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to execute lottery draw:', error);
      setState(prev => ({
        ...prev,
        isSpinning: false,
        nextSpinTime: Date.now() + 300000
      }));
    }
  };

  const handleWinnerAnnouncementClose = () => {
    setState(prev => ({ ...prev, showWinnerAnnouncement: false }));
  };

  const handleManualSpin = () => {
    if (!state.isSpinning && state.participants.length > 0) {
      handleAutomaticSpin();
    }
  };

  const formatTokenMint = (mint: string) => {
    return `${mint.slice(0, 8)}...${mint.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold mb-4">🎰 Loading SlotStorm...</h1>
          <p className="text-gray-400">Connecting to SlotStorm service...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">SlotStorm Service Offline</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="bg-gray-800 p-4 rounded-lg mb-6 text-left max-w-md">
            <p className="text-sm text-green-400 mb-2">To start SlotStorm service:</p>
            <code className="text-xs text-gray-300">npm run slotstorm</code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white overflow-hidden relative">
      {/* Weather System Background */}
      <WeatherSystem weather={state.weather} />

      {/* Header */}
      <div className="relative z-10 p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            ⚡ SOL SLOT STORM ⚡
          </h1>
          <p className="text-lg text-gray-300">
            Token: {formatTokenMint(TOKEN_MINT)}
          </p>
          <div className="mt-2 flex justify-center items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${slotStormData ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <span className="text-sm text-gray-400">
                {slotStormData ? 'SlotStorm Active' : 'SlotStorm Offline'}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Holders: {holders.length}
            </div>
            <div className="text-sm text-gray-400">
              Participants: {state.participants.length}
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-600 mb-8 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-6 text-purple-300">🎰 How SlotStorm Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🪙</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-blue-300">Hold Tokens</h3>
              <p className="text-sm text-gray-300">
                Own tokens of {formatTokenMint(TOKEN_MINT)} to automatically participate in the lottery
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎫</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-green-300">Earn Tickets</h3>
              <p className="text-sm text-gray-300">
                Get lottery tickets based on your holdings. Formula: 1 ticket per 1,000 tokens (minimum 1)
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-yellow-300">Lightning Strikes</h3>
              <p className="text-sm text-gray-300">
                Every 5 minutes, the storm selects a random winner based on ticket weight
              </p>
            </div>

            {/* Step 4 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-purple-300">Win Prizes</h3>
              <p className="text-sm text-gray-300">
                Winners receive 50% of creator fees from real trading. $15 minimum threshold with fee accumulation
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-8 p-4 bg-gray-700/30 rounded-lg border border-gray-500">
            <h4 className="text-lg font-semibold mb-3 text-center text-cyan-300">💡 Key Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <span className="text-green-400 font-semibold">✅ Fair System</span>
                <p className="text-gray-300 mt-1">Linear scaling: 1 ticket per 1,000 tokens held</p>
              </div>
              <div className="text-center">
                <span className="text-blue-400 font-semibold">🔍 Transparent</span>
                <p className="text-gray-300 mt-1">All draws are verifiable on blockchain</p>
              </div>
              <div className="text-center">
                <span className="text-purple-400 font-semibold">🎯 Holders Only</span>
                <p className="text-gray-300 mt-1">Must hold tokens to participate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Left Column */}
          <div className="space-y-6">
            <CountdownTimer
              targetTime={state.nextSpinTime}
              onComplete={() => {}} // Handled by useEffect
              title="⏰ Next Storm"
              subtitle="Lightning strikes every 5 minutes!"
            />

            <PrizePoolDisplay
              prizePool={state.prizePool}
              growthRate={0} // No artificial growth - only real data
              lastWinner={state.recentWinner}
            />

            {/* Manual Controls */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-600">
              <h3 className="text-lg font-bold mb-4">🎮 Storm Controls</h3>
              <div className="space-y-3">
                <button
                  onClick={handleManualSpin}
                  disabled={state.isSpinning || state.participants.length === 0}
                  className={`
                    w-full py-3 px-4 rounded-lg font-semibold text-lg transition-all
                    ${state.isSpinning || state.participants.length === 0
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white'
                    }
                  `}
                >
                  {state.isSpinning ? '🌪️ Storm in Progress...' : '⚡ Force Lightning Strike'}
                </button>

                <div className="text-xs text-gray-400 text-center">
                  {state.participants.length === 0
                    ? 'No participants yet'
                    : `${state.participants.length} holders ready`
                  }
                </div>
              </div>
            </div>

            {/* Real-time Stats */}
            {stats && (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-600">
                <h3 className="text-lg font-bold mb-4">📊 Live Stats</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-400">
                      {stats.totalHolders || 0}
                    </div>
                    <div className="text-xs text-gray-400">Total Holders</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-400">
                      {(stats.totalTokensHeld || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">Tokens Held</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-yellow-400">
                      {(stats.totalFeesCollected || 0).toFixed(3)} SOL
                    </div>
                    <div className="text-xs text-gray-400">Fees Collected</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-400">
                      {(stats.averageHolding || 0).toFixed(0)}
                    </div>
                    <div className="text-xs text-gray-400">Avg Holding</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Center Column - Slot Machine */}
          <div className="flex justify-center">
            <SlotMachineWithSounds
              symbols={['⚡', '🌩️', '💰']}
              isSpinning={state.isSpinning}
              onSpinComplete={() => {}}
              winner={state.recentWinner?.address}
              prize={state.recentWinner?.amount}
              winType={state.recentWinner ? 'large' : 'none'}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <WinnersList
              winners={winners}
              stats={winnerStats}
              maxDisplay={15}
            />

            {/* Lottery Participants */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-600">
              <h3 className="text-lg font-bold mb-4">🎯 Lottery Participants</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {slotStormData?.participants?.length > 0 ? (
                  slotStormData.participants.slice(0, 15).map((participant, index) => (
                    <div
                      key={participant.address}
                      className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="font-mono text-sm text-white">
                            {participant.address?.slice(0, 8)}...{participant.address?.slice(-4)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {(participant.balance || 0).toLocaleString()} tokens
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-sm font-semibold text-yellow-400">
                              {participant.tickets || 0}
                            </div>
                            <div className="text-xs text-gray-400">tickets</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-semibold text-green-400">
                              {(participant.winChance || 0).toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-400">chance</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <div className="text-3xl mb-2">🎯</div>
                    <div className="text-sm">No participants yet</div>
                    <div className="text-xs mt-1">Hold tokens to participate in the lottery</div>
                  </div>
                )}
              </div>

              {slotStormData?.participants?.length > 15 && (
                <div className="text-center mt-3 text-xs text-gray-400">
                  Showing 15 of {slotStormData.participants.length} participants
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Winner Announcement Overlay */}
      {state.showWinnerAnnouncement && state.recentWinner && (
        <WinnerAnnouncement
          winner={{
            address: state.recentWinner.address,
            amount: state.recentWinner.amount,
            prize: state.recentWinner.amount
          }}
          onClose={handleWinnerAnnouncementClose}
        />
      )}

      {/* Storm Intensity Indicator */}
      <div className="fixed bottom-6 left-6 z-20">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-gray-600">
          <div className="flex items-center gap-2">
            <div className="text-xl">
              {state.weather === 'clear' && '☀️'}
              {state.weather === 'cloudy' && '☁️'}
              {state.weather === 'rainy' && '🌧️'}
              {state.weather === 'stormy' && '⛈️'}
            </div>
            <div className="text-sm text-gray-300">
              {state.weather === 'clear' && 'Calm Weather'}
              {state.weather === 'cloudy' && 'Storm Building'}
              {state.weather === 'rainy' && 'Heavy Rain'}
              {state.weather === 'stormy' && 'Lightning Storm!'}
            </div>
          </div>
        </div>
      </div>

      {/* Live Status Indicator */}
      <div className="fixed top-6 right-6 z-20">
        <div className="bg-red-600/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-red-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-white">🔴 LIVE STORM</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlotStormDashboard;