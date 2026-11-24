import { NextResponse } from 'next/server';
import { documentUpdateBodySchema, updateEntityDocument } from '@saldacargo/domain-service';
import { createMiniappApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const PATCH = createMiniappApiHandler(
  {
    roles: ['owner', 'admin'],
    bodySchema: documentUpdateBodySchema,
    routeName: 'PATCH /api/admin/asset-documents/update',
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
