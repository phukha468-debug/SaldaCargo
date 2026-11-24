import { NextResponse } from 'next/server';
import { ApiError } from '@saldacargo/shared';
import { uploadEntityDocument } from '@saldacargo/domain-service';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const POST = createWebApiHandler(
  {
    roles: ['owner', 'admin'],
    routeName: 'POST /api/driver-documents/upload',
    rateLimit: { keyPrefix: 'web-driver-doc-upload', limit: 30, windowMs: 60_000 },
  },
  async ({ auth, request }) => {
    const formData = await request.formData();
    const file = formData.get('file');
    const driverId = String(formData.get('driverId') ?? '').trim();
    const isPassPackageRaw = formData.get('isPassPackage');
    const isPassPackage = isPassPackageRaw === null ? true : String(isPassPackageRaw) !== 'false';

    if (!(file instanceof File) || !driverId) {
      throw new ApiError(400, 'Необходимо передать файл и driverId');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = createAdminClient();
    const doc = await uploadEntityDocument(supabase, {
      organizationId: auth.organizationId,
      entityKind: 'driver',
      entityId: driverId,
      uploadedBy: auth.userId,
      fileName: file.name,
      mimeType: file.type,
      buffer,
      isPassPackage,
    });

    return NextResponse.json(doc, { status: 201 });
  },
);
