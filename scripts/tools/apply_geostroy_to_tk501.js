const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const TK501_ID = 'd955ee16-5597-4515-8712-06a55dd36c16';
  const GEOSTROY_ID = '83db41b2-c050-4013-a878-bda2ab5c226e';

  console.log('=== 1. MOVING 4000 ORDERS FROM GEOSTROY TO TK501 ===');

  // Order 1: Trip 832
  const { data: o832, error: e832 } = await supabase
    .from('trip_orders')
    .update({
      counterparty_id: TK501_ID,
      direction: 'loaders_only',
      amount: 0,
      payment_method: 'cash',
      settlement_status: 'completed',
      invoice_number: null,
      invoice_date: null,
      invoice_status: 'unbilled',
      invoice_paid_at: null,
      description: 'Внутренние работы (ПРР) ТК501 / Погрузо-разгрузочные работы (без авто)',
      updated_at: new Date().toISOString(),
    })
    .eq('id', '6a1729b5-fdd3-4208-825c-e282683e4dc2')
    .select();
  console.log('Updated order 832:', o832, 'error:', e832);

  // Order 2: Trip 844 (loader part 4000)
  const { data: o844, error: e844 } = await supabase
    .from('trip_orders')
    .update({
      counterparty_id: TK501_ID,
      direction: 'loaders_only',
      amount: 0,
      payment_method: 'cash',
      settlement_status: 'completed',
      invoice_number: null,
      invoice_date: null,
      invoice_status: 'unbilled',
      invoice_paid_at: null,
      description: 'Внутренние работы (ПРР) ТК501 / Шайтанка-Маминское',
      updated_at: new Date().toISOString(),
    })
    .eq('id', '5efb38a9-533f-495e-9116-d0e0b2801dc6')
    .select();
  console.log('Updated order 844 (loaders):', o844, 'error:', e844);

  // Order 3: Trip 852 (loader part 4000)
  const { data: o852, error: e852 } = await supabase
    .from('trip_orders')
    .update({
      counterparty_id: TK501_ID,
      direction: 'loaders_only',
      amount: 0,
      payment_method: 'cash',
      settlement_status: 'completed',
      invoice_number: null,
      invoice_date: null,
      invoice_status: 'unbilled',
      invoice_paid_at: null,
      description: 'Внутренние работы (ПРР) ТК501 / Шайтанка-Маминское',
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'b47332c6-bd3c-4db0-82ee-ec8c59e73ce8')
    .select();
  console.log('Updated order 852 (loaders):', o852, 'error:', e852);

  // Order 4: Trip 844 cancelled duplicate
  const { data: o844dup, error: e844dup } = await supabase
    .from('trip_orders')
    .update({
      counterparty_id: TK501_ID,
      direction: 'loaders_only',
      amount: 0,
      invoice_number: null,
      invoice_date: null,
      invoice_status: 'unbilled',
      invoice_paid_at: null,
      description: 'Дубликат (отменен)',
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'd765ce5d-532f-42e7-ae97-eee729da1114')
    .select();
  console.log('Updated order 844 (cancelled dup):', o844dup, 'error:', e844dup);

  console.log('\n=== 2. VERIFYING GEOSTROY ORDERS ===');
  const { data: remainingGeostroy } = await supabase
    .from('trip_orders')
    .select(
      'id, amount, invoice_number, description, counterparty:counterparties(name), trip:trips(trip_number)',
    )
    .eq('counterparty_id', GEOSTROY_ID)
    .neq('lifecycle_status', 'cancelled')
    .order('created_at', { ascending: false });

  console.log(`Remaining active Geostroy orders: ${remainingGeostroy.length}`);
  const any4000 = remainingGeostroy.filter((o) => Number(o.amount) === 4000);
  console.log('Any remaining 4000 orders in Geostroy:', any4000);

  console.log('\n=== 3. VERIFYING TK501 ORDERS ===');
  const { data: tk501Orders } = await supabase
    .from('trip_orders')
    .select(
      'id, amount, driver_pay, loader_pay, loader2_pay, direction, description, trip:trips(trip_number)',
    )
    .eq('counterparty_id', TK501_ID)
    .neq('lifecycle_status', 'cancelled')
    .order('created_at', { ascending: false });
  console.log('All TK501 orders:');
  console.table(
    tk501Orders.map((o) => ({
      tripNumber: o.trip?.trip_number,
      amount: o.amount,
      loaderPay: o.loader_pay,
      loader2Pay: o.loader2_pay,
      direction: o.direction,
      desc: o.description,
    })),
  );
}

run();
