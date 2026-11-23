'use client';

import { useEffect, useState } from 'react';
import { EditTxWarehouseSection } from './EditTxWarehouseSection';
import {
  BANK_ID,
  CASH_ID,
  FUEL_CARD_ID,
  type CategoryItem,
  type EditingTxState,
  type GaragePartOption,
  type ModalWarehouseEntry,
  type PaymentCalendarItem,
} from './types';
import type { CategorizePayload } from './useDailyControlData';
import { detectBrandFromText, getFilteredCategories, rub } from './utils';

function initWarehouseState(
  tx: EditingTxState,
  categories: CategoryItem[],
): { enabled: boolean; items: ModalWarehouseEntry[] } {
  const desc = tx.description || '';
  const catName = tx.categoryName || categories.find((c) => c.id === tx.categoryId)?.name || '';
  const isParts = catName.toLowerCase().includes('запчаст') && tx.direction !== 'income';
  const autoBrand = detectBrandFromText(desc);

  if (!isParts) {
    return { enabled: false, items: [] };
  }

  if (tx.warehouseParts && tx.warehouseParts.length > 0) {
    return {
      enabled: true,
      items: tx.warehouseParts.map((p, idx) => ({
        id: p.id || p.movement_id || `wh-${idx}-${Date.now()}`,
        brand: p.brand || autoBrand,
        clientCarModel:
          p.clientCarModel || p.client_car_model || (p.brand === 'client' ? 'Нива' : ''),
        name: p.name || desc,
        article: p.article || '',
        quantity: Math.max(1, p.quantity || 1),
        unitPrice: p.unit_price ?? '',
      })),
    };
  }

  if (tx.warehousePart) {
    return {
      enabled: true,
      items: [
        {
          id: `wh-${Date.now()}`,
          brand: tx.warehousePart.brand || autoBrand,
          clientCarModel:
            tx.warehousePart.clientCarModel ||
            tx.warehousePart.client_car_model ||
            (tx.warehousePart.brand === 'client' ? 'Нива' : ''),
          name: tx.warehousePart.name || desc,
          article: tx.warehousePart.article || '',
          quantity: Math.max(1, tx.warehousePart.quantity || 1),
          unitPrice: tx.warehousePart.unit_price ?? tx.amount,
        },
      ],
    };
  }

  return {
    enabled: true,
    items: [
      {
        id: `wh-${Date.now()}`,
        brand: autoBrand,
        clientCarModel: autoBrand === 'client' ? 'Нива' : '',
        name: desc,
        article: '',
        quantity: 1,
        unitPrice: tx.amount,
      },
    ],
  };
}

export function EditTxModal({
  initialTx,
  selectedDate,
  categories,
  calendarItems,
  warehouseParts,
  users,
  onSave,
  onClose,
}: {
  initialTx: EditingTxState;
  selectedDate: string;
  categories: CategoryItem[];
  calendarItems: PaymentCalendarItem[];
  warehouseParts: GaragePartOption[];
  users: { id: string; name: string }[];
  onSave: (payload: CategorizePayload) => void;
  onClose: () => void;
}) {
  const [editingTx, setEditingTx] = useState<EditingTxState>(initialTx);
  const [whEnabled, setWhEnabled] = useState<boolean>(
    () => initWarehouseState(initialTx, categories).enabled,
  );
  const [whItems, setWhItems] = useState<ModalWarehouseEntry[]>(
    () => initWarehouseState(initialTx, categories).items,
  );

  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
    };
  }, []);

  const resolvedCatName = (
    editingTx.categoryName ||
    categories.find((c) => c.id === editingTx.categoryId)?.name ||
    ''
  ).toLowerCase();
  const isPartsCategory = resolvedCatName.includes('запчаст') && editingTx.direction !== 'income';

  const showTransferWallet =
    editingTx.direction !== 'income' &&
    (editingTx.categoryId === '62cebf3f-9982-4cc6-904b-48c6169cf5e4' ||
      editingTx.categoryId === 'b9946a5e-4a33-4ed9-a272-5dee12d4ca93' ||
      (editingTx.categoryName || '').toLowerCase().includes('перевод') ||
      (editingTx.description || '').toLowerCase().includes('перевод') ||
      (editingTx.description || '').toLowerCase().includes('топливн') ||
      (editingTx.description || '').toLowerCase().includes('пополнение тк') ||
      (editingTx.description || '').toLowerCase().includes('гсм'));

  const showStaffSelect =
    editingTx.categoryId === 'a0000000-0000-0000-0000-000000000001' ||
    (editingTx.categoryName || '').toLowerCase().includes('аванс') ||
    (editingTx.categoryName || '').toLowerCase().includes('фот') ||
    (editingTx.categoryName || '').toLowerCase().includes('зарплат') ||
    (editingTx.description || '').toLowerCase().includes('суточн') ||
    Boolean(editingTx.relatedUserId);

  const handleSave = () => {
    const isWhActive = whEnabled && isPartsCategory;
    const validWhItems = isWhActive ? whItems.filter((it) => it.name.trim().length > 0) : [];

    onSave({
      id: editingTx.id,
      description: editingTx.description,
      category_id: editingTx.categoryId,
      categoryName: editingTx.categoryName,
      amount: editingTx.amount,
      to_wallet_id: editingTx.toWalletId,
      from_wallet_id: editingTx.fromWalletId,
      direction: editingTx.direction,
      obligation_id: editingTx.obligationId,
      transaction_date: editingTx.transactionDate,
      related_user_id: editingTx.relatedUserId,
      warehouse_enabled: isWhActive,
      warehouse_parts: isWhActive
        ? validWhItems.map((it) => ({
            brand: it.brand,
            client_car_model: it.brand === 'client' ? it.clientCarModel.trim() || 'Нива' : null,
            name: it.name.trim(),
            article: it.article.trim() || null,
            quantity: Math.max(1, Number(it.quantity) || 1),
            unit_price:
              it.unitPrice !== '' && it.unitPrice !== undefined
                ? Number(it.unitPrice)
                : Math.round(editingTx.amount / Math.max(1, validWhItems.length)),
          }))
        : [],
      warehouse_part:
        isWhActive && validWhItems[0]
          ? {
              enabled: true,
              brand: validWhItems[0].brand,
              client_car_model:
                validWhItems[0].brand === 'client'
                  ? validWhItems[0].clientCarModel.trim() || 'Нива'
                  : null,
              name: validWhItems[0].name.trim(),
              article: validWhItems[0].article.trim() || null,
              quantity: Math.max(1, Number(validWhItems[0].quantity) || 1),
              unit_price:
                validWhItems[0].unitPrice !== '' && validWhItems[0].unitPrice !== undefined
                  ? Number(validWhItems[0].unitPrice)
                  : editingTx.amount,
            }
          : !isWhActive && editingTx.warehousePart
            ? { enabled: false }
            : null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="text-base">✎</span>
            <span className="text-sm font-black uppercase text-slate-800">
              {editingTx.direction === 'income'
                ? 'Классификация и редактирование поступления'
                : 'Классификация и редактирование расхода'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 text-sm font-bold flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 overscroll-contain">
          <div
            className={
              editingTx.direction === 'income'
                ? 'bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between'
                : 'bg-rose-50/60 border border-rose-200/80 rounded-xl p-3 flex items-center justify-between'
            }
          >
            <div>
              <div
                className={
                  editingTx.direction === 'income'
                    ? 'text-[10px] font-black uppercase text-emerald-800 tracking-wider'
                    : 'text-[10px] font-black uppercase text-rose-800 tracking-wider'
                }
              >
                {editingTx.direction === 'income' ? 'Сумма поступления' : 'Сумма списания'}
              </div>
              <div
                className={
                  editingTx.direction === 'income'
                    ? 'text-lg font-black font-mono text-emerald-600 mt-0.5'
                    : 'text-lg font-black font-mono text-rose-600 mt-0.5'
                }
              >
                {editingTx.direction === 'income' ? '+' : '-'}
                {rub(editingTx.amount)}
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-500">
              <div>Дата операции:</div>
              <div className="font-mono font-bold text-slate-700">
                {editingTx.transactionDate
                  ? new Date(editingTx.transactionDate).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : selectedDate}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
              Название / точное назначение (куда ушли деньги) *
            </label>
            <input
              type="text"
              value={editingTx.description}
              onChange={(e) => {
                const newDesc = e.target.value;
                const prevDesc = editingTx.description;
                setEditingTx({ ...editingTx, description: newDesc });
                if (whItems.length === 1 && (whItems[0]!.name === prevDesc || !whItems[0]!.name)) {
                  setWhItems([{ ...whItems[0]!, name: newDesc }]);
                }
                const detected = detectBrandFromText(newDesc);
                if (detected && whItems.length === 1) {
                  setWhItems((prev) =>
                    prev.length === 1 ? [{ ...prev[0]!, brand: detected }] : prev,
                  );
                }
              }}
              placeholder="Например: Пополнение топливной карты, Запчасти на Газель, Кредит Тинькофф"
              className="w-full mt-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
              {editingTx.direction === 'income'
                ? 'Статья доходов / категория'
                : 'Статья расходов (Группа расходов) *'}
            </label>
            <select
              value={editingTx.categoryId || ''}
              onChange={(e) => {
                const newCatId = e.target.value || null;
                const catObj = categories.find((c) => c.id === newCatId);
                let toW = editingTx.toWalletId;
                if (catObj?.code === 'FUEL' || catObj?.code === 'WALLET_TRANSFER') {
                  toW = FUEL_CARD_ID;
                }
                const isPartsCat = (catObj?.name || '').toLowerCase().includes('запчаст');
                if (isPartsCat && editingTx.direction !== 'income') {
                  setWhEnabled(true);
                  if (whItems.length === 0) {
                    setWhItems([
                      {
                        id: `wh-${Date.now()}`,
                        brand: detectBrandFromText(editingTx.description),
                        clientCarModel: '',
                        name: editingTx.description,
                        article: '',
                        quantity: 1,
                        unitPrice: editingTx.amount,
                      },
                    ]);
                  }
                } else {
                  setWhEnabled(false);
                }
                setEditingTx({
                  ...editingTx,
                  categoryId: newCatId,
                  categoryName: catObj?.name,
                  toWalletId: toW,
                });
              }}
              className="w-full mt-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white font-medium"
            >
              <option value="">
                {editingTx.direction === 'income'
                  ? '(Выберите статью поступления)'
                  : '(Выберите статью расходов)'}
              </option>
              {getFilteredCategories(categories, editingTx.direction, editingTx.categoryId).map(
                (c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ),
              )}
            </select>
          </div>

          {editingTx.direction === 'income' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
              <label className="text-[10px] font-black uppercase text-emerald-900 tracking-wider">
                📥 Зачислить в кошелёк / на счёт:
              </label>
              <select
                value={editingTx.toWalletId || BANK_ID}
                onChange={(e) => setEditingTx({ ...editingTx, toWalletId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-emerald-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={BANK_ID}>💳 Расчётный счёт (Банк / Р/С)</option>
                <option value={CASH_ID}>🔒 Сейф (Наличные)</option>
                <option value={FUEL_CARD_ID}>⛽ Топливная карта (ГСМ)</option>
              </select>
            </div>
          )}

          {showTransferWallet && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <label className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                🔄 Зачислить на кошелек / карту:
              </label>
              <select
                value={editingTx.toWalletId || ''}
                onChange={(e) => setEditingTx({ ...editingTx, toWalletId: e.target.value || null })}
                className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value={BANK_ID}>💳 Расчётный счёт (Банк / Р/С)</option>
                <option value={CASH_ID}>🔒 Сейф (Наличные)</option>
                <option value={FUEL_CARD_ID}>⛽ Топливная карта (ГСМ)</option>
                <option value="">(Не переводить, оставить прямым списанием)</option>
              </select>
              <div className="text-[10px] text-amber-800">
                💡 При выборе кошелька баланс автоматически пополнится на эту сумму (+
                {rub(editingTx.amount)}).
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
              <span>📅</span> Связать с Календарём платежей (отметить как оплаченный):
            </label>
            <select
              value={editingTx.obligationId || ''}
              onChange={(e) => setEditingTx({ ...editingTx, obligationId: e.target.value || null })}
              className="w-full mt-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white font-medium"
            >
              <option value="">(Автоматический подбор по названию/сумме)</option>
              <option value="none">❌ Не связывать / отвязать от плана платежей</option>
              {calendarItems.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} — {rub(o.amount)} (до {o.due_day}-го числа)
                  {o.status === 'paid' ? ' [✓ Оплачен]' : ''}
                </option>
              ))}
            </select>
            <div className="text-[10px] text-slate-500 mt-1">
              Платёж автоматически отметится как оплаченный в Платёжном календаре за этот месяц.
            </div>
          </div>

          {isPartsCategory && (
            <EditTxWarehouseSection
              txAmount={editingTx.amount}
              txDescription={editingTx.description}
              whEnabled={whEnabled}
              setWhEnabled={setWhEnabled}
              whItems={whItems}
              setWhItems={setWhItems}
              warehouseParts={warehouseParts}
            />
          )}

          {showStaffSelect && (
            <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl space-y-1.5">
              <label className="text-[10px] font-black uppercase text-violet-900 tracking-wider flex items-center justify-between">
                <span>👤 Сотрудник / Водитель (учёт аванса/долга):</span>
                {editingTx.relatedUserId && (
                  <span className="text-emerald-700 font-bold">✓ Привязан к сотруднику</span>
                )}
              </label>
              <select
                value={editingTx.relatedUserId || ''}
                onChange={(e) =>
                  setEditingTx({ ...editingTx, relatedUserId: e.target.value || null })
                }
                className="w-full px-3 py-2 text-xs border border-violet-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">(Не привязывать к долгам сотрудника)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-violet-800">
                💡 При выборе сотрудника расход ({rub(editingTx.amount)}) автоматически запишется в
                его карточку как выданный аванс без создания дублирующих записей.
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 flex-shrink-0 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={!editingTx.description?.trim()}
            onClick={handleSave}
            className="px-5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            ✓ Сохранить и распределить
          </button>
        </div>
      </div>
    </div>
  );
}
