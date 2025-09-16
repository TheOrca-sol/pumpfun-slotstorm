import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StatsGrid } from './components/StatsGrid';
import { TokenGrid } from './components/TokenGrid';
import { AlertsPanel } from './components/AlertsPanel';
import { WhalesPanel } from './components/WhalesPanel';
import SlotStormDashboard from './pages/SlotStormDashboard';
import { API } from './services/api';

function App() {
  const [stats, setStats] = useState<any>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [whales, setWhales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'slotstorm'>('slotstorm'); // Default to SlotStorm
  const [selectedTokenMint, setSelectedTokenMint] = useState<string>('');

  const fetchData = async () => {
    try {
      const [statsData, tokensData, alertsData, whalesData] = await Promise.all([
        API.getSniperStats(),
        API.getRecentTokens(),
        API.getSniperAlerts(),
        API.getTopWhales()
      ]);

      setStats(statsData);
      setTokens(tokensData.tokens || []);
      setAlerts(alertsData.alerts || []);
      setWhales(whalesData.whales || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleTokenSlotStorm = (tokenMint: string) => {
    setSelectedTokenMint(tokenMint);
    setCurrentView('slotstorm');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedTokenMint('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Render SlotStorm Dashboard
  if (currentView === 'slotstorm') {
    return (
      <div className="relative">
        <button
          onClick={handleBackToDashboard}
          className="fixed top-6 left-6 z-30 bg-gray-800/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors"
        >
          ← Back to Token Sniper
        </button>
        <SlotStormDashboard />
      </div>
    );
  }

  // Render Main Dashboard
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Stats Overview */}
          <StatsGrid stats={stats} />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Token Analysis */}
            <div className="lg:col-span-2">
              <TokenGrid
                tokens={tokens}
                onSlotStorm={handleTokenSlotStorm}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <AlertsPanel alerts={alerts} />
              <WhalesPanel whales={whales} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;