// V5 Cinematic AI OS - Zustand Store
import { create } from 'zustand';

export interface AgentState {
  id: string;
  name: string;
  department: string;
  state: 'idle' | 'thinking' | 'working' | 'blocked' | 'speaking';
  activity: string;
  position: [number, number, number];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'routing' | 'execution';
  message: string;
  agent?: string;
}

export interface Task {
  id: string;
  input: string;
  department: string;
  agent: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'running' | 'done' | 'blocked';
  progress: number;
  output?: string;
  startedAt: string;
  completedAt?: string;
}

export interface Job {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  progress: number;
  tasks: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  department: string;
  assets: string[];
}

export interface Asset {
  id: string;
  name: string;
  type: 'document' | 'image' | 'video' | 'code' | 'design';
  url: string;
  projectId: string;
}

interface SpinachStore {
  // Agents
  agents: Record<string, AgentState>;
  setAgentState: (id: string, state: Partial<AgentState>) => void;
  
  // Logs
  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  
  // Tasks
  tasks: Record<string, Task>;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  
  // Jobs
  jobs: Record<string, Job>;
  addJob: (job: Job) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  
  // Projects
  projects: Record<string, Project>;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  
  // Assets
  assets: Record<string, Asset>;
  addAsset: (asset: Asset) => void;
  
  // UI State
  selectedAgent: string | null;
  setSelectedAgent: (id: string | null) => void;
  cameraTarget: [number, number, number] | null;
  setCameraTarget: (target: [number, number, number] | null) => void;
  commandHistory: string[];
  addToHistory: (cmd: string) => void;
  historyIndex: number;
  setHistoryIndex: (index: number) => void;
  
  // Routing visualization
  connected: boolean;
  agentStates: Record<string, AgentState>;
  feed: LogEntry[];
  routingState: 'idle' | 'routing' | 'executing' | 'complete';
  currentRouting: { department: string; agent: string; priority: string } | null;
  setRoutingState: (state: 'idle' | 'routing' | 'executing' | 'complete', info?: any) => void;

  // WebSocket binding
  wsConnected: boolean;
  setWsConnected: (v: boolean) => void;
  handleWsEvent: (event: string, data: any) => void;
}

export const useSpinachStore = create<SpinachStore>((set) => ({
  agents: {},
  setAgentState: (id, state) => set((s) => ({
    agents: { ...s.agents, [id]: { ...s.agents[id], ...state } }
  })),
  
  connected: false,
  agentStates: {},
  feed: [],
  tasks: {},
  
  logs: [],
  addLog: (log) => set((s) => ({
    logs: [{ ...log, id: crypto.randomUUID(), timestamp: new Date().toISOString() }, ...s.logs].slice(0, 1000)
  })),
  clearLogs: () => set({ logs: [] }),
  
  addTask: (task) => set((s) => ({ tasks: { ...s.tasks, [task.id]: task } })),
  updateTask: (id, updates) => set((s) => ({
    tasks: { ...s.tasks, [id]: { ...s.tasks[id], ...updates } }
  })),
  
  jobs: {},
  addJob: (job) => set((s) => ({ jobs: { ...s.jobs, [job.id]: job } })),
  updateJob: (id, updates) => set((s) => ({
    jobs: { ...s.jobs, [id]: { ...s.jobs[id], ...updates } }
  })),
  
  projects: {},
  addProject: (project) => set((s) => ({ projects: { ...s.projects, [project.id]: project } })),
  updateProject: (id, updates) => set((s) => ({
    projects: { ...s.projects, [id]: { ...s.projects[id], ...updates } }
  })),
  
  assets: {},
  addAsset: (asset) => set((s) => ({ assets: { ...s.assets, [asset.id]: asset } })),
  
  selectedAgent: null,
  setSelectedAgent: (id) => set({ selectedAgent: id }),
  cameraTarget: null,
  setCameraTarget: (target) => set({ cameraTarget: target }),
  
  commandHistory: [],
  addToHistory: (cmd) => set((s) => ({ 
    commandHistory: [cmd, ...s.commandHistory.filter(c => c !== cmd)].slice(0, 50),
    historyIndex: -1
  })),
  historyIndex: -1,
  setHistoryIndex: (index) => set({ historyIndex: index }),
  
  routingState: 'idle',
  currentRouting: null,
  setRoutingState: (state, info) => set({
    routingState: state,
    currentRouting: info
  }),

  // Live WebSocket → store binding
  wsConnected: false,
  setWsConnected: (v) => set({ connected: v }),
  handleWsEvent: (event, data) => set((s) => {
    const ts = (data?.timestamp as string) || new Date().toISOString();
    const asLog = (type: LogEntry['type'], message: string, agent?: string): LogEntry => ({
      id: crypto.randomUUID(), timestamp: ts, type, message, agent,
    });
    if (event === 'agent_state') {
      const agent = data?.agent || 'unknown';
      const state = data?.state || 'idle';
      return {
        connected: true,
        agentStates: {
          ...s.agentStates,
          [agent]: {
            ...(s.agentStates[agent] || {}),
            id: agent,
            state,
            activity: data?.activity,
            currentTask: data?.current_task_id,
          },
        },
        feed: [asLog('info', `${agent} → ${state}${data?.activity ? ` — ${data.activity}` : ''}`, agent), ...s.feed].slice(0, 200),
        logs: [asLog('info', `agent_state: ${agent} → ${state}`, agent), ...s.logs].slice(0, 1000),
      };
    }
    if (event === 'task_update') {
      const task = data || {};
      const tid = task.id || crypto.randomUUID();
      return {
        connected: true,
        tasks: { ...s.tasks, [tid]: { ...(s.tasks[tid] || {}), ...task, id: tid } },
        feed: [asLog('execution', `Task ${task.status || 'updated'}${task.agent ? ` — ${task.agent}` : ''}`, task.agent), ...s.feed].slice(0, 200),
        logs: [asLog('execution', `task_update: ${tid} → ${task.status || 'updated'}`, task.agent), ...s.logs].slice(0, 1000),
      };
    }
    if (event === 'feed') {
      const msg = data?.action ? `${data.profile || 'system'}: ${data.action}` : JSON.stringify(data).slice(0, 120);
      return {
        connected: true,
        feed: [asLog('info', msg, data?.profile), ...s.feed].slice(0, 200),
      };
    }
    if (event === 'approval' || event === 'workflow') {
      return {
        connected: true,
        feed: [asLog('success', `${event}: ${JSON.stringify(data).slice(0, 120)}`), ...s.feed].slice(0, 200),
        logs: [asLog('success', `${event} event`), ...s.logs].slice(0, 1000),
      };
    }
    return { connected: true };
  }),
}));