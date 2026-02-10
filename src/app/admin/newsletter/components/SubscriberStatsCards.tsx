'use client';

interface SubscriberStatsCardsProps {
  stats: {
    confirmed: number;
    pending: number;
    unsubscribed: number;
    topicCounts: {
      blog_digest: number;
      elder_care_tips: number;
      product_updates: number;
    };
  };
}

export default function SubscriberStatsCards({
  stats,
}: SubscriberStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard label="Confirmed" value={stats.confirmed} />
      <StatCard label="Pending" value={stats.pending} />
      <StatCard label="Unsubscribed" value={stats.unsubscribed} />
      <StatCard label="Blog Digest" value={stats.topicCounts.blog_digest} />
      <StatCard
        label="Elder Care Tips"
        value={stats.topicCounts.elder_care_tips}
      />
      <StatCard
        label="Product Updates"
        value={stats.topicCounts.product_updates}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
