// Type declarations for the office-diorama embeddable module (plain JS sources).
declare module '@/lib/office-diorama/viewer' {
  export interface ViewerOptions {
    THREE: unknown;
    OrbitControls: unknown;
    lighting?: 'day' | 'evening' | 'night';
    preset?: string;
    showLabels?: boolean;
    walkers?: boolean;
    autoRotate?: boolean;
    onZoneClick?: (zoneId: string, label: string) => void;
  }
  export interface OfficeViewer {
    setAgentStates(states: Record<string, string>): void;
    setLighting(preset: 'day' | 'evening' | 'night'): void;
    setPreset(preset: string): void;
    setZoneVisible(zoneId: string, visible: boolean): void;
    listZones(): string[];
    listAgents(): Array<{ id: string; label: string }>;
    dispose(): void;
  }
  export function createOfficeViewer(
    container: HTMLElement,
    options: ViewerOptions
  ): OfficeViewer;
}
