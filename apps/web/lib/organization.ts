'use client';

import { useQuery } from '@tanstack/react-query';
import { SALDA_MODULES, type SaldaModule } from '@saldacargo/shared';

export interface OrganizationClientContext {
  id: string;
  slug: string;
  name: string;
  enabled_modules: SaldaModule[];
  user: {
    id: string;
    roles: string[];
  };
  settings: {
    branding?: {
      short_name?: string;
      logo_url?: string;
      primary_color?: string;
      timezone?: string;
    };
    finance?: {
      cube_fuel_price_per_liter?: number;
      diesel_fuel_price_per_liter?: number;
    };
  };
}

export function useOrganizationContext() {
  return useQuery<OrganizationClientContext>({
    queryKey: ['organization-context'],
    queryFn: async () => {
      const res = await fetch('/api/organization/context');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function hasOrgModule(
  ctx: OrganizationClientContext | undefined,
  module: SaldaModule,
): boolean {
  if (!ctx) return true; // До загрузки не скрываем разделы рывком
  const list = Array.isArray(ctx.enabled_modules) ? ctx.enabled_modules : [...SALDA_MODULES];
  return list.includes(module);
}

export function hasAnyOrgModule(
  ctx: OrganizationClientContext | undefined,
  modules: readonly SaldaModule[],
): boolean {
  if (!ctx || modules.length === 0) return true;
  return modules.some((m) => hasOrgModule(ctx, m));
}
