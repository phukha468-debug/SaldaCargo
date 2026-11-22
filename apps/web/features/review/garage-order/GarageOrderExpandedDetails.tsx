'use client';

import { Money } from '@saldacargo/ui';
import type { ReviewServiceOrder } from '../types';
import { formatOrderDateRange, type calcGarageOrder } from '../utils';

type CalcGarageResult = ReturnType<typeof calcGarageOrder>;

export function GarageOrderExpandedDetails({
  order,
  calc,
  odo,
  canReview,
  cleanMechanicNote,
  showExternalForm,
  setShowExternalForm,
  extOrg,
  setExtOrg,
  extTitle,
  setExtTitle,
  extAmount,
  setExtAmount,
  onEdit,
  onApprove,
  onReturn,
  onDelete,
  onApproveExternal,
  approving,
  deleting,
}: {
  order: ReviewServiceOrder;
  calc: CalcGarageResult;
  odo: number | null | undefined;
  canReview: boolean;
  cleanMechanicNote: string;
  showExternalForm: boolean;
  setShowExternalForm: (v: boolean) => void;
  extOrg: string;
  setExtOrg: (v: string) => void;
  extTitle: string;
  setExtTitle: (v: string) => void;
  extAmount: string;
  setExtAmount: (v: string) => void;
  onEdit: () => void;
  onApprove: () => void;
  onReturn: () => void;
  onDelete: () => void;
  onApproveExternal?: (
    orderId: string,
    externalOrg: string,
    externalTitle: string,
    externalAmount: number,
  ) => void;
  approving: boolean;
  deleting: boolean;
}) {
  const {
    isOwn,
    isExternal,
    contractorName,
    hourlyRate,
    salaryPct,
    activeWorks,
    parts,
    worksSum,
    mechanicPay,
    partsUnitSum,
    partsClientSum,
    partsMargin,
  } = calc;

  return (
    <div className="animate-in fade-in slide-in-from-top-1 duration-200 border-t border-slate-100 p-4 sm:p-5 space-y-4 bg-slate-50/40">
      {/* Верхняя плашка с датами, одометром и тарифом */}
      {isExternal ? (
        <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3 rounded-xl border border-amber-300/80 text-xs text-slate-700">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">
                СТО / Исполнитель
              </span>
              <span className="font-bold text-amber-950">🏢 {contractorName}</span>
            </div>
            {odo && (
              <div>
                <span className="text-slate-400 font-bold block uppercase text-[10px]">
                  Пробег перегона
                </span>
                <span className="font-bold text-slate-800">
                  🛣 {Number(odo).toLocaleString('ru-RU')} км
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">
                Формат ремонта
              </span>
              <span className="font-bold text-slate-800">
                Сторонний сервис вне Салды (чужими силами)
              </span>
            </div>
          </div>

          <div className="text-right bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              ЗП слесарям автопарка
            </span>
            <span className="font-black text-slate-400 text-sm">0 ₽ (нет начислений)</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">
                Период выполнения
              </span>
              <span className="font-bold text-slate-800">
                📅 {formatOrderDateRange(order.started_at, order.completed_at, order.created_at)}
              </span>
            </div>
            {odo && (
              <div>
                <span className="text-slate-400 font-bold block uppercase text-[10px]">
                  Пробег / Одометр
                </span>
                <span className="font-bold text-slate-800">
                  🛣 {Number(odo).toLocaleString('ru-RU')} км
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">
                Тариф нормо-часа
              </span>
              <span className="font-bold text-slate-800">
                {hourlyRate.toLocaleString('ru-RU')} ₽/ч ({isOwn ? 'Свой парк' : 'Клиент'})
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">
                Ставка механика
              </span>
              <span className="font-bold text-emerald-700">{salaryPct}% от работ</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] font-black uppercase text-emerald-800 block">
                ЗП: {order.mechanic?.name?.split(' ')[0] ?? 'Механик 1'}
              </span>
              <span className="font-black text-emerald-700 text-sm">
                <Money amount={mechanicPay.toFixed(2)} />
              </span>
            </div>
            {order.second_mechanic && (
              <div className="text-right bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] font-black uppercase text-sky-800 block">
                  ЗП: {order.second_mechanic?.name?.split(' ')[0] ?? 'Механик 2'}
                </span>
                <span className="font-black text-sky-700 text-sm">
                  <Money amount={(parseFloat(order.second_mechanic_pay || '0') || 0).toFixed(2)} />
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Форма быстрого закрытия стороннего ремонта (СТО) */}
      {canReview && showExternalForm && (
        <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏢</span>
              <div>
                <h4 className="font-black text-xs text-amber-950 uppercase tracking-wide">
                  Ремонт сторонними силами (СТО / Сервис вне Салды)
                </h4>
                <p className="text-[11px] text-amber-800">
                  Введите данные по счёту СТО — наряд сразу будет утверждён и перенесён в Архив с
                  фиксацией расхода на автопарк:
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-black text-[10px] uppercase">
                ЗП слесарям: 0 ₽
              </span>
              {!isExternal && (
                <button
                  type="button"
                  onClick={() => setShowExternalForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  ✕ Отмена
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                1. Организация (где делали ремонт) *
              </label>
              <input
                type="text"
                placeholder="напр. ООО «Восточный Ветер» или СТО Заречный"
                value={extOrg}
                onChange={(e) => setExtOrg(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:border-amber-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                2. Наименование ремонта *
              </label>
              <input
                type="text"
                placeholder="напр. Замена сцепления, ремонт редуктора"
                value={extTitle}
                onChange={(e) => setExtTitle(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:border-amber-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                3. Общая сумма ремонта (₽) *
              </label>
              <input
                type="number"
                placeholder="Сумма по счёту / чеку"
                value={extAmount}
                onChange={(e) => setExtAmount(e.target.value)}
                className="w-full text-xs font-black bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:border-amber-500 shadow-2xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500 italic">
              ✓ Автоматически созданный заказ-наряд уходит с ревью в Архив
            </span>
            <button
              type="button"
              disabled={approving || !extOrg.trim() || !extAmount || Number(extAmount) <= 0}
              onClick={() => {
                if (onApproveExternal) {
                  onApproveExternal(order.id, extOrg, extTitle, Number(extAmount) || 0);
                }
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{approving ? 'Сохранение...' : '✓ Утвердить сторонний ремонт (В архив)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Перечень выполненных работ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-500">
          <span>
            {isExternal
              ? 'Выполненные работы СТО'
              : `Перечень выполненных работ (${activeWorks.length})`}
          </span>
          <span>
            Итого по работам:{' '}
            <span className="text-slate-900 font-black">
              <Money amount={worksSum.toFixed(2)} />
            </span>
          </span>
        </div>
        {activeWorks.length === 0 ? (
          <p className="text-sm text-slate-500 italic bg-white p-3 rounded-xl border border-slate-200">
            {order.problem_description || 'Работы не указаны'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {activeWorks.map((w, idx) => {
              const mins =
                Number(w.actual_minutes || w.norm_minutes || 0) *
                Math.max(1, Number(w.quantity || 1));
              const wPrice =
                parseFloat(w.price_client || '0') > 0
                  ? parseFloat(w.price_client!)
                  : (mins / 60) * hourlyRate;
              const customPctMatch = w.notes
                ? String(w.notes).match(/\[salary_pct:(\d+(?:\.\d+)?)\]/)
                : null;
              const wPct =
                customPctMatch && customPctMatch[1] ? parseFloat(customPctMatch[1]) : salaryPct;
              const isBoth = Boolean(w.second_mechanic_id);
              const isSecondOnly =
                order.second_mechanic &&
                w.mechanic_id === order.second_mechanic.id &&
                !w.second_mechanic_id;
              const performerLabel = isBoth
                ? '👥 Вдвоём 50/50'
                : isSecondOnly
                  ? `👤 ${order.second_mechanic?.name?.split(' ')[0] ?? 'Второй'}`
                  : order.second_mechanic
                    ? `👤 ${order.mechanic?.name?.split(' ')[0] ?? 'Основной'}`
                    : null;
              const wPay = (wPrice * wPct) / 100;
              return (
                <div
                  key={w.id || idx}
                  className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {idx + 1}.{' '}
                      {w.custom_work_name || w.work_catalog?.name || w.work_description || 'Работа'}
                    </p>
                    <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                      <p className="text-xs font-extrabold text-emerald-700">
                        ⏱ {mins} мин · ЗП: {Math.round(wPay).toLocaleString('ru-RU')} ₽
                      </p>
                      {performerLabel && (
                        <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                          {performerLabel}
                        </span>
                      )}
                      {customPctMatch && (
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                          {wPct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-800 whitespace-nowrap bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                    {Math.round(wPrice).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Запчасти автосервиса */}
      {parts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-600">☑</span>
              <span>Запчасти сервиса ({parts.length})</span>
            </span>
            <span className={isOwn ? 'text-slate-600 font-bold' : 'text-emerald-700 font-black'}>
              {isOwn
                ? `Запчасти автопарка: ${Math.round(partsUnitSum).toLocaleString('ru-RU')} ₽`
                : `Заработок на запчастях: +${Math.round(partsMargin).toLocaleString('ru-RU')} ₽`}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2">Запчасть</th>
                  <th className="px-3 py-2 text-center">Кол-во</th>
                  <th className="px-3 py-2 text-right">Закупка</th>
                  <th className="px-3 py-2 text-right">Клиенту (+30%)</th>
                  <th className="px-3.5 py-2 text-right">
                    {isOwn ? 'Себестоимость' : 'Заработок СТО'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parts.map((p, idx) => {
                  const qty = p.quantity || 1;
                  const uPrice = parseFloat(p.unit_price || '0') || 0;
                  const cPrice =
                    p.client_price !== undefined &&
                    p.client_price !== null &&
                    String(p.client_price).trim() !== ''
                      ? parseFloat(String(p.client_price)) || 0
                      : uPrice;
                  const margin = Math.max(0, (cPrice - uPrice) * qty);
                  const markupPct = uPrice > 0 ? Math.round(((cPrice - uPrice) / uPrice) * 100) : 0;

                  return (
                    <tr key={p.id || idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900">
                        {idx + 1}. {p.custom_part_name || p.part?.name || 'Запчасть'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-600">
                        {qty} {p.unit || p.part?.unit || 'шт'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-slate-500">
                        {uPrice > 0 ? `${(uPrice * qty).toLocaleString('ru-RU')} ₽` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                        <span>{(cPrice * qty).toLocaleString('ru-RU')} ₽</span>
                        {markupPct > 0 && !isOwn && (
                          <span className="ml-1.5 text-[9px] font-black bg-amber-100 text-amber-800 px-1 py-0.5 rounded">
                            +{markupPct}%
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-black text-emerald-700">
                        {isOwn
                          ? '—'
                          : margin > 0
                            ? `+${Math.round(margin).toLocaleString('ru-RU')} ₽`
                            : '0 ₽'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/70 border-t border-slate-200 font-bold text-slate-700">
                <tr>
                  <td colSpan={2} className="px-3.5 py-2 text-[11px] font-black uppercase">
                    Итого запчасти
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {Math.round(partsUnitSum).toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="px-3 py-2 text-right font-black text-slate-900">
                    {Math.round(partsClientSum).toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="px-3.5 py-2 text-right font-black text-emerald-700">
                    {isOwn ? '—' : `+${Math.round(partsMargin).toLocaleString('ru-RU')} ₽`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Заметки */}
      {(cleanMechanicNote || order.admin_note) && (
        <div className="flex flex-wrap gap-2.5 text-xs">
          {cleanMechanicNote && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl font-medium">
              💬 Комментарий механика: <span className="font-bold">{cleanMechanicNote}</span>
            </div>
          )}
          {order.admin_note && (
            <div className="bg-slate-100 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl font-medium">
              📌 Заметка руководителя: <span className="font-bold">{order.admin_note}</span>
            </div>
          )}
        </div>
      )}

      {/* Кнопки действий */}
      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <span>✏️ Редактировать</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={approving || deleting}
            className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-600 cursor-pointer disabled:opacity-50 transition-colors"
          >
            {deleting ? '...' : '🗑️ Удалить'}
          </button>
        </div>

        {canReview && (
          <div className="flex items-center gap-2">
            {!showExternalForm && isOwn && (
              <button
                type="button"
                onClick={() => setShowExternalForm(true)}
                className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-900 cursor-pointer transition-colors"
              >
                🏢 Это ремонт стороннего СТО
              </button>
            )}
            <button
              type="button"
              onClick={onReturn}
              disabled={approving}
              className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 cursor-pointer disabled:opacity-50 transition-colors"
            >
              ↩ На доработку
            </button>
            {!isExternal ? (
              <button
                type="button"
                onClick={onApprove}
                disabled={approving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
              >
                {approving ? 'Утверждаем...' : '✓ Утвердить наряд (начислить ЗП)'}
              </button>
            ) : (
              <button
                type="button"
                disabled={approving || !extOrg.trim() || !extAmount || Number(extAmount) <= 0}
                onClick={() => {
                  if (onApproveExternal) {
                    onApproveExternal(order.id, extOrg, extTitle, Number(extAmount) || 0);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
              >
                {approving ? 'Сохранение...' : '✓ Утвердить сторонний ремонт (В архив)'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
