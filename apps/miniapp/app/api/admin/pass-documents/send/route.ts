import { NextResponse } from 'next/server';
import { sendPassDocumentsPackage, sendPassPackageBodySchema } from '@saldacargo/domain-service';
import { createMiniappApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const POST = createMiniappApiHandler(
  {
    roles: ['owner', 'admin'],
    bodySchema: sendPassPackageBodySchema,
    routeName: 'POST /api/admin/pass-documents/send',
    rateLimit: { keyPrefix: 'miniapp-pass-send', limit: 20, windowMs: 60_000 },
  },
  async ({ auth, body }) => {
    const supabase = createAdminClient();
    const result = await sendPassDocumentsPackage(supabase, {
      organizationId: auth.organizationId,
      sentBy: auth.userId,
      recipientEmail: body.recipientEmail,
      counterpartyId: body.counterpartyId ?? null,
      assetId: body.assetId ?? null,
      driverId: body.driverId ?? null,
      assetDocumentIds: body.assetDocumentIds,
      driverDocumentIds: body.driverDocumentIds,
      subject: body.subject ?? null,
      bodyText: body.bodyText ?? null,
      includeSignature: body.includeSignature,
    });
    return NextResponse.json({ success: true, ...result });
  },
);
