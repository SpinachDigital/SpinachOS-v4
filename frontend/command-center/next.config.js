/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  async redirects() {
    return [
      // IA v3: consolidated nav — old routes redirect to their new homes (no 404s)
      { source: '/office', destination: '/', permanent: false },
      { source: '/team', destination: '/agents', permanent: false },
      { source: '/clients', destination: '/projects', permanent: false },
      { source: '/logs', destination: '/analytics', permanent: false },
      { source: '/marketing/calendar', destination: '/marketing', permanent: false },
      { source: '/marketing/engagement', destination: '/marketing', permanent: false },
      { source: '/assets', destination: '/settings', permanent: false },
      { source: '/finance', destination: '/analytics', permanent: false },
      { source: '/knowledge', destination: '/settings', permanent: false },
      { source: '/terminal', destination: '/', permanent: false },
      { source: '/kanban', destination: '/projects', permanent: false },
    ];
  },
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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