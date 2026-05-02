
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('--- USER STATUS CHECK ---');
  
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, roles, is_active')
    .limit(100);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  const active = users.filter(u => u.is_active);
  const inactive = users.filter(u => !u.is_active);
  const drivers = users.filter(u => u.roles && u.roles.includes('driver'));
  const admins = users.filter(u => u.roles && (u.roles.includes('admin') || u.roles.includes('owner')));

  console.log('Total users in DB:', users.length);
  console.log('Active users:', active.length);
  console.log('Inactive users:', inactive.length);
  console.log('Drivers:', drivers.length);
  console.log('Admins/Owners:', admins.length);

  console.log('\n--- ACTIVE USERS LIST ---');
  console.table(active.map(u => ({ name: u.name, roles: u.roles.join(', ') })));
}

check();
