import { useParams } from 'next/navigation';

interface FeedItem {
  profile: string;
  action: string;
  timestamp: string;
}

export default function ActivityFeed({ feed }: { feed: FeedItem[] }) {
  // Sort by timestamp descending (newest first)
  const sortedFeed = [...feed].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (sortedFeed.length === 0) {
    return (
      <div className="bg-[var(--panel)] rounded-lg p-4 border border-[var(--panel-2)]">
        <h3 className="text-lg font-medium text-[var(--text)] mb-2">Activity Feed</h3>
        <p className="text-[var(--text-dim)]">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--panel)] rounded-lg p-4 border border-[var(--panel-2)]">
      <h3 className="text-lg font-medium text-[var(--text)] mb-2">Activity Feed</h3>
      <div className="space-y-3">
        {sortedFeed.slice(0, 10).map((item, index) => (
          <div key={index} className="flex items-start gap-3 p-3 bg-[var(--card)] rounded hover:bg-[var(--card-hover)] transition-colors">
            {/* Avatar placeholder */}
            <div className="flex-shrink-0">
              <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--green)] text-white">
                <span className="text-xs font-medium">{item.profile.toUpperCase().charAt(0)}</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text)]">{item.action}</p>
              <p className="text-xs text-[var(--text-dim)]">
                {/* Format timestamp to relative time (simplified) */}
                {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
            </div>
          </div>
        ))}
        {feed.length > 10 && (
          <div className="text-center text-[var(--text-dim)] text-[0.75rem] py-2">
            and {feed.length - 10} more...
          </div>
        )}
      </div>
    </div>
  );
}