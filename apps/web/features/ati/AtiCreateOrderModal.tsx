'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { AtiCounterpartyOption } from './types';

export function AtiCreateOrderModal({
  counterparties,
  isPending,
  onSubmit,
  onClose,
}: {
  counterparties: AtiCounterpartyOption[];
  isPending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [newOrderNumber, setNewOrderNumber] = useState(
    `№ ... от ${new Date().toLocaleDateString('ru-RU')}`,
  );
  const [newCounterpartyMode, setNewCounterpartyMode] = useState<'select' | 'create'>('select');
  const [selectedCpId, setSelectedCpId] = useState('');
  const [newCpName, setNewCpName] = useState('');
  const [newCpInn, setNewCpInn] = useState('');
  const [newCpPhone, setNewCpPhone] = useState('');
  const [newCpEmail, setNewCpEmail] = useState('');
  const [newPickup, setNewPickup] = useState('');
  const [newDelivery, setNewDelivery] = useState('');
  const [newPrice, setNewPrice] = useState('30000');
  const [newDocType, setNewDocType] = useState<'etrn' | 'paper'>('etrn');
  const [newCargo, setNewCargo] = useState('');
  const [newAssetReg, setNewAssetReg] = useState('О188ТА 196 (Валдай)');
  const [newDriver, setNewDriver] = useState('Насртдинов Вячеслав Аксанович');

  const [isParsingContract, setIsParsingContract] = useState(false);
  const [contractParseSuccess, setContractParseSuccess] = useState<string | null>(null);
  const [contractParseError, setContractParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/orders/next-number')
      .then((r) => r.json())
      .then((data) => {
        if (data?.nextNumber) {
          const dateStr = new Date().toLocaleDateString('ru-RU');
          setNewOrderNumber((prev) =>
            prev.includes('№ ...') ? `№ ${data.nextNumber} от ${dateStr}` : prev,
          );
        }
      })
      .catch((err) => console.warn('Ошибка получения след. номера рейса:', err));
  }, []);

  const handleContractFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingContract(true);
    setContractParseSuccess(null);
    setContractParseError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ati/parse-contract', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Ошибка распознавания');

      const p = json.data;
      if (p.order_number) {
        const dateStr = p.order_date
          ? new Date(p.order_date).toLocaleDateString('ru-RU')
          : new Date().toLocaleDateString('ru-RU');
        setNewOrderNumber(`№ ${p.order_number} от ${dateStr}`);
      }
      if (p.pickup_address) setNewPickup(p.pickup_address);
      if (p.delivery_address) setNewDelivery(p.delivery_address);
      if (p.price) setNewPrice(String(p.price));
      if (p.cargo_description) setNewCargo(p.cargo_description);
      if (p.asset_name) setNewAssetReg(p.asset_name);
      if (p.driver_name) setNewDriver(p.driver_name);
      if (p.doc_type) setNewDocType(p.doc_type);

      if (p.matched_counterparty) {
        setNewCounterpartyMode('select');
        setSelectedCpId(p.matched_counterparty.id);
      } else {
        setNewCounterpartyMode('create');
        if (p.counterparty_name) setNewCpName(p.counterparty_name);
        if (p.counterparty_inn) setNewCpInn(p.counterparty_inn);
        if (p.counterparty_phone) setNewCpPhone(p.counterparty_phone);
        if (p.counterparty_email) setNewCpEmail(p.counterparty_email);
      }

      const cpLabel = p.matched_counterparty
        ? `${p.matched_counterparty.name} (найден в базе)`
        : p.counterparty_name || 'Новый контрагент';

      setContractParseSuccess(
        `✓ Договор распознан: ${cpLabel} | ${p.order_number ? `№ ${p.order_number}` : ''} | ${p.price ? `${Number(p.price).toLocaleString('ru-RU')} ₽` : ''}. Проверьте данные и нажмите «Создать заявку».`,
      );
    } catch (err: unknown) {
      setContractParseError(err instanceof Error ? err.message : 'Не удалось распознать документ');
    } finally {
      setIsParsingContract(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let cpName = '';
    let cpId: string | null = null;
    if (newCounterpartyMode === 'create') {
      cpName = newCpName;
    } else {
      const found = counterparties.find((c) => c.id === selectedCpId);
      cpName = found ? found.name : 'ООО Заказчик';
      cpId = selectedCpId || null;
    }

    onSubmit({
      order_number: newOrderNumber,
      create_counterparty: newCounterpartyMode === 'create',
      counterparty_id: cpId,
      counterparty_name: cpName,
      counterparty_inn: newCpInn,
      counterparty_phone: newCpPhone,
      counterparty_email: newCpEmail,
      doc_type: newDocType,
      pickup_address: newPickup,
      delivery_address: newDelivery,
      price: Number(newPrice) || 0,
      cargo_description: newCargo,
      asset_name: newAssetReg,
      driver_name: newDriver,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚚</span>
            <div>
              <h3 className="text-sm font-black font-display">Новый Договор-Заявка АТИ</h3>
              <p className="text-[11px] text-slate-400">
                Менеджер заносит контрагента для связки с рейсом и дебиторкой
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-black cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3 text-xs">
          <div className="p-3.5 bg-gradient-to-br from-indigo-50/90 via-sky-50/60 to-purple-50/90 border-2 border-dashed border-indigo-300 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleContractFileUpload}
            />
            <button
              type="button"
              disabled={isParsingContract}
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="text-base">{isParsingContract ? '⏳' : '📎'}</span>
              <span>
                {isParsingContract
                  ? 'Распознавание договора (OCR / PDF)...'
                  : 'Загрузить Договор-Заявку (PDF / скан / фото)'}
              </span>
            </button>
            <p className="text-[11px] text-slate-500 font-medium max-w-sm">
              Поддерживает цифровые PDF (из 1С, Word, АТИ), сканы и фото. Форма заполнится всеми
              данными автоматически.
            </p>
            {contractParseSuccess && (
              <div className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl font-bold text-left text-[11px] flex items-start gap-2 shadow-2xs">
                <span className="text-emerald-600 text-sm">✓</span>
                <span>{contractParseSuccess}</span>
              </div>
            )}
            {contractParseError && (
              <div className="w-full px-3 py-2 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl font-bold text-left text-[11px] flex items-start gap-2 shadow-2xs">
                <span className="text-rose-600 text-sm">✕</span>
                <span>{contractParseError}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
              Номер Договор-Заявки *
            </label>
            <input
              type="text"
              required
              value={newOrderNumber}
              onChange={(e) => setNewOrderNumber(e.target.value)}
              className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-mono font-bold text-slate-900"
            />
          </div>

          <div className="p-3 bg-indigo-50/70 border-2 border-indigo-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-indigo-950 uppercase">
                Контрагент (Заказчик) *
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setNewCounterpartyMode('select')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    newCounterpartyMode === 'select'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-700 border border-indigo-200'
                  }`}
                >
                  Из базы
                </button>
                <button
                  type="button"
                  onClick={() => setNewCounterpartyMode('create')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    newCounterpartyMode === 'create'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-700 border border-indigo-200'
                  }`}
                >
                  + Новый
                </button>
              </div>
            </div>

            {newCounterpartyMode === 'select' ? (
              <select
                value={selectedCpId}
                onChange={(e) => setSelectedCpId(e.target.value)}
                className="w-full px-3 py-1.5 border-2 border-indigo-300 rounded-xl font-bold bg-white text-slate-900"
              >
                <option value="">Выберите контрагента из базы...</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="text"
                  required
                  placeholder="Название: ООО «Новый Заказчик»"
                  value={newCpName}
                  onChange={(e) => setNewCpName(e.target.value)}
                  className="w-full px-3 py-1.5 border-2 border-indigo-300 rounded-xl font-bold bg-white text-slate-900"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="ИНН"
                    value={newCpInn}
                    onChange={(e) => setNewCpInn(e.target.value)}
                    className="w-full px-2.5 py-1 border border-indigo-200 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Телефон"
                    value={newCpPhone}
                    onChange={(e) => setNewCpPhone(e.target.value)}
                    className="w-full px-2.5 py-1 border border-indigo-200 rounded-lg text-xs"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newCpEmail}
                    onChange={(e) => setNewCpEmail(e.target.value)}
                    className="w-full px-2.5 py-1 border border-indigo-200 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
            <span className="text-[10px] text-indigo-700 block">
              Этот контрагент будет доступен водителю при завершении рейса
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Откуда (Погрузка) *
              </label>
              <input
                type="text"
                required
                placeholder="г. Арамиль"
                value={newPickup}
                onChange={(e) => setNewPickup(e.target.value)}
                className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Куда (Выгрузка) *
              </label>
              <input
                type="text"
                required
                placeholder="г. Уфа"
                value={newDelivery}
                onChange={(e) => setNewDelivery(e.target.value)}
                className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Автотранспорт
              </label>
              <input
                type="text"
                value={newAssetReg}
                onChange={(e) => setNewAssetReg(e.target.value)}
                placeholder="Валдай О188ТА 196"
                className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Водитель
              </label>
              <input
                type="text"
                value={newDriver}
                onChange={(e) => setNewDriver(e.target.value)}
                placeholder="ФИО водителя"
                className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Фрахт (₽) *
              </label>
              <input
                type="number"
                required
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-mono font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Тип документов *
              </label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value as 'etrn' | 'paper')}
                className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold bg-white"
              >
                <option value="etrn">⚡ ЭТрН + ЭДО</option>
                <option value="paper">📮 Бумажная ТрН + Почта РФ</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
              Груз и параметры
            </label>
            <input
              type="text"
              placeholder="Подоконники, 4т, 5 поддонов, ремни"
              value={newCargo}
              onChange={(e) => setNewCargo(e.target.value)}
              className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl font-bold"
            />
          </div>

          <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-[10px] text-amber-900">
            ⚠️ <strong>Правило старта:</strong> Работа начинается после отправки подписанного скана
            на почту заказчику.
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isPending ? 'Создание...' : 'Создать заявку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
