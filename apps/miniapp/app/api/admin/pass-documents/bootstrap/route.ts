import { NextResponse } from 'next/server';
import { getPassSendBootstrapData } from '@saldacargo/domain-service';
import { createMiniappApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const GET = createMiniappApiHandler(
  {
    roles: ['owner', 'admin'],
    routeName: 'GET /api/admin/pass-documents/bootstrap',
  },
  async ({ auth }) => {
    const supabase = createAdminClient();
    const data = await getPassSendBootstrapData(supabase, auth.organizationId);
    return NextResponse.json(data);
  },
);
