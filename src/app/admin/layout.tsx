import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ExamGuard Admin',
  description: 'Administrator portal for ExamGuard.',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
