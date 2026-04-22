import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const supabase = createAdminClient();
  const { periodId } = await request.json();

  // Simulated payroll calculation
  const { data: trips } = await supabase
    .from('trips')
    .select('driver_salary, loader_salary')
    .eq('status', 'approved');

  const total = (trips || []).reduce((s, t) => s + Number(t.driver_salary) + Number(t.loader_salary), 0);

  return NextResponse.json({
    calculated: true,
    totalPayroll: total,
    count: trips?.length || 0
  });
}
