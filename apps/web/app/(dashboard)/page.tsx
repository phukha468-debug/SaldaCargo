'use client';

import { Money } from '@saldacargo/ui';

export default function DashboardHome() {
  return (
    <div className="space-y-4 animate-in fade-in duration-500 p-4 min-h-full bg-slate-50/50">
      {/* Section 1: Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="ВЫРУЧКА" value="12450000" trend="+12.5%" trendType="up" />
        <KPICard title="РАСХОДЫ" value="8120400" trend="+4.2%" trendType="down" />
        <KPICard title="ПРИБЫЛЬ" value="4329600" trend="+28.1%" trendType="up" />
        <ProgressCard title="ПРОГРЕСС ЦЕЛИ" value="15000000" percent={82} />
      </div>

      {/* Section 2: Alerts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Alert
          type="critical"
          title="Критическая дебиторка"
          description="ООО 'Логист+' просрочка 14 дней"
          icon="warning"
        />
        <Alert
          type="warning"
          title="3 рейса ждут ревью"
          description="Требуется подтверждение"
          icon="pending_actions"
        />
        <Alert
          type="info"
          title="ТО через 500 км"
          description="Для 5 единиц техники"
          icon="info"
        />
      </div>

      {/* Section 3: Net Position & Today Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Net Position (8 columns) */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <SummaryTableCard
            title="АКТИВЫ"
            total="45200000"
            color="text-emerald-600"
            items={[
              { label: 'Деньги (все счета)', value: '12400000', icon: 'account_balance_wallet' },
              { label: 'Автопарк (оценка)', value: '28000000', icon: 'local_shipping' },
              { label: 'Склад (запчасти)', value: '13000000', icon: 'inventory_2' },
              { label: 'Дебиторка', value: '3500000', icon: 'request_quote' },
            ]}
          />
          <SummaryTableCard
            title="ПАССИВЫ"
            total="18450000"
            color="text-rose-600"
            items={[
              { label: 'Кредиторка', value: '12000000', icon: 'credit_card' },
              { label: 'ЗП (фонд выплат)', value: '4200000', icon: 'group' },
              { label: 'Налоги (прогноз)', value: '2250000', icon: 'account_balance' },
              { label: 'Прочее', value: '0', icon: 'lock', placeholder: 'данные уточняются' },
            ]}
          />
        </div>

        {/* Right: Today Summary (4 columns) */}
        <div className="lg:col-span-4">
          <TodayChartCard />
        </div>
      </div>

      {/* Latest Transactions Table (Bento Grid Style) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-md">
        <div className="px-4 py-2 border-b border-slate-200 flex justify-between items-center bg-white">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Последние операции</h3>
          <button className="text-xs font-medium text-slate-500 hover:text-primary transition-colors flex items-center gap-1">
            Все транзакции <span className="material-symbols-outlined !text-[14px]">arrow_forward</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">Дата</th>
                <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">Описание</th>
                <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">Категория</th>
                <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500 text-right">Сумма</th>
                <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500 text-right">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                {
                  date: '14:24 Сегодня',
                  title: 'Заправка топливом (Лукойл-23)',
                  sub: 'Scania A777AA 199',
                  cat: 'Топливо',
                  amount: '-42500',
                  status: 'УСПЕШНО',
                  statusColor: 'text-emerald-700 bg-emerald-50',
                },
                {
                  date: '12:05 Сегодня',
                  title: 'Оплата рейса #44590',
                  sub: 'ООО "Агро-Продукт"',
                  cat: 'Выручка',
                  amount: '+180000',
                  status: 'УСПЕШНО',
                  statusColor: 'text-emerald-700 bg-emerald-50',
                },
                {
                  date: 'Вчера',
                  title: 'Запчасти: Тормозные колодки',
                  sub: 'Склад Москва-Юг',
                  cat: 'Запчасти',
                  amount: '-12800',
                  status: 'В ОБРАБОТКЕ',
                  statusColor: 'text-amber-700 bg-amber-50',
                },
              ].map((t, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2 text-[10px] font-medium text-slate-500">{t.date}</td>
                  <td className="px-4 py-2">
                    <div className="text-xs font-semibold text-slate-900">{t.title}</div>
                    <div className="text-[10px] text-slate-500">{t.sub}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider">
                      {t.cat}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-2 text-right text-xs font-bold ${t.amount.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    <Money amount={t.amount.replace('+', '')} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${t.statusColor}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  trend,
  trendType,
}: {
  title: string;
  value: string;
  trend: string;
  trendType: 'up' | 'down';
}) {
  const bars = [15, 25, 20, 35, 45, 50];
  return (
    <div className="bg-white border border-slate-200/60 p-3 rounded-lg shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
      <div className="flex justify-between items-start mb-1">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <span
          className={`text-[11px] font-bold flex items-center ${trendType === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}
        >
          <span className="material-symbols-outlined !text-[14px] mr-1">
            {trendType === 'up' ? 'trending_up' : 'trending_down'}
          </span>{' '}
          {trend}
        </span>
      </div>
      <div className="text-lg font-bold text-slate-900">
        <Money amount={value} />
      </div>
      <div className="mt-2 h-8 w-full flex items-end gap-1 overflow-hidden">
        {bars.map((h, i) => (
          <div
            key={i}
            className={`sparkline-bar flex-1 ${trendType === 'up' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}
            style={{ 
              height: `${h}%`,
              backgroundColor: i === bars.length - 1 ? (trendType === 'up' ? '#10b981' : '#f43f5e') : undefined
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ProgressCard({ title, value, percent }: { title: string; value: string; percent: number }) {
  return (
    <div className="bg-white border border-slate-200/60 p-3 rounded-lg shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
      <div className="flex justify-between items-start mb-1">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <span className="text-[11px] text-slate-900 font-bold">{percent}%</span>
      </div>
      <div className="text-lg font-bold text-slate-900">
        <Money amount={value} />
      </div>
      <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
        <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[10px] text-slate-400 mt-1">Осталось <Money amount="2550000" /> до KPI</p>
    </div>
  );
}

function Alert({
  type,
  title,
  description,
  icon,
}: {
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  icon: string;
}) {
  const styles = {
    critical: 'bg-rose-50/80 border-rose-100 text-rose-900 hover:bg-rose-50',
    warning: 'bg-amber-50/80 border-amber-100 text-amber-900 hover:bg-amber-50',
    info: 'bg-sky-50/80 border-sky-100 text-sky-900 hover:bg-sky-50',
  };

  const iconStyles = {
    critical: 'bg-rose-200 text-rose-700',
    warning: 'bg-amber-200 text-amber-700',
    info: 'bg-sky-200 text-sky-700',
  };

  return (
    <div className={`border p-3 rounded-lg flex gap-3 items-center shadow-sm transition-colors ${styles[type]}`}>
      <div className={`w-8 h-8 flex items-center justify-center rounded-lg shrink-0 ${iconStyles[type]}`}>
        <span className="material-symbols-outlined !text-[20px]">{icon}</span>
      </div>
      <div>
        <h4 className="font-bold text-xs leading-tight">{title}</h4>
        <p className="text-[10px] mt-0.5 opacity-70">{description}</p>
      </div>
    </div>
  );
}

function SummaryTableCard({
  title,
  total,
  color,
  items,
}: {
  title: string;
  total: string;
  color: string;
  items: {
    label: string;
    value: string;
    icon: string;
    placeholder?: string;
  }[];
}) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
        <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider">{title}</span>
        <span className={`text-sm font-bold ${color}`}>
          <Money amount={total} />
        </span>
      </div>
      <table className="w-full text-left">
        <tbody className="divide-y divide-slate-50">
          {items.map((item, i) => (
            <tr key={i} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-4 py-2 text-xs text-slate-600 flex items-center gap-2">
                <span className="material-symbols-outlined !text-[16px] text-slate-400">
                  {item.icon}
                </span>
                {item.label}
              </td>
              <td className="px-4 py-2 text-xs text-right text-slate-900 font-semibold">
                {item.placeholder ? (
                  <span className="text-slate-300 italic font-normal">{item.placeholder}</span>
                ) : (
                  <Money amount={item.value} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TodayChartCard() {
  const bars = [20, 40, 60, 100, 80, 30, 15];
  return (
    <div className="bg-white border border-slate-200/60 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 h-full">
      <h3 className="text-xs font-semibold text-slate-900 mb-3 uppercase tracking-wider text-center lg:text-left">Выручка по часам (Сегодня)</h3>
      <div className="flex items-end justify-between h-28 gap-1.5 px-1">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-col items-center flex-1 group">
            <div
              className={`w-full rounded-sm transition-all duration-700 ease-out ${h > 50 ? 'bg-primary' : 'bg-slate-100'} group-hover:opacity-80`}
              style={{ height: `${h}%` }}
            />
            <span className="text-[8px] font-bold text-slate-400 mt-1.5">{9 + i}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Всего за сегодня</span>
          <span className="text-xs font-bold text-slate-900">
            <Money amount="842000" />
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Заказов исполнено</span>
          <span className="text-xs font-bold text-slate-900">42 рейса</span>
        </div>
      </div>
    </div>
  );
}
