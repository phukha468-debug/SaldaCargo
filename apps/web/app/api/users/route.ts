/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const supabase = createAdminClient();
  let query = (supabase.from('users') as any)
    .select(
      'id, name, phone, max_user_id, pin_code, roles, current_asset_id, is_active, notes, created_at, is_officially_employed, official_salary_amount, official_salary_day, has_court_orders, court_order_pct, court_order_notes, inn, license_series, license_number, license_issue_date, license_class, tab_number',
    )
    .not('name', 'ilike', '%STRESS%')
    .not('name', 'ilike', '%TEST%')
    .order('name');

  if (!includeInactive) query = query.eq('is_active', true);
  if (role === 'mechanic') {
    query = query.filter(
      'roles',
      'ov',
      '{mechanic,mechanic_lead,welder,painter,electrician,handyman}',
    );
  } else if (role) {
    query = query.contains('roles', [role]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Распаковываем паспортные данные из notes, если они там сохранены в JSON
  const mapped = (data || []).map((u: any) => {
    let passportData: any = {};
    if (u.notes) {
      try {
        const parsed = JSON.parse(u.notes);
        if (typeof parsed === 'object' && parsed !== null) {
          passportData = parsed;
        }
      } catch {
        // Обычная текстовая заметка, не JSON
      }
    }
    return {
      ...u,
      passport_series: passportData.passport_series || null,
      passport_number: passportData.passport_number || null,
      passport_issued_by: passportData.passport_issued_by || null,
      passport_issue_date: passportData.passport_issue_date || null,
      passport_department_code: passportData.passport_department_code || null,
      driver_full_name: passportData.full_name || u.name,
    };
  });

  return NextResponse.json(mapped);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, any>;
    const { name, phone, max_user_id, pin_code, roles, current_asset_id } = body;

    if (!name?.trim() || !roles?.length) {
      return NextResponse.json({ error: 'Имя и роль обязательны' }, { status: 400 });
    }

    // Упаковка паспорта в notes, если переданы паспортные поля
    let notesValue = body.notes || null;
    if (
      body.passport_series ||
      body.passport_number ||
      body.passport_issued_by ||
      body.passport_issue_date ||
      body.driver_full_name
    ) {
      const passportObj = {
        passport_series: body.passport_series || '',
        passport_number: body.passport_number || '',
        passport_issued_by: body.passport_issued_by || '',
        passport_issue_date: body.passport_issue_date || '',
        passport_department_code: body.passport_department_code || '',
        full_name: body.driver_full_name || name.trim(),
        user_notes: body.notes || '',
      };
      notesValue = JSON.stringify(passportObj);
    }

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('users') as any)
      .insert({
        name: name.trim(),
        phone: phone || null,
        max_user_id: max_user_id || null,
        pin_code: pin_code ? String(pin_code).trim() : null,
        roles,
        current_asset_id: current_asset_id || null,
        auto_settle: body.auto_settle ?? false,
        notes: notesValue,
        inn: body.inn || null,
        license_series: body.license_series || null,
        license_number: body.license_number || null,
        license_issue_date: body.license_issue_date || null,
        license_class: body.license_class || 'C',
        tab_number: body.tab_number || null,
        is_officially_employed: body.is_officially_employed ?? false,
        official_salary_amount: body.official_salary_amount ?? 22500,
        official_salary_day: body.official_salary_day ?? 25,
        has_court_orders: body.has_court_orders ?? false,
        court_order_pct: body.court_order_pct ?? 50,
        court_order_notes: body.court_order_notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
