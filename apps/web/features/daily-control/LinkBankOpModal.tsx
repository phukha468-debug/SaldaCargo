'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LinkableOrderItem, PeriodMode, TBankOp } from './types';
import type { LinkBankOpPayload } from './useDailyControlData';
import { formatTxTime, pickBestLinkableOrders, rub } from './utils';

export function LinkBankOpModal({
  bankOp,
  initialSuggestedOrderId,
  selectedDate,
  todayStr,
  yesterdayStr,
  period,
  isPending,
  onSubmit,
  onClose,
}: {
  bankOp: TBankOp;
  initialSuggestedOrderId?: string;
  selectedDate: string;
  todayStr: string;
  yesterdayStr: string;
  period: PeriodMode;
  isPending: boolean;
  onSubmit: (payload: LinkBankOpPayload) => void;
  onClose: () => void;
}) {
  const [linkMode, setLinkMode] = useState<'trip' | 'sto' | 'dispatcher'>('trip');
  const [userSelectedIds, setUserSelectedIds] = useState<string[] | null>(
    initialSuggestedOrderId ? [initialSuggestedOrderId] : null,
  );
  const [stoOrderNumber, setStoOrderNumber] = useState('');
  const [stoClientName, setStoClientName] = useState('');
  const [dispatcherDetails, setDispatcherDetails] = useState('');
  const [dispatcherClientName, setDispatcherClientName] = useState('');
  const [linkOrderSearch, setLinkOrderSearch] = useState('');
  const [linkOrderPeriod, setLinkOrderPeriod] = useState<
    'smart' | 'today' | 'yesterday' | '7days' | '30days' | 'custom'
  >('smart');
  const [linkOrderCustomDate, setLinkOrderCustomDate] = useState('');

  const opAmt = bankOp.operationAmount || bankOp.rubleAmount || 0;

  const { data: linkableOrdersData, isLoading } = useQuery<{
    extractedDate?: string | null;
    orders: LinkableOrderItem[];
  }>({
    queryKey: [
      'linkable-orders',
      bankOp.operationId,
      linkOrderSearch,
      linkOrderPeriod,
      linkOrderCustomDate,
    ],
    queryFn: async () => {
      const desc = bankOp.description || bankOp.payPurpose || '';
      const opDate = bankOp.operationDate || '';
      const params = new URLSearchParams();
      params.set('targetAmount', String(opAmt));
      params.set('targetDesc', desc);
      params.set('operationDate', opDate);
      if (linkOrderSearch) params.set('search', linkOrderSearch);

      if (linkOrderPeriod === 'custom' && linkOrderCustomDate) {
        params.set('date', linkOrderCustomDate);
      } else if (linkOrderPeriod === 'today') {
        params.set('date', todayStr);
      } else if (linkOrderPeriod === 'yesterday') {
        params.set('date', yesterdayStr);
      } else if (linkOrderPeriod === '7days') {
        params.set('days', '7');
      } else if (linkOrderPeriod === '30days') {
        params.set('days', '30');
      } else {
        params.set('days', '14');
      }

      const res = await fetch(`/api/finance/linkable-orders?${params.toString()}`);
      if (!res.ok) throw new Error('Ошибка загрузки рейсов');
      return res.json();
    },
    enabled: linkMode === 'trip',
  });

  const orders = useMemo(() => linkableOrdersData?.orders ?? [], [linkableOrdersData?.orders]);

  const selectedOrderIds = useMemo(() => {
    if (userSelectedIds !== null) return userSelectedIds;
    return pickBestLinkableOrders(orders, opAmt);
  }, [userSelectedIds, orders, opAmt]);

  const toggleOrderSelection = (orderId: string) => {
    const current = selectedOrderIds;
    setUserSelectedIds(
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
  };

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
  const selectedTotalAmount = selectedOrders.reduce(
    (sum, o) => sum + parseFloat(String(o.amount || '0')),
    0,
  );
  const isSumExactMatch =
    selectedOrderIds.length > 0 && Math.abs(selectedTotalAmount - opAmt) < 0.01;
  const isSumUnder = selectedOrderIds.length > 0 && selectedTotalAmount < opAmt;
  const isSumOver = selectedOrderIds.length > 0 && selectedTotalAmount > opAmt;

  const submitButtonLabel = () => {
    if (isPending) return 'Связывание...';
    if (linkMode === 'sto') return '✓ Связать с заказ-нарядом СТО';
    if (linkMode === 'dispatcher') return '✓ Связать с рейсом диспетчера';
    if (selectedOrderIds.length === 0) return 'Выберите рейс для привязки';
    if (selectedOrderIds.length === 1) {
      const selOrder = orders.find((o) => o.id === selectedOrderIds[0]);
      return selOrder?.trip?.trip_number
        ? `✓ Связать с рейсом №${selOrder.trip.trip_number}`
        : '✓ Связать с рейсом автопарка';
    }
    const tripNums = selectedOrders
      .map((o) => o.trip?.trip_number)
      .filter(Boolean)
      .map((n) => `№${n}`);
    return tripNums.length > 0
      ? `✓ Связать сразу с ${selectedOrderIds.length} рейсами (${tripNums.join(', ')}) · ${rub(selectedTotalAmount)}`
      : `✓ Связать сразу с ${selectedOrderIds.length} рейсами (${rub(selectedTotalAmount)})`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-1.5">
              <span>🔗</span> Привязка поступления денежных средств
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Свяжите приход с рейсом автопарка, заказ-нарядом СТО или диспетчерским договором
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
            <div className="text-[10px] uppercase font-black text-sky-800">
              Банковское поступление (Т-Банк API):
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="font-bold text-slate-800 text-sm">{rub(opAmt)}</div>
              <div className="text-[10px] text-slate-500 font-mono">
                {formatTxTime(
                  bankOp.trxnPostDate || bankOp.authorizationDate || bankOp.operationDate,
                  period,
                )}
              </div>
            </div>
            <div className="text-[11px] text-slate-600 mt-1">
              {bankOp.description || bankOp.payPurpose}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: 'trip', icon: '🚚', label: 'Рейс парка' },
                { id: 'sto', icon: '🔧', label: 'Гараж / СТО' },
                { id: 'dispatcher', icon: '🤝', label: 'Диспетчер (АТИ)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setLinkMode(tab.id)}
                className={`py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  linkMode === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {linkMode === 'trip' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-700">
                    Выберите рейс(ы) автопарка для привязки:
                  </label>
                  <div className="text-[10px] text-slate-500">
                    💡 Можно выбрать сразу несколько рейсов (оплата долга за 2 и более рейса)
                  </div>
                </div>
                {linkableOrdersData?.extractedDate && (
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-full border border-sky-200">
                    🎯 Дата из платежа:{' '}
                    {linkableOrdersData.extractedDate.split('-').reverse().join('.')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'smart', icon: '⚡', label: 'Умный подбор' },
                    {
                      id: 'yesterday',
                      icon: '📅',
                      label: `Вчера (${yesterdayStr.split('-').reverse().slice(0, 2).join('.')})`,
                    },
                    {
                      id: 'today',
                      icon: '📅',
                      label: `Сегодня (${todayStr.split('-').reverse().slice(0, 2).join('.')})`,
                    },
                    { id: '7days', icon: '🗓️', label: 'За 7 дней' },
                    { id: '30days', icon: '🗓️', label: 'За 30 дней' },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setLinkOrderPeriod(chip.id);
                      setLinkOrderCustomDate('');
                    }}
                    className={`px-2 py-1 text-[10px] font-black rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      linkOrderPeriod === chip.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{chip.icon}</span>
                    <span>{chip.label}</span>
                  </button>
                ))}
                <input
                  type="date"
                  value={linkOrderCustomDate}
                  onChange={(e) => {
                    setLinkOrderCustomDate(e.target.value);
                    if (e.target.value) setLinkOrderPeriod('custom');
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold border border-slate-300 rounded-lg bg-white text-slate-800"
                  title="Выбрать другую дату рейса"
                />
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={linkOrderSearch}
                  onChange={(e) => setLinkOrderSearch(e.target.value)}
                  placeholder="🔍 Поиск по номеру рейса (напр. 827), клиенту (Оля), сумме (2500)..."
                  className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                {linkOrderSearch && (
                  <button
                    type="button"
                    onClick={() => setLinkOrderSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Загрузка рейсов автопарка...
                </div>
              ) : orders.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                  <div className="text-slate-500 text-xs">
                    Рейсы не найдены по выбранным критериям.
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLinkOrderPeriod('7days');
                        setLinkOrderSearch('');
                        setLinkOrderCustomDate('');
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 rounded-lg text-sky-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Рейсы за 7 дней
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkOrderPeriod('30days');
                        setLinkOrderSearch('');
                        setLinkOrderCustomDate('');
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 rounded-lg text-sky-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Рейсы за 30 дней
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition ${
                      selectedOrderIds.length === 0
                        ? 'bg-slate-50 border-slate-200 text-slate-500'
                        : isSumExactMatch
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                          : isSumUnder
                            ? 'bg-amber-50 border-amber-300 text-amber-950'
                            : 'bg-purple-50 border-purple-300 text-purple-950'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>
                        {selectedOrderIds.length === 0 ? (
                          '💡 Отметьте один или сразу несколько рейсов'
                        ) : (
                          <>
                            Выбрано: <b>{selectedOrderIds.length}</b> рейса на сумму{' '}
                            <b className="font-mono text-slate-900">{rub(selectedTotalAmount)}</b>{' '}
                            из <b className="font-mono text-slate-900">{rub(opAmt)}</b>
                          </>
                        )}
                      </span>
                      {isSumExactMatch && (
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded shadow-2xs">
                          ✓ Сумма совпадает (100%)
                        </span>
                      )}
                      {isSumUnder && (
                        <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                          Остаток: {rub(opAmt - selectedTotalAmount)}
                        </span>
                      )}
                      {isSumOver && (
                        <span className="text-[10px] text-purple-800 font-bold bg-purple-100 px-1.5 py-0.2 rounded">
                          Превышение: +{rub(selectedTotalAmount - opAmt)}
                        </span>
                      )}
                    </div>
                    {selectedOrderIds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setUserSelectedIds([])}
                        className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer ml-2 flex-shrink-0"
                      >
                        Сбросить выбор
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {orders.map((order) => {
                      const isMatchAmt =
                        order.is_match_amount ?? parseFloat(String(order.amount)) === opAmt;
                      const isSelected = selectedOrderIds.includes(order.id);
                      const isTopRecommendation = Boolean(order.score && order.score >= 100);

                      return (
                        <div
                          key={order.id}
                          onClick={() => toggleOrderSelection(order.id)}
                          className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-sky-50 border-2 border-sky-500 ring-2 ring-sky-200'
                              : isTopRecommendation
                                ? 'bg-amber-50/80 border-2 border-amber-400 hover:border-amber-500 shadow-2xs'
                                : isMatchAmt
                                  ? 'bg-amber-50/50 border-amber-300 hover:border-amber-400'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleOrderSelection(order.id);
                              }}
                              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                            />
                            <div>
                              <div className="font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                                <span>
                                  {order.trip?.trip_number
                                    ? `Рейс №${order.trip.trip_number}`
                                    : 'Рейс'}
                                </span>
                                <span className="text-slate-500 font-normal">
                                  · {order.trip?.driver?.name || 'Водитель'}
                                </span>
                                {order.trip_date && (
                                  <span className="text-[10px] font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                    📅 {order.trip_date.split('-').reverse().slice(0, 2).join('.')}
                                  </span>
                                )}
                                {order.is_match_date && (
                                  <span className="text-[9px] font-black bg-sky-200 text-sky-900 px-1.5 py-0.2 rounded">
                                    🎯 Дата совпадает
                                  </span>
                                )}
                                {isMatchAmt && (
                                  <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-2xs">
                                    ⭐ Совпадает сумма
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                <span>
                                  Тип:{' '}
                                  {order.payment_method === 'qr'
                                    ? '📱 QR-код'
                                    : order.payment_method === 'cash'
                                      ? '💵 Наличные'
                                      : order.payment_method === 'bank_invoice'
                                        ? '💳 Безнал'
                                        : order.payment_method}
                                </span>
                                {order.counterparty?.name && (
                                  <span className="font-semibold text-slate-700">
                                    Клиент: {order.counterparty.name}
                                  </span>
                                )}
                                {order.description && (
                                  <span className="text-slate-400 italic">
                                    ({order.description})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="font-mono font-black text-slate-900 text-xs">
                              {rub(parseFloat(String(order.amount)))}
                            </div>
                            <div className="text-[9px] text-slate-400">
                              {order.is_already_linked ? (
                                <span className="text-emerald-700 font-bold">✓ Привязан к Р/С</span>
                              ) : order.settlement_status === 'completed' ? (
                                '✓ Отмечен'
                              ) : (
                                '⏳ Ожидает'
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {linkMode === 'sto' && (
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                  Номер заказ-наряда / чека автосервиса:
                </label>
                <input
                  type="text"
                  value={stoOrderNumber}
                  onChange={(e) => setStoOrderNumber(e.target.value)}
                  placeholder="Например: ЗН-104 или 482"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                  Клиент / Автомобиль (необязательно):
                </label>
                <input
                  type="text"
                  value={stoClientName}
                  onChange={(e) => setStoClientName(e.target.value)}
                  placeholder="Например: Газель В672ТТ / ООО Вектор"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="text-[10px] text-slate-500">
                💡 Привяжет данный платёж к услугам гаража/СТО и зафиксирует выручку автосервиса.
              </div>
            </div>
          )}

          {linkMode === 'dispatcher' && (
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                  Номер заявки / маршрут чужого авто:
                </label>
                <input
                  type="text"
                  value={dispatcherDetails}
                  onChange={(e) => setDispatcherDetails(e.target.value)}
                  placeholder="Например: АТИ №1405 Салда — Москва"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                  Заказчик перевозки / экспедирование:
                </label>
                <input
                  type="text"
                  value={dispatcherClientName}
                  onChange={(e) => setDispatcherClientName(e.target.value)}
                  placeholder="Например: ООО Логистик Групп"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="text-[10px] text-slate-500">
                💡 Привяжет платёж к экспедиторскому рейсу на привлечённом транспорте (диспетчерская
                комиссия).
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={
                isPending ||
                (linkMode === 'trip' && selectedOrderIds.length === 0) ||
                (linkMode === 'sto' && !stoOrderNumber.trim()) ||
                (linkMode === 'dispatcher' && !dispatcherDetails.trim())
              }
              onClick={() =>
                onSubmit({
                  operationId: bankOp.operationId,
                  linkType: linkMode === 'sto' ? 'service_order' : linkMode,
                  tripOrderIds: linkMode === 'trip' ? selectedOrderIds : undefined,
                  tripOrderId:
                    linkMode === 'trip' && selectedOrderIds.length === 1
                      ? selectedOrderIds[0]
                      : undefined,
                  serviceOrderId: linkMode === 'sto' ? stoOrderNumber.trim() : undefined,
                  dispatcherDetails:
                    linkMode === 'dispatcher' ? dispatcherDetails.trim() : undefined,
                  clientName:
                    linkMode === 'sto'
                      ? stoClientName.trim()
                      : linkMode === 'dispatcher'
                        ? dispatcherClientName.trim()
                        : undefined,
                  amount: opAmt,
                  operationDate:
                    bankOp.trxnPostDate || bankOp.authorizationDate || bankOp.operationDate,
                  date: selectedDate,
                  action: 'link',
                })
              }
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition"
            >
              {submitButtonLabel()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
