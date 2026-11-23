'use client';

import type { ClientOrderPart, OrderItem, RouteStop } from './types';

export function OrderDetailsCargoAndVehicle({
  order,
  routes,
  isMulti,
  isTransit,
  isCash,
  onQuickEditRate,
  onAssignVehicle,
}: {
  order: OrderItem;
  routes: RouteStop[];
  isMulti: boolean;
  isTransit: boolean;
  isCash: boolean;
  onQuickEditRate?: (order: OrderItem) => void;
  onAssignVehicle: () => void;
}) {
  const subOrders: ClientOrderPart[] =
    order.client_orders && order.client_orders.length > 0
      ? order.client_orders
      : order.raw_parser_payload?.client_orders || [];
  const isMultiClient = Array.isArray(subOrders) && subOrders.length > 1;

  return (
    <>
      {/* Блок 2: Маршрут (Мульти-стоп и транзит Салды) */}
      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <span>📍</span>
            <span>Маршрут перевозки {isMulti ? `(${routes.length} сегмента)` : ''}</span>
          </span>

          {isTransit && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-[10.5px]">
              🔄 Составной рейс: транзит через Салду разрешен (заездов:{' '}
              {order.salda_transit_count || 0})
            </span>
          )}
        </div>

        {isMulti ? (
          <div className="space-y-2">
            {routes.map((r, idx) => (
              <div
                key={r.id || idx}
                className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1"
              >
                <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
                  <span>
                    Сегмент #{idx + 1}: {r.loading_city} → {r.unloading_city}
                  </span>
                  {r.weight_kg && (
                    <span className="text-slate-500 font-mono">{r.weight_kg} кг</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                  <div>
                    <span className="text-slate-500 block">Погрузка (Откуда):</span>
                    <span className="font-semibold text-slate-900">{r.loading_address}</span>
                    {r.loading_org && (
                      <span className="text-slate-500 block text-[10px]">ЛОП: {r.loading_org}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block">Выгрузка (Куда):</span>
                    <span className="font-semibold text-slate-900">{r.unloading_address}</span>
                    {r.unloading_org && (
                      <span className="text-slate-500 block text-[10px]">
                        Получатель: {r.unloading_org}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-500 block text-[10.5px]">
                📍 Пункт погрузки (Откуда):
              </span>
              <span className="font-bold text-slate-900 text-xs">
                {order.loading_address_json?.raw || order.loading_address_json?.address || (
                  <span className="text-amber-600 font-bold">⚠️ Не указан (заполнить)</span>
                )}
              </span>
              <div className="mt-1 text-[10px] text-slate-500">
                ЛОП:{' '}
                <b>{order.loading_org_name || order.client?.name || '— (требуется указать)'}</b>
              </div>
            </div>
            <div>
              <span className="text-slate-500 block text-[10.5px]">🏁 Пункт выгрузки (Куда):</span>
              <span className="font-bold text-slate-900 text-xs">
                {order.unloading_address_json?.raw || order.unloading_address_json?.address || (
                  <span className="text-amber-600 font-bold">⚠️ Не указан (заполнить)</span>
                )}
              </span>
              <div className="mt-1 text-[10px] text-slate-500">
                Получатель: <b>{order.client?.name || '— (требуется указать)'}</b>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Блок 3: Груз, Финансы и Участники */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
          <span className="font-bold text-slate-900 text-xs block border-b border-slate-100 pb-1">
            📦 Груз и Финансы
          </span>
          {isMultiClient ? (
            <div className="space-y-2 text-[11px]">
              <div className="text-[10.5px] font-bold text-indigo-900 flex items-center justify-between border-b border-indigo-100 pb-1">
                <span>👥 Раздельные заказы клиентов ({subOrders.length}):</span>
                <span className="text-[9.5px] text-indigo-600 font-semibold">Раздельные счета</span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                {subOrders.map((sub, idx) => (
                  <div
                    key={sub.id || idx}
                    className="p-1.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-[11px] gap-2"
                  >
                    <div className="truncate">
                      <div className="font-bold text-slate-800 truncate">
                        #{idx + 1} {sub.client_name || 'Клиент'}
                        {sub.base_doc_number && (
                          <span className="text-slate-400 font-mono text-[10px] ml-1">
                            (№{sub.base_doc_number})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {sub.cargo_name || 'Груз'} •{' '}
                        {sub.weight_gross_kg ? `${sub.weight_gross_kg} кг` : '—'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-indigo-700">
                        {sub.price_without_vat
                          ? `${Number(sub.price_without_vat).toLocaleString('ru-RU')} ₽`
                          : '0 ₽'}
                      </span>
                      <span className="block text-[9px] text-slate-400">отдельный счёт</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200">
                <span className="font-bold text-slate-700">Итого доход рейса:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-emerald-600 text-sm">
                    {order.price_without_vat
                      ? `${Number(order.price_without_vat).toLocaleString('ru-RU')} ₽`
                      : '0 ₽'}
                  </span>
                  {onQuickEditRate && (
                    <button
                      onClick={() => onQuickEditRate(order)}
                      className="px-1.5 py-0.5 text-[10px] text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded font-bold cursor-pointer transition"
                      title="Быстро изменить ставку рейса"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Груз:</span>
                <span className="font-bold text-slate-900">
                  {order.cargo_name || (
                    <span className="text-amber-600 font-bold">⚠️ Требуется заполнить</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Масса брутто:</span>
                <span className="font-bold text-slate-900">{order.weight_gross_kg} кг</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Ставка (без НДС):</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-slate-900">
                    {order.price_without_vat
                      ? `${Number(order.price_without_vat).toLocaleString('ru-RU')} ₽`
                      : '—'}
                  </span>
                  {onQuickEditRate && (
                    <button
                      onClick={() => onQuickEditRate(order)}
                      className="px-1.5 py-0.5 text-[10px] text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded font-bold cursor-pointer transition"
                      title="Быстро изменить ставку рейса"
                    >
                      ✏️ Изменить
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Канал оплаты:</span>
                <span className="font-bold text-indigo-700">
                  {isCash ? '💵 В кассу компании' : '🏦 В дебиторку (Р/С)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Условия:</span>
                <span className="text-slate-700 text-right truncate max-w-[180px]">
                  {order.payment_terms || 'По факту доставки'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Автомобиль и Водитель */}
        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
            <span className="font-bold text-slate-900 text-xs">🚚 Автомобиль и Водитель</span>
            <button
              onClick={onAssignVehicle}
              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
            >
              Сменить
            </button>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Автомобиль:</span>
              <span className="font-bold text-slate-900">
                {order.vehicle ? (
                  <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                    {order.vehicle.reg_number}
                  </span>
                ) : (
                  <span className="text-amber-600 font-bold">Не назначен</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Модель:</span>
              <span className="font-medium text-slate-800">
                {order.vehicle?.brand_name || order.vehicle?.short_name || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Водитель:</span>
              <span className="font-bold text-slate-900">{order.driver?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Телефон водителя:</span>
              <span className="font-mono text-slate-700">{order.driver?.phone || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
