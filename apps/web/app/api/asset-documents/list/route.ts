import { NextResponse } from 'next/server';
import { assetDocumentsListQuerySchema, listEntityDocuments } from '@saldacargo/domain-service';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const GET = createWebApiHandler(
  {
    roles: ['owner', 'admin'],
    querySchema: assetDocumentsListQuerySchema,
    routeName: 'GET /api/asset-documents/list',
  },
  async ({ auth, query }) => {
    const supabase = createAdminClient();
    const docs = await listEntityDocuments(supabase, {
      organizationId: auth.organizationId,
      entityKind: 'asset',
      entityId: query.assetId,
    });
    return NextResponse.json(docs);
  },
);
