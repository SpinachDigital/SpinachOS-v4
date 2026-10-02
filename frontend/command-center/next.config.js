/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  // Sprint 8 build fix: next build and next dev SHARE .next and collide
  // (Sprint 7 CSS incident: a build wiped the dev server's manifest → layout.css 404).
  // Production builds go to .next-prod; dev keeps .next. No more corruption.
  distDir: process.env.NODE_ENV === 'production' ? '.next-prod' : '.next',
  async redirects() {
    return [
      // IA v3: consolidated nav — old routes redirect to their new homes (no 404s)
      // Sprint 5f: /team redirect REMOVED — the real /team page ships (HR department).
      // Sprint 10 §5 (2026-10-02 audit): /office rendered the SAME diorama as /
      // and wasn't in the nav — the orphan page is DELETED; this redirect
      // catches any stale links/bookmarks. (Sprint 6's "Living Office ships
      // at /office" is superseded — / renders the diorama + dept tags.)
      { source: '/office', destination: '/', permanent: false },
      { source: '/assets', destination: '/settings', permanent: false },
      { source: '/logs', destination: '/analytics', permanent: false },
      { source: '/marketing/calendar', destination: '/marketing', permanent: false },
      { source: '/marketing/engagement', destination: '/marketing', permanent: false },
      { source: '/finance', destination: '/analytics', permanent: false },
      { source: '/knowledge', destination: '/settings', permanent: false },
      { source: '/terminal', destination: '/', permanent: false },
      { source: '/kanban', destination: '/projects', permanent: false },
    ];
  },
  async rewrites() {
    // ONE canonical env var: NEXT_PUBLIC_API_BASE (documented in README).
    // The old NEXT_PUBLIC_API_URL name is retired.
    const api = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
    return [
      // dashboard bridge endpoints (NO /v1): stats, agents, health, activity, jobs, projects…
      {
        source: '/api/:path*',
        destination: `${api}/api/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${api}/api/v1/:path*`,
      },
    ];
  },
  webpack(config) {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });
    return config;
  },
};

module.exports = nextConfig;