import { describe, expect, it } from 'vitest';
import { ADVANCE_CAT, PAYROLL_CATS } from '../constants';
import type { StaffTx } from '../types';
import { classifyStaffTx, parseAccrualMeta, parseUserNotesAndPassport } from '../utils';
import { filterStaffAdvances, groupStaffAccruals } from '../history/historyGrouping';

function makeTx(overrides: Partial<StaffTx> = {}): StaffTx {
  return {
    id: 'tx-1',
    amount: '3000',
    direction: 'expense',
    description: 'ЗП за рейс #120',
    created_at: '2026-10-15T10:00:00Z',
    settlement_status: 'pending',
    category_id: PAYROLL_CATS[0]!,
    employee_confirmed: null,
    ...overrides,
  };
}

describe('staff/utils — parseUserNotesAndPassport', () => {
  it('parses JSON notes containing passport data and user_notes', () => {
    const res = parseUserNotesAndPassport({
      notes: JSON.stringify({ series: '6500', number: '123456', user_notes: 'Категория C' }),
      passport_data: null,
    });
    expect(res.noteText).toBe('Категория C');
    expect(res.passport).toMatchObject({ series: '6500', number: '123456' });
  });

  it('prefers explicit passport_data over JSON notes and handles plain text notes', () => {
    const plain = parseUserNotesAndPassport({
      notes: 'Опытный водитель',
      passport_data: { series: '6600' },
    });
    expect(plain.noteText).toBe('Опытный водитель');
    expect(plain.passport).toEqual({ series: '6600' });
  });
});

describe('staff/utils — classifyStaffTx', () => {
  it('classifies trip and garage payroll accruals', () => {
    const tripAccrual = classifyStaffTx(makeTx({ description: 'ЗП за рейс #45' }));
    expect(tripAccrual.type).toBe('accrual');
    expect(tripAccrual.source).toBe('Рейс');
    expect(tripAccrual.isIncome).toBe(true);

    const garageAccrual = classifyStaffTx(
      makeTx({ description: 'Начисление по заказ-наряду НЗ-77' }),
    );
    expect(garageAccrual.type).toBe('accrual');
    expect(garageAccrual.source).toBe('Гараж / СТО');
  });

  it('classifies payouts, advances, tax deductions, and advance offsets', () => {
    const payout = classifyStaffTx(
      makeTx({ from_wallet_id: 'w1', description: 'Выплата зарплаты из Касса' }),
    );
    expect(payout.type).toBe('payout');
    expect(payout.source).toContain('Касса');

    const adv = classifyStaffTx(
      makeTx({ category_id: ADVANCE_CAT, direction: 'expense', description: 'Аванс наличными' }),
    );
    expect(adv.type).toBe('advance');
    expect(adv.badgeText).toBe('Выдан аванс');

    const tax = classifyStaffTx(
      makeTx({ category_id: ADVANCE_CAT, direction: 'expense', description: 'Вычет по ТК РФ' }),
    );
    expect(tax.type).toBe('advance');
    expect(tax.badgeText).toBe('Налог ТК РФ');

    const offset = classifyStaffTx(
      makeTx({ category_id: ADVANCE_CAT, direction: 'income', description: 'Зачёт аванса' }),
    );
    expect(offset.type).toBe('offset');
    expect(offset.isIncome).toBe(true);
  });
});

describe('staff/utils — parseAccrualMeta', () => {
  it('extracts service order metadata from relation or description', () => {
    const meta = parseAccrualMeta(
      makeTx({
        description: 'Наряд НЗ-12: Замена масла (60 мин)',
      }),
    );
    expect(meta.isOrder).toBe(true);
    expect(meta.orderNumber).toBe('НЗ-12');
    expect(meta.workName).toBe('Замена масла');
    expect(meta.groupKey).toBe('order_НЗ-12');
  });

  it('extracts trip metadata from trip relation or description', () => {
    const meta = parseAccrualMeta(
      makeTx({
        trip_id: 'trip-uuid-1',
        trip: { id: 'trip-uuid-1', trip_number: 305, vehicle_label: 'Газель А111АА' },
        description: 'ЗП за рейс #305',
      }),
    );
    expect(meta.isTrip).toBe(true);
    expect(meta.tripNumber).toBe('305');
    expect(meta.vehicleDesc).toBe('Газель А111АА');
    expect(meta.groupKey).toBe('trip_trip-uuid-1');
  });
});

describe('staff/historyGrouping — groupStaffAccruals & filterStaffAdvances', () => {
  it('groups multiple works of the same service order and computes partial settlement status', () => {
    const groups = groupStaffAccruals([
      makeTx({
        id: 't1',
        amount: '1500',
        service_order_id: 'so-1',
        description: 'Наряд #10: Замена масла',
        settlement_status: 'completed',
      }),
      makeTx({
        id: 't2',
        amount: '2500',
        service_order_id: 'so-1',
        description: 'Наряд #10: Замена колодок',
        settlement_status: 'pending',
      }),
    ]);

    expect(groups).toHaveLength(1);
    const g = groups[0]!;
    expect(g.totalAmount).toBe(4000);
    expect(g.paidAmount).toBe(1500);
    expect(g.unpaidAmount).toBe(2500);
    expect(g.settlement_status).toBe('partial');
    expect(g.works).toHaveLength(2);
  });

  it('filterStaffAdvances excludes work accruals and keeps advances/loans', () => {
    const res = filterStaffAdvances([
      makeTx({ id: 'w1', category_id: PAYROLL_CATS[0]!, description: 'ЗП за рейс #10' }),
      makeTx({ id: 'a1', category_id: ADVANCE_CAT, description: 'Аванс' }),
      makeTx({ id: 'd1', category_id: 'other', description: 'Долг за штраф' }),
      makeTx({ id: 'm1', category_id: 'other', description: 'Долг механику по наряду #5' }),
    ]);

    expect(res.map((t) => t.id)).toEqual(['a1', 'd1']);
  });
});
