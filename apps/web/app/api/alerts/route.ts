/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const RECEIVABLES_OVERDUE_DAYS = 14;
const DOCS_WARN_DAYS = 30;

export async function GET() {
  try {
    const supabase = createAdminClient();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const warnDate = new Date(now);
    warnDate.setDate(warnDate.getDate() + DOCS_WARN_DAYS);
    const warnDateStr = warnDate.toISOString().slice(0, 10);

    const overdueSince = new Date(now);
    overdueSince.setDate(overdueSince.getDate() - RECEIVABLES_OVERDUE_DAYS);
    const overdueSinceStr = overdueSince.toISOString();

    const in7days = new Date(now);
    in7days.setDate(in7days.getDate() + 7);
    const in7Str = in7days.toISOString().slice(0, 10);

    const [{ data: assets }, { data: receivables }, { data: loans }] = await Promise.all([
      // Fleet: docs missing or expiring within 30 days (exclude sold/written_off)
      (supabase.from('assets') as any)
        .select('id, short_name, reg_number, insurance_expires_at, inspection_expires_at, status')
        .not('status', 'in', '("sold","written_off")')
        .or(
          [
            'insurance_expires_at.is.null',
            `insurance_expires_at.lte.${warnDateStr}`,
            'inspection_expires_at.is.null',
            `inspection_expires_at.lte.${warnDateStr}`,
          ].join(','),
        ),

      // Receivables: approved+pending older than 14 days
      (supabase.from('trip_orders') as any)
        .select(
          'id, amount, created_at, counterparty:counterparties(name), trip:trips!inner(asset_id)',
        )
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .lt('created_at', overdueSinceStr),

      // Loans: payment due within 7 days (including overdue)
      (supabase.from('loans') as any)
        .select('id, lender_name, next_payment_date, monthly_payment')
        .eq('is_active', true)
        .not('next_payment_date', 'is', null)
        .lte('next_payment_date', in7Str),
    ]);

    // ── Fleet alerts ──────────────────────────────────────────────────────────

    type DocAlert = {
      id: string;
      asset_name: string;
      reg_number: string;
      type: 'insurance' | 'inspection';
      expires_at: string | null;
      overdue: boolean;
    };

    const fleetAlerts: DocAlert[] = [];
    for (const a of (assets as any[]) ?? []) {
      for (const [type, field] of [
        ['insurance', 'insurance_expires_at'],
        ['inspection', 'inspection_expires_at'],
      ] as const) {
        const exp: string | null = a[field];
        if (exp === null || exp <= warnDateStr) {
          fleetAlerts.push({
            id: `${a.id}-${type}`,
            asset_name: a.short_name,
            reg_number: a.reg_number,
            type,
            expires_at: exp,
            overdue: exp === null || exp < todayStr,
          });
        }
      }
    }

    // ── Receivables alerts ────────────────────────────────────────────────────

    type ReceivableAlert = {
      id: string;
      counterparty: string;
      amount: string;
      days_overdue: number;
    };

    const receivableAlerts: ReceivableAlert[] = ((receivables as any[]) ?? []).map((r: any) => {
      const created = new Date(r.created_at);
      const days = Math.floor((now.getTime() - created.getTime()) / 86400000);
      return {
        id: r.id,
        counterparty: r.counterparty?.name ?? r.id,
        amount: r.amount,
        days_overdue: days,
      };
    });

    // ── Loan alerts ───────────────────────────────────────────────────────────

    type LoanAlert = {
      id: string;
      lender_name: string;
      next_payment_date: string;
      monthly_payment: string;
      overdue: boolean;
    };

    const loanAlerts: LoanAlert[] = ((loans as any[]) ?? []).map((l: any) => ({
      id: l.id,
      lender_name: l.lender_name,
      next_payment_date: l.next_payment_date,
      monthly_payment: l.monthly_payment,
      overdue: l.next_payment_date < todayStr,
    }));

    return NextResponse.json({
      fleet: fleetAlerts,
      receivables: receivableAlerts,
      loans: loanAlerts,
      total: fleetAlerts.length + receivableAlerts.length + loanAlerts.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { fleet: [], receivables: [], loans: [], total: 0, error: err?.message },
      { status: 500 },
    );
  }
}
