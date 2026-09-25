import { useState } from 'react';
import { Search, Menu, X } from 'lucide-react';

export default function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // Process natural language command
      console.log('Executing command:', query);
      // TODO: Send to API via WebSocket or fetch
      setQuery('');
      setIsOpen(false);
    }
  };

  return (
    <div className="border-b border-[var(--panel-2)] bg-[var(--panel)]/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex-shrink-0">
            <span className="text-sm font-medium text-[var(--text-dim)]">Spinach OS Command Center</span>
          </div>
          <div className="hidden sm:flex sm:items-center sm:space-x-4">
            {/* Quick actions */}
            <button
              className="p-2 rounded hover:bg-[var(--card-hover)]/50 transition-colors"
              title="New client pipeline"
            >
              <Menu className="h-4 w-4 text-[var(--text-dim)]" />
            </button>
            <button
              className="p-2 rounded hover:bg-[var(--card-hover)]/50 transition-colors"
              title="Approval queue"
            >
              <Search className="h-4 w-4 text-[var(--text-dim)]" />
            </button>
          </div>
          <div className="relative w-full max-w-xl">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              {isOpen ? (
                <X className="h-4 w-4 text-[var(--text-dim)]" onClick={() => setIsOpen(false)} />
              ) : (
                <Search className="h-4 w-4 text-[var(--text-dim)]" />
              )}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit(e);
                }
                if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
              onFocus={() => setIsOpen(true)}
              onBlur={() => {
                // Keep open if we have query or recently focused
                setTimeout(() => {
                  if (!query.trim() && !document.activeElement?.closest('[data-commandbar]')) {
                    setIsOpen(false);
                  }
                }, 100);
              }}
              className={`block w-full pl-10 pr-4 py-2 text-sm text-[var(--text)] bg-transparent 
                         focus:outline-none 
                         ${isOpen ? 'bg-[var(--panel)]' : 'bg-transparent'}`}
              placeholder="Ask Spinach OS... (Cmd+K)"
              data-commandbar
            />
          </div>
          <div className="flex-shrink-0">
            <button
              className="p-2 rounded hover:bg-[var(--card-hover)]/50 transition-colors"
              title="User menu"
            >
              {/* User avatar placeholder */}
              <div className="h-8 w-8 rounded-full bg-[var(--green)] flex items-center justify-center">
                <span className="text-xs font-medium text-white">AJ</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}