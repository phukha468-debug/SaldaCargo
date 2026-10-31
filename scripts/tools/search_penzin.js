const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  // 1. Search trip_orders with description or note containing 'пензин'
  const { data: penzinOrders } = await supabase
    .from('trip_orders')
    .select('*, trip:trips(trip_number, started_at, driver:users!trips_driver_id_fkey(name))')
    .or('description.ilike.%пензин%');
  console.log('Orders mentioning Пензин:', penzinOrders?.length);
  penzinOrders?.forEach((o) => {
    console.log({
      id: o.id,
      trip: o.trip?.trip_number,
      driver: o.trip?.driver?.name,
      amount: o.amount,
      desc: o.description,
      date: o.created_at,
      cpId: o.counterparty_id,
    });
  });

  // 2. Search transactions mentioning 'пензин'
  const { data: penzinTxs } = await supabase
    .from('transactions')
    .select('*')
    .or('description.ilike.%пензин%');
  console.log('\nTransactions mentioning Пензин:', penzinTxs?.length);
  penzinTxs?.forEach((t) => {
    console.log({
      id: t.id,
      amount: t.amount,
      desc: t.description,
      date: t.transaction_date,
      cpId: t.counterparty_id,
    });
  });

  // 3. Search orders mentioning 'плитк'
  const { data: plitkaOrders } = await supabase
    .from('trip_orders')
    .select('*, trip:trips(trip_number, started_at, driver:users!trips_driver_id_fkey(name))')
    .or('description.ilike.%плитк%');
  console.log('\nOrders mentioning Плитка:', plitkaOrders?.length);
  plitkaOrders?.forEach((o) => {
    console.log({
      id: o.id,
      trip: o.trip?.trip_number,
      driver: o.trip?.driver?.name,
      amount: o.amount,
      desc: o.description,
      date: o.created_at,
      cpId: o.counterparty_id,
    });
  });

  // 4. Also check service_orders mentioning 'пензин'
  const { data: penzinSvcs } = await supabase
    .from('service_orders')
    .select('*')
    .or('description.ilike.%пензин%');
  console.log('\nService orders mentioning Пензин:', penzinSvcs?.length);
}

run();
