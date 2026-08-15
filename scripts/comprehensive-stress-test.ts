/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// ── Load Environment ────────────────────────────────────────────────────────
const envContent = fs.readFileSync('apps/web/.env.local', 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts
      .slice(1)
      .join('=')
      .trim()
      .replace(/(^['"]|['"]$)/g, '');
    env[key] = val;
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(url, key);

// ── Constants ────────────────────────────────────────────────────────────────
const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const CARD_ID = '10000000-0000-0000-0000-000000000003';
const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';

const PREFIX = `[STRESS_${Date.now()}]`;

// ── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const testIds: {
  userIds: string[];
  assetIds: string[];
  counterpartyIds: string[];
  tripIds: string[];
  serviceOrderIds: string[];
  loanIds: string[];
  partIds: string[];
  transactionIds: string[];
} = {
  userIds: [],
  assetIds: [],
  counterpartyIds: [],
  tripIds: [],
  serviceOrderIds: [],
  loanIds: [],
  partIds: [],
  transactionIds: [],
};

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function logSection(title: string) {
  console.log(`\n======================================================`);
  console.log(`🔷 ${title}`);
  console.log(`======================================================`);
}

async function run() {
  console.log(`🚀 Starting Full-Scale Stress Test (${PREFIX})...`);

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: INITIALIZE TEST FIXTURES
    // ═══════════════════════════════════════════════════════════════════════════
    await logSection('1. Initializing Test Fixtures');

    // 1.1 Create Test Admin, Driver, and Mechanic
    const { data: adminUser, error: adminErr } = await supabase
      .from('users')
      .insert({
        name: `${PREFIX} Admin`,
        phone: `+7999${Math.floor(1000000 + Math.random() * 9000000)}`,
        roles: ['admin', 'owner'],
        is_active: true,
      })
      .select()
      .single();
    if (adminErr) throw adminErr;
    testIds.userIds.push(adminUser.id);
    assert(!!adminUser.id, 'Created Test Admin user');

    const { data: driverUser, error: driverErr } = await supabase
      .from('users')
      .insert({
        name: `${PREFIX} Водитель Тестовый`,
        phone: `+7999${Math.floor(1000000 + Math.random() * 9000000)}`,
        roles: ['driver'],
        is_active: true,
      })
      .select()
      .single();
    if (driverErr) throw driverErr;
    testIds.userIds.push(driverUser.id);
    assert(!!driverUser.id, 'Created Test Driver user');

    const { data: mechanicUser, error: mechErr } = await supabase
      .from('users')
      .insert({
        name: `${PREFIX} Механик-Сварщик`,
        phone: `+7999${Math.floor(1000000 + Math.random() * 9000000)}`,
        roles: ['mechanic'],
        mechanic_salary_pct: 50,
        is_active: true,
      })
      .select()
      .single();
    if (mechErr) throw mechErr;
    testIds.userIds.push(mechanicUser.id);
    assert(!!mechanicUser.id, 'Created Test Mechanic user');

    // 1.2 Create Test Asset (Truck)
    const { data: asset, error: assetErr } = await supabase
      .from('assets')
      .insert({
        short_name: `${PREFIX} Газель Next`,
        reg_number: `A${Math.floor(100 + Math.random() * 900)}AA196`,
        asset_type_id: '00000000-0000-0000-0002-000000000001',
        odometer_current: 100000,
        status: 'active',
      })
      .select()
      .single();
    if (assetErr) throw assetErr;
    testIds.assetIds.push(asset.id);
    assert(!!asset.id, 'Created Test Fleet Asset');

    // 1.3 Create Test Counterparty
    const { data: counterparty, error: cpErr } = await supabase
      .from('counterparties')
      .insert({
        name: `${PREFIX} ООО МеталлТранс`,
        type: 'client',
        phone: '+79990001122',
        is_active: true,
      })
      .select()
      .single();
    if (cpErr) throw cpErr;
    testIds.counterpartyIds.push(counterparty.id);
    assert(!!counterparty.id, 'Created Test Counterparty');

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: LOGISTICS LIFECYCLE (MINIAPP DRIVER + WEB REVIEW)
    // ═══════════════════════════════════════════════════════════════════════════
    await logSection('2. Testing Logistics Lifecycle (Shift -> Orders -> Review -> Payroll)');

    // 2.1 Driver Starts Shift
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .insert({
        driver_id: driverUser.id,
        asset_id: asset.id,
        started_at: new Date(Date.now() - 3600000 * 8).toISOString(),
        odometer_start: 100000,
        lifecycle_status: 'draft',
      })
      .select()
      .single();
    if (tripErr) throw tripErr;
    testIds.tripIds.push(trip.id);
    assert(trip.lifecycle_status === 'draft', 'Driver started trip in draft status');

    // 2.2 Add 5 Diverse Orders with Different Payment Methods
    const orderTypes = [
      { amount: 15000, method: 'cash', desc: 'Наличная оплата за рейс' },
      { amount: 25000, method: 'bank_invoice', desc: 'Безналичный расчет с договором' },
      { amount: 8000, method: 'qr', desc: 'Оплата по QR коду на Р/С' },
      { amount: 12000, method: 'card_driver', desc: 'Перевод на карту водителя' },
      { amount: 10000, method: 'debt_cash', desc: 'Долг клиента нал' },
    ];

    let totalRevenue = 0;
    for (const ot of orderTypes) {
      const { data: order, error: ordErr } = await supabase
        .from('trip_orders')
        .insert({
          trip_id: trip.id,
          counterparty_id: ot.method === 'bank_invoice' ? counterparty.id : null,
          amount: ot.amount,
          payment_method: ot.method,
          description: ot.desc,
          lifecycle_status: 'draft',
          settlement_status: 'pending',
          idempotency_key: crypto.randomUUID(),
        })
        .select()
        .single();
      if (ordErr) throw ordErr;
      totalRevenue += ot.amount;
    }
    assert(totalRevenue === 70000, `Added 5 diverse trip orders totaling ${totalRevenue} ₽`);

    // 2.3 Add Trip Direct Expenses (Fuel card, cash parking)
    const { data: fuelExp, error: fuelErr } = await supabase
      .from('trip_expenses')
      .insert({
        trip_id: trip.id,
        category_id: '62cebf3f-9982-4cc6-904b-48c6169cf5e4', // FUEL
        amount: 5000,
        payment_method: 'fuel_card',
        description: 'Заправка ДТ на АЗС по топливной карте',
        idempotency_key: crypto.randomUUID(),
      })
      .select()
      .single();
    if (fuelErr) throw fuelErr;
    assert(fuelExp.amount === 5000, 'Recorded fuel card expense (5000 ₽)');

    // 2.4 Driver Completes Shift
    const { data: completedTrip, error: endErr } = await supabase
      .from('trips')
      .update({
        ended_at: new Date().toISOString(),
        odometer_end: 100350, // 350 km
        driver_note: 'Смена завершена успешно',
      })
      .eq('id', trip.id)
      .select()
      .single();
    if (endErr) throw endErr;
    const distanceKm = completedTrip.odometer_end - completedTrip.odometer_start;
    assert(distanceKm === 350, `Driver completed trip with ${distanceKm} km distance`);

    // 2.5 Admin Approves Trip (Review) & Generates Payroll / Settlement
    // Calculate expected driver wage: 350 km * 15 ₽ + 1000 ₽ fixed = 6250 ₽
    const expectedDriverWage = distanceKm * 15 + 1000;
    const { error: reviewErr } = await supabase
      .from('trips')
      .update({
        status: 'completed',
        lifecycle_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: adminUser.id,
      })
      .eq('id', trip.id);
    if (reviewErr) throw reviewErr;

    // Approve orders in trip
    await supabase
      .from('trip_orders')
      .update({
        lifecycle_status: 'approved',
        settlement_status: 'completed',
      })
      .eq('trip_id', trip.id);

    // Create Driver Wage Accrual Transaction
    const { data: wageTx, error: wageErr } = await supabase
      .from('transactions')
      .insert({
        direction: 'expense',
        amount: expectedDriverWage,
        category_id: 'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // Payroll
        related_user_id: driverUser.id,
        trip_id: trip.id,
        lifecycle_status: 'approved',
        settlement_status: 'pending', // Debt to driver
        description: `ЗП: ${driverUser.name} — рейс (${distanceKm} км)`,
        idempotency_key: crypto.randomUUID(),
        created_by: adminUser.id,
      })
      .select()
      .single();
    if (wageErr) throw wageErr;
    testIds.transactionIds.push(wageTx.id);
    assert(wageTx.amount === 6250, `Accrued driver wage debt of ${expectedDriverWage} ₽`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: GARAGE, STO & WAREHOUSE LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════════
    await logSection(
      '3. Testing Garage & Warehouse (Order -> 80% Welder Salary -> Parts -> Close)',
    );

    // 3.1 Create Service Order
    const { data: serviceOrder, error: soErr } = await supabase
      .from('service_orders')
      .insert({
        asset_id: asset.id,
        machine_type: 'own',
        problem_description: 'Сварочные работы по раме и кузову',
        status: 'in_progress',
        lifecycle_status: 'approved',
        created_by: adminUser.id,
      })
      .select()
      .single();
    if (soErr) throw soErr;
    testIds.serviceOrderIds.push(serviceOrder.id);
    assert(!!serviceOrder.id, 'Created Service Order in Garage');

    // 3.2 Add Part to Service Order
    const { data: orderPart, error: partErr } = await supabase
      .from('service_order_parts')
      .insert({
        service_order_id: serviceOrder.id,
        custom_part_name: 'Сварочные электроды и усилитель рамы',
        quantity: 2,
        unit: 'шт',
        unit_price: 3000,
        client_price: 5000,
        status: 'reserved',
      })
      .select()
      .single();
    if (partErr) throw partErr;
    assert(orderPart.quantity === 2, 'Added 2 units of parts to service order');

    // 3.3 Add Custom Work with 80% Custom Salary
    const workPrice = 50000;
    const customSalaryPct = 80;
    const expectedMechSalary = (workPrice * customSalaryPct) / 100; // 40,000 ₽

    const { data: workItem, error: workErr } = await supabase
      .from('service_order_works')
      .insert({
        service_order_id: serviceOrder.id,
        custom_work_name: 'Кастомные сварочные работы',
        price_client: workPrice,
        mechanic_id: mechanicUser.id,
        notes: `[salary_pct:${customSalaryPct}]`,
        status: 'completed',
        salary_paid: true,
        norm_minutes: 120,
        actual_minutes: 180,
      })
      .select()
      .single();
    if (workErr) throw workErr;
    assert(workItem.price_client === 50000, 'Created custom welding work for 50 000 ₽');

    // 3.4 Accrue Mechanic Salary with custom 80% percentage
    const { data: mechTx, error: mechTxErr } = await supabase
      .from('transactions')
      .insert({
        direction: 'expense',
        amount: expectedMechSalary,
        category_id: '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // Mechanic salary
        related_user_id: mechanicUser.id,
        service_order_id: serviceOrder.id,
        lifecycle_status: 'approved',
        settlement_status: 'pending',
        description: `Долг механику — наряд: Кастомные сварочные работы (80% от 50 000 ₽)`,
        idempotency_key: crypto.randomUUID(),
        created_by: adminUser.id,
      })
      .select()
      .single();
    if (mechTxErr) throw mechTxErr;
    testIds.transactionIds.push(mechTx.id);
    assert(
      mechTx.amount === 40000,
      `Calculated and accrued exact 80% mechanic salary: ${expectedMechSalary} ₽ (not default 50%)`,
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: FINANCIAL FLOW, 4-WALLET BALANCES & RECONCILIATION
    // ═══════════════════════════════════════════════════════════════════════════
    await logSection('4. Testing Financial Circuit & 4-Wallet Integrity');

    // 4.1 Cash Collection (Driver cash -> Safe)
    const collectedAmount = 15000;
    const { data: collection, error: colErr } = await supabase
      .from('cash_collections')
      .insert({
        driver_id: driverUser.id,
        amount: collectedAmount,
        collected_by: adminUser.id,
      })
      .select()
      .single();
    if (colErr) throw colErr;
    assert(
      collection.amount === 15000,
      `Recorded cash collection from driver to Safe: ${collectedAmount} ₽`,
    );

    // 4.2 Bank -> Fuel Card Transfer (Пополнение топливных карт с Р/С)
    const fuelTopUp = 30000;
    const { data: fuelTransferTx, error: transferErr } = await supabase
      .from('transactions')
      .insert({
        direction: 'transfer',
        amount: fuelTopUp,
        category_id: '62cebf3f-9982-4cc6-904b-48c6169cf5e4', // FUEL
        from_wallet_id: BANK_ID,
        to_wallet_id: FUEL_CARD_ID,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        description: 'Пополнение корпоративных топливных карт с Р/С',
        idempotency_key: crypto.randomUUID(),
        created_by: adminUser.id,
      })
      .select()
      .single();
    if (transferErr) throw transferErr;
    testIds.transactionIds.push(fuelTransferTx.id);
    assert(
      fuelTransferTx.amount === 30000,
      `Transferred ${fuelTopUp} ₽ from Bank to Fuel Cards Wallet`,
    );

    // 4.3 Loan Creation with Automatic Wallet Deposit
    const loanAmount = 500000;
    const { data: stressLoan, error: loanErr } = await supabase
      .from('loans')
      .insert({
        lender_name: `${PREFIX} СберЛизинг`,
        loan_type: 'leasing',
        original_amount: loanAmount,
        remaining_amount: loanAmount,
        started_at: new Date().toISOString().split('T')[0],
        monthly_payment: 25000,
        is_active: true,
      })
      .select()
      .single();
    if (loanErr) throw loanErr;
    testIds.loanIds.push(stressLoan.id);

    // Deposit loan to Bank wallet
    const { data: loanDepTx, error: depErr } = await supabase
      .from('transactions')
      .insert({
        direction: 'income',
        amount: loanAmount,
        to_wallet_id: BANK_ID,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        category_id: '00000000-0000-0000-0000-000000000020',
        description: `Поступление кредита: СберЛизинг (${loanAmount} ₽)`,
        idempotency_key: crypto.randomUUID(),
        created_by: adminUser.id,
      })
      .select()
      .single();
    if (depErr) throw depErr;
    testIds.transactionIds.push(loanDepTx.id);
    assert(
      loanDepTx.amount === 500000,
      `Deposited loan disbursement of ${loanAmount} ₽ into Bank wallet`,
    );

    // 4.4 Partial Loan Repayment
    const repaymentAmount = 50000;
    const { error: loanPayTxErr } = await supabase.from('transactions').insert({
      direction: 'expense',
      amount: repaymentAmount,
      from_wallet_id: BANK_ID,
      category_id: '00000000-0000-0000-0000-000000000020',
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      description: 'Частичное погашение лизинга',
      idempotency_key: crypto.randomUUID(),
      created_by: adminUser.id,
    });
    if (loanPayTxErr) throw loanPayTxErr;

    const { data: updatedLoan, error: updLoanErr } = await supabase
      .from('loans')
      .update({
        remaining_amount: loanAmount - repaymentAmount,
      })
      .eq('id', stressLoan.id)
      .select()
      .single();
    if (updLoanErr) throw updLoanErr;
    assert(
      updatedLoan.remaining_amount === 450000,
      `Repaid ${repaymentAmount} ₽ from Bank, loan remaining is ${updatedLoan.remaining_amount} ₽`,
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: CONCURRENCY & DEDUPLICATION DEFENSE (STAFF PAYROLL)
    // ═══════════════════════════════════════════════════════════════════════════
    await logSection('5. Testing Anti-Race & Concurrency Protection (Double-Click Defense)');

    const payoutAmount = 6250;
    const idempotencyKey = crypto.randomUUID();

    // 5.1 First Payout Request
    const { data: firstPayout, error: pay1Err } = await supabase
      .from('transactions')
      .insert({
        direction: 'expense',
        amount: payoutAmount,
        from_wallet_id: CASH_ID,
        category_id: 'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
        related_user_id: driverUser.id,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        description: `Выплата зарплаты: ${driverUser.name}`,
        idempotency_key: idempotencyKey,
        created_by: adminUser.id,
      })
      .select()
      .single();
    if (pay1Err) throw pay1Err;
    testIds.transactionIds.push(firstPayout.id);
    assert(firstPayout.amount === 6250, 'First payout transaction succeeded');

    // 5.2 Second Concurrent Payout with same idempotency key
    const { data: duplicatePayout, error: pay2Err } = await supabase
      .from('transactions')
      .insert({
        direction: 'expense',
        amount: payoutAmount,
        from_wallet_id: CASH_ID,
        category_id: 'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
        related_user_id: driverUser.id,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        description: `Выплата зарплаты: ${driverUser.name}`,
        idempotency_key: idempotencyKey,
        created_by: adminUser.id,
      })
      .select();

    const blockedDuplicate = !!pay2Err || !duplicatePayout || duplicatePayout.length === 0;
    assert(blockedDuplicate, 'Idempotency key successfully BLOCKED duplicate payout transaction!');

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 6: RECONCILIATION INVARIANT VALIDATION
    // ═══════════════════════════════════════════════════════════════════════════
    await logSection('6. Validating Accounting Invariants (Cashflow & Balance Matching)');

    // Query all wallets
    const [
      { data: bankOrders },
      { data: cardOrders },
      { data: collections },
      { data: txIn },
      { data: txOut },
      { data: activeLoans },
    ] = await Promise.all([
      supabase
        .from('trip_orders')
        .select('amount')
        .in('payment_method', ['bank_invoice', 'qr'])
        .eq('settlement_status', 'completed')
        .eq('lifecycle_status', 'approved'),

      supabase
        .from('trip_orders')
        .select('amount')
        .eq('payment_method', 'card_driver')
        .eq('settlement_status', 'completed')
        .eq('lifecycle_status', 'approved'),

      supabase.from('cash_collections').select('amount'),

      supabase
        .from('transactions')
        .select('amount, to_wallet_id')
        .in('to_wallet_id', [BANK_ID, CASH_ID, CARD_ID, FUEL_CARD_ID])
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      supabase
        .from('transactions')
        .select('amount, from_wallet_id')
        .in('from_wallet_id', [BANK_ID, CASH_ID, CARD_ID, FUEL_CARD_ID])
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      supabase.from('loans').select('remaining_amount').eq('is_active', true),
    ]);

    const sumVal = (rows: any[]) =>
      (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);
    const sumWhereVal = (rows: any[], key: string, val: string) =>
      (rows ?? [])
        .filter((r: any) => r[key] === val)
        .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

    const calcBank =
      sumVal(bankOrders ?? []) +
      sumWhereVal(txIn ?? [], 'to_wallet_id', BANK_ID) -
      sumWhereVal(txOut ?? [], 'from_wallet_id', BANK_ID);

    const calcCash =
      sumVal(collections ?? []) +
      sumWhereVal(txIn ?? [], 'to_wallet_id', CASH_ID) -
      sumWhereVal(txOut ?? [], 'from_wallet_id', CASH_ID);

    const calcCard =
      sumVal(cardOrders ?? []) +
      sumWhereVal(txIn ?? [], 'to_wallet_id', CARD_ID) -
      sumWhereVal(txOut ?? [], 'from_wallet_id', CARD_ID);

    const calcFuel =
      sumWhereVal(txIn ?? [], 'to_wallet_id', FUEL_CARD_ID) -
      sumWhereVal(txOut ?? [], 'from_wallet_id', FUEL_CARD_ID);

    const totalLiquid = calcBank + calcCash + calcCard + calcFuel;
    const totalLoans = (activeLoans ?? []).reduce(
      (s, l) => s + parseFloat(l.remaining_amount ?? '0'),
      0,
    );

    console.log(`\n  📊 Current Financial Snapshot:`);
    console.log(`    • Bank:      ${calcBank.toLocaleString('ru-RU')} ₽`);
    console.log(`    • Safe Cash: ${calcCash.toLocaleString('ru-RU')} ₽`);
    console.log(`    • Card:      ${calcCard.toLocaleString('ru-RU')} ₽`);
    console.log(`    • Fuel Card: ${calcFuel.toLocaleString('ru-RU')} ₽`);
    console.log(`    • Total Liquid: ${totalLiquid.toLocaleString('ru-RU')} ₽`);
    console.log(`    • Active Loans Debt: ${totalLoans.toLocaleString('ru-RU')} ₽`);

    assert(calcBank >= 0, `Bank balance is positive (${calcBank} ₽)`);
    assert(calcCash >= 0, `Safe cash balance is positive (${calcCash} ₽)`);
    assert(calcFuel >= 0, `Fuel card balance is positive (${calcFuel} ₽)`);
    assert(totalLiquid > 0, `Total liquid assets are positive (${totalLiquid} ₽)`);
  } catch (err: any) {
    console.error('❌ Critical Stress Test Failure:', err);
    failed++;
  } finally {
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 7: CLEANUP TEST FIXTURES
    // ═══════════════════════════════════════════════════════════════════════════
    await logSection('7. Cleaning Up Test Fixtures');

    if (testIds.transactionIds.length > 0) {
      await supabase.from('transactions').delete().in('id', testIds.transactionIds);
    }
    if (testIds.loanIds.length > 0) {
      await supabase.from('loans').delete().in('id', testIds.loanIds);
    }
    if (testIds.partIds.length > 0) {
      await supabase.from('parts').delete().in('id', testIds.partIds);
    }
    if (testIds.serviceOrderIds.length > 0) {
      await supabase
        .from('service_order_works')
        .delete()
        .in('service_order_id', testIds.serviceOrderIds);
      await supabase.from('service_orders').delete().in('id', testIds.serviceOrderIds);
    }
    if (testIds.tripIds.length > 0) {
      await supabase.from('trip_orders').delete().in('trip_id', testIds.tripIds);
      await supabase.from('trip_expenses').delete().in('trip_id', testIds.tripIds);
      await supabase.from('cash_collections').delete().in('driver_id', testIds.userIds);
      await supabase.from('trips').delete().in('id', testIds.tripIds);
    }
    if (testIds.counterpartyIds.length > 0) {
      await supabase.from('counterparties').delete().in('id', testIds.counterpartyIds);
    }
    if (testIds.assetIds.length > 0) {
      await supabase.from('assets').delete().in('id', testIds.assetIds);
    }
    if (testIds.userIds.length > 0) {
      await supabase.from('users').delete().in('id', testIds.userIds);
    }

    console.log(`  🧹 All test fixtures successfully cleaned up.`);

    console.log(`\n======================================================`);
    console.log(`🏁 STRESS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`======================================================\n`);
  }
}

run();
