import { NextResponse } from 'next/server';
import { documentUrlQuerySchema, getEntityDocumentSignedUrl } from '@saldacargo/domain-service';
import { createMiniappApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const GET = createMiniappApiHandler(
  {
    roles: ['owner', 'admin'],
    querySchema: documentUrlQuerySchema,
    routeName: 'GET /api/admin/driver-documents/url',
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
