'use client';

import { Money, cn } from '@saldacargo/ui';
import type { ReviewServiceOrder, TripForReview } from './types';
import type { FleetAggregationResult, GarageSummary } from './fleetAggregation';

export function ReviewStatsCards({
  reviewSection,
  mode,
  garageMachineFilter,
  setGarageMachineFilter,
  garageSummary,
  filteredGarageOrders,
  expandedGarageOrderIds,
  setExpandedGarageOrderIds,
  trips,
  listTrips,
  listServiceOrders,
  fleetStats,
  expandedIds,
  setExpandedIds,
  expandedGroups,
  setExpandedGroups,
}: {
  reviewSection: 'auto' | 'garage';
  mode: 'review' | 'active' | 'history';
  garageMachineFilter: 'all' | 'client' | 'own';
  setGarageMachineFilter: (v: 'all' | 'client' | 'own') => void;
  garageSummary: GarageSummary;
  filteredGarageOrders: ReviewServiceOrder[];
  expandedGarageOrderIds: Set<string>;
  setExpandedGarageOrderIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  trips: TripForReview[];
  listTrips: TripForReview[];
  listServiceOrders: ReviewServiceOrder[];
  fleetStats: FleetAggregationResult;
  expandedIds: Set<string>;
  setExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedGroups: Set<string>;
  setExpandedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const {
    combinedAssetGroups,
    totalFleetRevenue,
    totalFleetCollectedRevenue,
    totalFleetPendingDebt,
    totalFleetPayroll,
    totalFleetFuel,
    totalFleetTripCosts,
    totalFleetMaintenance,
    totalFleetNetProfit,
    totalFleetExternalDebtCollected,
    externalSettlements,
    totalFleetActualProfit,
    totalFleetLoaderProfit,
    totalFleetLoadingBilled,
    totalFleetLoadingPayroll,
  } = fleetStats;

  return (
    <div className="bg-gradient-to-b from-sky-50/70 via-white to-white border-2 border-sky-200 rounded-2xl shadow-xs overflow-hidden">
      {reviewSection === 'garage' ? (
        <>
          <div className="px-4 py-1.5 bg-white/80 border-b border-sky-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-sky-800 uppercase tracking-wider mr-1">
                Разрез машин:
              </span>
              <button
                type="button"
                onClick={() => setGarageMachineFilter('all')}
                className={cn(
                  'px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  garageMachineFilter === 'all'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/70',
                )}
              >
                Все машины ({garageSummary.allCount})
              </button>
              <button
                type="button"
                onClick={() => setGarageMachineFilter('client')}
                className={cn(
                  'px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  garageMachineFilter === 'client'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/70',
                )}
              >
                🚗 Клиентские — Доход ({garageSummary.clientCount})
              </button>
              <button
                type="button"
                onClick={() => setGarageMachineFilter('own')}
                className={cn(
                  'px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  garageMachineFilter === 'own'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/70',
                )}
              >
                🏢 Свои машины — Затраты ({garageSummary.ownCount})
              </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">
                Выработка слесарей:{' '}
                <b className="text-sky-950">{(garageSummary.totalMinutes / 60).toFixed(1)} ч</b> ·
                Закупка запчастей:{' '}
                <b className="text-sky-950">
                  {Math.round(garageSummary.totalPartsCost).toLocaleString('ru-RU')} ₽
                </b>
              </span>
              {filteredGarageOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allIds = filteredGarageOrders.map((o) => o.id);
                    if (allIds.every((id) => expandedGarageOrderIds.has(id))) {
                      setExpandedGarageOrderIds(new Set());
                    } else {
                      setExpandedGarageOrderIds(new Set(allIds));
                    }
                  }}
                  className="text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200/70 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-0.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {filteredGarageOrders.every((o) => expandedGarageOrderIds.has(o.id))
                      ? 'unfold_less'
                      : 'unfold_more'}
                  </span>
                  {filteredGarageOrders.every((o) => expandedGarageOrderIds.has(o.id))
                    ? 'Свернуть все'
                    : 'Развернуть все'}
                </button>
              )}
            </div>
          </div>

          <div className="px-4 py-2.5 flex items-center justify-center flex-wrap gap-3 sm:gap-5">
            <div className="text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                {garageMachineFilter === 'own' ? 'Работы (свой парк)' : 'Выручка (клиенты)'}
              </span>
              <span className="text-sm sm:text-base font-black text-sky-950">
                <Money
                  amount={(garageMachineFilter === 'own'
                    ? garageSummary.ownWorks
                    : garageSummary.clientRevenue
                  ).toFixed(2)}
                />
              </span>
            </div>
            <span className="text-sky-200">−</span>
            <div className="text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                ЗП Механиков
              </span>
              <span className="text-sm sm:text-base font-black text-amber-600">
                −
                <Money
                  amount={(garageMachineFilter === 'own'
                    ? garageSummary.ownMechanicPay
                    : garageSummary.clientMechanicPay
                  ).toFixed(2)}
                />
              </span>
            </div>
            <span className="text-sky-200">|</span>
            <div className="text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                {garageMachineFilter === 'own' ? 'Запчасти парка' : 'Запчасти (закуп)'}
              </span>
              <span className="text-sm sm:text-base font-black text-sky-700">
                <Money
                  amount={(garageMachineFilter === 'own'
                    ? garageSummary.ownPartsCost
                    : garageSummary.clientPartsCost
                  ).toFixed(2)}
                />
              </span>
            </div>
            {garageMachineFilter !== 'own' && (
              <>
                <span className="text-sky-200">+</span>
                <div className="text-center bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1">
                  <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest block">
                    Наценка з/ч (+30%)
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-700">
                    +<Money amount={garageSummary.clientPartsMargin.toFixed(2)} />
                  </span>
                </div>
              </>
            )}
            <span className="text-sky-200">=</span>

            {garageMachineFilter !== 'own' && (
              <div
                className={cn(
                  'text-center border rounded-xl px-3.5 py-1 shadow-2xs cursor-help',
                  garageSummary.clientNetProfit >= 0
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-rose-600 border-rose-600 text-white',
                )}
                title={`Реальная чистая прибыль гаража со сторонних клиентов:\nВыручка с клиентов: ${Math.round(garageSummary.clientRevenue).toLocaleString('ru-RU')} ₽\n− ЗП механиков (клиенты): ${Math.round(garageSummary.clientMechanicPay).toLocaleString('ru-RU')} ₽\n− Закуп запчастей (клиенты): ${Math.round(garageSummary.clientPartsCost).toLocaleString('ru-RU')} ₽\n───────────────────────\nЧистая прибыль СТО: ${Math.round(garageSummary.clientNetProfit).toLocaleString('ru-RU')} ₽`}
              >
                <span
                  className={cn(
                    'text-[9px] font-bold uppercase tracking-widest block',
                    garageSummary.clientNetProfit >= 0 ? 'text-emerald-100' : 'text-rose-100',
                  )}
                >
                  Чистая прибыль (клиенты)
                </span>
                <span className="text-base sm:text-lg font-black">
                  {garageSummary.clientNetProfit < 0 ? '−' : ''}
                  <Money amount={Math.abs(garageSummary.clientNetProfit).toFixed(2)} />
                </span>
              </div>
            )}

            {garageMachineFilter !== 'client' && (
              <div
                className="text-center border border-sky-300 bg-sky-50 rounded-xl px-3.5 py-1 shadow-2xs cursor-help"
                title={`Сумма, которую Гараж берёт с компании-перевозчика за обслуживание автопарка:\n• Работы: ${Math.round(garageSummary.ownWorks).toLocaleString('ru-RU')} ₽\n• Запчасти: ${Math.round(garageSummary.ownPartsCost).toLocaleString('ru-RU')} ₽\n───────────────────────\nВсего счёт перевозчику: ${Math.round(garageSummary.ownBilledToCarrier).toLocaleString('ru-RU')} ₽\n(Прямые затраты гаража: ЗП слесарей ${Math.round(garageSummary.ownMechanicPay).toLocaleString('ru-RU')} ₽ + закуп з/ч ${Math.round(garageSummary.ownPartsCost).toLocaleString('ru-RU')} ₽ = ${Math.round(garageSummary.ownTotalSpent).toLocaleString('ru-RU')} ₽)\nРеальной чистой прибыли нет — это внутреннее обслуживание автопарка`}
              >
                <span className="text-[9px] font-bold uppercase tracking-widest block text-sky-800">
                  Счёт перевозчику (свой парк)
                </span>
                <span className="text-base sm:text-lg font-black text-sky-950">
                  <Money amount={garageSummary.ownBilledToCarrier.toFixed(2)} />
                </span>
              </div>
            )}

            {garageMachineFilter === 'own' && (
              <div
                className="text-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 cursor-help"
                title={`Прямые расходы гаража: ЗП слесарей (${Math.round(garageSummary.ownMechanicPay).toLocaleString('ru-RU')} ₽) + закупка запчастей (${Math.round(garageSummary.ownPartsCost).toLocaleString('ru-RU')} ₽). Реальной чистой прибыли нет, так как это внутреннее обслуживание автопарка.`}
              >
                <span className="text-[9px] font-bold uppercase tracking-widest block text-slate-400">
                  Прямые затраты парка
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-700">
                  −<Money amount={garageSummary.ownTotalSpent.toFixed(2)} />
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="px-4 py-1.5 bg-white/80 border-b border-sky-100 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sky-800 font-bold uppercase tracking-wider">
                {mode === 'history'
                  ? `Итоговая статистика · ${listTrips.length} рейс${listTrips.length === 1 ? '' : listTrips.length < 5 && listTrips.length > 0 ? 'а' : 'ов'}${listServiceOrders.length > 0 ? ` · ${listServiceOrders.length} ТО` : ''}`
                  : mode === 'active'
                    ? `Активные · ${trips.length} рейс${trips.length === 1 ? '' : trips.length < 5 && trips.length > 0 ? 'а' : 'ов'}`
                    : `На ревью · ${trips.length} рейс${trips.length === 1 ? '' : trips.length < 5 && trips.length > 0 ? 'а' : 'ов'}`}
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {totalFleetLoaderProfit > 0 && (
                <span className="text-slate-500 flex items-center gap-1">
                  <span>в т.ч. ПРР (грузчики):</span>
                  <b className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    +<Money amount={totalFleetLoaderProfit.toFixed(2)} />
                  </b>
                </span>
              )}
              {totalFleetPendingDebt > 0 && (
                <span
                  className="text-slate-500 flex items-center gap-1 cursor-help"
                  title={`Неоплаченная дебиторка за период: клиенты ещё должны ${Math.round(totalFleetPendingDebt).toLocaleString('ru-RU')} ₽`}
                >
                  <span>в долгах клиентов:</span>
                  <b className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <Money amount={totalFleetPendingDebt.toFixed(2)} />
                  </b>
                </span>
              )}
              {totalFleetExternalDebtCollected > 0 && (
                <span
                  className="text-slate-500 flex items-center gap-1 cursor-help"
                  title={`Погашение задолженностей прошлых периодов, поступившее в выбранном периоде (+${Math.round(totalFleetExternalDebtCollected).toLocaleString('ru-RU')} ₽):\n${externalSettlements
                    .slice(0, 5)
                    .map(
                      (s) =>
                        `• ${s.counterpartyName || 'Контрагент'}: +${Math.round(s.amount).toLocaleString('ru-RU')} ₽ (${new Date(s.created_at).toLocaleDateString('ru-RU')})`,
                    )
                    .join(
                      '\n',
                    )}${externalSettlements.length > 5 ? `\n...и ещё ${externalSettlements.length - 5} платежей` : ''}`}
                >
                  <span>погашено долгов:</span>
                  <b className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    +<Money amount={totalFleetExternalDebtCollected.toFixed(2)} />
                  </b>
                </span>
              )}
              {combinedAssetGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allIds = listTrips.map((t) => t.id);
                    const allGroups = combinedAssetGroups.map((g) => g.assetKey);
                    const isAllExpanded =
                      expandedIds.size === allIds.length &&
                      expandedGroups.size === allGroups.length;

                    if (isAllExpanded) {
                      setExpandedIds(new Set());
                      setExpandedGroups(new Set());
                    } else {
                      setExpandedIds(new Set(allIds));
                      setExpandedGroups(new Set(allGroups));
                    }
                  }}
                  className="text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200/70 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-0.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {expandedIds.size === listTrips.length &&
                    expandedGroups.size === combinedAssetGroups.length
                      ? 'unfold_less'
                      : 'unfold_more'}
                  </span>
                  {expandedIds.size === listTrips.length &&
                  expandedGroups.size === combinedAssetGroups.length
                    ? 'Свернуть все'
                    : 'Развернуть все'}
                </button>
              )}
            </div>
          </div>

          <div className="px-4 py-2.5 flex items-center justify-center flex-wrap gap-3 sm:gap-5">
            <div className="text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                Выручка
              </span>
              <span className="text-sm sm:text-base font-black text-sky-950">
                <Money amount={totalFleetRevenue.toFixed(2)} />
              </span>
            </div>

            <span className="text-sky-200">|</span>

            <div className="text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                Зарплаты
              </span>
              <span className="text-sm sm:text-base font-black text-amber-600">
                −<Money amount={totalFleetPayroll.toFixed(2)} />
              </span>
            </div>

            <span className="text-sky-200">|</span>

            <div className="text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                Топливо
              </span>
              <span className="text-sm sm:text-base font-black text-sky-600">
                −<Money amount={totalFleetFuel.toFixed(2)} />
              </span>
            </div>

            {mode === 'history' && (
              <>
                <span className="text-sky-200">|</span>
                <div className="text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                    Ремонты ТО
                  </span>
                  <span className="text-sm sm:text-base font-black text-rose-600">
                    −<Money amount={totalFleetMaintenance.toFixed(2)} />
                  </span>
                </div>
              </>
            )}

            <span className="text-sky-200">=</span>

            <div
              className="text-center cursor-help"
              title={`Чистый итог (начисленный доход рейсов):\nВыручка: ${Math.round(totalFleetRevenue).toLocaleString('ru-RU')} ₽\n− Зарплаты: ${Math.round(totalFleetPayroll).toLocaleString('ru-RU')} ₽\n− Топливо: ${Math.round(totalFleetFuel).toLocaleString('ru-RU')} ₽\n− Ремонты ТО: ${Math.round(totalFleetMaintenance).toLocaleString('ru-RU')} ₽\n= Чистый итог: ${Math.round(totalFleetNetProfit).toLocaleString('ru-RU')} ₽`}
            >
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                Чистый итог
              </span>
              <span
                className={cn(
                  'text-base sm:text-lg font-black',
                  totalFleetNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {totalFleetNetProfit < 0 ? '−' : ''}
                <Money amount={Math.abs(totalFleetNetProfit).toFixed(2)} />
              </span>
            </div>

            <span className="text-sky-200">|</span>

            <div
              className={cn(
                'text-center rounded-xl py-1 px-3.5 shadow-2xs cursor-help',
                totalFleetActualProfit >= 0
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 text-white',
              )}
              title={`Фактическая прибыль («живой» кэш):\n• Собрано по рейсам периода: ${Math.round(totalFleetCollectedRevenue).toLocaleString('ru-RU')} ₽${totalFleetExternalDebtCollected > 0 ? `\n• Погашено долгов прошлых периодов (поступило сейчас): +${Math.round(totalFleetExternalDebtCollected).toLocaleString('ru-RU')} ₽` : ''}\n• В долгах клиентов на конец периода: ${Math.round(totalFleetPendingDebt).toLocaleString('ru-RU')} ₽\n• Все расходы (ЗП + Топливо + ТО): −${Math.round(totalFleetTripCosts + totalFleetMaintenance).toLocaleString('ru-RU')} ₽\n───────────────────────\nФактическая прибыль: ${Math.round(totalFleetActualProfit).toLocaleString('ru-RU')} ₽`}
            >
              <span
                className={cn(
                  'text-[9px] font-bold uppercase tracking-widest block',
                  totalFleetActualProfit >= 0 ? 'text-emerald-100' : 'text-rose-100',
                )}
              >
                Факт. прибыль
              </span>
              <span className="text-base sm:text-lg font-black">
                {totalFleetActualProfit < 0 ? '−' : ''}
                <Money amount={Math.abs(totalFleetActualProfit).toFixed(2)} />
              </span>
            </div>

            {totalFleetLoaderProfit > 0 && (
              <>
                <span className="text-sky-200">|</span>
                <div
                  className="text-center bg-emerald-50 border border-emerald-200 rounded-xl py-1 px-3 cursor-help"
                  title={`Сумма уже включена в Чистый итог:\nВсего за ПРР клиенты заплатили ${Math.round(totalFleetLoadingBilled).toLocaleString('ru-RU')} ₽, выплачено рабочим ${Math.round(totalFleetLoadingPayroll).toLocaleString('ru-RU')} ₽, чистая прибыль компании 30% = +${Math.round(totalFleetLoaderProfit).toLocaleString('ru-RU')} ₽`}
                >
                  <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest block">
                    в т.ч. с ПРР
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-700">
                    +<Money amount={totalFleetLoaderProfit.toFixed(2)} />
                  </span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
