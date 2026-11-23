import { describe, expect, it } from 'vitest';
import type { AtiOrder } from '../types';
import {
  calcAtiClaimTotal,
  defaultClaimNumberForOrder,
  groupAtiOrdersByStage,
  partitionAtiOrders,
} from '../utils';

function makeAtiOrder(overrides: Partial<AtiOrder> = {}): AtiOrder {
  return {
    id: 'ati-1',
    order_number: '№ 001 от 01.04.2026',
    order_date: '2026-04-01',
    stage: 1,
    doc_type: 'etrn',
    counterparty_name: 'ООО Заказчик',
    carrier_name: 'ИП Перевозчик',
    carrier_inn: '660700000000',
    carrier_contact: '',
    carrier_account: '',
    carrier_bank: '',
    carrier_bik: '',
    asset_name: 'Валдай',
    asset_reg_number: 'О188ТА 196',
    driver_name: 'Водитель',
    driver_phone: '',
    driver_passport: '',
    driver_license: '',
    shipper_name: '',
    pickup_address: 'Екатеринбург',
    pickup_date_time: '',
    pickup_contact: '',
    cargo_description: 'Груз',
    consignee_name: '',
    delivery_address: 'Салда',
    delivery_date: '',
    delivery_contact: '',
    price: 30000,
    payment_terms: '5 б.д.',
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

describe('ati/utils', () => {
  it('partitions active, claim, paid claim, and simple cancelled orders with sums', () => {
    const orders: AtiOrder[] = [
      makeAtiOrder({ id: 'a1', stage: 2, price: 30000 }),
      makeAtiOrder({ id: 'a2', stage: 6, price: 45000 }),
      makeAtiOrder({
        id: 'c1',
        is_cancelled: true,
        has_claim: true,
        claim_status: 'issued',
        claim_amount: 6000,
      }),
      makeAtiOrder({
        id: 'c2',
        is_cancelled: true,
        has_claim: true,
        claim_status: 'paid',
        claim_amount: 3000,
      }),
      makeAtiOrder({ id: 's1', is_cancelled: true, has_claim: false }),
    ];

    const res = partitionAtiOrders(orders);
    expect(res.activeOrders.map((o) => o.id)).toEqual(['a1', 'a2']);
    expect(res.activeClaimOrders.map((o) => o.id)).toEqual(['c1']);
    expect(res.paidClaimOrders.map((o) => o.id)).toEqual(['c2']);
    expect(res.simpleCancelledOrders.map((o) => o.id)).toEqual(['s1']);
    expect(res.activeClaimsSum).toBe(6000);
    expect(res.paidClaimsSum).toBe(3000);
    expect(res.totalFreight).toBe(75000);
    expect(res.inReceivables).toBe(45000);
  });

  it('groups active orders by stage and filters by doc_type', () => {
    const orders: AtiOrder[] = [
      makeAtiOrder({ id: '1', stage: 1, doc_type: 'etrn' }),
      makeAtiOrder({ id: '2', stage: 5, doc_type: 'paper' }),
      makeAtiOrder({ id: '3', stage: 99, doc_type: 'etrn' }),
    ];
    const all = groupAtiOrdersByStage(orders, 'all');
    expect(all[1]?.map((o) => o.id)).toEqual(['1', '3']);
    expect(all[5]?.map((o) => o.id)).toEqual(['2']);

    const paperOnly = groupAtiOrdersByStage(orders, 'paper');
    expect(paperOnly[1]).toEqual([]);
    expect(paperOnly[5]?.map((o) => o.id)).toEqual(['2']);
  });

  it('calculates claim totals and default claim numbers', () => {
    expect(calcAtiClaimTotal('6000', '2000', '1500')).toBe(9500);
    expect(calcAtiClaimTotal('', 0, 'invalid')).toBe(0);
    expect(defaultClaimNumberForOrder('№ 001 от 01.04.2026')).toBe('01-ПР');
    expect(defaultClaimNumberForOrder('№ 42')).toBe('42-ПР');
  });
});
