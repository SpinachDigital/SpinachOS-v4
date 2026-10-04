'use client';

/*
 * GlobalErrorBoundary — Phase 5 GOAL 6: error boundary on every route.
 * Mounted in app/layout.tsx around {children}: a render crash shows the
 * honest error + a reload action, never a white screen.
 */

import React from 'react';

export default class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log honestly (client console; no fake silence).
    console.error('[error-boundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#B3261E', background: 'var(--bg, #FAFAF7)', minHeight: '100vh' }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Something broke — honest error:</h2>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', background: 'rgba(179,38,30,0.06)', padding: 12, borderRadius: 8 }}>{this.state.error.message}</pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ marginTop: 16, padding: '10px 18px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)', background: 'var(--card, #fff)', cursor: 'pointer', minHeight: 44 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
