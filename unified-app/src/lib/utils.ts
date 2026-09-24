import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Department accent colors (V5 palette — muted, never neon)
export const DEPARTMENT_COLORS: Record<string, string> = {
  engineering: '#22c55e',
  design: '#a855f7',
  marketing: '#ec4899',
  sales: '#f97316',
  research: '#3b82f6',
  operations: '#eab308',
  social: '#06b6d4',
  content: '#14b8a6',
  ceo: '#ffd700',
};

export function getDepartmentColor(dept: string): string {
  return DEPARTMENT_COLORS[dept] || '#22c55e';
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return 'text-red-400 bg-red-500/20';
    case 'medium': return 'text-yellow-400 bg-yellow-500/20';
    case 'low': return 'text-blue-400 bg-blue-500/20';
    default: return 'text-gray-400 bg-gray-500/20';
  }
}

export function getAgentStateColor(state: string): string {
  switch (state) {
    case 'working': return 'text-green-400 bg-green-500/20';
    case 'thinking': return 'text-yellow-400 bg-yellow-500/20';
    case 'speaking': return 'text-purple-400 bg-purple-500/20';
    case 'blocked': return 'text-red-400 bg-red-500/20';
    case 'idle': return 'text-gray-400 bg-gray-500/20';
    default: return 'text-gray-400 bg-gray-500/20';
  }
}