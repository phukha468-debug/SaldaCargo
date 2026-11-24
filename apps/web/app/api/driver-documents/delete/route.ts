import { NextResponse } from 'next/server';
import { deleteEntityDocument, documentDeleteBodySchema } from '@saldacargo/domain-service';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const POST = createWebApiHandler(
  {
    roles: ['owner', 'admin'],
    bodySchema: documentDeleteBodySchema,
    routeName: 'POST /api/driver-documents/delete',
  },
  async ({ auth, body }) => {
    const supabase = createAdminClient();
    await deleteEntityDocument(supabase, {
      organizationId: auth.organizationId,
      entityKind: 'driver',
      documentId: body.id,
    });
    return NextResponse.json({ success: true });
  },
);
