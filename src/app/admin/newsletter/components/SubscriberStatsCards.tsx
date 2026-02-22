import AdminStatCard from '~/app/admin/components/AdminStatCard';

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
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      <AdminStatCard label="Confirmed" value={stats.confirmed} />
      <AdminStatCard label="Pending" value={stats.pending} />
      <AdminStatCard label="Unsubscribed" value={stats.unsubscribed} />
      <AdminStatCard label="Blog Digest" value={stats.topicCounts.blog_digest} />
      <AdminStatCard
        label="Elder Care Tips"
        value={stats.topicCounts.elder_care_tips}
      />
      <AdminStatCard
        label="Product Updates"
        value={stats.topicCounts.product_updates}
      />
    </div>
  );
}
