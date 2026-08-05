const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  console.log('--- Checking custom_salary_pct and custom_salary_amount columns ---');

  const { data, error } = await supabase
    .from('service_order_works')
    .select('id, custom_salary_pct, custom_salary_amount')
    .limit(1);

  if (error) {
    console.log('Columns do not exist yet. Error:', error.message);
  } else {
    console.log('Columns custom_salary_pct and custom_salary_amount exist! Sample:', data);
  }
}

run().catch(console.error);
