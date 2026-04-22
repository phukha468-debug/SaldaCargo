import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = createAdminClient();
  
  // Complexity: Aggregating from multiple tables for the "Money Map"
  // In production, this should be a DB view or a stored procedure for performance
  
  const { data: wallets } = await supabase.from('wallets').select('balance');
  const { data: assets } = await supabase.from('assets').select('id');
  const { data: transactions } = await supabase.from('transactions').select('amount, type, created_at');

  const totalBalance = (wallets || []).reduce((sum, w) => sum + Number(w.balance), 0);
  
  // Real logic would calculate these from DB
  return NextResponse.json({
    success: true,
    data: {
      netPosition: totalBalance - 320000, // Assets - Liabilities
      assets: {
        cash: totalBalance,
        fleet: 8500000,
        equipment: 450000
      },
      liabilities: {
        accountsPayable: 210000,
        taxes: 110000
      },
      pandlMonth: {
        revenue: 2450000,
        expenses: 1845000,
        profit: 605000
      },
      today: {
        revenue: 125000,
        payroll: 32000,
        fuel: 18500,
        profit: 74500
      }
    }
  });
}
