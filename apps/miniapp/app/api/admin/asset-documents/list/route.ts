import { NextResponse } from 'next/server';
import { assetDocumentsListQuerySchema, listEntityDocuments } from '@saldacargo/domain-service';
import { createMiniappApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const GET = createMiniappApiHandler(
  {
    roles: ['owner', 'admin'],
    querySchema: assetDocumentsListQuerySchema,
    routeName: 'GET /api/admin/asset-documents/list',
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
