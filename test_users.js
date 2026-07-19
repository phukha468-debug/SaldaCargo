const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: users, error } = await supabase.from('users').select('id, name, current_asset_id').limit(1);
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Users:', users);
  }
}

main().catch(console.error);
