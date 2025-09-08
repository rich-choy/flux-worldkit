import { useEffect, useRef } from 'react';
import { type WorldEvent } from '@flux';

interface CombatLogProps {
  entries: WorldEvent[];
  maxEntries?: number;
}

export function CombatLog({ entries, maxEntries = 100 }: CombatLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Limit entries to prevent memory issues
  const displayEntries = entries.slice(-maxEntries);

  // Debug: Check for duplicate IDs
  const ids = displayEntries.map(e => e.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    console.warn('🚨 CombatLog: Found duplicate IDs in displayEntries:', duplicateIds);
    console.warn('🚨 All IDs:', ids);
  }

  return (
    <div className="combat-log border border-gray-200 rounded-lg">
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-900">Combat Log</h3>
        <p className="text-xs text-gray-500 mt-1">
          {displayEntries.length} entries {entries.length > maxEntries && `(showing last ${maxEntries})`}
        </p>
      </div>

      <div
        ref={logRef}
        className="p-3 h-64 overflow-y-auto space-y-2 text-sm font-mono"
      >
        {displayEntries.length === 0 ? (
          <div className="text-gray-500 italic text-center py-8">
            No combat actions yet. Enter a command to begin!
          </div>
        ) : (
          displayEntries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2">
              <span className="text-xs text-gray-400 mt-0.5 min-w-[50px]">
                {formatTimestamp(entry.ts)}
              </span>
              <span className="flex-1">
                {`${entry.type} - ${entry.actor}: ${JSON.stringify(entry.payload)}`}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Quick action indicators */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Turn Start</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span>Action</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>Attack</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span>Miss</span>
          </div>
        </div>
      </div>
    </div>
  );
}
