import { NextResponse } from 'next/server';
import { documentUrlQuerySchema, getEntityDocumentSignedUrl } from '@saldacargo/domain-service';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const GET = createWebApiHandler(
  {
    roles: ['owner', 'admin'],
    querySchema: documentUrlQuerySchema,
    routeName: 'GET /api/asset-documents/url',
  },
  async ({ auth, query }) => {
    const supabase = createAdminClient();
    const result = await getEntityDocumentSignedUrl(supabase, {
      organizationId: auth.organizationId,
      entityKind: 'asset',
      documentId: query.id,
      expiresIn: query.expiresIn,
    });
    return NextResponse.json(result);
  },
);
