/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('loading_points_directory') as any)
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ loading_points: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();

    const { data, error } = await (supabase.from('loading_points_directory') as any)
      .insert({
        name: body.name,
        inn: body.inn || null,
        kpp: body.kpp || null,
        gar_guid: body.gar_guid || null,
        structured_address: body.structured_address || {},
        contact_phone: body.contact_phone || null,
        contact_fio: body.contact_fio || null,
        contact_position: body.contact_position || 'Представитель',
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ loading_point: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
