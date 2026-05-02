
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('--- DEBUG ASSETS START ---');
  
  const { data, error } = await supabase
    .from('assets')
    .select('id, reg_number, short_name, status');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Total assets found:', data.length);
  console.table(data);
}

debug();
