import { describe, expect, it } from 'vitest';
import type { OrderItem } from '../types';
import {
  formatMonthLabel,
  formatRouteSummary,
  formatTravelTime,
  getDocCounterpartyBadge,
  getEstimatedRouteDistance,
  getFolderOrders,
  getOrderEffectiveClientName,
  isShaytankaMaminskoeRoute,
  isStrictDocCounterparty,
  normalizeCounterpartySearch,
} from '../utils';

function makeOrder(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'o-1',
    order_number: 101,
    source_type: 'manual',
    status: 'in_progress',
    base_doc_name: 'Заявка',
    base_doc_number: '101',
    base_doc_date: '2026-04-01',
    internal_order_number: null,
    cargo_name: 'Трубы',
    weight_gross_kg: 1000,
    places_count: 1,
    price_without_vat: 25000,
    vat_rate: '0',
    payment_terms: 'Безнал',
    waybill_number: null,
    loading_address_json: { city: 'Екатеринбург', raw: 'г. Екатеринбург' },
    unloading_address_json: { city: 'Верхняя Салда', raw: 'г. Верхняя Салда' },
    planned_loading_at: null,
    planned_delivery_at: null,
    ...overrides,
  };
}

describe('orders/utils', () => {
  it('detects strict doc counterparties and returns appropriate badges', () => {
    expect(isStrictDocCounterparty('ПАО «Корпорация ВСМПО-АВИСМА»')).toBe(true);
    expect(isStrictDocCounterparty('ООО Ависма')).toBe(true);
    expect(isStrictDocCounterparty('ООО «Геостройиндустрия»')).toBe(true);
    expect(isStrictDocCounterparty('ООО Ромашка')).toBe(false);
    expect(isStrictDocCounterparty(null)).toBe(false);

    expect(getDocCounterpartyBadge('ВСМПО-АВИСМА').label).toContain('ВСМПО');
    expect(getDocCounterpartyBadge('ООО Геострой').label).toContain('Геострой');
    expect(getDocCounterpartyBadge(null).label).toBe('Контрагент');
  });

  it('resolves effective client name with fallback order', () => {
    expect(
      getOrderEffectiveClientName(makeOrder({ client: { id: '1', name: 'A', inn: '' } })),
    ).toBe('A');
    expect(getOrderEffectiveClientName(makeOrder({ loading_org_name: 'ЛОП Б' }))).toBe('ЛОП Б');
    expect(
      getOrderEffectiveClientName(
        makeOrder({
          trip: {
            id: 't1',
            trip_number: 1,
            odometer_start: 0,
            odometer_end: 0,
            trip_orders: [{ counterparty: { name: 'Из рейса' } }],
          },
        }),
      ),
    ).toBe('Из рейса');
  });

  it('normalizes counterparty search strings', () => {
    expect(normalizeCounterpartySearch('ООО "Геострой-Индустрия"')).toBe('ооогеостройиндустрия');
    expect(normalizeCounterpartySearch(null)).toBe('');
  });

  it('formats route summary for single and multi-stop orders', () => {
    expect(formatRouteSummary(makeOrder())).toBe('Екатеринбург → Верхняя Салда');
    expect(
      formatRouteSummary(
        makeOrder({
          routes_json: [
            {
              id: '1',
              loading_city: 'Шайтанка',
              loading_address: '',
              unloading_city: 'Тагил',
              unloading_address: '',
            },
            {
              id: '2',
              loading_city: 'Тагил',
              loading_address: '',
              unloading_city: 'Маминское',
              unloading_address: '',
            },
          ],
        }),
      ),
    ).toBe('Шайтанка → Маминское (2 точки)');
  });

  it('filters orders into pipeline folders respecting docs_collection & completed rules', () => {
    const orders: OrderItem[] = [
      makeOrder({ id: 'w1', status: 'draft' }),
      makeOrder({ id: 'w2', status: 'waiting_vehicle' }),
      makeOrder({
        id: 'd1',
        status: 'docs_collection',
        client: { id: 'c1', name: 'ПАО ВСМПО-АВИСМА', inn: '' },
        billing_docs: { status: 'in_progress' },
      }),
      makeOrder({
        id: 'd2',
        status: 'docs_collection',
        client: { id: 'c1', name: 'ПАО ВСМПО-АВИСМА', inn: '' },
        billing_docs: { client_accepted_edo: true, status: 'accepted' },
      }),
      makeOrder({
        id: 'd3',
        status: 'docs_collection',
        client: { id: 'c2', name: 'Прочий', inn: '' },
      }),
      makeOrder({ id: 'c1', status: 'completed' }),
    ];

    expect(getFolderOrders('waiting_vehicle', orders).map((o) => o.id)).toEqual(['w1', 'w2']);
    expect(getFolderOrders('docs_collection', orders).map((o) => o.id)).toEqual(['d1']);
    expect(getFolderOrders('completed', orders).map((o) => o.id)).toEqual(['d2', 'c1']);
  });

  it('estimates distances, travel time, month labels, and Shaytanka-Maminskoe route', () => {
    expect(getEstimatedRouteDistance('г. Верхняя Салда', 'г. Екатеринбург')).toBe(175);
    expect(getEstimatedRouteDistance('пос. Шайтанка', 'село Маминское')).toBe(275);
    expect(getEstimatedRouteDistance('Москва', 'Казань')).toBeNull();

    expect(formatTravelTime(35)).toBe('30 мин');
    expect(formatTravelTime(140)).toBe('2 ч');
    expect(formatTravelTime(175)).toBe('2 ч 30 мин');

    expect(formatMonthLabel('2026-04')).toBe('Апрель 2026');
    expect(isShaytankaMaminskoeRoute('Шайтанка', 'Маминское')).toBe(true);
    expect(isShaytankaMaminskoeRoute('Салда', 'Пермь')).toBe(false);
  });
});
