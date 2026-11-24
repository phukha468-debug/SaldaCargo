import { NextResponse } from 'next/server';
import { documentUrlQuerySchema, getEntityDocumentSignedUrl } from '@saldacargo/domain-service';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const GET = createWebApiHandler(
  {
    roles: ['owner', 'admin'],
    querySchema: documentUrlQuerySchema,
    routeName: 'GET /api/driver-documents/url',
  },
  async ({ auth, query }) => {
    const supabase = createAdminClient();
    const result = await getEntityDocumentSignedUrl(supabase, {
      organizationId: auth.organizationId,
      entityKind: 'driver',
      documentId: query.id,
      expiresIn: query.expiresIn,
    });
    return NextResponse.json(result);
  },
);
