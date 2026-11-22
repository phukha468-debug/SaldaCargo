import { ADVANCE_CAT, PAYROLL_CATS } from '../constants';
import type { GroupedAccrualItem, StaffTx } from '../types';
import { parseAccrualMeta } from '../utils';

export function filterStaffAdvances(history: StaffTx[]): StaffTx[] {
  return history.filter((t) => {
    const isAdvCat = t.category_id === ADVANCE_CAT;
    const desc = (t.description || '').toLowerCase();
    const isWorkAccrual =
      PAYROLL_CATS.includes(t.category_id) ||
      desc.includes('наряд') ||
      desc.includes('долг механику') ||
      desc.includes('рейс');
    if (isWorkAccrual) return false;
    return (
      isAdvCat ||
      desc.includes('аванс') ||
      desc.includes('займ') ||
      (desc.includes('долг') && !desc.includes('долг механику'))
    );
  });
}

export function groupStaffAccruals(accruals: StaffTx[]): GroupedAccrualItem[] {
  const map = new Map<string, GroupedAccrualItem>();

  for (const tx of accruals) {
    const parsed = parseAccrualMeta(tx);
    const amt = parseFloat(tx.amount || '0') || 0;
    const isCompleted = tx.settlement_status === 'completed';
    const txDate = tx.transaction_date || tx.created_at || '';
    const txPaidDate = isCompleted ? tx.updated_at || tx.transaction_date || tx.created_at : null;

    let group = map.get(parsed.groupKey);
    if (!group) {
      let title = tx.description || 'Начисление';
      let source = 'Зарплата';
      if (parsed.isOrder) {
        title = `Заказ-наряд #${parsed.orderNumber}`;
        source = 'Гараж / СТО';
      } else if (parsed.isTrip) {
        title = `Рейс #${parsed.tripNumber}`;
        source = 'Рейс';
      }

      group = {
        id: tx.id,
        groupKey: parsed.groupKey,
        isOrder: parsed.isOrder,
        isTrip: parsed.isTrip,
        title,
        orderNumber: parsed.orderNumber,
        tripNumber: parsed.tripNumber,
        service_order_id: parsed.service_order_id,
        trip_id: parsed.trip_id,
        vehicle_desc: parsed.vehicleDesc,
        eventDate: parsed.eventDate,
        paidDate: txPaidDate,
        category_id: tx.category_id,
        source,
        latestDate: txDate,
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
        paidPct: 0,
        settlement_status: 'pending',
        works: [],
      };
      map.set(parsed.groupKey, group);
    } else {
      if (parsed.vehicleDesc && !group.vehicle_desc) group.vehicle_desc = parsed.vehicleDesc;
      if (parsed.eventDate && !group.eventDate) group.eventDate = parsed.eventDate;
      if (txPaidDate && (!group.paidDate || new Date(txPaidDate) > new Date(group.paidDate))) {
        group.paidDate = txPaidDate;
      }
    }

    if (txDate && (!group.latestDate || new Date(txDate) > new Date(group.latestDate))) {
      group.latestDate = txDate;
    }

    group.totalAmount += amt;
    if (isCompleted) group.paidAmount += amt;
    else group.unpaidAmount += amt;

    group.works.push({
      id: tx.id,
      title: parsed.workName || tx.description || 'Работа',
      amount: amt,
      settlement_status: tx.settlement_status,
      employee_confirmed: tx.employee_confirmed,
      updated_at: tx.updated_at,
      rawTx: tx,
    });
  }

  return Array.from(map.values()).map((g) => {
    const paidPct = g.totalAmount > 0 ? (g.paidAmount / g.totalAmount) * 100 : 0;
    let settlement_status: 'completed' | 'pending' | 'partial' = 'pending';
    if (g.paidAmount >= g.totalAmount - 0.01) settlement_status = 'completed';
    else if (g.paidAmount > 0.01) settlement_status = 'partial';

    const hasUnconfirmed = g.works.some((w) => w.employee_confirmed === false);

    return {
      ...g,
      paidPct,
      settlement_status,
      employee_confirmed: hasUnconfirmed ? false : true,
    };
  });
}
