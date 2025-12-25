'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Phone, Plus } from 'lucide-react';
import { LineRow } from '~/lib/ultaura/types';
import { LineCard } from './LineCard';
import { AddLineModal } from './AddLineModal';

interface LinesPageClientProps {
  accountId: string;
  lines: LineRow[];
  planLinesLimit: number;
}

export function LinesPageClient({
  accountId,
  lines,
  planLinesLimit,
}: LinesPageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Open modal if ?action=add is in the URL
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddModalOpen(true);
      // Clean up the URL
      router.replace('/dashboard/lines', { scroll: false });
    }
  }, [searchParams, router]);

  const canAddLine = lines.length < planLinesLimit;

  return (
    <div className="space-y-6">
      {/* Add Line Button */}
      <div>
        {canAddLine ? (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add a Phone Line
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">
            You've reached the line limit for your plan ({planLinesLimit} line{planLinesLimit > 1 ? 's' : ''}).
            <a
              href="/dashboard/settings/subscription"
              className="text-primary hover:underline ml-1"
            >
              Upgrade to add more
            </a>
          </p>
        )}
      </div>

      {/* Lines Grid */}
      {lines.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {lines.map((line) => (
            <LineCard key={line.id} line={line} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No phone lines yet
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Add a phone line to start providing voice companionship for your loved one.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Line
          </button>
        </div>
      )}

      {/* Add Line Modal */}
      <AddLineModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        accountId={accountId}
      />
    </div>
  );
}
