'use client';

import { useState } from 'react';
import { Money, cn } from '@saldacargo/ui';
import type { ReviewServiceOrder } from '../types';
import { calcGarageOrder, formatOrderDateRange } from '../utils';
import { GarageOrderExpandedDetails } from './GarageOrderExpandedDetails';

export function GarageOrderRow({
  order,
  expanded,
  onToggle,
  onEdit,
  onApprove,
  onReturn,
  onDelete,
  onApproveExternal,
  approving,
  deleting,
}: {
  order: ReviewServiceOrder;
  expanded: boolean;
  onToggle: () => void;
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
  const calc = calcGarageOrder(order);
  const {
    isOwn,
    isExternal,
    contractorName,
    worksSum,
    mechanicPay,
    partsUnitSum,
    partsMargin,
    totalRevenue,
    billedToCarrier,
    netProfit,
  } = calc;

  const initialOrg = contractorName && contractorName !== 'Стороннее СТО' ? contractorName : '';
  const initialTitle =
    (order.problem_description || '')
      .replace(/\[Сторонний сервис(?::\s*[^\]]+)?\]/i, '')
      .replace(/\[РЕЙС_НА_РЕМОНТ\]/i, '')
      .trim() ||
    order.works?.[0]?.custom_work_name ||
    'Ремонт на СТО';
  const initialAmount = worksSum > 0 ? String(worksSum) : '';

  const [extOrg, setExtOrg] = useState(initialOrg);
  const [extTitle, setExtTitle] = useState(initialTitle);
  const [extAmount, setExtAmount] = useState(initialAmount);
  const [showExternalForm, setShowExternalForm] = useState(isExternal);

  const odo = order.odometer_end || order.odometer_start;
  const canReview = order.lifecycle_status === 'draft' || order.lifecycle_status === 'returned';

  const vehicleTitle = isOwn
    ? `${order.asset?.short_name ?? 'Свой ТС'} (${order.asset?.reg_number ?? '—'})`
    : `${order.client_vehicle_model || order.client_vehicle_brand || 'Клиентский авто'} · ${order.client_vehicle_reg || 'без номера'}`;

  const cleanMechanicNote = (order.mechanic_note || '')
    .replace('[Запчасти предоставил автосервис]', '')
    .trim();

  const accentColor = isExternal
    ? 'border-l-amber-500'
    : isOwn
      ? 'border-l-sky-500'
      : netProfit > 0
        ? 'border-l-emerald-500'
        : netProfit < 0
          ? 'border-l-rose-500'
          : 'border-l-slate-300';

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md border-l-4',
        accentColor,
      )}
    >
      {/* Свернутая строка (Dense 1-Line Layout) */}
      <div
        className="px-4 py-2.5 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="font-mono text-xs font-black text-sky-900 shrink-0 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded">
              НЗ-{order.order_number}
            </span>
            {isExternal ? (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 bg-amber-50 text-amber-800 border border-amber-300">
                🏢 СТО: {contractorName}
              </span>
            ) : (
              <span
                className={cn(
                  'text-[10px] font-black px-1.5 py-0.5 rounded shrink-0',
                  isOwn
                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                )}
              >
                {isOwn ? '🏢 Свой' : '🚗 Клиент'}
              </span>
            )}
            <span
              className="font-bold text-slate-900 text-sm truncate max-w-[190px]"
              title={vehicleTitle}
            >
              {vehicleTitle}
            </span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-xs text-slate-600 font-semibold truncate max-w-[160px]">
              {isExternal ? (
                <span className="text-amber-800 font-bold">СТО (чужими силами)</span>
              ) : (
                <>
                  👨‍🔧 {order.mechanic?.name?.split(' ')[0] ?? '—'}
                  {order.second_mechanic && ` + ${order.second_mechanic?.name?.split(' ')[0]}`}
                </>
              )}
            </span>
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0',
                order.lifecycle_status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800'
                  : order.lifecycle_status === 'returned'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800',
              )}
            >
              {order.lifecycle_status === 'approved'
                ? '✓ Закрыт'
                : order.lifecycle_status === 'returned'
                  ? '↩ Доработка'
                  : '⏳ Ревью'}
            </span>
            <span className="text-[10px] text-slate-400 font-medium shrink-0 hidden md:block">
              {formatOrderDateRange(order.started_at, order.completed_at, order.created_at)}
            </span>
          </div>

          <div className="shrink-0 flex items-center">
            <div className="w-[90px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                {isExternal ? 'Сумма СТО' : isOwn ? 'Работы' : 'Выручка'}
              </span>
              <span className="text-sm font-bold text-slate-700">
                <Money amount={(isOwn ? worksSum : totalRevenue).toFixed(2)} />
              </span>
            </div>
            <span className="w-4 text-center text-slate-200 text-sm">−</span>
            <div className="w-[105px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                {isExternal ? 'ЗП Слесаря' : order.second_mechanic ? 'ЗП Механиков' : 'ЗП Механика'}
              </span>
              <span
                className={cn(
                  'text-sm font-bold',
                  isExternal ? 'text-slate-400' : 'text-amber-600',
                )}
              >
                {isExternal ? (
                  '0 ₽'
                ) : (
                  <Money
                    amount={(
                      mechanicPay + (parseFloat(order.second_mechanic_pay || '0') || 0)
                    ).toFixed(2)}
                  />
                )}
              </span>
            </div>
            <span className="w-4 text-center text-slate-200 text-sm">+</span>
            <div className="w-[90px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                {isOwn ? 'Запчасти' : 'Маржа з/ч'}
              </span>
              <span
                className={cn('text-sm font-bold', isOwn ? 'text-slate-700' : 'text-emerald-600')}
              >
                {isOwn ? (
                  <Money amount={partsUnitSum.toFixed(2)} />
                ) : (
                  <Money amount={partsMargin.toFixed(2)} />
                )}
              </span>
            </div>
            <span className="w-4 text-center text-slate-200 text-sm">=</span>
            <div className="w-[105px] text-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                {isOwn ? 'Счёт перевозчику' : 'Прибыль СТО'}
              </span>
              {isOwn ? (
                <span
                  className="text-sm font-black text-sky-900 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md inline-block"
                  title={`Сумма счёта СТО на автопарк: ${Math.round(billedToCarrier).toLocaleString('ru-RU')} ₽\nРеальной чистой прибыли нет — это затраты на ремонт парка`}
                >
                  <Money amount={billedToCarrier.toFixed(2)} />
                </span>
              ) : (
                <span
                  className={cn(
                    'text-base font-black',
                    netProfit > 0
                      ? 'text-emerald-600'
                      : netProfit < 0
                        ? 'text-rose-600'
                        : 'text-slate-500',
                  )}
                  title={`Реальная чистая прибыль гаража с клиента: ${Math.round(netProfit).toLocaleString('ru-RU')} ₽`}
                >
                  {netProfit < 0 ? '−' : ''}
                  <Money amount={Math.abs(netProfit).toFixed(2)} />
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
              title="Редактировать наряд"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <span
              className={cn(
                'material-symbols-outlined text-slate-300 text-[20px] transition-transform duration-300',
                expanded ? 'rotate-180' : '',
              )}
            >
              expand_more
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <GarageOrderExpandedDetails
          order={order}
          calc={calc}
          odo={odo}
          canReview={canReview}
          cleanMechanicNote={cleanMechanicNote}
          showExternalForm={showExternalForm}
          setShowExternalForm={setShowExternalForm}
          extOrg={extOrg}
          setExtOrg={setExtOrg}
          extTitle={extTitle}
          setExtTitle={setExtTitle}
          extAmount={extAmount}
          setExtAmount={setExtAmount}
          onEdit={onEdit}
          onApprove={onApprove}
          onReturn={onReturn}
          onDelete={onDelete}
          onApproveExternal={onApproveExternal}
          approving={approving}
          deleting={deleting}
        />
      )}
    </div>
  );
}
