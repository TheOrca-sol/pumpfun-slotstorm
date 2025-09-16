import React, { useState, useEffect } from 'react';

interface Holder {
  wallet: string;
  balance: number;
  tickets: number;
  holdDuration: number; // in minutes
  winChance: number; // percentage
}

interface HoldersListProps {
  holders: Holder[];
  maxDisplay?: number;
  showTickets?: boolean;
}

export const HoldersList: React.FC<HoldersListProps> = ({
  holders,
  maxDisplay = 20,
  showTickets = true
}) => {
  const [displayHolders, setDisplayHolders] = useState<Holder[]>([]);
  const [sortBy, setSortBy] = useState<'balance' | 'tickets' | 'duration'>('tickets');

  useEffect(() => {
    const sorted = [...holders].sort((a, b) => {
      switch (sortBy) {
        case 'balance': return b.balance - a.balance;
        case 'tickets': return b.tickets - a.tickets;
        case 'duration': return b.holdDuration - a.holdDuration;
        default: return b.tickets - a.tickets;
      }
    });

    setDisplayHolders(sorted.slice(0, maxDisplay));
  }, [holders, sortBy, maxDisplay]);

  const formatWallet = (wallet: string) => {
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const formatBalance = (balance: number) => {
    if (balance >= 1000000) {
      return `${(balance / 1000000).toFixed(1)}M`;
    } else if (balance >= 1000) {
      return `${(balance / 1000).toFixed(1)}K`;
    }
    return balance.toFixed(0);
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 1440) {
      return `${Math.floor(minutes / 1440)}d`;
    } else if (minutes >= 60) {
      return `${Math.floor(minutes / 60)}h`;
    }
    return `${minutes}m`;
  };

  const getTicketColor = (tickets: number) => {
    if (tickets >= 100) return 'text-purple-400';
    if (tickets >= 50) return 'text-blue-400';
    if (tickets >= 20) return 'text-green-400';
    if (tickets >= 10) return 'text-yellow-400';
    return 'text-gray-400';
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return '👑';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `#${index + 1}`;
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-600">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">🎟️ Participants</h2>
        <div className="text-sm text-gray-400">
          {holders.length} total holders
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'tickets', label: 'Tickets' },
          { key: 'balance', label: 'Balance' },
          { key: 'duration', label: 'Hold Time' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key as typeof sortBy)}
            className={`
              px-3 py-1 rounded-lg text-xs font-medium transition-colors
              ${sortBy === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Holders List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {displayHolders.map((holder, index) => (
          <HolderRow
            key={holder.wallet}
            holder={holder}
            rank={index}
            showTickets={showTickets}
            formatWallet={formatWallet}
            formatBalance={formatBalance}
            formatDuration={formatDuration}
            getTicketColor={getTicketColor}
            getRankIcon={getRankIcon}
          />
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-gray-600">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-blue-400">
              {holders.reduce((sum, h) => sum + h.tickets, 0)}
            </div>
            <div className="text-xs text-gray-400">Total Tickets</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-400">
              {formatBalance(holders.reduce((sum, h) => sum + h.balance, 0))}
            </div>
            <div className="text-xs text-gray-400">Total Holdings</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-purple-400">
              {Math.round(holders.reduce((sum, h) => sum + h.holdDuration, 0) / holders.length)}m
            </div>
            <div className="text-xs text-gray-400">Avg Hold Time</div>
          </div>
        </div>
      </div>

      {/* Participation Animation */}
      <TicketAnimation />
    </div>
  );
};

interface HolderRowProps {
  holder: Holder;
  rank: number;
  showTickets: boolean;
  formatWallet: (wallet: string) => string;
  formatBalance: (balance: number) => string;
  formatDuration: (minutes: number) => string;
  getTicketColor: (tickets: number) => string;
  getRankIcon: (index: number) => string;
}

const HolderRow: React.FC<HolderRowProps> = ({
  holder,
  rank,
  showTickets,
  formatWallet,
  formatBalance,
  formatDuration,
  getTicketColor,
  getRankIcon
}) => {
  return (
    <div className={`
      flex items-center justify-between p-3 rounded-lg transition-all
      ${rank < 3 ? 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30' : 'bg-gray-700/50'}
      hover:bg-gray-600/50
    `}>
      {/* Rank & Wallet */}
      <div className="flex items-center gap-3">
        <div className="text-lg font-bold text-yellow-400 w-8 text-center">
          {getRankIcon(rank)}
        </div>
        <div>
          <div className="text-white font-mono text-sm">
            {formatWallet(holder.wallet)}
          </div>
          <div className="text-xs text-gray-400">
            {formatDuration(holder.holdDuration)} hold
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="text-center">
          <div className="text-green-400 font-semibold">
            {formatBalance(holder.balance)}
          </div>
          <div className="text-xs text-gray-500">tokens</div>
        </div>

        {showTickets && (
          <div className="text-center">
            <div className={`font-semibold ${getTicketColor(holder.tickets)}`}>
              {holder.tickets}
            </div>
            <div className="text-xs text-gray-500">tickets</div>
          </div>
        )}

        <div className="text-center">
          <div className="text-blue-400 font-semibold">
            {holder.winChance.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">chance</div>
        </div>
      </div>
    </div>
  );
};

const TicketAnimation: React.FC = () => {
  return (
    <div className="absolute top-4 right-4 pointer-events-none">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="absolute text-2xl animate-ticket-float"
          style={{
            animationDelay: `${i * 0.5}s`,
            right: `${i * 10}px`
          }}
        >
          🎟️
        </div>
      ))}
    </div>
  );
};