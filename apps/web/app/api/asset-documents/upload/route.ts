import { NextResponse } from 'next/server';
import { ApiError } from '@saldacargo/shared';
import { uploadEntityDocument } from '@saldacargo/domain-service';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const POST = createWebApiHandler(
  {
    roles: ['owner', 'admin'],
    routeName: 'POST /api/asset-documents/upload',
    rateLimit: { keyPrefix: 'web-asset-doc-upload', limit: 30, windowMs: 60_000 },
  },
  async ({ auth, request }) => {
    const formData = await request.formData();
    const file = formData.get('file');
    const assetId = String(formData.get('assetId') ?? '').trim();
    const isPassPackageRaw = formData.get('isPassPackage');
    const isPassPackage = isPassPackageRaw === null ? true : String(isPassPackageRaw) !== 'false';

    if (!(file instanceof File) || !assetId) {
      throw new ApiError(400, 'Необходимо передать файл и assetId');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = createAdminClient();
    const doc = await uploadEntityDocument(supabase, {
      organizationId: auth.organizationId,
      entityKind: 'asset',
      entityId: assetId,
      uploadedBy: auth.userId,
      fileName: file.name,
      mimeType: file.type,
      buffer,
      isPassPackage,
    });

    return NextResponse.json(doc, { status: 201 });
  },
);
