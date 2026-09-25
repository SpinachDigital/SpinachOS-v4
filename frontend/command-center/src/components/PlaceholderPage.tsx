'use client';

// Shared empty-state page shell — used by nav destinations whose real content is pending.
// Design v6: left-aligned header + designed empty state (no icon topper, no center-stack slop).
// Warm light tokens — renders on --bg-page from AppShell.
import Link from 'next/link';

export default function PlaceholderPage({
  title,
  sub,
  description,
  links = [],
}: {
  title: string;
  sub: string;
  description: string;
  links?: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Page header — left-aligned, action-row pattern */}
      <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <h1 className="t-title" style={{ color: 'var(--text)' }}>{title}</h1>
        <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>{sub}</p>
      </div>

      {/* Designed empty state — left-anchored composition, not centered filler */}
      <div className="flex-1 p-8">
        <div style={{ maxWidth: 560 }}>
          <div
            className="rounded-xl p-5"
            style={{
              background: 'var(--panel-2)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="t-heading" style={{ color: 'var(--text)' }}>In build</h2>
              <span className="badge badge-gray">v6</span>
            </div>
            <p className="t-body mt-2" style={{ color: 'var(--text-faint)', lineHeight: 1.6 }}>
              {description}
            </p>
            {links.length > 0 && (
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
