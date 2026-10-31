const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  console.log('=== 1. UPDATING GEOSTROY ORDERS 49 AND 50 TO 30 000 ₽ ===');

  // Order 49 in trip 844
  const { data: o49, error: e49 } = await supabase
    .from('trip_orders')
    .update({
      amount: 30000,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '0e23ae95-1eb7-42ef-8a14-16ecbec74168')
    .select();
  console.log('Updated order 49 to 30000:', o49, 'error:', e49);

  // Order 50 in trip 852
  const { data: o50, error: e50 } = await supabase
    .from('trip_orders')
    .update({
      amount: 30000,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '76ac4d9a-4509-492e-bca9-e8b114b6bb7e')
    .select();
  console.log('Updated order 50 to 30000:', o50, 'error:', e50);

  // Reset driver_car_pay on TK501 PRR order in trip 844
  await supabase
    .from('trip_orders')
    .update({
      driver_car_pay: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '5efb38a9-533f-495e-9116-d0e0b2801dc6');

  console.log('\n=== 2. UPDATING SETTLEMENT TRANSACTION META ===');
  const meta = JSON.stringify({
    type: 'receivables_settlement',
    orders: [
      { id: 'ef09b1d7-f71d-46df-9d13-415f0e6dc07d', type: 'trip_order', amount: '50000.00' },
      { id: '0e23ae95-1eb7-42ef-8a14-16ecbec74168', type: 'trip_order', amount: '30000.00' },
      { id: '76ac4d9a-4509-492e-bca9-e8b114b6bb7e', type: 'trip_order', amount: '30000.00' },
    ],
  });

  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .update({
      photo_url: meta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '8b0cf3d1-d1e8-49ff-aa0d-c09ed1e8c7df')
    .select();
  console.log('Updated transaction 8b0cf3d1:', tx, 'error:', txErr);

  console.log('\n=== 3. VERIFYING TRIPS 844 AND 852 ===');
  const { data: trips } = await supabase
    .from('trips')
    .select(
      `
      trip_number,
      trip_orders (
        id,
        counterparty:counterparties(name),
        invoice_number,
        amount,
        driver_pay,
        loader_pay,
        loader2_pay,
        direction,
        description,
        settlement_status
      )
    `,
    )
    .in('trip_number', [844, 852])
    .order('trip_number', { ascending: true });

  for (const t of trips) {
    console.log(`\n--- Trip №${t.trip_number} ---`);
    console.table(
      t.trip_orders.map((o) => ({
        invoice: o.invoice_number,
        cp: o.counterparty?.name,
        amount: o.amount,
        driverPay: o.driver_pay,
        loaderPay: o.loader_pay,
        loader2Pay: o.loader2_pay,
        direction: o.direction,
        desc: o.description,
        status: o.settlement_status,
      })),
    );
  }
}

run();
