'use client';

// OfficeCanvas: React wrapper for the OfficeScene v2 orchestrator (client-only WebGL)
// Listens for 'office-theme' events from the page to toggle light/dark.
import { useEffect, useRef } from 'react';
import { OfficeScene } from './OfficeScene';

export default function OfficeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OfficeScene | null>(null);

  useEffect(() => {
    if (containerRef.current && !sceneRef.current) {
      sceneRef.current = new OfficeScene(containerRef.current);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Theme toggle events from the page
  useEffect(() => {
    const onTheme = (e: Event) => {
      const theme = (e as CustomEvent<'dark' | 'light'>).detail;
      sceneRef.current?.setTheme(theme);
    };
    window.addEventListener('office-theme', onTheme);
    return () => window.removeEventListener('office-theme', onTheme);
  }, []);

  return (
    <div
      ref={containerRef}
      className="office-canvas-root"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    />
  );
}