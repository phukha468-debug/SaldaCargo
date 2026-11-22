import type { GroupKey, PayrollResponse, PayrollUser } from './types';

export const GROUP_CONFIG: Record<
  GroupKey,
  {
    label: string;
    headerBg: string;
    headerTextColor: string;
    tabActive: string;
    tabInactive: string;
    countActive: string;
    countInactive: string;
    getUsers: (p: PayrollResponse) => PayrollUser[];
    getCount: (p: PayrollResponse) => number;
  }
> = {
  drivers: {
    label: 'Водители',
    headerBg: 'bg-emerald-600',
    headerTextColor: 'text-emerald-100',
    tabActive: 'bg-emerald-600 text-white shadow-sm',
    tabInactive:
      'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700',
    countActive: 'bg-white/25 text-white',
    countInactive: 'bg-slate-100 text-slate-500',
    getUsers: (p) => p.drivers,
    getCount: (p) => p.drivers.length,
  },
  loaders: {
    label: 'Грузчики',
    headerBg: 'bg-orange-500',
    headerTextColor: 'text-orange-100',
    tabActive: 'bg-orange-500 text-white shadow-sm',
    tabInactive:
      'bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-700',
    countActive: 'bg-white/25 text-white',
    countInactive: 'bg-slate-100 text-slate-500',
    getUsers: (p) => p.loaders,
    getCount: (p) => p.loaders.length,
  },
  workshop: {
    label: 'Цех',
    headerBg: 'bg-indigo-600',
    headerTextColor: 'text-indigo-100',
    tabActive: 'bg-indigo-600 text-white shadow-sm',
    tabInactive:
      'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700',
    countActive: 'bg-white/25 text-white',
    countInactive: 'bg-slate-100 text-slate-500',
    getUsers: (p) => {
      const all = [...p.mechanics, ...p.office, ...(p.cleaners || [])];
      return all.filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i);
    },
    getCount: (p) => {
      const all = [...p.mechanics, ...p.office, ...(p.cleaners || [])];
      return all.filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i).length;
    },
  },
  cleaners: {
    label: 'Уборщицы',
    headerBg: 'bg-teal-700',
    headerTextColor: 'text-teal-100',
    tabActive: 'bg-teal-700 text-white shadow-sm',
    tabInactive:
      'bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700',
    countActive: 'bg-white/25 text-white',
    countInactive: 'bg-slate-100 text-slate-500',
    getUsers: (p) => p.cleaners || [],
    getCount: (p) => (p.cleaners ? p.cleaners.length : 0),
  },
  debts: {
    label: 'Долги сотрудников',
    headerBg: 'bg-violet-600',
    headerTextColor: 'text-violet-100',
    tabActive: 'bg-violet-600 text-white shadow-sm',
    tabInactive:
      'bg-white border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700',
    countActive: 'bg-white/25 text-white',
    countInactive: 'bg-slate-100 text-slate-500',
    getUsers: (p) => {
      const all = [
        ...p.drivers,
        ...p.loaders,
        ...p.mechanics,
        ...p.office,
        ...(p.cleaners || []),
      ].filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i);
      return all.filter((u) => parseFloat(u.advance_balance ?? '0') > 0);
    },
    getCount: (p) => {
      const all = [
        ...p.drivers,
        ...p.loaders,
        ...p.mechanics,
        ...p.office,
        ...(p.cleaners || []),
      ].filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i);
      return all.filter((u) => parseFloat(u.advance_balance ?? '0') > 0).length;
    },
  },
  accountable: {
    label: '💵 Подотчёт',
    headerBg: 'bg-amber-600',
    headerTextColor: 'text-amber-100',
    tabActive: 'bg-amber-600 text-white shadow-sm',
    tabInactive:
      'bg-white border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700',
    countActive: 'bg-white/25 text-white',
    countInactive: 'bg-amber-100 text-amber-900 font-black',
    getUsers: (p) =>
      [...(p.drivers || []), ...(p.loaders || []), ...(p.mechanics || [])]
        .filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i)
        .filter((d) => (d.accountable_hold ?? 0) > 0),
    getCount: (p) =>
      [...(p.drivers || []), ...(p.loaders || []), ...(p.mechanics || [])]
        .filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i)
        .filter((d) => (d.accountable_hold ?? 0) > 0).length,
  },
};
