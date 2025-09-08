import { useState, type KeyboardEvent } from 'react';

interface CommandInputProps {
  onCommand: (command: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function CommandInput({
  onCommand,
  disabled = false,
  placeholder = "Enter command (e.g., target alice, reposition 150, attack)"
}: CommandInputProps) {
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      const command = input.trim();

      // Add to history
      setCommandHistory(prev => [command, ...prev.slice(0, 19)]); // Keep last 20 commands
      setHistoryIndex(-1);

      // Execute command
      onCommand(command);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  return (
    <div className="command-input-container">
      <div className="mb-2">
        <label htmlFor="command-input" className="block text-sm font-medium text-gray-700 mb-1">
          Command Input
        </label>
        <input
          id="command-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <div>
          <strong>Natural Language Commands:</strong> Use plain English to control your combatant
        </div>
        <div>
          <strong>Examples:</strong> "Attack Bob", "Move closer to Alice", "Back away 5 meters", "Defend myself"
        </div>
        <div>
          <strong>Navigation:</strong> ↑/↓ arrows for command history, Enter to execute
        </div>
      </div>
    </div>
  );
}
