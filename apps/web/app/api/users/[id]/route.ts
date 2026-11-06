/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, any>;

    const allowed = [
      'name',
      'phone',
      'max_user_id',
      'pin_code',
      'roles',
      'current_asset_id',
      'is_active',
      'auto_settle',
      'notes',
      'is_officially_employed',
      'official_salary_amount',
      'official_salary_day',
      'has_court_orders',
      'court_order_pct',
      'court_order_notes',
      'inn',
      'license_series',
      'license_number',
      'license_issue_date',
      'license_class',
      'tab_number',
    ];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    if (update.name) update.name = update.name.trim();
    if ('pin_code' in update) {
      update.pin_code = update.pin_code ? String(update.pin_code).trim() : null;
    }

    const supabase = createAdminClient();
    const hasPassportFields =
      body.passport_series !== undefined ||
      body.passport_number !== undefined ||
      body.passport_issued_by !== undefined ||
      body.passport_issue_date !== undefined ||
      body.passport_department_code !== undefined ||
      body.driver_full_name !== undefined;

    if (hasPassportFields || body.notes !== undefined) {
      const { data: existingUser } = await (supabase.from('users') as any)
        .select('notes')
        .eq('id', id)
        .single();

      let existingNotesObj: any = null;
      if (existingUser?.notes) {
        try {
          const parsed = JSON.parse(existingUser.notes);
          if (typeof parsed === 'object' && parsed !== null) {
            existingNotesObj = parsed;
          }
        } catch {
          // Обычная текстовая заметка в БД
        }
      }

      if (hasPassportFields || existingNotesObj) {
        const notesObj = existingNotesObj || {};
        if (body.passport_series !== undefined) notesObj.passport_series = body.passport_series;
        if (body.passport_number !== undefined) notesObj.passport_number = body.passport_number;
        if (body.passport_issued_by !== undefined)
          notesObj.passport_issued_by = body.passport_issued_by;
        if (body.passport_issue_date !== undefined)
          notesObj.passport_issue_date = body.passport_issue_date;
        if (body.passport_department_code !== undefined)
          notesObj.passport_department_code = body.passport_department_code;
        if (body.driver_full_name !== undefined) notesObj.full_name = body.driver_full_name;
        if (body.notes !== undefined) {
          if (body.notes && String(body.notes).trim()) {
            notesObj.user_notes = String(body.notes).trim();
          } else {
            delete notesObj.user_notes;
          }
        }
        update.notes = JSON.stringify(notesObj);
      } else if (body.notes !== undefined) {
        update.notes = body.notes ? String(body.notes).trim() : null;
      }
    }

    const { data, error } = await (supabase.from('users') as any)
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
