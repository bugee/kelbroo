'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { readAccess } from '@/lib/api';

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    router.replace(readAccess() ? '/queue' : '/login');
  }, [router]);
  return null;
}
