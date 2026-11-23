import { describe, expect, it } from 'vitest';
import {
  calcOrderDetailTotals,
  computeMechanicDefaultPays,
  fmtDate,
  getArchiveWeekDates,
  getSpecialtyLabel,
  moneyVal,
  ruleAlert,
} from '../utils';

describe('garage/utils — getSpecialtyLabel & basic helpers', () => {
  it('picks highest-priority specialty label', () => {
    expect(getSpecialtyLabel(['driver', 'welder'])).toBe('Сварщик');
    expect(getSpecialtyLabel(['mechanic', 'mechanic_lead'])).toBe('Старший механик');
    expect(getSpecialtyLabel([])).toBe('');
    expect(getSpecialtyLabel(null)).toBe('');
  });

  it('parses moneyVal and formats dates safely', () => {
    expect(moneyVal('1250.50')).toBe(1250.5);
    expect(moneyVal(null)).toBe(0);
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate('2026-10-15T12:00:00Z')).toMatch(/15\.10\.2026/);
  });

  it('computes Monday..Sunday bounds in getArchiveWeekDates', () => {
    expect(getArchiveWeekDates('2026-10-15')).toEqual({
      weekStart: '2026-10-12',
      weekEnd: '2026-10-18',
    });
    expect(getArchiveWeekDates('2026-10-18')).toEqual({
      weekStart: '2026-10-12',
      weekEnd: '2026-10-18',
    });
  });
});

describe('garage/utils — ruleAlert (planned maintenance)', () => {
  const now = new Date('2026-10-15T12:00:00Z');

  it('returns overdue when mileage exceeded', () => {
    expect(
      ruleAlert(
        {
          id: 'r1',
          work_name: 'Замена масла',
          interval_km: 10000,
          interval_months: null,
          last_done_km: 100000,
          last_done_at: null,
        },
        110500,
        now,
      ),
    ).toBe('overdue');
  });

  it('returns soon within 15% of interval_km or 30 days of due date', () => {
    expect(
      ruleAlert(
        {
          id: 'r2',
          work_name: 'ТО-1',
          interval_km: 10000,
          interval_months: null,
          last_done_km: 100000,
          last_done_at: null,
        },
        109000, // remaining 1000 <= 1500
        now,
      ),
    ).toBe('soon');

    expect(
      ruleAlert(
        {
          id: 'r3',
          work_name: 'ТО-сезон',
          interval_km: null,
          interval_months: 6,
          last_done_km: null,
          last_done_at: '2026-05-01T00:00:00Z', // due 2026-11-01 -> 17 days left
        },
        null,
        now,
      ),
    ).toBe('soon');
  });

  it('returns ok when well within interval and null when no bounds apply', () => {
    expect(
      ruleAlert(
        {
          id: 'r4',
          work_name: 'ГРМ',
          interval_km: 60000,
          interval_months: null,
          last_done_km: 50000,
          last_done_at: null,
        },
        70000,
        now,
      ),
    ).toBe('ok');

    expect(
      ruleAlert(
        {
          id: 'r5',
          work_name: 'Без интервала',
          interval_km: null,
          interval_months: null,
          last_done_km: null,
          last_done_at: null,
        },
        null,
        now,
      ),
    ).toBeNull();
  });
});

describe('garage/utils — computeMechanicDefaultPays & calcOrderDetailTotals', () => {
  it('splits shared works 50/50 and skips cancelled or already paid works', () => {
    const pays = computeMechanicDefaultPays(
      [
        {
          status: 'completed',
          salary_paid: false,
          mechanic_id: 'm1',
          second_mechanic_id: 'm2',
          price_client: '4000',
        },
        {
          status: 'completed',
          salary_paid: false,
          mechanic_id: 'm1',
          second_mechanic_id: null,
          price_client: '2000',
        },
        {
          status: 'cancelled',
          salary_paid: false,
          mechanic_id: 'm1',
          second_mechanic_id: null,
          price_client: '9000',
        },
        {
          status: 'completed',
          salary_paid: true,
          mechanic_id: 'm2',
          second_mechanic_id: null,
          price_client: '5000',
        },
      ],
      [
        { id: 'm1', name: 'Иванов', mechanic_salary_pct: '50' },
        { id: 'm2', name: 'Петров', mechanic_salary_pct: '40' },
      ],
    );

    // m1: (2000 * 50%) + (2000 * 50%) = 2000
    // m2: (2000 * 40%) = 800
    expect(pays).toEqual({ m1: '2000', m2: '800' });
  });

  it('calculates order works total, parts margin, and grand total', () => {
    const totals = calcOrderDetailTotals(
      [
        { status: 'completed', price_client: '3000', norm_minutes: 90, quantity: 1 },
        { status: 'cancelled', price_client: '9999', norm_minutes: 60, quantity: 1 },
      ],
      [
        { quantity: 2, unit_price: '500', client_price: '650' },
        { quantity: 1, unit_price: '1000', client_price: null },
      ],
    );

    expect(totals.totalNormMin).toBe(90);
    expect(totals.worksTotal).toBe(3000);
    expect(totals.partsCostTotal).toBe(2000);
    expect(totals.partsClientTotal).toBe(2300);
    expect(totals.partsMargin).toBe(300);
    expect(totals.grandTotal).toBe(5300);
  });
});
