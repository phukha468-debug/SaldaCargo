const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function fixRLS() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('--- FIX RLS START ---');

  // Мы не можем выполнить произвольный SQL через supabase-js напрямую, 
  // если нет RPC функции. Но мы можем попробовать создать политику через миграцию 
  // или проверить доступ.

  const { data, error } = await supabase.from('assets').select('count', { count: 'exact', head: true });

  if (error) {
    console.error('Error accessing assets:', error.message);
    if (error.message.includes('permission denied')) {
      console.log('Confirmed: Permission denied. Need to apply SQL policy.');
    }
  } else {
    console.log('Assets count accessible with Service Key:', data);
  }
}

fixRLS();
