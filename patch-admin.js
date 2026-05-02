
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function patch() {
  console.log('Patching users...');
  
  // 1. Добавляем колонку email если её нет (через RPC или надеемся что она есть, 
  // но лучше через SQL в дашборде. Попробуем просто апдейтнуть)
  
  // 2. Находим админа и ставим ему email и is_active
  const { data, error } = await supabase
    .from('users')
    .update({ 
      is_active: true,
      notes: 'Admin with access'
    })
    .eq('phone', '+79221800911')
    .select();

  if (error) {
    console.error('Error updating admin:', error.message);
  } else {
    console.log('Admin updated:', data);
  }
}

patch();
