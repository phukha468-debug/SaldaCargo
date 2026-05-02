
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('--- DEBUG TABLES START ---');
  
  const { data, error } = await supabase
    .rpc('get_tables'); // This might not exist

  if (error) {
    console.error('RPC Error:', error.message);
    
    // Try a direct query to pg_catalog if possible (usually not via Supabase client)
    // But we can try to select from a known table
    const { data: users, error: usersError } = await supabase.from('users').select('count');
    console.log('Users count query error:', usersError?.message);
  }

  console.log('Data:', data);
}

debug();
