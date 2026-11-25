'use client';

import { PIPELINE_FOLDERS } from './constants';
import { OrderDetailsCargoAndVehicle } from './OrderDetailsCargoAndVehicle';
import type { OrderItem, OrderRouteEntry } from './types';

export function OrderDetailsModal({
  order,
  onClose,
  onEdit,
  onQuickEditRate,
  onAssignVehicle,
  onDepart,
  onArrive,
  onComplete,
  onManualStage,
  onDelete,
  onOpenDocTemplates,
}: {
  order: OrderItem;
  onClose: () => void;
  onEdit: () => void;
  onQuickEditRate?: (order: OrderItem) => void;
  onAssignVehicle: () => void;
  onDepart: () => void;
  onArrive: () => void;
  onComplete: () => void;
  onManualStage?: (stage: OrderItem['status']) => void;
  onDelete: () => void;
  onOpenDocTemplates?: () => void;
}) {
  const routes: OrderRouteEntry[] =
    order.routes_json ||
    (order.raw_parser_payload?.routes as unknown as OrderRouteEntry[] | undefined) ||
    [];
  const isMulti = routes.length > 1;
  const isTransit = Boolean(
    order.prevent_salda_auto_finish || order.raw_parser_payload?.prevent_salda_auto_finish,
  );
  const isCash = Boolean(order.payment_terms?.includes('Наличные'));
  const isRepair = Boolean(
    order.raw_parser_payload?.is_repair ||
    order.raw_parser_payload?.trip_type === 'repair' ||
    order.base_doc_name?.includes('РЕМОНТ') ||
    order.cargo_name?.toLowerCase().includes('ремонт'),
  );
  const serviceOrderId = order.raw_parser_payload?.service_order_id;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Шапка */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📋</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span>
                    {order.trip?.trip_number
                      ? `Рейс № ${order.trip.trip_number}`
                      : `Заявка № ${order.base_doc_number || order.order_number}`}
                  </span>
                  {order.base_doc_number &&
                    (order.base_doc_number.includes('/') || order.base_doc_number.includes('\\') ? (
                      <span className="px-1.5 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 rounded text-[11px] font-bold">
                        ЭПЭ {order.base_doc_number}
                      </span>
                    ) : order.trip?.trip_number &&
                      order.base_doc_number !== String(order.trip.trip_number) ? (
                      <span className="text-xs text-slate-300 font-mono font-normal">
                        (№{order.base_doc_number})
                      </span>
                    ) : null)}
                </h3>
                <span className="text-xs text-slate-300">
                  от {order.base_doc_date ? order.base_doc_date : order.created_at?.slice(0, 10)}
                </span>
                {order.status === 'in_progress' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-500 text-white animate-pulse">
                    🚛 В пути
                  </span>
                ) : order.status === 'assigned' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-sky-500 text-white">
                    📋 Назначен
                  </span>
                ) : order.status === 'pending_review' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-orange-500 text-white">
                    🔍 На ревью
                  </span>
                ) : order.status === 'docs_collection' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-600 text-white">
                    📑 Сбор документов
                  </span>
                ) : order.status === 'completed' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500 text-white">
                    ✅ Завершен
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500 text-white">
                    ⏳ Лист ожидания
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {isRepair
                  ? '🔧 Внутренний выезд: Ремонт автопарка (Гараж / СТО)'
                  : order.client?.name || (
                      <span className="text-amber-400 font-bold">
                        ⚠️ Заказчик не указан (требуется заполнить)
                      </span>
                    )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-black text-sm text-emerald-400">
                  {order.price_without_vat
                    ? `${Number(order.price_without_vat).toLocaleString('ru-RU')} ₽`
                    : '—'}
                </span>
                {onQuickEditRate && (
                  <button
                    onClick={() => onQuickEditRate(order)}
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded text-[10px] font-bold cursor-pointer transition"
                    title="Быстро изменить ставку рейса (в пути)"
                  >
                    ✏️
                  </button>
                )}
              </div>
              <div className="text-[10px] text-slate-300 font-bold">
                {isCash ? '💵 В кассу' : '🏦 В дебиторку'}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-lg p-1 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Тело */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {/* Ручное управление этапами */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                <span>🔄</span>
                <span>Текущий этап заявки (ручное перемещение для машин без Wialon):</span>
              </div>
              <span className="text-[10.5px] text-indigo-700 font-semibold">
                Кликните этап для мгновенного перевода
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PIPELINE_FOLDERS.map((st) => (
                <button
                  key={st.id}
                  onClick={() => onManualStage && onManualStage(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    order.status === st.id
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs font-black'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{st.icon}</span>
                  <span>{st.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Телематика Wialon и управление рейсом */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛰️</span>
              <div>
                <span className="font-bold text-slate-900 block text-xs">
                  Телематика Wialon & Рейс
                </span>
                <span className="text-[11px] text-slate-600">
                  {order.status === 'in_progress' ? (
                    <span className="text-purple-700 font-bold">
                      Грузовик покинул Салду. Одометр: {order.trip?.odometer_start || 120500} км.
                      {isTransit
                        ? ' Включен составной маршрут (1-й заезд снимет галочку, 2-й закроет).'
                        : (order.salda_transit_count || 0) > 0
                          ? ' Промежуточный транзит пройден (следующий заезд завершит).'
                          : ''}
                    </span>
                  ) : order.status === 'assigned' ? (
                    <span className="text-sky-700 font-bold">
                      Машина назначена. При выезде за радиус 8 км Салды рейс стартует автоматически
                      (или используйте кнопки справа).
                    </span>
                  ) : order.status === 'pending_review' ? (
                    <span className="text-orange-700 font-bold">
                      {isRepair
                        ? '🔧 Поездка на ремонт (СТО) завершена. Перегон зафиксирован. Заполните работы и затраты в Гараже.'
                        : 'Грузовик вернулся / разгрузился. Ожидает одобрения ЗП и ГСМ, документы в обработке.'}
                    </span>
                  ) : order.status === 'docs_collection' ? (
                    <span className="text-indigo-700 font-bold">
                      Рейс успешно проверен, зарплаты рассчитаны. Идёт сбор и подписание документов
                      (Счёт, ТН, ЭПЭ, ЭДО).
                    </span>
                  ) : order.status === 'completed' ? (
                    <span className="text-emerald-700 font-bold">
                      Рейс успешно закрыт, дебиторка зафиксирована.
                    </span>
                  ) : (
                    <span className="text-amber-700 font-bold">
                      В листе ожидания. Назначьте автомобиль и водителя.
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {order.status === 'assigned' && (
                <>
                  <button
                    onClick={onDepart}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px]"
                  >
                    🚀 Выезд (Wialon)
                  </button>
                  <button
                    onClick={() => onManualStage && onManualStage('pending_review')}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px]"
                    title="Машина уже разгрузилась — сразу перевести в ревью и открыть сбор документов"
                  >
                    ⏩ Разгрузился (На ревью)
                  </button>
                </>
              )}
              {order.status === 'in_progress' && (
                <>
                  <button
                    onClick={onArrive}
                    className={`px-3 py-1.5 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px] ${
                      isTransit
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {isTransit ? '🔄 Заезд (транзит, снять флаг)' : '🏁 Возврат в Салду (Ревью)'}
                  </button>
                  <button
                    onClick={() => onManualStage && onManualStage('pending_review')}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px]"
                  >
                    ⏩ Разгрузился (На ревью)
                  </button>
                </>
              )}
              {order.status === 'pending_review' &&
                (isRepair ? (
                  <button
                    onClick={() => onManualStage && onManualStage('completed')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px]"
                  >
                    ✓ Завершить рейс ремонта
                  </button>
                ) : (
                  <button
                    onClick={() => onManualStage && onManualStage('docs_collection')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px]"
                  >
                    📑 Одобрить рейс (В сбор документов)
                  </button>
                ))}
              {order.status === 'docs_collection' && (
                <button
                  onClick={onComplete}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition active:scale-95 cursor-pointer text-[11px]"
                >
                  ✓ Завершить сделку
                </button>
              )}
              {!order.assigned_vehicle_id && (
                <button
                  onClick={onAssignVehicle}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-xs cursor-pointer text-[11px]"
                >
                  + Назначить ТС
                </button>
              )}
            </div>
          </div>

          {isRepair && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🔧</span>
                <div>
                  <div className="font-bold text-amber-950 text-xs flex items-center gap-2">
                    <span>Поездка на ремонт (СТО)</span>
                    <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-mono text-[10px] font-bold">
                      {serviceOrderId ? 'Заказ-наряд Гаража' : 'Гараж'}
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-800 block">
                    ТС вернулось в Салду. Перейдите в Гараж для фиксации работ, запчастей и
                    стоимости ремонта.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`/garage?tab=active${serviceOrderId ? `&order=${serviceOrderId}` : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>Открыть в Гараже ↗</span>
                </a>
                <a
                  href="/review?section=garage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <span>Ревью Гаража ↗</span>
                </a>
              </div>
            </div>
          )}

          <OrderDetailsCargoAndVehicle
            order={order}
            routes={routes}
            isMulti={isMulti}
            isTransit={isTransit}
            isCash={isCash}
            onQuickEditRate={onQuickEditRate}
            onAssignVehicle={onAssignVehicle}
          />

          {/* Документы */}
          <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <span className="font-bold text-slate-900 block text-xs">
                📄 Комплект перевозочных документов
              </span>
              <span className="text-[10.5px] text-slate-600">
                Печать готовых бланков с данными заявки или чистых пустых форм
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/api/orders/${order.id}/docs/tn-pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1"
              >
                <span>📄 ТН</span>
              </a>
              <a
                href={`/api/orders/${order.id}/docs/waybill-4c`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1"
              >
                <span>📋 Путевой лист № 4-С</span>
              </a>
              <a
                href={`/api/orders/${order.id}/docs/etrn-xml`}
                download
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1"
              >
                <span>📥 XML</span>
              </a>
              {onOpenDocTemplates && (
                <button
                  type="button"
                  onClick={onOpenDocTemplates}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                  title="Центр управления шаблонами документов (ПЛ, ТН, ЭТрн)"
                >
                  <span>⚙️ Шаблоны</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Футер */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onDelete}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs cursor-pointer transition active:scale-95"
          >
            🗑️ Удалить заявку
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="px-4 py-1.5 bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg font-bold text-xs cursor-pointer transition active:scale-95"
            >
              ✏️ Редактировать заявку
            </button>
            <button
              onClick={onClose}
              className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs cursor-pointer transition active:scale-95"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
