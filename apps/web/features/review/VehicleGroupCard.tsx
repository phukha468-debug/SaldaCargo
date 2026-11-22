'use client';

import { Money, cn } from '@saldacargo/ui';
import { isTruckAsset } from '@saldacargo/shared';
import type { TripForReview } from './types';
import type { VehicleAssetGroup } from './fleetAggregation';
import { calcServiceOrder } from './utils';
import { TripCard } from './trip-card/TripCard';

export function VehicleGroupCard({
  group,
  mode,
  isExpanded,
  isTripsOpen,
  isOrdersOpen,
  expandedIds,
  expandedGroups,
  approvingId,
  deletingId,
  onToggleGroup,
  onToggleTripsSpoiler,
  onToggleOrdersSpoiler,
  onToggleExpandTrip,
  onSelectMaintenanceGroup,
  onEditTrip,
  onApproveTrip,
  onReturnTrip,
  onDeleteTrip,
}: {
  group: VehicleAssetGroup;
  mode: 'review' | 'active' | 'history';
  isExpanded: boolean;
  isTripsOpen: boolean;
  isOrdersOpen: boolean;
  expandedIds: Set<string>;
  expandedGroups: Set<string>;
  approvingId: string | null;
  deletingId: string | null;
  onToggleGroup: (assetKey: string) => void;
  onToggleTripsSpoiler: (assetKey: string) => void;
  onToggleOrdersSpoiler: (assetKey: string) => void;
  onToggleExpandTrip: (tripId: string) => void;
  onSelectMaintenanceGroup: (group: VehicleAssetGroup) => void;
  onEditTrip: (trip: TripForReview) => void;
  onApproveTrip: (tripId: string) => void;
  onReturnTrip: (tripId: string) => void;
  onDeleteTrip: (tripId: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Group Header - Плотный 2-строчный вид (Dense 2-Line Layout) */}
      <div
        onClick={() => onToggleGroup(group.assetKey)}
        className="flex items-center justify-between p-3 sm:p-3.5 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors gap-3"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="bg-sky-100 p-2 sm:p-2.5 rounded-xl text-sky-600 shrink-0">
            <span className="material-symbols-outlined block text-xl sm:text-2xl">
              local_shipping
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate">
                {group.assetKey}
              </h3>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs">
              {group.trips.length > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTripsSpoiler(group.assetKey);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md transition cursor-pointer text-[11px] shadow-2xs',
                    isTripsOpen
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200',
                  )}
                  title="Нажмите, чтобы показать или скрыть номера рейсов"
                >
                  <span>📋</span>
                  <span>
                    {group.trips.length} рейс
                    {group.trips.length === 1 ? '' : group.trips.length < 5 ? 'а' : 'ов'}
                  </span>
                  <span
                    className={cn(
                      'text-[9px] transition-transform',
                      isTripsOpen ? 'rotate-180' : '',
                    )}
                  >
                    ▾
                  </span>
                </button>
              ) : (
                <span className="text-slate-400 italic text-[11px]">0 рейсов</span>
              )}

              {mode === 'history' && group.serviceOrders.length > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleOrdersSpoiler(group.assetKey);
                    }}
                    className={cn(
                      'inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md transition cursor-pointer text-[11px] shadow-2xs',
                      isOrdersOpen
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200',
                    )}
                    title="Нажмите, чтобы показать или скрыть заказ-наряды ТО"
                  >
                    <span>🔧</span>
                    <span>
                      {group.serviceOrders.length} наряд
                      {group.serviceOrders.length === 1 ? '' : 'а'} ТО (−
                      {Math.round(group.maintenanceTotal).toLocaleString('ru-RU')} ₽)
                    </span>
                    <span
                      className={cn(
                        'text-[9px] transition-transform',
                        isOrdersOpen ? 'rotate-180' : '',
                      )}
                    >
                      ▾
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Выручка
            </span>
            <span className="text-sm font-black text-slate-800">
              <Money amount={group.tripsRevenue.toFixed(2)} />
            </span>
          </div>
          <div
            className="text-right hidden sm:block relative cursor-help"
            title={
              group.assetKey === '👷 ПРР (без авто)'
                ? `ФОТ грузчиков: ${Math.round(group.loaderPayroll).toLocaleString('ru-RU')} ₽`
                : isTruckAsset(group.trips[0]?.asset)
                  ? `Зарплата водителя: ${Math.round(group.driverPayroll).toLocaleString('ru-RU')} ₽`
                  : `ФОТ рейсов: Водители ${Math.round(group.driverPayroll).toLocaleString('ru-RU')} ₽ + Грузчики ${Math.round(group.loaderPayroll).toLocaleString('ru-RU')} ₽${group.loaderProfit > 0 ? `\nПрибыль компании с грузчиков: +${Math.round(group.loaderProfit).toLocaleString('ru-RU')} ₽ (маржа 30%)` : ''}`
            }
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              ЗП (ФОТ)
            </span>
            <span className="text-sm font-black text-amber-500">
              <Money
                amount={(group.assetKey === '👷 ПРР (без авто)'
                  ? group.loaderPayroll
                  : isTruckAsset(group.trips[0]?.asset)
                    ? group.driverPayroll
                    : group.tripsPayroll
                ).toFixed(2)}
              />
            </span>
            {group.loaderProfit > 0 && (
              <span className="text-[9px] font-bold text-emerald-600 block leading-tight">
                +{Math.round(group.loaderProfit).toLocaleString('ru-RU')} ₽ с грузч.
              </span>
            )}
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              ГСМ
            </span>
            <span className="text-sm font-black text-rose-500">
              <Money amount={group.tripsFuel.toFixed(2)} />
            </span>
          </div>
          {mode === 'history' && (
            <div
              onClick={(e) => {
                if (group.serviceOrders.length > 0) {
                  e.stopPropagation();
                  onSelectMaintenanceGroup(group);
                }
              }}
              className={cn(
                'text-right hidden sm:block px-2 py-0.5 rounded-lg transition-colors',
                group.serviceOrders.length > 0
                  ? 'bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer shadow-2xs'
                  : '',
              )}
              title={
                group.serviceOrders.length > 0
                  ? `Нажмите, чтобы открыть ${group.serviceOrders.length} заказ-наряда ТО`
                  : 'Ремонтов не было'
              }
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Ремонт ТО
              </span>
              <span
                className={cn(
                  'text-sm font-black',
                  group.maintenanceTotal > 0 ? 'text-rose-600' : 'text-slate-400',
                )}
              >
                {group.maintenanceTotal > 0 ? (
                  <>
                    −<Money amount={group.maintenanceTotal.toFixed(2)} />
                  </>
                ) : (
                  '0 ₽'
                )}
              </span>
            </div>
          )}
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Прибыль
            </span>
            <span
              className={cn(
                'text-sm font-black',
                group.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {group.netProfit < 0 ? '−' : ''}
              <Money amount={Math.abs(group.netProfit).toFixed(2)} />
            </span>
          </div>
          <span
            className={cn(
              'material-symbols-outlined text-slate-400 transition-transform duration-300',
              isExpanded ? 'rotate-180' : '',
            )}
          >
            expand_more
          </span>
        </div>
      </div>

      {/* Спойлер номеров рейсов */}
      {isTripsOpen && group.trips.length > 0 && (
        <div className="bg-sky-50/70 border-t border-sky-100 p-2.5 px-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 mr-1">
            Номера рейсов ({group.trips.length}):
          </span>
          {group.trips.map((t) => (
            <span
              key={t.id}
              onClick={(e) => {
                e.stopPropagation();
                if (!expandedGroups.has(group.assetKey)) {
                  onToggleGroup(group.assetKey);
                }
                if (!expandedIds.has(t.id)) {
                  onToggleExpandTrip(t.id);
                }
              }}
              className="inline-flex items-center bg-white hover:bg-sky-500 hover:text-white border border-sky-200 text-sky-700 font-bold px-2 py-0.5 rounded text-[11px] cursor-pointer transition-colors shadow-2xs"
              title={`Нажмите, чтобы открыть рейс #${t.trip_number}`}
            >
              #{t.trip_number}
            </span>
          ))}
        </div>
      )}

      {/* Спойлер заказ-нарядов ТО */}
      {isOrdersOpen && mode === 'history' && group.serviceOrders.length > 0 && (
        <div className="bg-rose-50/70 border-t border-rose-100 p-2.5 px-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 mr-1">
            Заказ-наряды ТО ({group.serviceOrders.length}):
          </span>
          {group.serviceOrders.map((so) => {
            const cso = calcServiceOrder(so);
            return (
              <span
                key={so.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMaintenanceGroup(group);
                }}
                className={cn(
                  'inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] cursor-pointer transition-all shadow-2xs',
                  cso.isExternal
                    ? 'bg-white hover:bg-purple-600 hover:text-white border border-purple-200 text-purple-800'
                    : cso.isEquipment
                      ? 'bg-white hover:bg-amber-600 hover:text-white border border-amber-300 text-amber-800'
                      : 'bg-white hover:bg-rose-600 hover:text-white border border-rose-200 text-rose-700',
                )}
                title={`Заказ-наряд #${so.order_number}: ${so.problem_description || ''}. Нажмите для просмотра`}
              >
                <span>{cso.isExternal ? '🏢' : cso.isEquipment ? '⚙️' : '🔧'}</span>
                <span>#{so.order_number}</span>
                {cso.contractorName && (
                  <span className="opacity-85 max-w-[120px] truncate">
                    {cso.contractorName.replace(/^ООО\s*["']?|["']$/g, '')}
                  </span>
                )}
                <span className="font-mono text-[10px] opacity-90">
                  (−{cso.totalCost.toLocaleString('ru-RU')} ₽)
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Group Content */}
      {isExpanded && (
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 space-y-4">
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 sm:gap-5">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">
                    ЗП водителя (за руль)
                  </span>
                  <span className="font-extrabold text-slate-800 text-sm">
                    <Money amount={group.driverCarPayroll.toFixed(2)} />
                  </span>
                  {group.driverLoaderPayroll > 0 && (
                    <span
                      className="block text-[10px] text-amber-600 font-semibold"
                      title="Доплата водителю за то, что грузил сам"
                    >
                      +{Math.round(group.driverLoaderPayroll).toLocaleString('ru-RU')} ₽ за погрузку
                    </span>
                  )}
                </div>

                <div className="h-8 w-px bg-slate-200 hidden sm:block" />

                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">
                    Выплаты бригаде грузчиков
                  </span>
                  <span className="font-extrabold text-slate-700 text-sm">
                    <Money amount={group.loaderPayroll.toFixed(2)} />
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    Всего за ПРР: {Math.round(group.totalLoadingPayroll).toLocaleString('ru-RU')} ₽
                  </span>
                </div>

                {group.loaderProfit > 0 && (
                  <>
                    <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">
                        Оплачено клиентами за ПРР
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        <Money amount={group.loadingBilled.toFixed(2)} />
                      </span>
                      <span className="block text-[10px] text-slate-400">в чеках заказов</span>
                    </div>
                    <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                        payments
                      </span>
                      <div>
                        <span className="text-emerald-800 block text-[9px] uppercase font-black tracking-wider">
                          Прибыль компании с ПРР
                        </span>
                        <span className="font-black text-emerald-600 text-sm sm:text-base">
                          +{Math.round(group.loaderProfit).toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {group.loaderProfit > 0 ? (
                <div className="text-[10px] text-slate-400 font-medium">
                  ПРР: 70% оплата рабочим · 30% прибыль компании
                </div>
              ) : group.totalLoadingPayroll > 0 ? (
                <div className="text-[10px] text-slate-400 font-medium italic">
                  * До 01.09.2026 маржа с ПРР не взималась (100% выплата рабочим)
                </div>
              ) : null}
            </div>
          </div>

          {group.trips.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wider px-1">
                <span className="material-symbols-outlined text-sky-600 text-[18px]">
                  local_shipping
                </span>
                Рейсы автомобиля ({group.trips.length})
              </div>
              <div className="space-y-3">
                {group.trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    mode={mode}
                    expanded={expandedIds.has(trip.id)}
                    onToggle={() => onToggleExpandTrip(trip.id)}
                    onEdit={() => onEditTrip(trip)}
                    onApprove={() => onApproveTrip(trip.id)}
                    onReturn={() => onReturnTrip(trip.id)}
                    onDelete={() => onDeleteTrip(trip.id)}
                    approving={approvingId === trip.id}
                    deleting={deletingId === trip.id}
                  />
                ))}
              </div>
            </div>
          )}

          {mode === 'history' && group.serviceOrders.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wider">
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">
                    build_circle
                  </span>
                  Заказ-наряды ТО и ремонты ({group.serviceOrders.length})
                </div>
                <button
                  type="button"
                  onClick={() => onSelectMaintenanceGroup(group)}
                  className="text-xs font-black text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Итого ТО: −{group.maintenanceTotal.toLocaleString('ru-RU')} ₽</span>
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.serviceOrders.map((so) => {
                  const cso = calcServiceOrder(so);
                  const cleanDesc = (so.problem_description || so.admin_note || '')
                    .replace(/\[Сторонний сервис[^\]]*\]\s*/gi, '')
                    .trim();
                  return (
                    <div
                      key={so.id}
                      onClick={() => onSelectMaintenanceGroup(group)}
                      className={cn(
                        'p-3.5 rounded-xl border bg-white shadow-2xs hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between gap-2.5',
                        cso.isExternal
                          ? 'border-purple-200 hover:border-purple-400'
                          : 'border-slate-200 hover:border-rose-300',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              'text-[11px] font-mono font-black px-2 py-0.5 rounded-md text-white',
                              cso.isExternal ? 'bg-purple-600' : 'bg-rose-600',
                            )}
                          >
                            НЗ-{so.order_number}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {new Date(so.created_at).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                          {cso.isExternal && (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1">
                              <span>🏢</span>
                              <span>{cso.contractorName || 'Сторонний сервис'}</span>
                            </span>
                          )}
                          {cso.isEquipment && (
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1">
                              <span>⚙️</span>
                              <span>Доп. оборуд.</span>
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-black text-rose-600 whitespace-nowrap">
                          −{cso.totalCost.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                      {cleanDesc && (
                        <p className="text-xs text-slate-700 font-medium line-clamp-2">
                          {cleanDesc}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                        <span>
                          {cso.isExternal
                            ? `Подрядчик: ${cso.worksCost > 0 ? `${cso.worksCost.toLocaleString('ru-RU')} ₽` : 'запчасти'}`
                            : so.mechanic?.name
                              ? `Слесарь: ${so.mechanic.name}`
                              : 'Свой гараж'}
                        </span>
                        <span className="text-slate-400 flex items-center gap-0.5 font-medium hover:text-slate-700">
                          Детали{' '}
                          <span className="material-symbols-outlined text-[14px]">
                            arrow_forward
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {group.trips.length === 0 && group.serviceOrders.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-xs font-medium">
              Нет записей за выбранный период
            </div>
          )}
        </div>
      )}
    </div>
  );
}
