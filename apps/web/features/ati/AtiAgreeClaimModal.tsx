'use client';

import type { AgreeClaimState } from './types';

export function AtiAgreeClaimModal({
  agreeingClaim,
  isPending,
  onChange,
  onConfirm,
  onClose,
}: {
  agreeingClaim: AgreeClaimState;
  isPending: boolean;
  onChange: (next: AgreeClaimState) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const freight = Number(agreeingClaim.order.price || 30000);
  const tenP = Math.round(freight * 0.1);
  const fifteenP = Math.round(freight * 0.15);
  const twentyP = Math.round(freight * 0.2);
  const currentNum = Number(agreeingClaim.amount) || 0;
  const pct = freight > 0 ? Math.round((currentNum / freight) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚖️</span>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide">
                {agreeingClaim.order.claim_status === 'issued'
                  ? 'Согласование претензии'
                  : 'Изменение суммы претензии'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Претензия № {agreeingClaim.order.claim_number || '01-ПР'} ·{' '}
                {agreeingClaim.order.order_number}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
            <div className="flex justify-between items-center text-slate-600">
              <span>Контрагент (Заказчик):</span>
              <strong className="text-slate-900 text-right">
                {agreeingClaim.order.counterparty_name}
              </strong>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Стоимость фрахта по заявке:</span>
              <span className="font-mono font-bold text-slate-900">
                {freight.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 border-t border-slate-200/80 pt-1">
              <span>Текущая сумма претензии:</span>
              <span className="font-mono font-bold text-amber-900">
                {Number(agreeingClaim.order.claim_amount || 6000).toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-700 block mb-1.5">
              Быстрый выбор согласованной суммы:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...agreeingClaim,
                    amount: String(tenP),
                    notes: 'Согласовано 10% от фрахта без бюрократических проволочек',
                  })
                }
                className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                  currentNum === tenP
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-xs'
                    : 'border-slate-200 hover:border-indigo-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-indigo-700">⭐ 10% (Рекомендовано)</span>
                  <span className="font-mono font-bold text-xs">
                    {tenP.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                  Без бюрократических проволочек
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...agreeingClaim,
                    amount: String(fifteenP),
                    notes: 'Согласовано 15% от фрахта по обоюдному согласию',
                  })
                }
                className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                  currentNum === fifteenP
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-xs'
                    : 'border-slate-200 hover:border-indigo-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-slate-800">15%</span>
                  <span className="font-mono font-bold text-xs">
                    {fifteenP.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                  Компромиссная сумма
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...agreeingClaim,
                    amount: String(twentyP),
                    notes: 'Стандартный штраф 20% по УАТ РФ',
                  })
                }
                className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                  currentNum === twentyP
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-xs'
                    : 'border-slate-200 hover:border-indigo-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-slate-800">20% (УАТ РФ)</span>
                  <span className="font-mono font-bold text-xs">
                    {twentyP.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                  Полный законный штраф
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...agreeingClaim,
                    amount: String(freight),
                    notes: '100% компенсация полной стоимости фрахта',
                  })
                }
                className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                  currentNum === freight
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-xs'
                    : 'border-slate-200 hover:border-indigo-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-slate-800">100% Фрахт</span>
                  <span className="font-mono font-bold text-xs">
                    {freight.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                  Полная оплата рейса
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-700 block mb-1">
              Итоговая согласованная сумма к взысканию (₽):
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="500"
                value={agreeingClaim.amount}
                onChange={(e) => onChange({ ...agreeingClaim, amount: e.target.value })}
                className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 focus:border-indigo-600 rounded-xl font-mono font-black text-base text-slate-900 outline-none"
                placeholder="3000"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                ₽
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                Составляет <strong>{pct}%</strong> от стоимости рейса (
                {freight.toLocaleString('ru-RU')} ₽)
              </span>
              {pct === 10 && (
                <span className="text-emerald-700 font-bold">✓ Согласованные 10%</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Примечание к соглашению (необязательно):
            </label>
            <input
              type="text"
              value={agreeingClaim.notes}
              onChange={(e) => onChange({ ...agreeingClaim, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 focus:border-indigo-600 rounded-xl text-xs text-slate-800"
              placeholder="например: Согласовано 10% от фрахта без бюрократических проволочек"
            />
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-950">
            <span className="text-base shrink-0">💡</span>
            <p className="text-[11px] leading-relaxed">
              Сумма <strong>{currentNum.toLocaleString('ru-RU')} ₽</strong> будет зафиксирована в
              заявке и автоматически отразится в <strong>Дебиторке</strong> заказчика «
              {agreeingClaim.order.counterparty_name}».
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={isPending || !agreeingClaim.amount}
              onClick={onConfirm}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>✓</span>
              <span>
                {agreeingClaim.order.claim_status === 'issued'
                  ? `Согласовать и отправить ${currentNum.toLocaleString('ru-RU')} ₽ в Дебиторку`
                  : `Сохранить ${currentNum.toLocaleString('ru-RU')} ₽ в Дебиторке`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
