import React from 'react';

interface StatsGridProps {
  stats: any;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  if (!stats) return null;

  const statCards = [
    {
      title: 'Active Alerts',
      value: stats.activeAlerts || 0,
      icon: '🚨',
      color: 'text-red-400'
    },
    {
      title: 'Whales Tracked',
      value: stats.whalesTracked || 0,
      icon: '🐋',
      color: 'text-blue-400'
    },
    {
      title: 'Tokens Analyzed',
      value: stats.tokensAnalyzed || 0,
      icon: '🔍',
      color: 'text-green-400'
    },
    {
      title: 'Recent Alerts (1h)',
      value: stats.recentAlertsHour || 0,
      icon: '📊',
      color: 'text-yellow-400'
    },
    {
      title: 'Average Score',
      value: stats.averageScore || 0,
      icon: '⭐',
      color: 'text-purple-400'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {statCards.map((stat, index) => (
        <div key={index} className="card">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-2xl ${stat.color}`}>{stat.icon}</span>
            <div className={`text-2xl font-bold ${stat.color}`}>
              {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
            </div>
          </div>
          <div className="text-sm text-gray-400">{stat.title}</div>
        </div>
      ))}
    </div>
  );
};