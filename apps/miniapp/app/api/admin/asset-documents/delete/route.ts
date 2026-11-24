import { NextResponse } from 'next/server';
import { deleteEntityDocument, documentDeleteBodySchema } from '@saldacargo/domain-service';
import { createMiniappApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const POST = createMiniappApiHandler(
  {
    roles: ['owner', 'admin'],
    bodySchema: documentDeleteBodySchema,
    routeName: 'POST /api/admin/asset-documents/delete',
  },
  async ({ auth, body }) => {
    const supabase = createAdminClient();
    await deleteEntityDocument(supabase, {
      organizationId: auth.organizationId,
      entityKind: 'asset',
      documentId: body.id,
    });
    return NextResponse.json({ success: true });
  },
);
