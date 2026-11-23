import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  WialonTelematicsProvider,
  buildWebhookSnapshot,
  getIntegrationConfig,
  getOrganizationContext,
  normalizePlate,
  processVehicleSnapshot,
  type AssetForTelematics,
  type WialonIntegrationCredentials,
} from '@saldacargo/domain-service';
import { DEFAULT_ORGANIZATION_ID, hasModule, logger } from '@saldacargo/shared';

const DEFAULT_WIALON_HOST = 'https://host.local4.wialon.host';

const WebhookPayloadSchema = z
  .object({
    org: z.string().trim().max(80).optional(),
    secret: z.string().trim().max(256).optional(),
    token: z.string().trim().max(256).optional(),
    event: z.string().optional(),
    action: z.string().optional(),
    type: z.string().optional(),
    zone_status: z.string().optional(),
    status: z.string().optional(),
    notification: z.string().optional(),
    text: z.string().optional(),
    raw_body: z.string().optional(),
    unit: z.string().optional(),
    unit_name: z.string().optional(),
    unitName: z.string().optional(),
    name: z.string().optional(),
    unit_id: z.union([z.string(), z.number()]).optional(),
    time: z.union([z.string(), z.number()]).optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    pos_time: z.union([z.string(), z.number()]).optional(),
    curr_time: z.union([z.string(), z.number()]).optional(),
    lat: z.union([z.string(), z.number()]).optional(),
    lon: z.union([z.string(), z.number()]).optional(),
    odometer: z.union([z.string(), z.number()]).optional(),
    odo: z.union([z.string(), z.number()]).optional(),
    mileage: z.union([z.string(), z.number()]).optional(),
    mileage_km: z.union([z.string(), z.number()]).optional(),
    km: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

function isUnexpandedMacro(val: unknown): boolean {
  return typeof val === 'string' && val.startsWith('%') && val.endsWith('%');
}

function parseWialonTimestampSec(raw?: string | number): number {
  if (!raw || isUnexpandedMacro(raw)) return Math.floor(Date.now() / 1000);
  if (typeof raw === 'number') {
    return raw > 1e11 ? Math.floor(raw / 1000) : Math.floor(raw);
  }
  const str = raw.trim();
  const ruMatch = str.match(/^(\d{2})[.-](\d{2})[.-](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (ruMatch) {
    const [, d, m, y, hh = '00', mm = '00', ss = '00'] = ruMatch;
    const ms = Date.parse(`${y}-${m}-${d}T${hh}:${mm}:${ss}+05:00`);
    if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
  }
  const ms = Date.parse(str);
  return Number.isNaN(ms) ? Math.floor(Date.now() / 1000) : Math.floor(ms / 1000);
}

function parseOptionalNumber(raw?: string | number): number | undefined {
  if (raw === undefined || raw === null || isUnexpandedMacro(raw)) return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  const match = raw
    .replace(/\s+/g, '')
    .replace(',', '.')
    .match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : undefined;
}

function classifyWebhookEvent(payload: WebhookPayload): 'departure' | 'arrival' | null {
  const explicit =
    `${payload.event ?? ''} ${payload.action ?? ''} ${payload.type ?? ''} ${payload.zone_status ?? ''}`
      .trim()
      .toLowerCase();
  const fullText = `${payload.text ?? ''} ${payload.notification ?? ''} ${payload.raw_body ?? ''}`
    .trim()
    .toLowerCase();

  const exitWords = [
    'вышел',
    'выход',
    'покинул',
    'выезд',
    'уехал',
    'depart',
    'exit',
    'leave',
    'left',
    'outside',
  ];
  const enterWords = [
    'вошел',
    'вошёл',
    'вход',
    'въезд',
    'приезд',
    'заезд',
    'прибыл',
    'arrive',
    'enter',
    'inside',
  ];

  if (explicit === '2' || explicit === 'out') return 'departure';
  if (explicit === '1' || explicit === 'in') return 'arrival';

  const textHasExit = exitWords.some((w) => fullText.includes(w) || explicit.includes(w));
  const textHasEnter = enterWords.some((w) => fullText.includes(w) || explicit.includes(w));

  if (textHasExit && !textHasEnter) return 'departure';
  if (textHasEnter && !textHasExit) return 'arrival';
  // Если в тексте оба слова (напр. название правила «Вход/Выход»), опираемся на явное поле event
  if (exitWords.some((w) => explicit.includes(w))) return 'departure';
  if (enterWords.some((w) => explicit.includes(w))) return 'arrival';
  return null;
}

async function resolveOrganizationId(supabase: SupabaseClient, orgSlug?: string): Promise<string> {
  if (!orgSlug) return DEFAULT_ORGANIZATION_ID;
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .eq('is_active', true)
    .maybeSingle();
  return data?.id ? String(data.id) : DEFAULT_ORGANIZATION_ID;
}

async function findOrgAsset(
  supabase: SupabaseClient,
  organizationId: string,
  unitStr: string,
  unitIdStr?: string,
): Promise<AssetForTelematics | null> {
  const { data: assetsRaw } = await supabase
    .from('assets')
    .select(
      'id, reg_number, short_name, wialon_id, odometer_current, odometer_offset_km, assigned_driver_id',
    )
    .eq('organization_id', organizationId)
    .eq('status', 'active');

  const assets = (assetsRaw ?? []) as AssetForTelematics[];
  if (assets.length === 0) return null;

  if (unitIdStr) {
    const byId = assets.find((a) => a.wialon_id && String(a.wialon_id) === unitIdStr);
    if (byId) return byId;
  }

  const cleanUnit = normalizePlate(unitStr);
  if (!cleanUnit) return null;

  for (const a of assets) {
    const reg = normalizePlate(a.reg_number);
    const short = normalizePlate(a.short_name);
    if (reg && (reg === cleanUnit || cleanUnit.includes(reg) || reg.includes(cleanUnit))) {
      return a;
    }
    if (short && short.length >= 3 && cleanUnit.includes(short)) {
      return a;
    }
  }
  return null;
}

async function parseIncomingRequest(req: Request): Promise<WebhookPayload> {
  const rawUrl = req.url;
  const firstQ = rawUrl.indexOf('?');
  const cleanUrl =
    firstQ !== -1
      ? rawUrl.slice(0, firstQ + 1) + rawUrl.slice(firstQ + 1).replace(/\?/g, '&')
      : rawUrl;
  const url = new URL(cleanUrl);
  const raw: Record<string, unknown> = {};

  if (req.method === 'POST') {
    const bodyText = await req.text().catch(() => '');
    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          Object.assign(raw, parsed);
        }
      } catch {
        if (bodyText.includes('=')) {
          const sp = new URLSearchParams(bodyText);
          sp.forEach((v, k) => {
            raw[k] = v;
          });
        }
        raw.raw_body = bodyText;
        if (!raw.text) raw.text = bodyText;
      }
    }
  }

  url.searchParams.forEach((val, key) => {
    if (!isUnexpandedMacro(val) || !raw[key]) {
      raw[key] = val;
    }
  });

  try {
    const rawQuery = decodeURIComponent(url.search.replace(/^\?/, '').trim());
    if (rawQuery && !rawQuery.includes('=')) {
      if (!raw.text) raw.text = rawQuery;
      if (!raw.raw_body) raw.raw_body = rawQuery;
    }
  } catch {
    // ignore malformed percent encoding
  }

  return WebhookPayloadSchema.parse(raw);
}

async function processWialonWebhook(req: Request) {
  try {
    const payload = await parseIncomingRequest(req);
    const supabase = createAdminClient() as unknown as SupabaseClient;
    const organizationId = await resolveOrganizationId(supabase, payload.org);

    const orgCtx = await getOrganizationContext(supabase, organizationId);
    if (!orgCtx || !orgCtx.isActive || !hasModule(orgCtx.enabledModules, 'transport')) {
      return NextResponse.json({ error: 'Модуль транспорта отключён' }, { status: 403 });
    }

    const wialon = await getIntegrationConfig<
      WialonIntegrationCredentials & { webhook_secret?: string }
    >(supabase, organizationId, 'wialon');

    const expectedSecret =
      wialon.credentials.webhook_secret ||
      (organizationId === DEFAULT_ORGANIZATION_ID ? process.env.WIALON_WEBHOOK_SECRET : undefined);
    const providedSecret =
      payload.secret || payload.token || req.headers.get('x-wialon-secret') || undefined;

    if (expectedSecret && providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    const unitIdStr =
      payload.unit_id !== undefined && !isUnexpandedMacro(payload.unit_id)
        ? String(payload.unit_id)
        : undefined;
    let unitStr = String(
      payload.unit ?? payload.unit_name ?? payload.unitName ?? payload.name ?? '',
    ).trim();
    if (isUnexpandedMacro(unitStr)) unitStr = '';
    if (!unitStr && (payload.text || payload.raw_body)) {
      unitStr = String(payload.text ?? payload.raw_body);
    }

    if (!unitStr && !unitIdStr) {
      return NextResponse.json({ error: 'Параметр unit или unit_id обязателен' }, { status: 400 });
    }

    const eventType = classifyWebhookEvent(payload);
    if (!eventType) {
      return NextResponse.json({ error: 'Некорректный тип события' }, { status: 400 });
    }

    const asset = await findOrgAsset(supabase, organizationId, unitStr, unitIdStr);
    if (!asset) {
      logger.warn('Wialon webhook: asset not found', { organizationId, unitStr, unitIdStr });
      return NextResponse.json({ error: 'Объект не найден' }, { status: 404 });
    }

    if (!wialon.isEnabled || !wialon.credentials.token) {
      return NextResponse.json({ error: 'Интеграция Wialon не настроена' }, { status: 503 });
    }

    const host =
      typeof wialon.config.host === 'string' && wialon.config.host
        ? wialon.config.host
        : DEFAULT_WIALON_HOST;

    const provider = new WialonTelematicsProvider({ host, token: wialon.credentials.token });
    const targetExternalId = asset.wialon_id || unitIdStr || '';

    // Получаем фактическую позицию из Wialon (чтобы иметь точные lat/lon и одометр, а не гадать направление)
    const snapshots = await provider.fetchUnitsSnapshot(
      targetExternalId ? [targetExternalId] : undefined,
    );
    let snapshot =
      snapshots.find((s) => s.externalUnitId === targetExternalId) ??
      snapshots.find((s) => {
        const reg = normalizePlate(asset.reg_number);
        return Boolean(reg && s.plateHint && s.plateHint.includes(reg));
      }) ??
      null;

    if (!snapshot) {
      const lat = parseOptionalNumber(payload.lat);
      const lon = parseOptionalNumber(payload.lon);
      if (lat === undefined || lon === undefined) {
        return NextResponse.json(
          { error: 'Не удалось получить координаты объекта из Wialon' },
          { status: 502 },
        );
      }
      snapshot = buildWebhookSnapshot({
        externalUnitId: targetExternalId || asset.id,
        unitName: unitStr || asset.reg_number,
        lat,
        lon,
        timestampSec: parseWialonTimestampSec(
          payload.time ?? payload.timestamp ?? payload.pos_time ?? payload.curr_time,
        ),
        rawOdometerKm: parseOptionalNumber(
          payload.odometer ?? payload.odo ?? payload.mileage ?? payload.mileage_km ?? payload.km,
        ),
      });
    }

    const outcome = await processVehicleSnapshot({
      supabase,
      organizationId,
      orgSettings: orgCtx.settings,
      asset,
      provider,
      snapshot,
      source: 'webhook',
      webhookHint: eventType,
    });

    return NextResponse.json({ success: true, eventType, outcome });
  } catch (err) {
    logger.error('Wialon webhook processing error', {}, err);
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return processWialonWebhook(req);
}

export async function POST(req: Request) {
  return processWialonWebhook(req);
}
