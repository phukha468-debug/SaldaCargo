const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Creating bucket "driver-documents"...');
  
  // 1. Создаём бакет (если не существует)
  const { data, error } = await supabase.storage.createBucket('driver-documents', {
    public: false, // Файлы будут приватными, доступ через signed URL
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    fileSizeLimit: 10485760 // 10MB
  });

  if (error) {
    if (error.message.includes('already exists')) {
       console.log('Bucket already exists.');
    } else {
       console.error('Error creating bucket:', error);
       return;
    }
  } else {
    console.log('Bucket created:', data);
  }
}

main().catch(console.error);
