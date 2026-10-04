'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoansPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/finance?tab=calendar');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-sm font-medium text-slate-500">
        Кредиты и лизинги перенесены в <strong>Платёжный календарь</strong>. Перенаправление...
      </p>
    </div>
  );
}
