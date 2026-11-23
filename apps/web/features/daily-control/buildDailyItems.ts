import {
  BANK_ID,
  CASH_ID,
  FUEL_CARD_ID,
  type DailyBalanceData,
  type ExpenseItem,
  type IncomeItem,
  type PaymentCalendarItem,
  type PeriodMode,
  type RawTx,
  type TBankOp,
  type WalletFilter,
} from './types';
import {
  cleanExpenseDescription,
  formatTxTime,
  getOpLocalDate,
  resolveExpenseCategory,
} from './utils';

function txMatchesWallet(tx: RawTx, activeWallet: WalletFilter): boolean {
  if (activeWallet === 'all') return true;
  if (activeWallet === 'bank') return tx.from_wallet_id === BANK_ID || tx.to_wallet_id === BANK_ID;
  if (activeWallet === 'cash') return tx.from_wallet_id === CASH_ID || tx.to_wallet_id === CASH_ID;
  if (activeWallet === 'fuel_card')
    return tx.from_wallet_id === FUEL_CARD_ID || tx.to_wallet_id === FUEL_CARD_ID;
  return true;
}

export function buildDailyIncomes({
  data,
  activeWallet,
  period,
  selectedDate,
}: {
  data: DailyBalanceData | undefined;
  activeWallet: WalletFilter;
  period: PeriodMode;
  selectedDate: string;
}): IncomeItem[] {
  const incomeItems: IncomeItem[] = [];
  const bankOps = data?.bank_operations ?? [];
  const creditBankOps = bankOps.filter((op) => {
    if (op.typeOfOperation !== 'Credit') return false;
    if (period === 'day') {
      const opDay = getOpLocalDate(op);
      return !opDay || opDay === selectedDate;
    }
    return true;
  });

  if (activeWallet === 'all' || activeWallet === 'bank') {
    if (creditBankOps.length > 0) {
      creditBankOps.forEach((op) => {
        const payerName = op.payer?.name || op.counterParty?.name || 'Поступление на Р/С';
        const descLower = (op.description || op.payPurpose || '').toLowerCase();
        const isSbpOrQr =
          descLower.includes('сбп') ||
          descLower.includes('терминал') ||
          descLower.includes('qr') ||
          op.category === 'acquiring';

        const linkedTxs = (data?.transactions ?? []).filter(
          (t) =>
            t.idempotency_key === op.operationId ||
            (op.operationId && t.description?.includes(op.operationId)) ||
            (op.operationId && t.idempotency_key?.startsWith(`${op.operationId}_`)),
        );

        let title = op.description || op.payPurpose || 'Входящий перевод на Р/С';
        let author = payerName;
        let isLinked = false;
        let linkTypeLabel = '';
        let linkedTripNumber: string | number | undefined;
        let linkedDriverName: string | undefined;

        if (linkedTxs.length > 0) {
          isLinked = true;
          if (linkedTxs.length === 1 && linkedTxs[0]) {
            const linkedTx = linkedTxs[0];
            const cleanDesc = (linkedTx.description || '')
              .replace(/\s*\[bank_op:[^\]]+\]/g, '')
              .trim();
            if (cleanDesc.includes('Заказ-наряд') || cleanDesc.includes('Диспетчерский')) {
              linkTypeLabel = cleanDesc.replace(/^Оплата\s*/, '').trim();
            } else {
              const linkedOrder = (data?.trip_orders ?? []).find(
                (o) => o.id === linkedTx.trip_order_id,
              );
              const matchNum = cleanDesc.match(/Рейс №(\d+)/);
              linkedTripNumber =
                linkedOrder?.trip?.trip_number || (matchNum ? matchNum[1] : undefined);
              const matchDriver = cleanDesc.match(/\((.+?)\)/);
              linkedDriverName =
                linkedTx.related_user?.name ||
                linkedOrder?.trip?.driver?.name ||
                (matchDriver && matchDriver[1] ? matchDriver[1] : undefined);
              linkTypeLabel = linkedTripNumber
                ? `Рейс №${linkedTripNumber}${linkedDriverName ? ` (${linkedDriverName})` : ''}`
                : 'Рейс автопарка';
            }
            author = linkedDriverName ? `вод. ${linkedDriverName}` : payerName;
            title = cleanDesc || title;
          } else {
            const tripNumbers: string[] = [];
            const driverNames: string[] = [];
            for (const tx of linkedTxs) {
              const matchNum = tx.description?.match(/Рейс №(\d+)/);
              if (matchNum && matchNum[1] && !tripNumbers.includes(`№${matchNum[1]}`)) {
                tripNumbers.push(`№${matchNum[1]}`);
              }
              const matchDriver = tx.description?.match(/\((.+?)\)/);
              if (matchDriver && matchDriver[1] && !driverNames.includes(matchDriver[1])) {
                driverNames.push(matchDriver[1]);
              }
            }
            linkTypeLabel =
              tripNumbers.length > 0
                ? `Рейсы: ${tripNumbers.join(', ')}`
                : `${linkedTxs.length} рейса`;
            if (driverNames.length > 0) {
              author = `вод. ${driverNames.join(', ')}`;
            }
            title = `Оплата долга за ${linkedTxs.length} рейса (${tripNumbers.join(', ')})`;
          }
        }

        const opAmt = op.operationAmount || op.rubleAmount || 0;
        const matchingOrder = !isLinked
          ? (data?.trip_orders ?? []).find(
              (o) =>
                parseFloat(o.amount) === opAmt &&
                !(data?.transactions ?? []).some((t) => t.trip_order_id === o.id),
            )
          : undefined;

        const opDateVal =
          op.trxnPostDate || op.authorizationDate || op.operationDate || op.operationTime;
        incomeItems.push({
          id: `tbank-${op.operationId}`,
          title,
          category: isSbpOrQr ? 'Эквайринг / СБП' : 'Поступление на Р/С',
          wallet: 'bank',
          walletName: 'Р/С Банк (API)',
          author,
          amount: opAmt,
          time: formatTxTime(opDateVal, period),
          dateSort: opDateVal ? new Date(opDateVal).getTime() : 0,
          bankOp: op,
          isLinked,
          linkTypeLabel,
          linkedTripNumber,
          linkedDriverName,
          canLinkToTrip: true,
          suggestedOrder: matchingOrder,
        });
      });
    } else {
      (data?.trip_orders ?? [])
        .filter(
          (order) =>
            order.settlement_status === 'completed' && order.lifecycle_status === 'approved',
        )
        .forEach((order) => {
          const client = order.counterparty?.name || order.description || 'Оплата счёта / QR';
          const driver = order.trip?.driver?.name ? `вод. ${order.trip.driver.name}` : 'Рейс';
          incomeItems.push({
            id: `trip-${order.id}`,
            title: `Оплата рейса · ${client}`,
            category: 'Оплата по счёту / QR',
            wallet: 'bank',
            walletName: 'Р/С Банк',
            author: driver,
            amount: parseFloat(order.amount) || 0,
            time: formatTxTime(order.created_at, period),
            dateSort: new Date(order.created_at).getTime(),
          });
        });
    }
  }

  if (activeWallet === 'all' || activeWallet === 'cash') {
    (data?.cash_collections ?? [])
      .filter((col) => !/взаимозач/i.test(col.note || ''))
      .forEach((col) => {
        incomeItems.push({
          id: `cash-${col.id}`,
          title: `Инкассация с рейса${col.note ? ` (${col.note})` : ''}`,
          category: 'Наличные со смены',
          wallet: 'cash',
          walletName: 'Сейф (нал)',
          author: col.driver?.name || 'Водитель',
          amount: parseFloat(col.amount) || 0,
          time: formatTxTime(col.created_at, period),
          dateSort: new Date(col.created_at).getTime(),
        });
      });
  }

  const rawIncomeTxs = (data?.transactions ?? []).filter(
    (t) => t.direction === 'income' && txMatchesWallet(t, activeWallet),
  );

  const acquiringTxs: RawTx[] = [];
  rawIncomeTxs.forEach((tx) => {
    const desc = (tx.description || '').toLowerCase();
    const cat = (tx.category?.name || '').toLowerCase();

    if (desc.includes('корректировка остатка') || desc.includes('корректировка баланса')) {
      return;
    }

    if (creditBankOps.length > 0 && tx.to_wallet_id === BANK_ID) {
      return;
    }

    if (desc.includes('эквайринг') || cat.includes('эквайринг')) {
      acquiringTxs.push(tx);
    } else {
      let w: 'bank' | 'cash' | 'fuel_card' = 'bank';
      let wName = 'Р/С Банк';
      if (tx.to_wallet_id === CASH_ID) {
        w = 'cash';
        wName = 'Сейф (нал)';
      } else if (tx.to_wallet_id === FUEL_CARD_ID) {
        w = 'fuel_card';
        wName = 'Топливная карта';
      }
      const txDate = tx.transaction_date || tx.created_at;
      incomeItems.push({
        id: tx.id,
        title: tx.description || 'Погашение задолженности (нал)',
        category: tx.category?.name || 'Поступление в сейф',
        wallet: w,
        walletName: wName,
        author: tx.counterparty?.name || tx.related_user?.name || 'Администратор',
        amount: parseFloat(tx.amount) || 0,
        time: formatTxTime(txDate, period),
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
      });
    }
  });

  if (acquiringTxs.length > 0) {
    if (acquiringTxs.length === 1 && acquiringTxs[0]) {
      const tx = acquiringTxs[0];
      const txDate = tx.transaction_date || tx.created_at;
      incomeItems.push({
        id: tx.id,
        title: tx.description || 'Возмещение по эквайрингу',
        category: 'Эквайринг',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: 'Т-Банк Эквайринг',
        amount: parseFloat(tx.amount) || 0,
        time: formatTxTime(txDate, period),
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
      });
    } else {
      const sortedAcq = [...acquiringTxs].sort(
        (a, b) =>
          new Date(b.transaction_date || b.created_at).getTime() -
          new Date(a.transaction_date || a.created_at).getTime(),
      );
      const totalAcq = sortedAcq.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const latestAcq = sortedAcq[0];
      const latestAcqDate = latestAcq ? latestAcq.transaction_date || latestAcq.created_at : null;
      incomeItems.push({
        id: 'group-acquiring',
        title: `Возмещение по эквайрингу (${acquiringTxs.length} реестра)`,
        category: 'Эквайринг',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: 'Т-Банк Эквайринг',
        amount: totalAcq,
        time: formatTxTime(latestAcqDate, period),
        dateSort: latestAcqDate ? new Date(latestAcqDate).getTime() : 0,
        isGroup: true,
        subItems: sortedAcq.map((t) => ({
          id: t.id,
          title: t.description || 'Реестр эквайринга',
          author: t.counterparty?.name || 'Т-Банк',
          amount: parseFloat(t.amount) || 0,
          time: formatTxTime(t.transaction_date || t.created_at, period),
          rawTx: t,
        })),
      });
    }
  }

  incomeItems.sort((a, b) => (b.dateSort ?? 0) - (a.dateSort ?? 0));
  return incomeItems;
}

type BankCommItem = {
  id: string;
  title: string;
  author: string;
  amount: number;
  time: string;
  dateSort?: number;
  rawTx?: RawTx;
  bankOp?: TBankOp;
};

export function buildDailyExpenses({
  data,
  calendarItems,
  activeWallet,
  period,
  selectedDate,
}: {
  data: DailyBalanceData | undefined;
  calendarItems: PaymentCalendarItem[] | undefined;
  activeWallet: WalletFilter;
  period: PeriodMode;
  selectedDate: string;
}): ExpenseItem[] {
  const allExpenseTxs = (data?.transactions ?? []).filter(
    (t) =>
      (t.direction === 'expense' || (t.direction === 'transfer' && t.from_wallet_id)) &&
      txMatchesWallet(t, activeWallet),
  );

  // Защита от задвоения сводной ручной операции ФССП
  const rawExpenseTxs = allExpenseTxs.filter((tx, _, arr) => {
    const isFssp = /фссп|исполнит|взп|пристав|удержан.*зарплат/i.test(
      `${tx.description || ''} ${tx.category?.name || ''}`,
    );
    if (!isFssp) return true;

    const amt = parseFloat(tx.amount) || 0;
    const otherFsspTxs = arr.filter(
      (o) =>
        o.id !== tx.id &&
        /фссп|исполнит|взп|пристав|удержан.*зарплат/i.test(
          `${o.description || ''} ${o.category?.name || ''}`,
        ),
    );
    if (otherFsspTxs.length >= 2) {
      const sumOthers = otherFsspTxs.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);
      if (Math.abs(sumOthers - amt) < 1) {
        return false;
      }
    }
    return true;
  });

  const bankCommissions: BankCommItem[] = [];
  const payrollTxs: RawTx[] = [];
  const fuelTxs: RawTx[] = [];
  const individualExpenses: ExpenseItem[] = [];

  rawExpenseTxs.forEach((tx) => {
    const desc = (tx.description || '').toLowerCase();
    const cat = (tx.category?.name || '').toLowerCase();

    if (desc.includes('корректировка остатка') || desc.includes('корректировка баланса')) {
      return;
    }

    const txDate = tx.transaction_date || tx.created_at;

    if (
      desc.includes('комисси') ||
      cat.includes('комисси') ||
      desc.includes('за входящий перевод') ||
      desc.includes('плата за обслуживание')
    ) {
      bankCommissions.push({
        id: tx.id,
        title: tx.description || 'Комиссия банка',
        author: tx.counterparty?.name || 'Т-Банк',
        amount: parseFloat(tx.amount) || 0,
        time: formatTxTime(txDate, period),
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
      });
    } else if (
      desc.includes('зарплат') ||
      desc.includes('фот') ||
      desc.includes('аванс') ||
      cat.includes('зарплат') ||
      cat.includes('фот')
    ) {
      payrollTxs.push(tx);
    } else if (
      tx.from_wallet_id === FUEL_CARD_ID &&
      (desc.includes('гсм') || cat.includes('гсм') || desc.includes('заправ'))
    ) {
      fuelTxs.push(tx);
    } else {
      let w: 'bank' | 'cash' | 'fuel_card' = 'bank';
      let wName = 'Р/С Банк';
      if (tx.from_wallet_id === CASH_ID) {
        w = 'cash';
        wName = 'Сейф (нал)';
      } else if (tx.from_wallet_id === FUEL_CARD_ID) {
        w = 'fuel_card';
        wName = 'Топливная карта';
      }

      const txTime = formatTxTime(txDate, period);
      const txAmt = parseFloat(tx.amount) || 0;
      const calendarOverrides = data?.calendar_overrides ?? [];
      const matchedOv = calendarOverrides.find(
        (ov) =>
          (ov.custom_notes && ov.custom_notes.includes(tx.id)) ||
          (ov.paid_amount &&
            Math.abs(Number(ov.paid_amount) - txAmt) < 1 &&
            (tx.category_id === '00000000-0000-0000-0000-000000000020' ||
              (tx.description || '').toLowerCase().includes('кредит'))),
      );

      let oblTitle: string | null = null;
      let oblId: string | null = null;
      if (matchedOv) {
        oblId = matchedOv.obligation_id;
        const calItem = calendarItems?.find((i) => i.id === matchedOv.obligation_id);
        oblTitle = calItem?.title || matchedOv.custom_title || 'План платежей';
      }

      individualExpenses.push({
        id: tx.id,
        title: tx.description || 'Расход',
        category: tx.category?.name || 'Прочие расходы',
        categoryId: tx.category_id,
        wallet: w,
        walletName: wName,
        author: tx.related_user?.name || tx.counterparty?.name || 'Администратор',
        amount: txAmt,
        time: txTime,
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
        linkedObligationId: oblId,
        linkedObligationTitle: oblTitle,
      });
    }
  });

  if (data?.bank_operations && data.bank_operations.length > 0) {
    const debitBankOps = data.bank_operations.filter((op) => {
      if (op.typeOfOperation !== 'Debit') return false;
      if (activeWallet !== 'all' && activeWallet !== 'bank') return false;
      if (period === 'day') {
        const opDay = getOpLocalDate(op);
        if (opDay && opDay !== selectedDate) return false;
      }
      return !(data?.transactions ?? []).some((t) => t.idempotency_key === op.operationId);
    });

    debitBankOps.forEach((op) => {
      const desc = (op.description || op.payPurpose || '').toLowerCase();
      const opAmt = op.operationAmount || op.rubleAmount || 0;
      const dateVal =
        op.trxnPostDate || op.authorizationDate || op.operationDate || op.operationTime;
      const opTime = formatTxTime(dateVal, period);
      const opDateSort = dateVal ? new Date(dateVal).getTime() : 0;

      if (
        desc.includes('комисси') ||
        desc.includes('плата за') ||
        desc.includes('тариф') ||
        op.category === 'commission'
      ) {
        bankCommissions.push({
          id: `tbank-deb-${op.operationId}`,
          title: op.description || op.payPurpose || 'Комиссия банка',
          author: 'Т-Банк (Авто)',
          amount: opAmt,
          time: opTime,
          dateSort: opDateSort,
          bankOp: op,
        });
      } else {
        const receiverName = op.receiver?.name || op.counterParty?.name || 'Контрагент';
        individualExpenses.push({
          id: `tbank-deb-${op.operationId}`,
          title: op.description || op.payPurpose || `Списание с Р/С · ${receiverName}`,
          category: 'Списание с Р/С (API)',
          categoryId: null,
          wallet: 'bank',
          walletName: 'Р/С Банк',
          author: receiverName,
          amount: opAmt,
          time: opTime,
          dateSort: opDateSort,
          bankOp: op,
        });
      }
    });
  }

  const expenseItems: ExpenseItem[] = [];

  if (bankCommissions.length > 0) {
    const sortedComm = [...bankCommissions].sort((a, b) => (b.dateSort ?? 0) - (a.dateSort ?? 0));
    if (sortedComm.length === 1 && sortedComm[0]) {
      const comm = sortedComm[0];
      expenseItems.push({
        id: comm.id,
        title: comm.title,
        category: 'Банковские услуги',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: comm.author,
        amount: comm.amount,
        time: comm.time,
        dateSort: comm.dateSort,
        rawTx: comm.rawTx,
        bankOp: comm.bankOp,
      });
    } else {
      const totalComm = sortedComm.reduce((s, t) => s + t.amount, 0);
      const latestComm = sortedComm[0];
      expenseItems.push({
        id: 'group-bank-commission',
        title: `Банковские комиссии (${sortedComm.length} списаний)`,
        category: 'Банковские услуги',
        wallet: 'bank',
        walletName: 'Р/С Банк',
        author: 'Т-Банк (Авто)',
        amount: totalComm,
        time: latestComm?.time,
        dateSort: latestComm?.dateSort,
        isGroup: true,
        subItems: sortedComm.map((t) => ({
          id: t.id,
          title: t.title,
          author: t.author,
          amount: t.amount,
          time: t.time,
          category: 'Банковские услуги',
          wallet: 'bank' as const,
          walletName: 'Р/С Банк',
          rawTx: t.rawTx,
          bankOp: t.bankOp,
        })),
      });
    }
  }

  if (payrollTxs.length > 0) {
    const sortedPay = [...payrollTxs].sort(
      (a, b) =>
        new Date(b.transaction_date || b.created_at).getTime() -
        new Date(a.transaction_date || a.created_at).getTime(),
    );
    if (sortedPay.length === 1 && sortedPay[0]) {
      const tx = sortedPay[0];
      const txDate = tx.transaction_date || tx.created_at;
      const isCash = tx.from_wallet_id === CASH_ID;
      expenseItems.push({
        id: tx.id,
        title: tx.description || 'Выплата зарплаты',
        category: 'ФОТ / Зарплата',
        categoryId: tx.category_id,
        wallet: isCash ? 'cash' : 'bank',
        walletName: isCash ? 'Сейф (нал)' : 'Р/С Банк',
        author: tx.related_user?.name || 'Водитель/Сотрудник',
        amount: parseFloat(tx.amount) || 0,
        time: formatTxTime(txDate, period),
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
      });
    } else {
      const totalPay = sortedPay.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const latestPay = sortedPay[0];
      const latestPayDate = latestPay ? latestPay.transaction_date || latestPay.created_at : null;
      expenseItems.push({
        id: 'group-payroll',
        title: `Выплата зарплаты сотрудникам (${sortedPay.length} выплат)`,
        category: 'ФОТ / Зарплата',
        wallet: 'bank',
        walletName: 'Сводная выплата',
        author: 'Бухгалтерия / Директор',
        amount: totalPay,
        time: formatTxTime(latestPayDate, period),
        dateSort: latestPayDate ? new Date(latestPayDate).getTime() : 0,
        isGroup: true,
        subItems: sortedPay.map((t) => ({
          id: t.id,
          title: t.description || 'Зарплата / Аванс',
          author: t.related_user?.name || 'Сотрудник',
          amount: parseFloat(t.amount) || 0,
          time: formatTxTime(t.transaction_date || t.created_at, period),
          category: 'ФОТ / Зарплата',
          categoryId: t.category_id,
          wallet: t.from_wallet_id === CASH_ID ? 'cash' : 'bank',
          walletName: t.from_wallet_id === CASH_ID ? 'Сейф (нал)' : 'Р/С Банк',
          rawTx: t,
        })),
      });
    }
  }

  if (fuelTxs.length > 0) {
    const sortedFuel = [...fuelTxs].sort(
      (a, b) =>
        new Date(b.transaction_date || b.created_at).getTime() -
        new Date(a.transaction_date || a.created_at).getTime(),
    );
    if (sortedFuel.length === 1 && sortedFuel[0]) {
      const tx = sortedFuel[0];
      const txDate = tx.transaction_date || tx.created_at;
      expenseItems.push({
        id: tx.id,
        title: tx.description || 'Заправка ГСМ',
        category: 'ГСМ',
        categoryId: tx.category_id,
        wallet: 'fuel_card',
        walletName: 'Топливная карта',
        author: tx.related_user?.name || 'Водитель',
        amount: parseFloat(tx.amount) || 0,
        time: formatTxTime(txDate, period),
        dateSort: new Date(txDate).getTime(),
        rawTx: tx,
      });
    } else {
      const totalFuel = sortedFuel.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const latestFuel = sortedFuel[0];
      const latestFuelDate = latestFuel
        ? latestFuel.transaction_date || latestFuel.created_at
        : null;
      expenseItems.push({
        id: 'group-fuel',
        title: `Заправки автопарка (${sortedFuel.length} транзакций)`,
        category: 'ГСМ / Топливо',
        wallet: 'fuel_card',
        walletName: 'Топливная карта',
        author: 'Водители парка',
        amount: totalFuel,
        time: formatTxTime(latestFuelDate, period),
        dateSort: latestFuelDate ? new Date(latestFuelDate).getTime() : 0,
        isGroup: true,
        subItems: sortedFuel.map((t) => ({
          id: t.id,
          title: t.description || 'Заправка ТС',
          author: t.related_user?.name || 'Водитель',
          amount: parseFloat(t.amount) || 0,
          time: formatTxTime(t.transaction_date || t.created_at, period),
          category: 'ГСМ',
          categoryId: t.category_id,
          wallet: 'fuel_card',
          walletName: 'Топливная карта',
          rawTx: t,
        })),
      });
    }
  }

  const groupedByCategoryOrTitle = new Map<string, ExpenseItem[]>();
  for (const it of individualExpenses) {
    const cleanedTitle = cleanExpenseDescription(it.title);
    const assignedCategory = resolveExpenseCategory(cleanedTitle, it.category);
    it.title = cleanedTitle;
    it.category = assignedCategory;

    const groupKey = assignedCategory.toLowerCase();
    const list = groupedByCategoryOrTitle.get(groupKey) || [];
    list.push(it);
    groupedByCategoryOrTitle.set(groupKey, list);
  }

  for (const [catKey, list] of groupedByCategoryOrTitle.entries()) {
    const sortedList = [...list].sort((a, b) => (b.dateSort ?? 0) - (a.dateSort ?? 0));
    if (sortedList.length === 1 && sortedList[0]) {
      expenseItems.push(sortedList[0]);
    } else if (sortedList.length > 1 && sortedList[0]) {
      const first = sortedList[0];
      const sumAmt = sortedList.reduce((s, it) => s + it.amount, 0);
      expenseItems.push({
        id: `group-cat-${catKey.slice(0, 30)}-${sortedList.length}`,
        title: `${first.category} (${sortedList.length} операций)`,
        category: first.category,
        categoryId: first.categoryId,
        wallet: first.wallet,
        walletName: sortedList.every((it) => it.wallet === first.wallet)
          ? first.walletName
          : 'Разные счета',
        author: first.author,
        amount: sumAmt,
        time: first.time,
        dateSort: first.dateSort,
        isGroup: true,
        subItems: sortedList.map((it) => ({
          id: it.id,
          title: it.title,
          author: it.author,
          amount: it.amount,
          time: it.time || '—',
          category: it.category,
          categoryId: it.categoryId,
          wallet: it.wallet,
          walletName: it.walletName,
          rawTx: it.rawTx,
          bankOp: it.bankOp,
          linkedObligationId: it.linkedObligationId,
          linkedObligationTitle: it.linkedObligationTitle,
        })),
      });
    }
  }

  expenseItems.sort((a, b) => (b.dateSort ?? 0) - (a.dateSort ?? 0));
  return expenseItems;
}

export function computeWalletSummary(
  data: DailyBalanceData | undefined,
  activeWallet: WalletFilter,
) {
  const bankWallet = data?.wallets?.bank;
  const cashWallet = data?.wallets?.cash;
  const fuelWallet = data?.wallets?.fuel_card;

  let morningTotal =
    (bankWallet?.morning ?? 0) + (cashWallet?.morning ?? 0) + (fuelWallet?.morning ?? 0);
  let eveningTotal =
    (bankWallet?.evening ?? 0) + (cashWallet?.evening ?? 0) + (fuelWallet?.evening ?? 0);

  if (activeWallet === 'bank') {
    morningTotal = bankWallet?.morning ?? 0;
    eveningTotal = bankWallet?.evening ?? 0;
  } else if (activeWallet === 'cash') {
    morningTotal = cashWallet?.morning ?? 0;
    eveningTotal = cashWallet?.evening ?? 0;
  } else if (activeWallet === 'fuel_card') {
    morningTotal = fuelWallet?.morning ?? 0;
    eveningTotal = fuelWallet?.evening ?? 0;
  }

  return {
    morningTotal,
    eveningTotal,
    deltaTotal: eveningTotal - morningTotal,
  };
}
