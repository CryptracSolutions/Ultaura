import type { CallSessionRow } from './types';

export function getCallTypeLabel(session: Pick<
  CallSessionRow,
  'is_test_call' | 'is_reminder_call' | 'direction' | 'scheduler_idempotency_key'
>): string {
  if (session.is_test_call) return 'Test call';
  if (session.is_reminder_call) return 'Reminder';
  if (session.direction === 'inbound') return 'Inbound';
  if (session.scheduler_idempotency_key?.startsWith('schedule:')) return 'Scheduled';
  return 'Manual call';
}
