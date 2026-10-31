const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data: orders } = await supabase
    .from('trip_orders')
    .select(
      `
      id,
      trip_id,
      amount,
      driver_pay,
      loader_pay,
      loader2_pay,
      loaders_data,
      direction,
      description,
      invoice_number,
      invoice_date,
      invoice_status,
      settlement_status,
      lifecycle_status,
      created_at,
      counterparty:counterparties(id, name),
      trip:trips(trip_number, driver:users!trips_driver_id_fkey(name), asset:assets(short_name, reg_number))
    `,
    )
    .or('amount.eq.4000,amount.eq.4000.00')
    .order('created_at', { ascending: false });

  console.log(`Total orders with amount 4000 in DB: ${orders?.length}`);
  const geostroyOrPrr = (orders || []).filter(
    (o) =>
      /геострой/i.test(o.counterparty?.name || '') ||
      /геострой/i.test(o.description || '') ||
      /501|510/i.test(o.counterparty?.name || ''),
  );

  console.log('\n--- Geostroy or TK501 orders of 4000 ---');
  geostroyOrPrr.forEach((o) => {
    console.log({
      orderId: o.id,
      tripNumber: o.trip?.trip_number,
      cp: o.counterparty?.name,
      amount: o.amount,
      driverPay: o.driver_pay,
      loaderPay: o.loader_pay,
      loader2Pay: o.loader2_pay,
      direction: o.direction,
      invoice: o.invoice_number,
      settlement: o.settlement_status,
      lifecycle: o.lifecycle_status,
      desc: o.description,
      createdAt: o.created_at,
    });
  });

  console.log('\n--- ALL orders with invoice containing (2) ---');
  const { data: invOrders } = await supabase
    .from('trip_orders')
    .select(
      'id, amount, invoice_number, counterparty:counterparties(name), trip:trips(trip_number)',
    )
    .like('invoice_number', '%(2)%');
  console.log(invOrders);
}

run();
