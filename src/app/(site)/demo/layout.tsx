import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Voice Demo - Ultaura',
  description:
    'Hear the voices of Ultaura. Five distinct AI voice personalities designed for warm, natural conversations with seniors.',
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
