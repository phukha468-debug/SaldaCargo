const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const PENZIN_ID = '92bcddf3-48d6-4482-83ef-53d87f60e558';
  const PLITKA_ID = 'b4741830-5b39-4841-bff5-f3b0ca77c066';
  const PENZIN_VEHICLE_ID = '167ed8aa-d70b-4716-ab24-b5c7f76bce43';
  const PENZIN_SERVICE_ORDER_ID = '9ce227d9-885b-473a-8b28-401802bba311';

  console.log('=== 1. RESTORING PENZIN ALEXEY ===');
  const { data: penzin, error: penzinErr } = await supabase
    .from('counterparties')
    .update({
      name: 'Пензин Алексей',
      phone: '+79045442302',
      is_active: true,
      notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', PENZIN_ID)
    .select();
  console.log('Restored Penzin:', penzin, 'error:', penzinErr);

  console.log('\n=== 2. REASSIGNING VEHICLE AND SERVICE ORDER TO PENZIN ===');
  const { data: veh, error: vehErr } = await supabase
    .from('client_vehicles')
    .update({
      counterparty_id: PENZIN_ID,
      updated_at: new Date().toISOString(),
    })
    .eq('id', PENZIN_VEHICLE_ID)
    .select();
  console.log('Reassigned vehicle А530ТМ196 to Penzin:', veh, 'error:', vehErr);

  const { data: svc, error: svcErr } = await supabase
    .from('service_orders')
    .update({
      counterparty_id: PENZIN_ID,
      updated_at: new Date().toISOString(),
    })
    .eq('id', PENZIN_SERVICE_ORDER_ID)
    .select();
  console.log('Reassigned service order #96 to Penzin:', svc, 'error:', svcErr);

  console.log('\n=== 3. UPDATING ALEXEY PLITKA ===');
  // Clean up notes from merge with Penzin
  const { data: plitkaBefore } = await supabase
    .from('counterparties')
    .select('notes')
    .eq('id', PLITKA_ID)
    .single();

  const cleanedNotes =
    (plitkaBefore?.notes || '')
      .split('\n')
      .filter((line) => !line.includes('Пензин Алексей'))
      .join('\n')
      .trim() || null;

  const { data: plitka, error: plitkaErr } = await supabase
    .from('counterparties')
    .update({
      name: 'Алексей плитка',
      phone: null, // Phone belonged to Penzin
      is_active: true,
      notes: cleanedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', PLITKA_ID)
    .select();
  console.log('Updated Alexey Plitka:', plitka, 'error:', plitkaErr);

  console.log('\n=== 4. VERIFYING FINAL STATE ===');
  const { data: verifyCps } = await supabase
    .from('counterparties')
    .select('id, name, phone, notes, is_active')
    .in('id', [PENZIN_ID, PLITKA_ID]);
  console.log('Counterparties:');
  console.table(verifyCps);

  const { data: verifyVehs } = await supabase
    .from('client_vehicles')
    .select('id, brand, model, reg_number, counterparty_id')
    .in('counterparty_id', [PENZIN_ID, PLITKA_ID]);
  console.log('Vehicles:');
  console.table(verifyVehs);

  const { data: verifySvcs } = await supabase
    .from('service_orders')
    .select('id, order_number, client_name, client_vehicle_reg, counterparty_id')
    .in('counterparty_id', [PENZIN_ID, PLITKA_ID]);
  console.log('Service orders:');
  console.table(verifySvcs);
}

run();
