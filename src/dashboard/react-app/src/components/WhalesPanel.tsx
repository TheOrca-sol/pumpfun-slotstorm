import React from 'react';

interface WhalesPanelProps {
  whales: any[];
}

export const WhalesPanel: React.FC<WhalesPanelProps> = ({ whales }) => {
  return (
    <div className="card">
      <h3 className="text-lg font-bold mb-4 flex items-center">
        🐋 Top Whales
        <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
          {whales.length}
        </span>
      </h3>

      {whales.length === 0 ? (
        <div className="text-center py-4 text-gray-400">
          No whale data available
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {whales.map((whale, index) => (
            <div key={index} className="bg-gray-700 rounded-lg p-3 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm text-white">
                  {whale.address ? `${whale.address.substring(0, 8)}...` : 'Unknown'}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-blue-400">
                    {whale.successRate || 0}%
                  </span>
                  <span className="text-xs text-gray-400">success</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Trades:</span>
                  <span className="ml-1 text-white">{whale.totalTrades || 0}</span>
                </div>
                <div>
                  <span className="text-gray-400">Volume:</span>
                  <span className="ml-1 text-green-400">
                    ${whale.totalVolume ? (whale.totalVolume / 1000).toFixed(1) : 0}K
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-500 mt-2">
                Last seen: {whale.lastSeen ? new Date(whale.lastSeen).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};