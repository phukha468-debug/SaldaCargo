import { Suspense } from 'react';
import { SendDocsWorkspace } from '@/features/send-docs/SendDocsWorkspace';

export default function SendDocsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-sm font-semibold text-[#666B73]">
          Загрузка...
        </div>
      }
    >
      <SendDocsWorkspace />
    </Suspense>
  );
}
