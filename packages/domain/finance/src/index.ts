export { TransactionDirection, LifecycleStatus, SettlementStatus, type Transaction, type Wallet } from '@saldacargo/shared-types';
import { addMoney } from '@saldacargo/shared';

/**
 * ВАЖНО: балансы кошельков ВСЕГДА вычисляются из транзакций.
 * Никогда не хранятся как отдельное поле в БД.
 * Эта функция — reference implementation для фронта.
 */
export function calculateWalletBalance(
  transactions: Array<{
    direction: string;
    amount: string;
    from_wallet_id: string | null;
    to_wallet_id: string | null;
    lifecycle_status: string;
    settlement_status: string;
  }>,
  walletId: string,
): string {
  // Считаем только approved + completed
  const relevant = transactions.filter(
    (t) =>
      t.lifecycle_status === 'approved' &&
      t.settlement_status === 'completed' &&
      (t.from_wallet_id === walletId || t.to_wallet_id === walletId),
  );

  let balance = 0;
  for (const t of relevant) {
    const amount = parseFloat(t.amount);
    if (t.to_wallet_id === walletId) balance += amount;
    if (t.from_wallet_id === walletId) balance -= amount;
  }
  return balance.toFixed(2);
}

/**
 * Возвращает иконку способа оплаты.
 */
export function getPaymentMethodIcon(method: string): string {
  const icons: Record<string, string> = {
    cash: '💵',
    qr: '📱',
    bank_invoice: '🏦',
    debt_cash: '⏳',
    card_driver: '💳',
  };
  return icons[method] ?? '💰';
}

/**
 * Возвращает русское название способа оплаты.
 */
export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Наличные',
    qr: 'QR на р/с',
    bank_invoice: 'Безнал по счёту',
    debt_cash: 'Долг наличными',
    card_driver: 'На карту водителя',
  };
  return labels[method] ?? method;
}