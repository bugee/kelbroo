import { GuestApp } from '@/components/GuestApp';

export default async function TablePage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  return <GuestApp qrToken={qrToken} />;
}
