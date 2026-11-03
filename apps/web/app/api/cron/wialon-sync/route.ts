/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncValdaiTelematics, fetchWialonValdaiPositions } from '@saldacargo/domain-service';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const viewOnly = url.searchParams.get('view') === '1';

    const host = process.env.WIALON_HOST || 'https://host.local4.wialon.host';
    const token =
      process.env.WIALON_TOKEN ||
      '561a6efcd9ed8d38d0ff3b80c29253f01653C6698177A6D92E360BBD0D70D0B6AF5240DE';

    if (viewOnly) {
      const positions = await fetchWialonValdaiPositions(host, token);
      return NextResponse.json({ success: true, positions });
    }

    const supabase = createAdminClient();
    const result = await syncValdaiTelematics(supabase, { host, token });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Ошибка Wialon Sync:', err);
    return NextResponse.json({ error: err.message || 'Внутренняя ошибка' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
