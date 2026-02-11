import { redirect } from 'next/navigation';

interface PageProps {
  params: { lineId: string };
}

export default function RemindersPage({ params }: PageProps) {
  redirect(`/dashboard/reminders?line=${params.lineId}`);
}
