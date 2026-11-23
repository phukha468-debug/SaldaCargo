import type { AtiOrder } from './types';

export function partitionAtiOrders(orders: AtiOrder[]) {
  const cancelledOrders = orders.filter((o) => o.is_cancelled || o.stage === 0);
  const claimOrders = cancelledOrders.filter((o) => o.has_claim);
  const activeClaimOrders = claimOrders.filter((o) => o.claim_status !== 'paid');
  const paidClaimOrders = claimOrders.filter((o) => o.claim_status === 'paid');
  const simpleCancelledOrders = cancelledOrders.filter((o) => !o.has_claim);
  const activeOrders = orders.filter((o) => !o.is_cancelled && o.stage > 0);

  const activeClaimsSum = activeClaimOrders.reduce(
    (sum, o) => sum + (Number(o.claim_amount) || 0),
    0,
  );
  const paidClaimsSum = paidClaimOrders.reduce((sum, o) => sum + (Number(o.claim_amount) || 0), 0);
  const totalFreight = activeOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const inReceivables = activeOrders
    .filter((o) => o.stage === 6)
    .reduce((sum, o) => sum + (Number(o.price) || 0), 0);

  return {
    cancelledOrders,
    claimOrders,
    activeClaimOrders,
    paidClaimOrders,
    simpleCancelledOrders,
    activeOrders,
    activeClaimsSum,
    paidClaimsSum,
    totalFreight,
    inReceivables,
  };
}

export function groupAtiOrdersByStage(
  activeOrders: AtiOrder[],
  filterDoc: 'all' | 'etrn' | 'paper',
): Record<number, AtiOrder[]> {
  const filtered = activeOrders.filter((o) =>
    filterDoc === 'all' ? true : o.doc_type === filterDoc,
  );
  const grouped: Record<number, AtiOrder[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
  };
  for (const ord of filtered) {
    const st = ord.stage >= 1 && ord.stage <= 7 ? ord.stage : 1;
    grouped[st]?.push(ord);
  }
  return grouped;
}

export function calcAtiClaimTotal(
  penalty: string | number,
  emptyRun: string | number,
  idle: string | number,
): number {
  return (Number(penalty) || 0) + (Number(emptyRun) || 0) + (Number(idle) || 0);
}

export function defaultClaimNumberForOrder(orderNumber: string): string {
  if (orderNumber.includes('001')) return '01-ПР';
  return `${orderNumber.replace(/\D/g, '') || '1'}-ПР`;
}
