const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  console.log('--- Applying migration to service_order_works ---');

  // Test if we can run via Postgres connection string if available in env
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
  if (dbUrl) {
    console.log('Found DB URL in env!');
    const { Client } = require('pg');
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('Connected to Postgres via Client!');
    await client.query(`
      ALTER TABLE service_order_works 
      ADD COLUMN IF NOT EXISTS custom_salary_pct NUMERIC(5,2) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS custom_salary_amount NUMERIC(10,2) DEFAULT NULL;
    `);
    console.log('Successfully executed ALTER TABLE via pg Client!');
    await client.end();
  } else {
    console.log('No direct DATABASE_URL in env, trying alternative methods...');
    // Try supabase SQL endpoint
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        sql: 'ALTER TABLE service_order_works ADD COLUMN IF NOT EXISTS custom_salary_pct NUMERIC(5,2) DEFAULT NULL, ADD COLUMN IF NOT EXISTS custom_salary_amount NUMERIC(10,2) DEFAULT NULL;',
      }),
    });
    console.log('Exec SQL endpoint response status:', res.status, await res.text());
  }

  // Verify columns
  const { data, error } = await supabase
    .from('service_order_works')
    .select('id, custom_salary_pct, custom_salary_amount')
    .limit(1);
  console.log('Verification result:', { data, error });
}

main().catch(console.error);
