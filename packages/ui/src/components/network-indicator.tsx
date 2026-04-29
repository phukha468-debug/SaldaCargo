'use client';
import * as React from 'react';
import { cn } from '../lib/utils';

interface NetworkIndicatorProps {
  className?: string;
}

/**
 * Индикатор сети для MiniApp — водители ездят в межгород,
 * часто без сигнала. Показывает статус синхронизации.
 */
export function NetworkIndicator({ className }: NetworkIndicatorProps) {
  const [isOnline, setIsOnline] = React.useState(true);
  const [pendingCount, setPendingCount] = React.useState(0);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && pendingCount === 0) {
    return <span className={cn('text-xs text-green-600', className)}>📶 Онлайн</span>;
  }
  if (pendingCount > 0) {
    return (
      <span className={cn('text-xs text-amber-600', className)}>🔄 {pendingCount} в очереди</span>
    );
  }
  return <span className={cn('text-xs text-red-600', className)}>📵 Офлайн</span>;
}
