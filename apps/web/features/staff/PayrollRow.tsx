'use client';

import { useState, useRef, useEffect } from 'react';
import { Money, cn } from '@saldacargo/ui';
import { formatPhone } from '@saldacargo/shared';
import { ROLE_COLOR, ROLE_LABEL } from './constants';
import type { PayrollUser, UserRole } from './types';
import { parseUserNotesAndPassport } from './utils';
import { DriverPassportModal } from './DriverPassportModal';

export function PayrollRow({
  user,
  onSettle,
  onEdit,
  onDeactivate,
  onAdvance,
  onManualPay,
  onHistory,
  onAdjustDebt,
  onPayslip,
  onOpenShifts,
}: {
  user: PayrollUser;
  onSettle: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onAdvance?: () => void;
  onManualPay: () => void;
  onHistory: () => void;
  onAdjustDebt?: () => void;
  onPayslip?: () => void;
  onOpenShifts?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const deactivateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPassportModal, setShowPassportModal] = useState(false);
  const { noteText, passport } = parseUserNotesAndPassport(user);

  useEffect(() => {
    return () => {
      if (deactivateTimer.current) clearTimeout(deactivateTimer.current);
    };
  }, []);

  const debt = parseFloat(user.debt);
  const earned = parseFloat(user.earned);
  const advanceBalance = parseFloat(user.advance_balance ?? '0');
  const hasDebt = debt > 0;
  const hasAdvance = advanceBalance > 0;
  const isAdminOrOwner = user.roles.some((r) => r === 'owner' || r === 'admin');

  const handleDeactivate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!deactivateConfirm) {
      setDeactivateConfirm(true);
      deactivateTimer.current = setTimeout(() => setDeactivateConfirm(false), 4000);
    } else {
      if (deactivateTimer.current) clearTimeout(deactivateTimer.current);
      setDeactivateConfirm(false);
      onDeactivate();
    }
  };

  return (
    <div
      className={cn(
        'border-b border-slate-100 last:border-0 border-l-4',
        hasAdvance
          ? 'border-l-violet-400 bg-violet-50/20'
          : hasDebt
            ? 'border-l-amber-400 bg-amber-50/20'
            : 'border-l-emerald-300',
      )}
    >
      <div
        className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="w-60 shrink-0 min-w-0">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="font-bold text-slate-900 text-xs truncate block">{user.name}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 leading-tight overflow-hidden whitespace-nowrap">
            {user.roles.slice(0, 2).map((role) => (
              <span
                key={role}
                className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                  ROLE_COLOR[role as UserRole] ?? 'bg-slate-100 text-slate-500',
                )}
              >
                {ROLE_LABEL[role as UserRole] ?? role}
              </span>
            ))}
            {user.roles.length > 2 && (
              <span className="text-[9px] text-slate-400 font-bold shrink-0">
                +{user.roles.length - 2}
              </span>
            )}
            {user.auto_settle && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                день
              </span>
            )}
            {user.is_officially_employed && (
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0"
                title={`ТК РФ: выплата ${parseFloat(user.official_salary_amount || '22500').toLocaleString('ru-RU')} ₽ (налог 5 000 ₽ в долг 1-го числа)`}
              >
                💼 ТК РФ
              </span>
            )}
            {user.has_court_orders && (
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 shrink-0"
                title={`ФССП ${Math.round(parseFloat(user.court_order_pct || '50'))}% удержания: ${user.court_order_notes || 'Исполнительный лист'}`}
              >
                ⚖️ ФССП {Math.round(parseFloat(user.court_order_pct || '50'))}%
              </span>
            )}
            {user.accountable_hold && user.accountable_hold > 0 ? (
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shrink-0"
                title={`Подотчёт на руках: ${user.accountable_hold.toLocaleString('ru-RU')} ₽`}
              >
                💵 {user.accountable_hold.toLocaleString('ru-RU')} ₽
              </span>
            ) : null}
            {user.asset && (
              <span className="text-[10px] text-slate-400 font-mono truncate">
                {user.asset.reg_number}
              </span>
            )}
          </div>
        </div>

        <div className="w-16 shrink-0 text-center">
          <p className="text-xs font-black text-slate-800 leading-tight">
            {user.shifts > 0 ? user.shifts : '—'}
          </p>
          <p className="text-[9px] text-slate-400 uppercase tracking-wider leading-tight">смен</p>
        </div>

        <div className="w-28 shrink-0 text-right">
          {earned > 0 ? (
            <p className="text-xs font-bold text-slate-800 leading-tight">
              <Money amount={user.earned} />
            </p>
          ) : (
            <p className="text-xs text-slate-300 leading-tight">—</p>
          )}
          <p className="text-[9px] text-slate-400 leading-tight">начислено</p>
        </div>

        <div className="w-28 shrink-0 text-right">
          {parseFloat(user.paid) > 0 ? (
            <p className="text-xs font-bold text-emerald-600 leading-tight">
              <Money amount={user.paid} />
            </p>
          ) : (
            <p className="text-xs text-slate-300 leading-tight">—</p>
          )}
          <p className="text-[9px] text-slate-400 leading-tight">выплачено</p>
        </div>

        <div className="w-32 shrink-0 text-right">
          {hasDebt ? (
            <>
              <div className="flex items-center justify-end gap-1 leading-tight">
                <p className="text-xs font-black text-amber-600">
                  <Money amount={user.debt} />
                </p>
                {parseFloat(user.unconfirmed_debt) > 0 && (
                  <span
                    className="material-symbols-outlined text-rose-500 text-[13px]"
                    title="Не подтверждено сотрудником"
                  >
                    pending_actions
                  </span>
                )}
              </div>
              {hasAdvance ? (
                <p className="text-[9px] text-violet-600 font-bold leading-tight truncate">
                  аванс: <Money amount={user.advance_balance} />
                </p>
              ) : (
                <p className="text-[9px] text-slate-400 leading-tight">к выплате</p>
              )}
            </>
          ) : hasAdvance ? (
            <>
              <p className="text-xs font-black text-violet-600 leading-tight">
                <Money amount={user.advance_balance} />
              </p>
              <p className="text-[9px] text-violet-400 leading-tight">аванс долг</p>
            </>
          ) : earned > 0 ? (
            <>
              <p className="text-xs font-bold text-emerald-600 leading-tight">✓ 0 ₽</p>
              <p className="text-[9px] text-slate-400 leading-tight">расчёт закрыт</p>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-300 leading-tight">—</p>
              <p className="text-[9px] text-slate-400 leading-tight">&nbsp;</p>
            </>
          )}
        </div>

        <div className="flex-1 flex flex-col items-end justify-center min-w-[200px] leading-tight ml-auto">
          <div className="flex items-center gap-3">
            {hasDebt && !user.auto_settle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSettle();
                }}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                title="Рассчитаться с сотрудником"
              >
                Расчёт
              </button>
            )}
            {isAdminOrOwner && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onManualPay();
                }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                title="Выплатить заработную плату"
              >
                Выплата
              </button>
            )}
            {onAdvance && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdvance();
                }}
                className="text-xs font-bold text-violet-600 hover:text-violet-700 hover:underline cursor-pointer"
                title="Выдать аванс"
              >
                Аванс
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 mt-0.5">
            {onAdjustDebt && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjustDebt();
                }}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                title="Редактировать целевую сумму долга"
              >
                <span>✏️</span>
                <span>Долг</span>
              </button>
            )}
            {onOpenShifts && user.roles.includes('cleaner') && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenShifts();
                }}
                className="text-[11px] font-bold text-teal-700 hover:text-teal-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                title="Календарь смен и ставка (отметить дни работы)"
              >
                <span>📅</span>
                <span>Смены</span>
              </button>
            )}
            {onPayslip && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPayslip();
                }}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                title="Сформировать расчётный лист сотрудника"
              >
                <span>📄</span>
                <span>Лист</span>
              </button>
            )}
            <span
              className={cn(
                'material-symbols-outlined text-slate-300 text-[18px] shrink-0 transition-transform duration-200 ml-1',
                expanded && 'rotate-180',
              )}
            >
              expand_more
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 animate-in fade-in duration-150">
          {user.asset && (
            <span className="text-xs text-slate-600 font-semibold">
              🚛 {user.asset.short_name} ({user.asset.reg_number})
            </span>
          )}
          {user.max_user_id ? (
            <span className="text-xs text-slate-500">
              MAX: <span className="font-mono text-emerald-700">{user.max_user_id}</span>
            </span>
          ) : (
            <span className="text-xs text-rose-400 font-medium">MAX не привязан</span>
          )}
          {user.pin_code ? (
            <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-mono font-bold inline-flex items-center gap-1">
              🔒 PIN: {user.pin_code}
            </span>
          ) : (
            <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1">
              🔒 PIN не установлен
            </span>
          )}
          {user.phone && (
            <span className="text-xs text-slate-500 font-mono">📞 {formatPhone(user.phone)}</span>
          )}
          {noteText && (
            <span className="text-xs text-slate-500 italic max-w-xs truncate" title={noteText}>
              {noteText}
            </span>
          )}
          {passport && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowPassportModal(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors cursor-pointer shrink-0"
              title="Посмотреть паспорт и водительские данные"
            >
              <span>🪪</span>
              <span>
                {passport.passport_series && passport.passport_number
                  ? `Паспорт ${passport.passport_series} ${passport.passport_number}`
                  : 'Документы'}
              </span>
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {onOpenShifts && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenShifts();
                }}
                className={cn(
                  'text-xs font-bold rounded-lg py-1 px-3 transition-colors flex items-center gap-1 border cursor-pointer',
                  user.roles.includes('cleaner')
                    ? 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
                )}
                title="Календарь смен и ставка"
              >
                <span>📅</span>
                <span>Табель смен</span>
              </button>
            )}
            {onPayslip && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPayslip();
                }}
                className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg py-1 px-3 transition-colors flex items-center gap-1"
              >
                <span>📄</span>
                <span>Расчётный лист</span>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHistory();
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg py-1 px-3 transition-colors"
            >
              История
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg py-1 px-3 transition-colors"
            >
              Изменить
            </button>
            <button
              onClick={handleDeactivate}
              className={cn(
                'text-xs font-bold px-3 py-1 rounded-lg border transition-all',
                deactivateConfirm
                  ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                  : 'text-slate-400 border-slate-200 hover:text-rose-600 hover:border-rose-300',
              )}
            >
              {deactivateConfirm ? 'Ещё раз — деактивировать!' : 'Деактивировать'}
            </button>
          </div>
        </div>
      )}

      {showPassportModal && passport && (
        <DriverPassportModal
          user={user}
          passport={passport}
          onClose={() => setShowPassportModal(false)}
        />
      )}
    </div>
  );
}
