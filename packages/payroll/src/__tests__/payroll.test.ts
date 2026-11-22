import { describe, it, expect } from 'vitest';
import {
  calculateOrderPayroll,
  suggestDriverPay,
  calcPeriodPay,
  isAutomaticDirection,
  getDirectionBasePrice,
} from '../index';

describe('domain-payroll', () => {
  it('marks ekb as manual driver pay direction and others as automatic', () => {
    expect(isAutomaticDirection('ekb')).toBe(false);
    expect(isAutomaticDirection('local')).toBe(true);
    expect(isAutomaticDirection('tagil_vagonka')).toBe(true);
    expect(getDirectionBasePrice('local', 800)).toBe(800);
    expect(getDirectionBasePrice('n_salda')).toBe(1500);
  });

  it('calculates driver-only order (30% driver / 70% company)', () => {
    const res = calculateOrderPayroll({
      direction: 'local',
      amount: 3000,
      isDriverLoader: false,
      loadersCount: 0,
    });

    expect(res.driverCarPay).toBe(900);
    expect(res.driverLoaderPay).toBe(0);
    expect(res.driverTotalPay).toBe(900);
    expect(res.totalLoadersPay).toBe(0);
    expect(res.companyShare).toBe(2100);
    expect(res.isAutomatic).toBe(true);
  });

  it('calculates driver-loader + external loader proportionally', () => {
    const res = calculateOrderPayroll({
      direction: 'local',
      amount: 3000, // base 1000 + 2 loaders * 1000 = 3000 (1:2)
      isDriverLoader: true,
      loadersCount: 1,
    });

    expect(res.machinePool).toBe(1000);
    expect(res.loadersPool).toBe(2000);
    expect(res.driverCarPay).toBe(300); // 30% of 1000
    expect(res.loaderPayEach).toBe(700); // 70% of 1000
    expect(res.driverLoaderPay).toBe(700);
    expect(res.driverTotalPay).toBe(1000);
    expect(res.totalLoadersPay).toBe(700);
    expect(res.companyShare).toBe(1300);
  });

  it('handles loaders_only (ПРР без авто) with 0 machinePool', () => {
    const res = calculateOrderPayroll({
      direction: 'loaders_only',
      amount: 4000,
      isDriverLoader: false,
      loadersCount: 2,
    });

    expect(res.machinePool).toBe(0);
    expect(res.loadersPool).toBe(4000);
    expect(res.driverCarPay).toBe(0);
    expect(res.loaderPayEach).toBe(1400); // 70% of 2000
    expect(res.totalLoadersPay).toBe(2800);
    expect(res.companyShare).toBe(1200);
  });

  it('handles explicit loadingAmount and internal company orders (0% company share)', () => {
    const explicit = calculateOrderPayroll({
      direction: 'local',
      amount: 5000,
      isDriverLoader: false,
      loadersCount: 1,
      loadingAmount: 1000,
    });
    expect(explicit.machinePool).toBe(4000);
    expect(explicit.loadersPool).toBe(1000);
    expect(explicit.driverCarPay).toBe(1200);
    expect(explicit.loaderPayEach).toBe(700);

    const internal = calculateOrderPayroll({
      direction: 'loaders_only',
      amount: 2000,
      isDriverLoader: false,
      loadersCount: 2,
      isInternal: true,
    });
    expect(internal.loaderPayEach).toBe(1000);
    expect(internal.companyShare).toBe(0);
  });

  it('handles zero or negative amount safely', () => {
    const res = calculateOrderPayroll({
      amount: 0,
      isDriverLoader: true,
      loadersCount: 2,
    });
    expect(res.driverTotalPay).toBe(0);
    expect(res.totalLoadersPay).toBe(0);
    expect(res.companyShare).toBe(0);
  });

  it('suggestDriverPay and calcPeriodPay respect approved-only invariant', () => {
    expect(suggestDriverPay(10000, 'percent', 30)).toBe(3000);
    expect(suggestDriverPay(10000, 'fixed', 2500)).toBe(2500);

    const period = calcPeriodPay([
      { driver_pay: '1500.50', lifecycle_status: 'approved' },
      { driver_pay: '2000.00', lifecycle_status: 'approved' },
      { driver_pay: '9999.00', lifecycle_status: 'draft' },
      { driver_pay: '5000.00', lifecycle_status: 'cancelled' },
    ]);
    expect(period).toBe('3500.50');
  });
});
