const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  // 1. Get counterparties
  const { data: cps } = await supabase
    .from('counterparties')
    .select('id, name')
    .or('name.ilike.%геострой%,name.ilike.%501%,name.ilike.%510%');
  console.log('Counterparties found:', cps);

  const geostroyCps = cps.filter((c) => /геострой/i.test(c.name));
  const tk501 = cps.find((c) => /501|510/i.test(c.name));
  console.log('TK501 cp:', tk501);

  const geostroyIds = geostroyCps.map((c) => c.id);

  // 2. Find orders
  const { data: orders, error } = await supabase
    .from('trip_orders')
    .select(
      `
      id,
      amount,
      driver_pay,
      loader_pay,
      loader2_pay,
      driver_loader_pay,
      loaders_data,
      direction,
      is_driver_loader,
      description,
      payment_method,
      settlement_status,
      lifecycle_status,
      invoice_number,
      created_at,
      trip_id,
      trip:trips(
        id,
        trip_number,
        status,
        lifecycle_status,
        trip_type,
        driver_id,
        driver:users!trips_driver_id_fkey(name),
        asset:assets(short_name, reg_number)
      )
    `,
    )
    .in('counterparty_id', geostroyIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  console.log(`Total Geostroy orders: ${orders.length}`);

  const orders4000 = orders.filter(
    (o) =>
      parseFloat(o.amount) === 4000 ||
      o.description?.includes('4000') ||
      o.description?.includes('4 000'),
  );
  console.log(`\nOrders with amount 4000 (total ${orders4000.length}):`);
  orders4000.forEach((o) => {
    console.log({
      orderId: o.id,
      tripNumber: o.trip?.trip_number,
      amount: o.amount,
      driverPay: o.driver_pay,
      loaderPay: o.loader_pay,
      loader2Pay: o.loader2_pay,
      driverLoaderPay: o.driver_loader_pay,
      loadersData: o.loaders_data,
      direction: o.direction,
      driverName: o.trip?.driver?.name,
      asset: o.trip?.asset?.short_name || o.trip?.asset?.reg_number,
      desc: o.description,
      invoice: o.invoice_number,
      settlement: o.settlement_status,
      date: o.created_at,
    });
  });

  // Also check if there are other orders around 4000 or any orders with 4000 in description
  const allOrdersList = orders.map((o) => ({
    tripNumber: o.trip?.trip_number,
    amount: o.amount,
    driver: o.trip?.driver?.name,
    asset: o.trip?.asset?.short_name || o.trip?.asset?.reg_number,
    desc: o.description,
    date: o.created_at.slice(0, 10),
    invoice: o.invoice_number,
  }));
  console.log('\nAll Geostroy orders overview:');
  console.table(allOrdersList);
}

run();
