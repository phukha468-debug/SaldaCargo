'use client';

import { useRef } from 'react';
import { STAGE_CONFIG } from './constants';
import { AtiOrderDetailDocsPanel, type UpdateDocFieldsPayload } from './AtiOrderDetailDocsPanel';
import type { AtiOrder } from './types';

export function AtiOrderDetailModal({
  order,
  onClose,
  onOpenCancelModal,
  onUpdateStage,
  onUpdateDocFields,
  onOpenPowerOfAttorney,
}: {
  order: AtiOrder;
  onClose: () => void;
  onOpenCancelModal: (order: AtiOrder) => void;
  onUpdateStage: (id: string, stage: number) => void;
  onUpdateDocFields: (payload: UpdateDocFieldsPayload) => void;
  onOpenPowerOfAttorney: (order: AtiOrder) => void;
}) {
  const backdropRef = useRef(false);
  const isReady5 = Boolean(order.docs_sent && order.docs_received && order.payment_promised_date);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 lg:p-6 overflow-y-auto"
      onMouseDown={(e) => {
        backdropRef.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (backdropRef.current && e.target === e.currentTarget) onClose();
        backdropRef.current = false;
      }}
    >
      <div
        className="bg-white rounded-3xl border border-slate-300 shadow-2xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between gap-4 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-2xl shrink-0">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black font-display tracking-tight text-white">
                  Договор-Заявка {order.order_number}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                    order.doc_type === 'etrn'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400'
                  }`}
                >
                  {order.doc_type === 'etrn' ? '⚡ ЭТрН (ЭДО)' : '📮 Почта РФ / СДЭК'}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  от {new Date(order.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
              <p className="text-xs text-slate-400 pt-0.5">
                Междугородняя перевозка груза автотранспортом • Статус:{' '}
                <strong className="text-indigo-300">{STAGE_CONFIG[order.stage]?.title}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Стоимость перевозки
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-emerald-400">
                {Number(order.price || 0).toLocaleString('ru-RU')} ₽
              </span>
              <span className="text-[10px] text-slate-400">без НДС</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg font-black transition cursor-pointer"
              title="Закрыть (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Stepper 1..7 */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 shrink-0 overflow-x-auto">
          <div className="flex items-center justify-between gap-1.5 min-w-[700px]">
            {[1, 2, 3, 4, 5, 6, 7].map((s) => {
              const cfg = STAGE_CONFIG[s] || STAGE_CONFIG[1];
              const isCurrent = order.stage === s;
              const isPast = order.stage > s;
              return (
                <div
                  key={s}
                  className={`flex-1 flex items-center gap-2 py-1.5 px-2.5 rounded-xl border transition select-none ${
                    isCurrent
                      ? 'bg-white border-indigo-500 shadow-xs text-indigo-950 font-black ring-2 ring-indigo-500/20'
                      : isPast
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-bold'
                        : 'bg-slate-50/60 border-slate-200 text-slate-400'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                      isCurrent
                        ? 'bg-indigo-600 text-white'
                        : isPast
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-300 text-slate-600'
                    }`}
                  >
                    {isPast ? '✓' : s}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] leading-tight truncate">
                      {cfg?.shortTitle || ''}
                    </div>
                    {isCurrent && (
                      <div className="text-[9px] text-indigo-600 uppercase font-black tracking-wider">
                        Текущий
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Тело */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1 bg-slate-50/60">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Левая колонка */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow-2xs p-4 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-indigo-50">
                    <span className="text-[11px] font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1.5">
                      <span>🏢</span> 1. ЗАКАЗЧИК
                    </span>
                    {order.ati_code && (
                      <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                        Код АТИ: {order.ati_code}
                      </span>
                    )}
                  </div>
                  <div className="font-black text-slate-900 text-sm leading-snug">
                    {order.counterparty_name}
                  </div>
                  {order.counterparty_inn && (
                    <div className="text-slate-600 text-xs">
                      ИНН:{' '}
                      <span className="font-mono font-bold text-slate-800">
                        {order.counterparty_inn}
                      </span>
                    </div>
                  )}
                  {order.counterparty_contact && (
                    <div className="text-slate-600 text-xs">
                      Контактное лицо:{' '}
                      <strong className="text-slate-800">{order.counterparty_contact}</strong>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {order.counterparty_phone && (
                      <a
                        href={`tel:${order.counterparty_phone.replace(/[^\d+]/g, '')}`}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 flex items-center gap-1 transition"
                        title="Позвонить заказчику"
                      >
                        <span>📞</span>
                        <span>{order.counterparty_phone}</span>
                      </a>
                    )}
                    {order.counterparty_email && (
                      <a
                        href={`mailto:${order.counterparty_email}`}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-200 flex items-center gap-1 transition"
                        title="Написать письмо"
                      >
                        <span>✉️</span>
                        <span className="truncate max-w-[150px]">{order.counterparty_email}</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-2xs p-4 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                      <span>🚚</span> 2. ПЕРЕВОЗЧИК
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-bold">ИП</span>
                  </div>
                  <div className="font-black text-slate-900 text-sm leading-snug">
                    {order.carrier_name}
                  </div>
                  <div className="text-slate-600 text-xs">
                    ИНН:{' '}
                    <span className="font-mono font-bold text-slate-800">{order.carrier_inn}</span>
                  </div>
                  <div className="text-slate-600 text-xs">
                    Контакт: <strong className="text-slate-800">{order.carrier_contact}</strong>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-100">
                    <div>
                      Р/С:{' '}
                      <span className="font-mono font-bold text-slate-800">
                        {order.carrier_account}
                      </span>
                    </div>
                    <div>
                      Банк: <strong className="text-slate-800">{order.carrier_bank}</strong> (БИК{' '}
                      {order.carrier_bik})
                    </div>
                  </div>
                </div>
              </div>

              {/* Маршрут */}
              <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-2xs p-4 space-y-3">
                <div className="text-[11px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
                  <span>🗺️</span> 3. МАРШРУТ И АДРЕСА СКЛАДОВ
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-emerald-50/50 rounded-xl border border-emerald-200 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                        <span className="text-sm">🟢</span> ПОГРУЗКА
                      </span>
                      <span className="font-mono font-black text-emerald-800 text-xs bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        {order.pickup_date_time || 'По графику'}
                      </span>
                    </div>
                    {order.shipper_name && (
                      <div className="text-xs">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">
                          Грузоотправитель:
                        </span>
                        <span className="font-bold text-slate-900">{order.shipper_name}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">
                        Точный адрес:
                      </span>
                      <span className="font-bold text-slate-800 text-xs leading-snug">
                        {order.pickup_address || 'Адрес не указан'}
                      </span>
                    </div>
                    {order.pickup_contact && (
                      <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-emerald-100">
                        <span className="text-slate-400">Контакты склада: </span>
                        <span className="font-bold text-slate-800">{order.pickup_contact}</span>
                      </div>
                    )}
                    {order.cargo_description && (
                      <div className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-emerald-100">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Характер груза:
                        </span>
                        <span className="font-bold text-slate-900">{order.cargo_description}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-rose-50/50 rounded-xl border border-rose-200 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                        <span className="text-sm">🔴</span> ВЫГРУЗКА
                      </span>
                      <span className="font-mono font-black text-rose-800 text-xs bg-rose-100/80 px-2 py-0.5 rounded-md">
                        {order.delivery_date || 'По графику'}
                      </span>
                    </div>
                    {order.consignee_name && (
                      <div className="text-xs">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">
                          Грузополучатель:
                        </span>
                        <span className="font-bold text-slate-900">{order.consignee_name}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">
                        Точный адрес:
                      </span>
                      <span className="font-bold text-slate-800 text-xs leading-snug">
                        {order.delivery_address || 'Адрес не указан'}
                      </span>
                    </div>
                    {order.delivery_contact && (
                      <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-rose-100">
                        <span className="text-slate-400">Контакты приемки: </span>
                        <span className="font-bold text-slate-800">{order.delivery_contact}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Транспорт и водитель */}
              <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-2xs p-4 space-y-3">
                <div className="text-[11px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
                  <span>🚛</span> 4. СВЕДЕНИЯ О ТРАНСПОРТЕ И ВОДИТЕЛЕ
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">
                      Автомобиль и госномер:
                    </span>
                    <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                      <span>{order.asset_name}</span>
                      {order.asset_reg_number && (
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-300">
                          {order.asset_reg_number}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">
                      Водитель:
                    </span>
                    <div className="font-black text-slate-900 text-sm">
                      {order.driver_name || 'Не назначен'}
                    </div>
                    {order.driver_phone && (
                      <a
                        href={`tel:${order.driver_phone.replace(/[^\d+]/g, '')}`}
                        className="inline-flex items-center gap-1 font-mono font-bold text-xs text-blue-600 hover:underline pt-0.5"
                      >
                        <span>📞</span>
                        <span>{order.driver_phone}</span>
                      </a>
                    )}
                  </div>
                  <div className="sm:col-span-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <div>
                      Паспорт:{' '}
                      <strong className="text-slate-800">
                        {order.driver_passport || 'Указан в системе'}
                      </strong>
                    </div>
                    <div>
                      В/У:{' '}
                      <strong className="text-slate-800">
                        {order.driver_license || 'Указано в системе'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <AtiOrderDetailDocsPanel
              order={order}
              onUpdateDocFields={onUpdateDocFields}
              onOpenPowerOfAttorney={onOpenPowerOfAttorney}
            />
          </div>
        </div>

        {/* Подвал */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer transition text-xs"
            >
              Закрыть
            </button>
            {order.stage <= 5 && (
              <button
                type="button"
                onClick={() => onOpenCancelModal(order)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl font-black text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>✕</span>
                <span>Срыв заявки / Претензия</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {order.stage > 1 && (
              <button
                type="button"
                onClick={() => onUpdateStage(order.id, order.stage - 1)}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1 transition cursor-pointer"
              >
                <span>↶</span>
                <span>Назад на этап {order.stage - 1}</span>
              </button>
            )}

            {order.stage < 7 ? (
              <button
                type="button"
                disabled={order.stage === 5 && !isReady5}
                onClick={() => {
                  if (order.stage === 5 && !isReady5) {
                    alert('Заполните 3 пункта документооборота выше перед переводом в Дебиторку!');
                    return;
                  }
                  onUpdateStage(order.id, order.stage + 1);
                }}
                className={`px-5 py-2 rounded-xl font-black text-xs transition flex items-center gap-2 shadow-sm ${
                  order.stage === 5 && !isReady5
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : `${STAGE_CONFIG[order.stage]?.btnClass || ''} cursor-pointer active:scale-95`
                }`}
              >
                <span>
                  {order.stage === 5 && !isReady5
                    ? 'Заполните 3 пункта документов'
                    : STAGE_CONFIG[order.stage]?.btnForward || 'Далее →'}
                </span>
              </button>
            ) : (
              <span className="px-4 py-2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-black text-xs">
                ✓ Сделка закрыта и оплачена
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
