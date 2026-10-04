'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PayablesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/counterparties');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-sm font-medium text-slate-500">
        Долги поставщикам перенесены в раздел <strong>Контрагенты</strong>. Перенаправление...
      </p>
    </div>
  );
}
