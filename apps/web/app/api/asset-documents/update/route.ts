import { NextResponse } from 'next/server';
import { documentUpdateBodySchema, updateEntityDocument } from '@saldacargo/domain-service';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const PATCH = createWebApiHandler(
  {
    roles: ['owner', 'admin'],
    bodySchema: documentUpdateBodySchema,
    routeName: 'PATCH /api/asset-documents/update',
  },
  async ({ auth, body }) => {
    const supabase = createAdminClient();
    const doc = await updateEntityDocument(supabase, {
      organizationId: auth.organizationId,
      entityKind: 'asset',
      documentId: body.id,
      isPassPackage: body.isPassPackage,
      fileName: body.fileName,
    });
    return NextResponse.json(doc);
  },
);
