const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  console.log('--- Updating roles for Макс, Артём, Роман Радикович ---');

  const updates = [
    {
      nameMatch: 'макс',
      id: '23b82f3c-6e82-4766-8835-05da473a9408',
      newRoles: ['welder', 'mechanic'],
    },
    {
      nameMatch: 'артём',
      id: '0695ee0c-0810-4979-9d36-1de7caf255d7',
      newRoles: ['electrician', 'mechanic'],
    },
    {
      nameMatch: 'роман радикович',
      id: '595e749a-6271-4799-b9e6-6132c2d89913',
      newRoles: ['driver', 'mechanic_lead', 'mechanic'],
    },
  ];

  for (const item of updates) {
    const { data: user } = await supabase.from('users').select('*').eq('id', item.id).single();
    if (user) {
      const mergedRoles = Array.from(new Set([...(user.roles || []), ...item.newRoles]));
      const { data: updated, error } = await supabase
        .from('users')
        .update({ roles: mergedRoles })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error(`Error updating user ${user.name}:`, error);
      } else {
        console.log(`Updated user ${updated.name} (id: ${updated.id}): roles =`, updated.roles);
      }
    }
  }

  console.log('\n--- Checking all users with mechanic/welder/electrician/mechanic_lead roles ---');
  const { data: mechanics } = await supabase
    .from('users')
    .select('id, name, roles, mechanic_salary_pct')
    .eq('is_active', true);

  const garageWorkers = (mechanics || []).filter(
    (u) =>
      u.roles &&
      u.roles.some((r) =>
        ['mechanic', 'mechanic_lead', 'welder', 'electrician', 'painter'].includes(r),
      ),
  );

  console.log(`Garage workers count: ${garageWorkers.length}`);
  garageWorkers.forEach((w) => {
    console.log(
      `- ${w.name} | roles: ${w.roles.join(', ')} | default_pct: ${w.mechanic_salary_pct ?? '50'}%`,
    );
  });
}

run().catch(console.error);
