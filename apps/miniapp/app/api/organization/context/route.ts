import { NextResponse } from 'next/server';
import { createMiniappApiHandler } from '@/lib/api';

export const GET = createMiniappApiHandler(
  {
    routeName: 'GET /api/organization/context',
  },
  async ({ auth }) => {
    return NextResponse.json({
      id: auth.organizationId,
      slug: auth.organizationSlug,
      name: auth.organizationName,
      enabled_modules: auth.enabledModules,
      user: {
        id: auth.userId,
        roles: auth.roles,
      },
      settings: {
        branding: auth.orgSettings.branding,
        counterparty_rules: auth.orgSettings.counterparty_rules,
        fleet_rules: auth.orgSettings.fleet_rules,
        finance: {
          cube_fuel_price_per_liter: auth.orgSettings.finance.cube_fuel_price_per_liter,
          diesel_fuel_price_per_liter: auth.orgSettings.finance.diesel_fuel_price_per_liter,
        },
      },
    });
  },
);
