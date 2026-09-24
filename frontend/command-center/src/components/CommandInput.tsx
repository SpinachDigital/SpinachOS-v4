"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSpinachStore } from '@/store/spinach-store';
import { Mic, Send, ChevronUp, ChevronDown, Zap, Brain, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/auth';

export default function CommandInput() {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  
  const { 
    addLog, 
    setRoutingState, 
    addToHistory, 
    historyIndex, 
    setHistoryIndex,
    commandHistory,
    routingState,
    currentRouting 
  } = useSpinachStore();

  const commandSuggestions = [
    'build a landing page',
    'design a logo',
    'write a blog post',
    'run instagram campaign',
    'research competitors',
    'schedule standup',
    'start pipeline for [client]',
    'should we target enterprise',
    'approve strategy',
    'hire developer',
  ];

  const filteredSuggestions = commandSuggestions.filter(s => 
    s.toLowerCase().includes(input.toLowerCase()) && input.length > 0
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    const command = input.trim();
    setInput('');
    setShowHistory(false);
    addToHistory(command);

    // Add routing log
    addLog({
      type: 'routing',
      message: `Command received: "${command}"`,
    });

    setRoutingState('routing');

    try {
      const res = await apiFetch('/api/v1/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, source: 'ui' }),
      });

      const data = await res.json();
      
      if (data.action === 'laya_routed') {
        setRoutingState('executing', {
          department: data.routed,
          agent: data.routed,
          priority: data.priority,
        });
        addLog({
          type: 'execution',
          message: `Routed to ${data.routed} via Laya (${data.priority} priority)`,
          agent: data.routed,
        });
      } else if (data.action === 'start_pipeline') {
        setRoutingState('executing', {
          department: 'pipeline',
          agent: 'orchestrator',
          priority: 'high',
        });
        addLog({
          type: 'execution',
          message: `Pipeline started: ${data.reply}`,
        });
      } else {
        addLog({
          type: 'info',
          message: data.reply || 'Command processed',
        });
      }

      setRoutingState('complete');
      setTimeout(() => setRoutingState('idle'), 3000);
    } catch (error) {
      addLog({
        type: 'error',
        message: 'Command failed - check connection',
      });
      setRoutingState('idle');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Create a proper form event
      const form = inputRef.current?.form;
      if (form) {
        handleSubmit(new Event('submit', { bubbles: true, cancelable: true }) as unknown as React.FormEvent<HTMLFormElement>);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        setHistoryIndex(historyIndex + 1);
        setInput(commandHistory[historyIndex + 1]);
      } else if (historyIndex === -1 && commandHistory.length > 0) {
        setHistoryIndex(0);
        setInput(commandHistory[0]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1);
        setInput(commandHistory[historyIndex - 1]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Escape') {
      setShowHistory(false);
      setHistoryIndex(-1);
    } else if (e.key === 'Tab' && filteredSuggestions.length > 0) {
      e.preventDefault();
      setInput(filteredSuggestions[0]);
    }
  };

  const handleVoiceClick = () => {
    setIsListening(!isListening);
    if (isListening) {
      addLog({ type: 'info', message: 'Voice input stopped' });
    } else {
      addLog({ type: 'info', message: 'Voice input started - speak now' });
      // Web Speech API integration would go here
    }
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto pointer-events-auto">
      {/* Routing Status Indicator */}
      {routingState !== 'idle' && currentRouting && (
        <div className="mb-3 p-3 rounded-lg bg-green-900/30 border border-green-500/30 animate-pulse">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Zap className="w-4 h-4 animate-spin" />
            <span>
              {routingState === 'routing' && 'Routing via Laya...'}
              {routingState === 'executing' && `Executing on ${currentRouting.department} (${currentRouting.priority})`}
              {routingState === 'complete' && 'Task dispatched'}
            </span>
          </div>
          {currentRouting.priority === 'high' && (
            <span className="ml-auto px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">HIGH PRIORITY</span>
          )}
        </div>
      )}

      {/* Command Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowHistory(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            placeholder="Type a command... (↑/↓ history, Tab autocomplete)"
            className="w-full px-4 py-3 pl-12 pr-16 bg-gray-950/90 backdrop-blur-md border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all shadow-2xl"
            autoComplete="off"
          />
          
          {/* Voice Button */}
          <button
            type="button"
            onClick={handleVoiceClick}
            className={cn(
              'absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all',
              isListening 
                ? 'bg-red-500/20 text-red-400 animate-pulse' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            )}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!input.trim()}
            className={cn(
              'absolute right-44 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all',
              input.trim()
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            )}
            aria-label="Send command"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {showHistory && (filteredSuggestions.length > 0 || commandHistory.length > 0) && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900/95 border border-gray-700 rounded-xl overflow-hidden shadow-2xl z-50">
            {filteredSuggestions.length > 0 && (
              <div className="p-2 border-b border-gray-800">
                <p className="text-xs text-green-400 px-2 mb-1">Suggestions</p>
                {filteredSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setInput(s); handleSubmit(new Event('submit') as unknown as React.FormEvent<HTMLFormElement>); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-green-500/10 hover:text-green-400 rounded-lg transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {commandHistory.length > 0 && (
              <div className="p-2">
                <p className="text-xs text-gray-500 px-2 mb-1">History</p>
                {commandHistory.slice(0, 10).map((cmd, i) => (
                  <button
                    key={cmd}
                    type="button"
                    onClick={() => { setInput(cmd); handleSubmit(new Event('submit') as unknown as React.FormEvent<HTMLFormElement>); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm rounded-lg transition-colors',
                      i === historyIndex ? 'bg-green-500/20 text-green-400' : 'text-gray-300 hover:bg-gray-800'
                    )}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Routing Result Display */}
        {routingState === 'complete' && currentRouting && (
          <div className="mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-xl animate-slide-in">
            <div className="flex items-center gap-2 text-green-400">
              <Brain className="w-5 h-5" />
              <span className="font-medium">Routed to {currentRouting.department}</span>
              <ArrowRight className="w-4 h-4" />
              <span className="text-xs px-2 py-0.5 bg-green-500/20 rounded">
                {currentRouting.priority}
              </span>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}