
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('--- DEBUG START ---');
  console.log('Target phone: "+79221800911"');
  
  const { data, error } = await supabase
    .from('users')
    .select('id, name, phone, is_active');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Total users found:', data.length);
  console.table(data);

  const exactMatch = data.find(u => u.phone === '+79221800911');
  if (exactMatch) {
    console.log('EXACT MATCH FOUND!', exactMatch);
  } else {
    console.log('No exact match for "+79221800911"');
    // Проверим на наличие лишних символов
    const partialMatch = data.find(u => u.phone?.includes('9221800911'));
    if (partialMatch) {
      console.log('Partial match found (check format!):', partialMatch);
    }
  }
}

debug();
