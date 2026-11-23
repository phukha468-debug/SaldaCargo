import { DISTANCE_MATRIX, MONTH_NAMES_RU } from './constants';
import type { OrderItem, PipelineFolderId } from './types';

export function isStrictDocCounterparty(name?: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('всмпо') || n.includes('ависма') || n.includes('геострой');
}

export function getOrderEffectiveClientName(o: OrderItem): string {
  return o.client?.name || o.loading_org_name || o.trip?.trip_orders?.[0]?.counterparty?.name || '';
}

export function getDocCounterpartyBadge(name?: string | null): {
  label: string;
  badgeClass: string;
} {
  if (!name) return { label: 'Контрагент', badgeClass: 'bg-slate-100 text-slate-700' };
  const n = name.toLowerCase();
  if (n.includes('всмпо')) {
    return {
      label: '🏢 ВСМПО-АВИСМА',
      badgeClass: 'bg-indigo-100 text-indigo-900 border border-indigo-200',
    };
  }
  if (n.includes('ависма')) {
    return {
      label: '🏢 ООО Ависма',
      badgeClass: 'bg-blue-100 text-blue-900 border border-blue-200',
    };
  }
  if (n.includes('геострой')) {
    return {
      label: '🏗️ Геостройиндустрия',
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
    };
  }
  return { label: name, badgeClass: 'bg-slate-100 text-slate-700' };
}

export function normalizeCounterpartySearch(str?: string | null): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-zа-я0-9]/gi, '');
}

export function formatRouteSummary(order: OrderItem): string {
  const routes = order.routes_json || order.raw_parser_payload?.routes;
  if (routes && Array.isArray(routes) && routes.length > 1) {
    const count = routes.length;
    const first =
      'loading_city' in (routes[0] || {}) ? routes[0]?.loading_city || 'Шайтанка' : 'Шайтанка';
    const last =
      'unloading_city' in (routes[count - 1] || {})
        ? routes[count - 1]?.unloading_city || 'Салда'
        : 'Салда';
    return `${first} → ${last} (${count} точки)`;
  }
  const load = order.loading_address_json?.city || 'Погрузка';
  const unload = order.unloading_address_json?.city || 'Салда';
  return `${load} → ${unload}`;
}

export function getFolderOrders(folderId: PipelineFolderId, sourceList: OrderItem[]): OrderItem[] {
  return sourceList.filter((o) => {
    if ((o.status as string) === 'cancelled') return false;
    if (folderId === 'waiting_vehicle') {
      return o.status === 'waiting_vehicle' || o.status === 'draft';
    }
    if (folderId === 'docs_collection') {
      if (!isStrictDocCounterparty(getOrderEffectiveClientName(o))) return false;
      const isAccepted = Boolean(
        o.billing_docs?.client_accepted_edo || o.billing_docs?.status === 'accepted',
      );
      return o.status === 'docs_collection' && !isAccepted;
    }
    if (folderId === 'completed') {
      const isAccepted = Boolean(
        o.billing_docs?.client_accepted_edo || o.billing_docs?.status === 'accepted',
      );
      return o.status === 'completed' || (o.status === 'docs_collection' && isAccepted);
    }
    return o.status === folderId;
  });
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES_RU[Number(m) - 1] || m} ${y}`;
}

export function getEstimatedRouteDistance(cityA?: string, cityB?: string): number | null {
  if (!cityA || !cityB) return null;
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/^(г\.|пос\.|село|п\.)\s*/, '')
      .trim();
  const a = clean(cityA);
  const b = clean(cityB);

  const findKey = (text: string) => {
    for (const k of Object.keys(DISTANCE_MATRIX)) {
      if (text.includes(k) || k.includes(text)) return k;
    }
    return null;
  };

  const keyA = findKey(a);
  const keyB = findKey(b);
  if (keyA && keyB && DISTANCE_MATRIX[keyA]?.[keyB]) {
    return DISTANCE_MATRIX[keyA][keyB];
  }
  return null;
}

export function formatTravelTime(km: number): string {
  const hours = km / 70;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

export function isShaytankaMaminskoeRoute(loadCity?: string, unloadCity?: string): boolean {
  const l = loadCity?.toLowerCase() || '';
  const u = unloadCity?.toLowerCase() || '';
  return (
    (l.includes('шайтан') && u.includes('мамин')) || (l.includes('мамин') && u.includes('шайтан'))
  );
}
