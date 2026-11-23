import {
  normalizePlate,
  type TelematicsGeofence,
  type TelematicsPoint,
  type TelematicsProvider,
  type TelematicsUnitSnapshot,
} from './types';

interface WialonPosPayload {
  y?: number;
  x?: number;
  s?: number;
  t?: number;
  sc?: number;
}

interface WialonMsgPayload {
  t?: number;
  pos?: WialonPosPayload;
  p?: Record<string, unknown>;
  cnm?: number;
}

interface WialonUnitItem {
  id: number;
  nm?: string;
  pos?: WialonPosPayload;
  lmsg?: WialonMsgPayload;
  cnm?: number;
}

interface WialonLoginResponse {
  eid?: string;
  error?: number;
}

interface WialonSearchItemsResponse {
  items?: WialonUnitItem[];
  error?: number;
}

interface WialonResourceGeofence {
  id?: number | string;
  n?: string;
  b?: { cen_y?: number; cen_x?: number };
  w?: number;
  r?: number;
}

interface WialonResourceItem {
  zl?: Record<string, WialonResourceGeofence>;
}

interface WialonLoadIntervalResponse {
  messages?: WialonMsgPayload[];
  count?: number;
  error?: number;
}

export interface WialonProviderOptions {
  host: string;
  token: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const TRACK_BATCH_SIZE = 5_000;
const MAX_TRACK_PAGES = 6; // до 30 000 сообщений за рейс

function extractRawOdometerKm(params?: Record<string, unknown>, cnm?: number): number | undefined {
  const candidate = params?.mileage ?? params?.can_mileage ?? cnm;
  if (candidate === undefined || candidate === null) return undefined;
  const num = Number(candidate);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return num > 2_000_000 ? Math.round(num / 1000) : Math.round(num);
}

function extractIgnition(params?: Record<string, unknown>): boolean | undefined {
  if (!params) return undefined;
  const raw = params.ign ?? params.ignition ?? params.engine_on ?? params.pwr_ext;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw > 0;
  return undefined;
}

function isValidCoordinates(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/**
 * Реализация TelematicsProvider для Wialon Hosting / Wialon Local.
 * Переиспользует одну сессию (eid) в пределах экземпляра (одного цикла синхронизации),
 * поддерживает чанкованную загрузку треков без обрезки длинных рейсов.
 */
export class WialonTelematicsProvider implements TelematicsProvider {
  readonly providerId = 'wialon';
  private readonly cleanHost: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private sessionId: string | null = null;

  constructor(options: WialonProviderOptions) {
    this.cleanHost = options.host.replace(/\/+$/, '');
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async ensureSession(): Promise<string> {
    if (this.sessionId) return this.sessionId;
    const url = `${this.cleanHost}/wialon/ajax.html?svc=token/login&params=${encodeURIComponent(
      JSON.stringify({ token: this.token }),
    )}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) {
      throw new Error(`Wialon HTTP error on token/login: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as WialonLoginResponse;
    if (data.error) {
      throw new Error(`Wialon API error on token/login (code ${data.error})`);
    }
    if (!data.eid) {
      throw new Error('Wialon API did not return session ID (eid)');
    }
    this.sessionId = data.eid;
    return data.eid;
  }

  async fetchUnitsSnapshot(externalUnitIds?: readonly string[]): Promise<TelematicsUnitSnapshot[]> {
    const eid = await this.ensureSession();
    // Флаги: 1 (base) + 256 (pos details) + 1024 (pos) + 4096 (counters) + 0x80000 (lmsg)
    const flags = 1 + 256 + 1024 + 4096 + 0x80000;
    const searchParams = {
      spec: {
        itemsType: 'avl_unit',
        propName: 'sys_name',
        propValueMask: '*',
        sortType: 'sys_name',
      },
      force: 1,
      flags,
      from: 0,
      to: 0,
    };

    const url = `${this.cleanHost}/wialon/ajax.html?svc=core/search_items&params=${encodeURIComponent(
      JSON.stringify(searchParams),
    )}&sid=${eid}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) {
      throw new Error(`Wialon HTTP error on search_items: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as WialonSearchItemsResponse;
    if (json.error) {
      throw new Error(`Wialon API error on search_items (code ${json.error})`);
    }

    const filterSet =
      externalUnitIds && externalUnitIds.length > 0 ? new Set(externalUnitIds.map(String)) : null;

    const snapshots: TelematicsUnitSnapshot[] = [];

    for (const item of json.items ?? []) {
      const unitIdStr = String(item.id);
      if (filterSet && !filterSet.has(unitIdStr)) continue;

      const unitName = String(item.nm ?? '');
      const pos = item.pos;
      const lat = Number(pos?.y ?? 0);
      const lon = Number(pos?.x ?? 0);
      const timestampSec = Number(pos?.t ?? item.lmsg?.t ?? 0);
      const hasCoords = isValidCoordinates(lat, lon) && timestampSec > 0;

      const point: TelematicsPoint | null = hasCoords
        ? {
            lat,
            lon,
            speedKmh: Number(pos?.s ?? 0),
            timestampSec,
            rawOdometerKm: extractRawOdometerKm(item.lmsg?.p, item.cnm),
            satellites: typeof pos?.sc === 'number' ? pos.sc : undefined,
            ignition: extractIgnition(item.lmsg?.p),
          }
        : null;

      snapshots.push({
        externalUnitId: unitIdStr,
        unitName,
        plateHint: normalizePlate(unitName),
        position: point,
        isOnline: point !== null,
      });
    }

    return snapshots;
  }

  async fetchTrack(
    externalUnitId: string,
    fromSec: number,
    toSec: number,
    options?: { maxMessages?: number },
  ): Promise<TelematicsPoint[]> {
    const eid = await this.ensureSession();
    const numericId = Number(externalUnitId);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return [];
    }

    const maxTotal = options?.maxMessages ?? TRACK_BATCH_SIZE * MAX_TRACK_PAGES;
    const points: TelematicsPoint[] = [];
    let cursorFrom = Math.max(0, Math.floor(fromSec));
    const endSec = Math.floor(toSec);

    if (cursorFrom >= endSec) return [];

    for (let page = 0; page < MAX_TRACK_PAGES && points.length < maxTotal; page++) {
      const remaining = Math.min(TRACK_BATCH_SIZE, maxTotal - points.length);
      const url = `${this.cleanHost}/wialon/ajax.html?svc=messages/load_interval&params=${encodeURIComponent(
        JSON.stringify({
          itemId: numericId,
          timeFrom: cursorFrom,
          timeTo: endSec,
          flags: 0,
          flagsMask: 0,
          loadCount: remaining,
        }),
      )}&sid=${eid}`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(Math.max(this.timeoutMs, 15_000)),
      });
      if (!res.ok) break;
      const data = (await res.json()) as WialonLoadIntervalResponse;
      if (data.error) break;

      const msgs = data.messages ?? [];
      if (msgs.length === 0) break;

      let lastTs = cursorFrom;
      for (const m of msgs) {
        const ts = Number(m.t ?? 0);
        if (ts > lastTs) lastTs = ts;
        if (!m.pos) continue;
        const lat = Number(m.pos.y ?? 0);
        const lon = Number(m.pos.x ?? 0);
        if (!isValidCoordinates(lat, lon) || ts <= 0) continue;

        points.push({
          lat,
          lon,
          speedKmh: Number(m.pos.s ?? 0),
          timestampSec: ts,
          rawOdometerKm: extractRawOdometerKm(m.p, m.cnm),
          satellites: typeof m.pos.sc === 'number' ? m.pos.sc : undefined,
          ignition: extractIgnition(m.p),
        });
      }

      if (msgs.length < remaining || lastTs >= endSec) {
        break;
      }
      cursorFrom = lastTs + 1;
    }

    return points;
  }

  async fetchGeofences(): Promise<TelematicsGeofence[]> {
    const eid = await this.ensureSession();
    const searchParams = {
      spec: {
        itemsType: 'avl_resource',
        propName: 'sys_name',
        propValueMask: '*',
        sortType: 'sys_name',
      },
      force: 1,
      flags: 0x1000 + 0x400 + 1,
      from: 0,
      to: 0,
    };
    const url = `${this.cleanHost}/wialon/ajax.html?svc=core/search_items&params=${encodeURIComponent(
      JSON.stringify(searchParams),
    )}&sid=${eid}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: WialonResourceItem[] };
    const result: TelematicsGeofence[] = [];

    for (const item of json.items ?? []) {
      if (!item.zl) continue;
      for (const [key, geo] of Object.entries(item.zl)) {
        const lat = Number(geo.b?.cen_y ?? 0);
        const lon = Number(geo.b?.cen_x ?? 0);
        if (!geo.n || !isValidCoordinates(lat, lon)) continue;
        result.push({
          id: String(geo.id ?? key),
          name: geo.n,
          lat,
          lon,
          radiusMeters: Number(geo.w ?? geo.r ?? 3500),
        });
      }
    }

    return result;
  }
}
