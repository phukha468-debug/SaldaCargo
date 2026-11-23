'use client';

import type { emptyForm } from '../constants';

type CreateOrderForm = typeof emptyForm;

export function CreateOrderExternalFields({
  form,
  set,
  totalExternalCost,
}: {
  form: CreateOrderForm;
  set: <K extends keyof CreateOrderForm>(field: K, value: CreateOrderForm[K]) => void;
  totalExternalCost: number;
}) {
  return (
    <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-3.5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Дата ремонта *</label>
          <input
            type="date"
            value={form.order_date}
            onChange={(e) => set('order_date', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-medium"
          />
          <span className="text-[10px] text-slate-400">Можно указать прошлую дату</span>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Акт / наряд №</label>
          <input
            value={form.external_doc_number}
            onChange={(e) => set('external_doc_number', e.target.value)}
            placeholder="№ 452"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">
          Исполнитель / Сервис *
        </label>
        <input
          value={form.contractor_name}
          onChange={(e) => set('contractor_name', e.target.value)}
          placeholder="Например, ООО Дизель-Сервис, Мастер по КПП..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">
          Что ремонтировали *
        </label>
        <textarea
          value={form.problem_description}
          onChange={(e) => set('problem_description', e.target.value)}
          rows={2}
          placeholder="Например, Капитальный ремонт двигателя Д-245, замена поршневой..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">
            Стоимость работ (₽)
          </label>
          <input
            type="number"
            value={form.works_cost}
            onChange={(e) => set('works_cost', e.target.value)}
            placeholder="0"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-bold"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">
            Стоимость запчастей (₽)
          </label>
          <input
            type="number"
            value={form.parts_cost}
            onChange={(e) => set('parts_cost', e.target.value)}
            placeholder="0"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-bold"
          />
        </div>
      </div>

      {totalExternalCost > 0 && (
        <div className="bg-purple-100/70 p-3 rounded-lg flex items-center justify-between text-xs">
          <span className="font-bold text-purple-900">Итого расход автопарка:</span>
          <span className="font-black text-purple-700 text-sm">
            {totalExternalCost.toLocaleString('ru-RU')} ₽
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="ext_completed"
          checked={form.is_completed}
          onChange={(e) => set('is_completed', e.target.checked)}
          className="w-4 h-4 text-purple-600 rounded"
        />
        <label
          htmlFor="ext_completed"
          className="text-xs text-slate-700 font-semibold cursor-pointer"
        >
          Ремонт завершён и оплачен (сразу в архив и P&L)
        </label>
      </div>

      {form.is_completed && form.machine_type === 'own' && totalExternalCost > 0 && (
        <div className="bg-white p-3 rounded-xl border border-purple-200 space-y-1.5 shadow-2xs">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <span>💵</span> Источник списания оплаты (Кошелёк)
          </label>
          <select
            value={form.payment_wallet_id}
            onChange={(e) => set('payment_wallet_id', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-slate-50 font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="10000000-0000-0000-0000-000000000002">
              💵 Сейф (Наличные ТК) — списать из кассы
            </option>
            <option value="10000000-0000-0000-0000-000000000001">
              🏦 Расчётный счёт (Т-Банк) — безналичный расчёт
            </option>
            <option value="none">🚫 Без списания (уже учтено в выписке / личные средства)</option>
          </select>
          <p className="text-[10px] text-slate-500">
            Сумма {totalExternalCost.toLocaleString('ru-RU')} ₽ сразу отобразится в Дневном контроле
            и уменьшит остаток выбранного счёта.
          </p>
        </div>
      )}
    </div>
  );
}
