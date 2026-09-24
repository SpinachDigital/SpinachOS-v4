'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Send, Mic, Zap, Loader2, X } from 'lucide-react';
import { useStore } from '@/store/useStore';

interface CommandBarProps {
  onSend?: (message: string) => void;
}

export function CommandBar({ onSend }: CommandBarProps) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    'Start client pipeline for gym in Mira Road',
    'Get 20 leads for SaaS startup in Bangalore',
    'Create content calendar for next week',
    'Research AI trends for weekly report',
    'Approve pending X posts',
    'Check workflow status',
  ]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addFeed } = useStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const message = input.trim();
    setInput('');
    setShowSuggestions(false);
    
    // Add to feed immediately
    addFeed({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      profile: 'director',
      action: 'Command sent',
      details: message,
    });
    
    onSend?.(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setShowSuggestions(true);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-dark-300/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="relative">
          <div className="flex items-center gap-3">
            <label htmlFor="command-input" className="sr-only">Command</label>
            <div className="relative flex-1">
              <input
                ref={inputRef}
                id="command-input"
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setShowSuggestions(e.target.value.length > 0);
                }}
                onFocus={() => setShowSuggestions(input.length > 0)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command: 'Start client pipeline for gym in Mira Road'..."
                className={cn(
                  'w-full bg-dark-200 border border-border/50 rounded-xl px-5 py-3.5',
                  'text-foreground placeholder:text-muted-foreground',
                  'focus:border-spinach-500 focus:ring-2 focus:ring-spinach-500/20',
                  'transition-all duration-200',
                  'pr-16'
                )}
                autoComplete="off"
                spellCheck={false}
              />
              {input && (
                <button
                  type="button"
                  onClick={() => setInput('')}
                  className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-dark-100 text-muted-foreground transition-colors"
                  aria-label="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Voice Button */}
            <button
              type="button"
              onClick={() => setIsListening(!isListening)}
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200',
                'bg-dark-200 border border-border/50',
                'hover:bg-dark-100',
                isListening && 'bg-spinach-500/20 border-spinach-500/30 text-spinach-400 animate-pulse'
              )}
              aria-label={isListening ? 'Stop listening' : 'Start voice command'}
              title={isListening ? 'Listening...' : 'Voice command'}
            >
              <Mic className="w-5 h-5" />
            </button>
            
            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim()}
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200',
                'text-white font-medium',
                input.trim()
                  ? 'bg-spinach-500 hover:bg-spinach-400'
                  : 'bg-dark-200 text-muted-foreground cursor-not-allowed'
              )}
              aria-label="Send command"
            >
              {input.trim() ? <Send className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-dark-300/95 backdrop-blur-sm border border-border/50 rounded-xl p-2 shadow-xl z-50 animate-in">
              <p className="px-3 py-1 text-xs text-muted-foreground">Suggestions</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-dark-200 transition-colors flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4 text-spinach-500" />
                    <span className="truncate">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Hint */}
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 bg-dark-200 rounded text-[10px] font-mono">Esc</kbd> to close suggestions • 
          <kbd className="px-1.5 py-0.5 bg-dark-200 rounded text-[10px] font-mono">Enter</kbd> to send • 
          Natural language commands work best
        </p>
      </div>
    </form>
  );
}