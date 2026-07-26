import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../apps/web/.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const envVars: Record<string, string> = {};
for (const line of envText.split('\n')) {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
  if (match) {
    envVars[match[1]] = match[2].trim();
  }
}

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('=== Cleaning up duplicated transactions ===');

  const duplicateTxnIds = [
    // Trip 394 duplicates
    '80c01ac6-5af3-48d5-8fd4-b91e94501ff7', // Duplicate loader pay (2000 ₽)
    'e9e960d9-5e38-4d80-a03c-d8333fc332f1', // Duplicate trip revenue income (11700 ₽)
    // Trip 364 duplicates
    '4d4b612d-dd92-4d21-9b49-1958672c1edb', // Duplicate cash income (5900 ₽)
    '21ab0739-5292-41ef-8abe-d4d3522791f0', // Duplicate QR income (6000 ₽)
  ];

  for (const id of duplicateTxnIds) {
    const { data, error } = await supabase
      .from('transactions')
      .update({
        lifecycle_status: 'cancelled',
        cancelled_reason: 'Исправление задвоения при апруве рейса',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, amount, description, trip_id');

    if (error) {
      console.error(`Failed to cancel transaction ${id}:`, error);
    } else {
      console.log(`Successfully cancelled transaction ${id}:`, data);
    }
  }

  console.log('\n=== Cleanup complete ===');
}

main().catch(console.error);
