import { redirect } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ lineId: string }> }) {
  const { lineId } = await params;
  redirect(`/dashboard/calls?line=${lineId}`);
}
