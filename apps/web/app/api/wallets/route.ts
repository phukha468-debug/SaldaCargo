import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWalletsSummary } from '@saldacargo/domain-service';
import { createWebApiHandler } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 15;

export const GET = createWebApiHandler(
  {
    routeName: 'web:/api/wallets',
    roles: ['admin', 'owner'],
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('force') === '1';
    const supabase = createAdminClient();
    const result = await getWalletsSummary(supabase, { forceRefresh });
    return NextResponse.json(result);
  },
);
