import { describe, expect, it } from 'vitest';
import { buildDailyExpenses } from '../buildDailyItems';
import { BANK_ID, type DailyBalanceData, type LinkableOrderItem } from '../types';
import {
  cleanExpenseDescription,
  detectBrandFromText,
  getFilteredCategories,
  getWeekDates,
  pickBestLinkableOrders,
  resolveExpenseCategory,
} from '../utils';

describe('daily-control utils', () => {
  it('computes Monday-Sunday week bounds for a Sunday date', () => {
    expect(getWeekDates('2026-11-22')).toEqual({
      weekStart: '2026-11-16',
      weekEnd: '2026-11-22',
    });
  });

  it('cleans bank noise and classifies expense categories', () => {
    expect(cleanExpenseDescription('Оплата ГСМ, НДС не облагается ИНН 6607000001')).toBe(
      'Оплата ГСМ',
    );
    expect(cleanExpenseDescription('Комиссия банка за входящий перевод')).toBe('Комиссия банка');
    expect(resolveExpenseCategory('Оплата топлива АЗС Лукойл', 'Прочие расходы')).toBe(
      'ГСМ / Топливо',
    );
    expect(resolveExpenseCategory('Любой текст', 'Запчасти')).toBe('Запчасти');
  });

  it('collapses multiple payroll categories into one ФОТ entry for expenses', () => {
    const res = getFilteredCategories(
      [
        { id: '1', name: 'Выручка', code: 'REV', direction: 'income' },
        { id: '2', name: 'ЗП водителям', code: 'PAYROLL_DRIVER', direction: 'expense' },
        { id: '3', name: 'ЗП механикам', code: 'PAYROLL_MECHANIC', direction: 'expense' },
        { id: '4', name: 'Запчасти', code: 'PARTS', direction: 'expense' },
      ],
      'expense',
      '3',
    );
    expect(res).toEqual([
      { id: '3', name: 'Зарплата (ФОТ)' },
      { id: '4', name: 'Запчасти' },
    ]);
  });

  it('detects vehicle brand from description text', () => {
    expect(detectBrandFromText('Рессора на Валдай')).toBe('valday');
    expect(detectBrandFromText('Колодки Газель Next')).toBe('gazelle');
    expect(detectBrandFromText('Масло моторное 10W40')).toBe('consumables');
    expect(detectBrandFromText('Фильтр Fuso Canter')).toBe('consumables');
    expect(detectBrandFromText('Сцепление Fuso Canter')).toBe('canter');
  });

  it('picks exact single or pair sum when auto-matching linkable orders', () => {
    const orders: LinkableOrderItem[] = [
      {
        id: 'o1',
        trip_id: 't1',
        amount: '1000',
        payment_method: 'invoice',
        settlement_status: 'pending',
        lifecycle_status: 'approved',
        created_at: '2026-11-20T10:00:00Z',
        counterparty: { id: 'c1', name: 'Альфа' },
      },
      {
        id: 'o2',
        trip_id: 't2',
        amount: '1500',
        payment_method: 'invoice',
        settlement_status: 'pending',
        lifecycle_status: 'approved',
        created_at: '2026-11-20T11:00:00Z',
        counterparty: { id: 'c1', name: 'Альфа' },
      },
    ];
    expect(pickBestLinkableOrders(orders, 1500)).toEqual(['o2']);
    expect(pickBestLinkableOrders(orders, 2500)).toEqual(['o1', 'o2']);
  });

  it('deduplicates summary FSSP row matching sum of detailed FSSP rows', () => {
    const data: DailyBalanceData = {
      date: '2026-11-20',
      is_today: false,
      wallets: {
        bank: {
          id: BANK_ID,
          name: 'Банк',
          account_number: '40802',
          api_synced: true,
          morning: 0,
          inflow: 0,
          outflow: 0,
          evening: 0,
        },
        cash: { id: 'c', name: 'Сейф', morning: 0, inflow: 0, outflow: 0, evening: 0 },
        fuel_card: { id: 'f', name: 'Топливо', morning: 0, inflow: 0, outflow: 0, evening: 0 },
      },
      audit: null,
      transactions: [
        {
          id: 'summary',
          amount: '3000',
          direction: 'expense',
          description: 'ФССП удержание из зарплаты',
          created_at: '2026-11-20T10:00:00Z',
          from_wallet_id: BANK_ID,
          to_wallet_id: null,
          category: null,
          counterparty: null,
          related_user: null,
        },
        {
          id: 'part-1',
          amount: '1000',
          direction: 'expense',
          description: '//ВЗП// ФССП ИП 1',
          created_at: '2026-11-20T10:01:00Z',
          from_wallet_id: BANK_ID,
          to_wallet_id: null,
          category: null,
          counterparty: null,
          related_user: null,
        },
        {
          id: 'part-2',
          amount: '2000',
          direction: 'expense',
          description: '//ВЗП// ФССП ИП 2',
          created_at: '2026-11-20T10:02:00Z',
          from_wallet_id: BANK_ID,
          to_wallet_id: null,
          category: null,
          counterparty: null,
          related_user: null,
        },
      ],
      trip_orders: [],
      cash_collections: [],
      categories: [],
    };

    const items = buildDailyExpenses({
      data,
      calendarItems: [],
      activeWallet: 'all',
      period: 'day',
      selectedDate: '2026-11-20',
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.amount).toBe(3000);
    expect(items[0]?.subItems).toHaveLength(2);
  });
});
