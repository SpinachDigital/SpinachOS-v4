'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Layout } from '@/components/Layout';
import CommandCenter from '@/pages/command-center/page';
import Office3D from '@/pages/office-3d/page';

export default function UnifiedApp() {
  const { sidebarOpen, activeView, setSidebarOpen, setActiveView } = useStore();
  
  return (
    <Layout 
      sidebarOpen={sidebarOpen} 
      onToggleSidebar={setSidebarOpen} 
      activeView={activeView} 
      onSetActiveView={setActiveView}
    >
      {activeView === 'command' ? <CommandCenter /> : <Office3D />}
    </Layout>
  );
}