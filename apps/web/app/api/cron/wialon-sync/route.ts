/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncValdaiTelematics, fetchWialonValdaiPositions } from '@saldacargo/domain-service';
import {
  isEnvConfigError,
  requireWialonEnv,
  verifyCronAuthorization,
  notifyCronFailure,
} from '@saldacargo/shared';
import { requireRole } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const cronAuth = verifyCronAuthorization(req.headers.get('authorization'));
    if (!cronAuth.ok) {
      const roleAuth = await requireRole(['admin', 'owner', 'dispatcher']);
      if (roleAuth instanceof NextResponse) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const url = new URL(req.url);
    const viewOnly = url.searchParams.get('view') === '1';

    const { host, token } = requireWialonEnv();

    if (viewOnly) {
      const positions = await fetchWialonValdaiPositions(host, token);
      return NextResponse.json({ success: true, positions });
    }

    const supabase = createAdminClient();
    const result = await syncValdaiTelematics(supabase, { host, token });

    return NextResponse.json(result);
  } catch (err: any) {
    if (!isEnvConfigError(err)) {
      await notifyCronFailure('wialon-sync', err);
    }
    const status = isEnvConfigError(err) ? 503 : 500;
    return NextResponse.json({ error: err.message || 'Внутренняя ошибка' }, { status });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
