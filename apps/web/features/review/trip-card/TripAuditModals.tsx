'use client';

import type { auditTripFuel, TripWialonAudit } from '@saldacargo/shared';
import type { TripForReview } from '../types';

export function TripFuelAuditModal({
  trip,
  fuelAudit,
  onClose,
}: {
  trip: TripForReview;
  fuelAudit: ReturnType<typeof auditTripFuel>;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-base">
              ⚠️
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                Контроль расхода ГСМ
              </h3>
              <p className="text-[11px] text-slate-500">
                Рейс #{trip.trip_number} · {trip.asset?.short_name} ({trip.asset?.reg_number})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900 leading-relaxed">
          {fuelAudit.badgeText}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Емкость бака
            </span>
            <span className="text-slate-800 font-bold">{fuelAudit.tankCapacity} л</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              В баке зафиксировано
            </span>
            <span className="text-slate-800 font-bold">
              {fuelAudit.isCalibrated ? `${fuelAudit.currentTankLiters} л` : 'Не калибровался'}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Заправлено в рейсе
            </span>
            <span className="text-slate-800 font-bold">{fuelAudit.totalFuelAddedLiters} л</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Пробег рейса
            </span>
            <span className="text-slate-800 font-bold">{fuelAudit.mileageKm} км</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Расход по норме
            </span>
            <span className="text-slate-800 font-bold">
              {fuelAudit.fuelConsumedLiters} л ({fuelAudit.ratePer100Km} л/100км)
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Расчётный остаток
            </span>
            <span className="text-slate-800 font-bold">{fuelAudit.estimatedRemainingLiters} л</span>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}

export function TripWialonAuditModal({
  trip,
  wialonAudit,
  isApplying,
  onApply,
  onClose,
}: {
  trip: TripForReview;
  wialonAudit: TripWialonAudit;
  isApplying: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 border border-slate-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-base">
              📡
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                Телеметрия Wialon (CAN / GPS)
              </h3>
              <p className="text-[11px] text-slate-500">
                Рейс #{trip.trip_number} · {trip.asset?.short_name} ({trip.asset?.reg_number})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Введено сотрудником
            </span>
            <span className="text-base font-black text-slate-800">{wialonAudit.enteredKm} км</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              одометр {trip.odometer_start || 0} → {trip.odometer_end || 0}
            </span>
          </div>
          <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            <span className="text-[10px] text-amber-700 uppercase font-bold block">
              По данным Wialon
            </span>
            <span className="text-base font-black text-amber-900">{wialonAudit.wialonKm} км</span>
            <span className="text-[11px] text-amber-700 block mt-0.5">
              одометр {wialonAudit.odoStart} → {wialonAudit.odoEnd}
            </span>
          </div>
        </div>

        {wialonAudit.hasDiscrepancy ? (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900 leading-relaxed flex items-start gap-2">
            <span className="text-base shrink-0">⚠️</span>
            <div>
              Обнаружено расхождение: {wialonAudit.diffKm} км!
              <div className="text-[11px] font-normal text-rose-800 mt-0.5">
                Сотрудник указал {wialonAudit.enteredKm} км, а бортовой трекер зафиксировал{' '}
                {wialonAudit.wialonKm} км.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 leading-relaxed flex items-center gap-2">
            <span className="text-base shrink-0">✓</span>
            <div>Одометр рейса полностью совпадает с Wialon ({wialonAudit.wialonKm} км).</div>
          </div>
        )}

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Расчет нормативов по Wialon ({wialonAudit.wialonKm} км):
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-600">Расход топлива (18 л / 100 км):</span>
            <span className="font-bold text-slate-900">{wialonAudit.normLiters} л</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-600">Стоимость ГСМ (по тарифу 82 ₽/л):</span>
            <span className="font-bold text-rose-600">
              {wialonAudit.normCost.toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-t border-slate-200/60 pt-1">
            <span className="text-slate-600">Зарплата водителя (10 ₽/км + суточные):</span>
            <span className="font-bold text-emerald-600">
              {wialonAudit.driverPay.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Закрыть
          </button>
          <button
            type="button"
            disabled={isApplying}
            onClick={() => {
              onApply();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">sync</span>
            <span>
              {isApplying ? 'Применение...' : `Применить Wialon (${wialonAudit.wialonKm} км)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
