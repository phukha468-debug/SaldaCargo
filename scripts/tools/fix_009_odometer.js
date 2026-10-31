const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function fix() {
  console.log('--- 1. Fixing Asset 009 (М009ОВ96) ---');
  const { data: assetBefore, error: aErr1 } = await supabase
    .from('assets')
    .select('id, reg_number, short_name, odometer_current')
    .eq('reg_number', 'М009ОВ96')
    .single();

  if (aErr1) throw aErr1;
  console.log('Asset before:', assetBefore);

  const { data: assetAfter, error: aErr2 } = await supabase
    .from('assets')
    .update({ odometer_current: 142800, updated_at: new Date().toISOString() })
    .eq('id', assetBefore.id)
    .select()
    .single();

  if (aErr2) throw aErr2;
  console.log(
    'Asset after:',
    assetAfter.reg_number,
    assetAfter.short_name,
    'odometer_current:',
    assetAfter.odometer_current,
  );

  console.log('\n--- 2. Fixing Trip #927 ---');
  const { data: trip927, error: t927Err } = await supabase
    .from('trips')
    .update({
      odometer_start: 142750,
      odometer_end: 142800,
      updated_at: new Date().toISOString(),
    })
    .eq('trip_number', 927)
    .select('trip_number, odometer_start, odometer_end')
    .single();
  if (t927Err) throw t927Err;
  console.log('Trip 927 updated:', trip927);

  console.log('\n--- 3. Fixing Trip #900 ---');
  const { data: trip900, error: t900Err } = await supabase
    .from('trips')
    .update({
      odometer_end: 121088,
      updated_at: new Date().toISOString(),
    })
    .eq('trip_number', 900)
    .select('trip_number, odometer_start, odometer_end')
    .single();
  if (t900Err) throw t900Err;
  console.log('Trip 900 updated:', trip900);

  console.log('\n--- 4. Fixing Trip #901 ---');
  const { data: trip901, error: t901Err } = await supabase
    .from('trips')
    .update({
      odometer_start: 121088,
      odometer_end: 121088,
      updated_at: new Date().toISOString(),
    })
    .eq('trip_number', 901)
    .select('trip_number, odometer_start, odometer_end')
    .single();
  if (t901Err) throw t901Err;
  console.log('Trip 901 updated:', trip901);

  console.log('\n--- 5. Fixing Old Trips #385 and #388 ---');
  const { data: oldTrips, error: oldErr } = await supabase
    .from('trips')
    .update({
      odometer_end: 121000,
      updated_at: new Date().toISOString(),
    })
    .in('trip_number', [385, 388])
    .select('trip_number, odometer_start, odometer_end');
  if (oldErr) throw oldErr;
  console.log('Old trips updated:', oldTrips);

  console.log('\n--- 6. Verify Asset Current Odometer ---');
  const { data: finalAsset } = await supabase
    .from('assets')
    .select('id, reg_number, short_name, odometer_current')
    .eq('reg_number', 'М009ОВ96')
    .single();
  console.log('Final Asset 009:', finalAsset);
}

fix().catch(console.error);
