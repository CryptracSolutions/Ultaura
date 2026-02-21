import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Voice Demo - Ultaura',
  description:
    "Hear Ultaura's five AI voice personalities designed for seniors. Natural, warm conversations on any phone — no app required. Try a voice demo now.",
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
