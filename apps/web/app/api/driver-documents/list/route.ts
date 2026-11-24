import { NextResponse } from 'next/server';
import { driverDocumentsListQuerySchema, listEntityDocuments } from '@saldacargo/domain-service';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const GET = createWebApiHandler(
  {
    roles: ['owner', 'admin'],
    querySchema: driverDocumentsListQuerySchema,
    routeName: 'GET /api/driver-documents/list',
  },
  async ({ auth, query }) => {
    const supabase = createAdminClient();
    const docs = await listEntityDocuments(supabase, {
      organizationId: auth.organizationId,
      entityKind: 'driver',
      entityId: query.driverId,
    });
    return NextResponse.json(docs);
  },
);
