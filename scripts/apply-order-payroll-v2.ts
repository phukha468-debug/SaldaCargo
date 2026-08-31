import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('--- Applying migration 20260901000000_order_payroll_v2.sql ---');
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260901000000_order_payroll_v2.sql'),
    'utf-8',
  );

  // Try RPC exec_sql if available
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.log('RPC exec_sql result/error:', error.message);
  } else {
    console.log('RPC exec_sql success:', data);
  }

  // Check columns in trip_orders
  const { data: testData, error: testError } = await supabase
    .from('trip_orders')
    .select('id, direction, is_driver_loader, driver_car_pay, driver_loader_pay, loaders_data')
    .limit(1);

  if (testError) {
    console.log('Columns test error in trip_orders:', testError.message);
  } else {
    console.log('Columns in trip_orders are available! Sample:', testData);
  }
}

main().catch(console.error);
