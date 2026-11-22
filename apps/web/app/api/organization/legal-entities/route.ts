import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

const createLegalEntitySchema = z.object({
  name: z.string().trim().min(2, 'Укажите название юрлица').max(180),
  type: z.enum(['ooo', 'ip', 'self_employed']).default('ooo'),
  inn: z
    .string()
    .trim()
    .regex(/^\d{10}(\d{2})?$/, 'ИНН должен содержать 10 или 12 цифр')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : null)),
  kpp: z
    .string()
    .trim()
    .regex(/^\d{9}$/, 'КПП должен содержать 9 цифр')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : null)),
  ogrn: z
    .string()
    .trim()
    .regex(/^\d{13}(\d{2})?$/, 'ОГРН/ОГРНИП должен содержать 13 или 15 цифр')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : null)),
  tax_regime: optionalTrimmed(60),
  legal_address: optionalTrimmed(300),
  bank_name: optionalTrimmed(180),
  bik: z
    .string()
    .trim()
    .regex(/^\d{9}$/, 'БИК должен содержать 9 цифр')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : null)),
  bank_account: z
    .string()
    .trim()
    .regex(/^\d{20}$/, 'Расчётный счёт должен содержать 20 цифр')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : null)),
  corr_account: z
    .string()
    .trim()
    .regex(/^\d{20}$/, 'Корр. счёт должен содержать 20 цифр')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : null)),
  edo_id: optionalTrimmed(120),
  is_active: z.boolean().default(true),
});

const patchLegalEntitySchema = createLegalEntitySchema.partial().extend({
  id: z.string().uuid('Некорректный ID юрлица'),
});

export const GET = createWebApiHandler(
  {
    roles: ['owner', 'admin'],
    routeName: 'GET /api/organization/legal-entities',
  },
  async ({ auth }) => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('legal_entities')
      .select(
        'id, name, type, inn, kpp, ogrn, tax_regime, legal_address, bank_name, bik, bank_account, corr_account, edo_id, is_active, created_at, updated_at',
      )
      .eq('organization_id', auth.organizationId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [] });
  },
);

export const POST = createWebApiHandler(
  {
    roles: ['owner'],
    bodySchema: createLegalEntitySchema,
    routeName: 'POST /api/organization/legal-entities',
  },
  async ({ auth, body }) => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('legal_entities')
      .insert({
        ...body,
        organization_id: auth.organizationId,
      })
      .select(
        'id, name, type, inn, kpp, ogrn, tax_regime, legal_address, bank_name, bik, bank_account, corr_account, edo_id, is_active',
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'Не удалось создать юрлицо' },
        { status: 500 },
      );
    }

    return NextResponse.json({ item: data }, { status: 201 });
  },
);

export const PATCH = createWebApiHandler(
  {
    roles: ['owner'],
    bodySchema: patchLegalEntitySchema,
    routeName: 'PATCH /api/organization/legal-entities',
  },
  async ({ auth, body }) => {
    const supabase = createAdminClient();
    const { id, ...fields } = body;
    const { data, error } = await supabase
      .from('legal_entities')
      .update({
        ...fields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', auth.organizationId)
      .select(
        'id, name, type, inn, kpp, ogrn, tax_regime, legal_address, bank_name, bik, bank_account, corr_account, edo_id, is_active',
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Юрлицо не найдено в вашей организации' }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  },
);
