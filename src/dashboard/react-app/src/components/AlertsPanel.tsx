import React from 'react';

interface AlertsPanelProps {
  alerts: any[];
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts }) => {
  return (
    <div className="card">
      <h3 className="text-lg font-bold mb-4 flex items-center">
        🚨 Active Alerts
        <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
          {alerts.length}
        </span>
      </h3>

      {alerts.length === 0 ? (
        <div className="text-center py-4 text-gray-400">
          No active alerts
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alerts.map((alert, index) => (
            <div key={index} className="bg-gray-700 rounded-lg p-3 border-l-4 border-red-500">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white truncate">
                  ${alert.symbol || 'Unknown'}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-red-400">
                    {alert.score}
                  </span>
                  <span className="text-xs text-gray-400">score</span>
                </div>
              </div>

              <div className="text-sm text-gray-300 mb-2">
                {alert.name || 'Unknown Token'}
              </div>

              {alert.triggers && alert.triggers.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {alert.triggers.slice(0, 3).map((trigger: any, i: number) => (
                    <span
                      key={i}
                      className="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded"
                    >
                      {trigger.type}
                    </span>
                  ))}
                  {alert.triggers.length > 3 && (
                    <span className="text-xs text-gray-400">
                      +{alert.triggers.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <div className="text-xs text-gray-500">
                {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'Just now'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};