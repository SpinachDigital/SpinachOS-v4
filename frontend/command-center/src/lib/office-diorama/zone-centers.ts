// Sprint 6 — diorama zone-center anchors (agent → world x/z).
// These are the module's OWN zone-center positions (office.js places its 3D dept
// labels at exactly these points) — consumed, not reimplemented. The AGENT_ZONES map
// in the module maps agent keys to zone ids; this maps the same ids to world coords
// for the HTML label projection.
export const ZONE_CENTERS: Record<string, [number, number]> = {
  engineering: [4, 2.6],
  marketing: [15.5, 2.6],
  design: [6, -11],
  operations: [17, -4.5],
  clients: [17, -12],
  'ceo-cabin': [-15.5, -10],
  'research-cabin': [-3, -11],
};
