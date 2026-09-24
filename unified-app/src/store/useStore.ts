import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FeedItem {
  id: string;
  timestamp: string;
  profile: string;
  action: string;
  details?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  assigned_to: string;
  status: string;
  progress: number;
  client_id?: string;
}

export interface AgentState {
  agent: string;
  state: 'idle' | 'thinking' | 'working' | 'speaking' | 'blocked';
  activity: string;
  current_task_id?: string;
}

export interface ApprovalItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  platform?: string;
  status: string;
  client_id?: string;
  payload_json?: any;
}

export interface WorkflowItem {
  id: string;
  name: string;
  progress: number;
  current_step: string;
  status: string;
  client_id?: string;
  steps_json?: any[];
}

export interface ClientItem {
  id: string;
  name: string;
  business_type: string;
  location: string;
  services: string[];
  goal: string;
  status: string;
}

interface StoreState {
  feed: FeedItem[];
  tasks: TaskItem[];
  agents: AgentState[];
  approvals: ApprovalItem[];
  workflows: WorkflowItem[];
  clients: ClientItem[];
  activeView: 'command' | 'office';
  sidebarOpen: boolean;
  
  // Actions
  setFeed: (feed: FeedItem[]) => void;
  addFeed: (item: FeedItem) => void;
  setTasks: (tasks: TaskItem[]) => void;
  addTask: (task: TaskItem) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  setAgents: (agents: AgentState[]) => void;
  updateAgent: (agent: string, updates: Partial<AgentState>) => void;
  setApprovals: (approvals: ApprovalItem[]) => void;
  addApproval: (approval: ApprovalItem) => void;
  updateApproval: (id: string, updates: Partial<ApprovalItem>) => void;
  setWorkflows: (workflows: WorkflowItem[]) => void;
  updateWorkflow: (id: string, updates: Partial<WorkflowItem>) => void;
  setClients: (clients: ClientItem[]) => void;
  setActiveView: (view: 'command' | 'office') => void;
  setSidebarOpen: (open: boolean) => void;
  
  // WebSocket handlers
  handleFeedEvent: (data: any) => void;
  handleAgentStateEvent: (data: any) => void;
  handleTaskEvent: (data: any) => void;
  handleApprovalEvent: (data: any) => void;
  handleWorkflowEvent: (data: any) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      feed: [],
      tasks: [],
      agents: [
        { agent: 'ceo', state: 'idle', activity: 'Awaiting command' },
        { agent: 'cto', state: 'idle', activity: 'Awaiting strategy' },
        { agent: 'research', state: 'idle', activity: 'Monitoring sources' },
        { agent: 'social', state: 'idle', activity: 'Awaiting approval' },
        { agent: 'sales', state: 'idle', activity: 'Scanning pipeline' },
        { agent: 'content', state: 'idle', activity: 'Drafting queue empty' },
        { agent: 'design', state: 'idle', activity: 'Idle' },
        { agent: 'engineering', state: 'idle', activity: 'Idle' },
        { agent: 'ops', state: 'idle', activity: 'Monitoring systems' },
      ],
      approvals: [],
      workflows: [],
      clients: [],
      activeView: 'command',
      sidebarOpen: true,
      
      setFeed: (feed) => set({ feed }),
      addFeed: (item) => set((state) => ({ feed: [item, ...state.feed].slice(0, 100) })),
      setTasks: (tasks) => set({ tasks }),
      addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map((t) => t.id === id ? { ...t, ...updates } : t)
      })),
      setAgents: (agents) => set({ agents }),
      updateAgent: (agent, updates) => set((state) => ({
        agents: state.agents.map((a) => a.agent === agent ? { ...a, ...updates } : a)
      })),
      setApprovals: (approvals) => set({ approvals }),
      addApproval: (approval) => set((state) => ({ approvals: [approval, ...state.approvals] })),
      updateApproval: (id, updates) => set((state) => ({
        approvals: state.approvals.map((a) => a.id === id ? { ...a, ...updates } : a)
      })),
      setWorkflows: (workflows) => set({ workflows }),
      updateWorkflow: (id, updates) => set((state) => ({
        workflows: state.workflows.map((w) => w.id === id ? { ...w, ...updates } : w)
      })),
      setClients: (clients) => set({ clients }),
      setActiveView: (activeView) => set({ activeView }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      
      handleFeedEvent: (data) => {
        const item: FeedItem = {
          id: crypto.randomUUID(),
          timestamp: data.timestamp || new Date().toISOString(),
          profile: data.profile,
          action: data.action,
          details: data.details,
        };
        get().addFeed(item);
      },
      
      handleAgentStateEvent: (data) => {
        get().updateAgent(data.agent, { state: data.state, activity: data.activity });
      },
      
      handleTaskEvent: (data) => {
        const existing = get().tasks.find(t => t.id === data.id);
        if (existing) get().updateTask(data.id, data);
        else get().addTask(data);
      },
      
      handleApprovalEvent: (data) => {
        const existing = get().approvals.find(a => a.id === data.id);
        if (existing) get().updateApproval(data.id, data);
        else get().addApproval(data);
      },
      
      handleWorkflowEvent: (data) => {
        const existing = get().workflows.find(w => w.id === data.id);
        if (existing) get().updateWorkflow(data.id, data);
        else set((state) => ({ workflows: [data, ...state.workflows] }));
      },
    }),
    {
      name: 'spinach-unified',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        // NOTE: activeView intentionally NOT persisted — default to Command Center
        // on every fresh load (persisting it trapped users in a broken 3D view
        // when WebGL was unavailable, with no visible way back).
      }),
    }
  )
)