import { NextResponse } from 'next/server';
import { createMiniappApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

interface RawAssetRow {
  id: string;
  short_name: string | null;
  reg_number: string | null;
  type: string | null;
}

interface RawAssetDocCountRow {
  asset_id: string;
  is_pass_package: boolean;
}

export const GET = createMiniappApiHandler(
  {
    roles: ['owner', 'admin'],
    routeName: 'GET /api/admin/assets',
  },
  async ({ auth }) => {
    const supabase = createAdminClient();

    const [{ data: assetsData, error: assetsErr }, { data: docsData, error: docsErr }] =
      await Promise.all([
        supabase
          .from('assets')
          .select('id, short_name, reg_number, type')
          .eq('organization_id', auth.organizationId)
          .eq('is_active', true)
          .order('short_name'),
        supabase
          .from('asset_documents')
          .select('asset_id, is_pass_package')
          .eq('organization_id', auth.organizationId),
      ]);

    if (assetsErr) {
      return NextResponse.json({ error: assetsErr.message }, { status: 500 });
    }
    if (docsErr) {
      return NextResponse.json({ error: docsErr.message }, { status: 500 });
    }

    const totalByAsset = new Map<string, number>();
    const passByAsset = new Map<string, number>();
    for (const doc of (docsData ?? []) as RawAssetDocCountRow[]) {
      totalByAsset.set(doc.asset_id, (totalByAsset.get(doc.asset_id) ?? 0) + 1);
      if (doc.is_pass_package) {
        passByAsset.set(doc.asset_id, (passByAsset.get(doc.asset_id) ?? 0) + 1);
      }
    }

    const result = ((assetsData ?? []) as RawAssetRow[]).map((a) => ({
      id: a.id,
      short_name: a.short_name,
      reg_number: a.reg_number,
      type: a.type,
      docs_count: totalByAsset.get(a.id) ?? 0,
      pass_docs_count: passByAsset.get(a.id) ?? 0,
    }));

    return NextResponse.json(result);
  },
);
