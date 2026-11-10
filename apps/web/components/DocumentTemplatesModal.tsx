'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DocumentTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  counterparties?: any[];
  loadingPoints?: any[];
}

export function DocumentTemplatesModal({
  isOpen,
  onClose,
  counterparties = [],
}: DocumentTemplatesModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'waybill' | 'tn' | 'etrn'>('waybill');

  // Режим добавления / редактирования пресета ЭТрн
  const [editingEtrn, setEditingEtrn] = useState<any | null>(null);
  const [isEtrnFormOpen, setIsEtrnFormOpen] = useState(false);

  // 1. Загрузка шаблонов Путевых листов (4-С)
  const { data: waybillTemplates = [], isLoading: isLoadingWb } = useQuery<any[]>({
    queryKey: ['doc-templates-waybill'],
    queryFn: async () => {
      const res = await fetch('/api/document-templates?type=waybill');
      const json = await res.json();
      return json.list || [];
    },
    enabled: isOpen,
  });

  // 2. Загрузка шаблонов Транспортных накладных (ТН)
  const { data: tnTemplates = [], isLoading: isLoadingTn } = useQuery<any[]>({
    queryKey: ['doc-templates-tn'],
    queryFn: async () => {
      const res = await fetch('/api/document-templates?type=tn');
      const json = await res.json();
      return json.list || [];
    },
    enabled: isOpen,
  });

  // 3. Загрузка пресетов ЭТрн / Заявок
  const { data: etrnPresets = [], isLoading: isLoadingEtrn } = useQuery<any[]>({
    queryKey: ['order-presets-all'],
    queryFn: async () => {
      const res = await fetch('/api/order-presets');
      const json = await res.json();
      return json.presets || [];
    },
    enabled: isOpen,
  });

  // Удаление шаблона ПЛ или ТН
  const deleteDocTemplateMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'waybill' | 'tn' }) => {
      const res = await fetch(`/api/document-templates?id=${encodeURIComponent(id)}&type=${type}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка удаления шаблона');
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      if (vars.type === 'waybill') {
        queryClient.invalidateQueries({ queryKey: ['doc-templates-waybill'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['doc-templates-tn'] });
      }
    },
  });

  // Сохранение / обновление пресета ЭТрн
  const saveEtrnPresetMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!payload.id;
      const res = await fetch('/api/order-presets', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка сохранения пресета ЭТрн');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-presets-all'] });
      queryClient.invalidateQueries({ queryKey: ['order-presets'] });
      setIsEtrnFormOpen(false);
      setEditingEtrn(null);
    },
  });

  // Удаление пресета ЭТрн
  const deleteEtrnPresetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/order-presets?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка удаления пресета ЭТрн');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-presets-all'] });
      queryClient.invalidateQueries({ queryKey: ['order-presets'] });
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Шапка модального окна */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">⚙️</span>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Управление шаблонами документов</h2>
              <p className="text-[11px] text-slate-400">
                Настройка идеальных шаблонов: Путевые листы (4-С), Транспортные накладные (ТН) и
                ЭТрн (МЧД/ЭДО)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer text-base"
          >
            ✕
          </button>
        </div>

        {/* Вкладки переключения (Dense 1-Line Layout) */}
        <div className="px-5 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setActiveTab('waybill');
                setIsEtrnFormOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'waybill'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-300'
              }`}
            >
              <span>📋 Путевые листы 4-С</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">
                {waybillTemplates.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('tn');
                setIsEtrnFormOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'tn'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-300'
              }`}
            >
              <span>📄 Накладные ТН</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">
                {tnTemplates.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('etrn');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'etrn'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-300'
              }`}
            >
              <span>⚡ ЭТрн (МЧД и ЭДО)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">
                {etrnPresets.length}
              </span>
            </button>
          </div>

          <div>
            {activeTab === 'waybill' && (
              <a
                href="/api/orders/blank/docs/waybill-4c"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
              >
                <span>+ Настроить в бланке 4-С</span>
              </a>
            )}
            {activeTab === 'tn' && (
              <a
                href="/api/orders/blank/docs/tn-pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
              >
                <span>+ Настроить в бланке ТН</span>
              </a>
            )}
            {activeTab === 'etrn' && !isEtrnFormOpen && (
              <button
                onClick={() => {
                  setEditingEtrn({
                    title: '',
                    client_counterparty_id: '',
                    forwarder_counterparty_id: '',
                    default_loading_point_id: '',
                    carrier_settings: {
                      inn: '660704814106',
                      ogrnip: '321665800053976',
                      name: 'ИП Нигамедьянов Александр Сергеевич',
                      phone: '+79221800911',
                      edo_participant_id: '2BM-660704814106-20260506082129781701600000000',
                    },
                    emchd_signer: {
                      fio: { lastName: 'Симанова', firstName: 'Олеся', middleName: 'Витальевна' },
                      position: 'Сотрудник',
                      power_of_attorney: {
                        number: '532497b2-e630-4925-b6dd-947e6d26534a',
                        date: '01.09.2026',
                        storage_url:
                          'https://m4d.nalog.gov.ru/emchd/check-status?guid=532497b2-e630-4925-b6dd-947e6d26534a',
                      },
                    },
                  });
                  setIsEtrnFormOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
              >
                <span>+ Добавить пресет ЭТрн</span>
              </button>
            )}
          </div>
        </div>

        {/* Тело списка */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {/* ── ВКЛАДКА 1: ПУТЕВЫЕ ЛИСТЫ ── */}
          {activeTab === 'waybill' && (
            <div>
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 px-3.5 mb-3 text-xs text-emerald-900 flex items-center justify-between gap-3">
                <span>
                  💡 <b>Как настроить идеальный шаблон:</b> откройте путевой лист из списка или по
                  кнопке справа, впишите реквизиты (норма ГСМ, штамп, экипаж) и нажмите{' '}
                  <b>«💾 + Шаблон»</b> прямо в бланке.
                </span>
              </div>

              {isLoadingWb ? (
                <div className="py-12 text-center text-xs text-slate-500 font-bold">
                  Загрузка шаблонов путевых листов...
                </div>
              ) : waybillTemplates.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <div className="text-2xl mb-1">🚚</div>
                  <div className="text-xs font-bold text-slate-700">
                    Нет сохраненных шаблонов путевых листов
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Откройте любой путевой лист и сохраните шаблон под гос. номером автомобиля.
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {waybillTemplates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base">🚚</span>
                        <div className="truncate">
                          <span className="font-black text-xs text-slate-900 uppercase tracking-wide">
                            {t.name}
                          </span>
                          {t.fields?.vehBrand && (
                            <span className="ml-2 text-[11px] text-slate-500 font-medium">
                              {t.fields.vehBrand.split('(')[0].trim()}
                            </span>
                          )}
                          {t.fields?.driverAcceptFio && (
                            <span className="ml-2 text-[11px] text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded-md">
                              👤 {t.fields.driverAcceptFio}
                            </span>
                          )}
                          {t.updatedAt && (
                            <span className="ml-2 text-[10px] text-slate-400">
                              (обновлен: {new Date(t.updatedAt).toLocaleDateString('ru-RU')})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={`/api/orders/blank/docs/waybill-4c?empty=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs transition"
                          title="Открыть бланк и применить шаблон"
                        >
                          📄 Бланк
                        </a>
                        <button
                          onClick={() => {
                            if (
                              confirm(`Удалить шаблон путевого листа для автомобиля "${t.name}"?`)
                            ) {
                              deleteDocTemplateMutation.mutate({ id: t.id, type: 'waybill' });
                            }
                          }}
                          className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition cursor-pointer"
                          title="Удалить шаблон"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ВКЛАДКА 2: НАКЛАДНЫЕ ТН ── */}
          {activeTab === 'tn' && (
            <div>
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 px-3.5 mb-3 text-xs text-blue-900 flex items-center justify-between gap-3">
                <span>
                  💡 <b>Шаблоны ТН</b> сохраняют грузоотправителя, заказчика, склады,
                  грузополучателя, перевозчика и основание полномочий (МЧД) для печати формы ПП РФ №
                  2116.
                </span>
              </div>

              {isLoadingTn ? (
                <div className="py-12 text-center text-xs text-slate-500 font-bold">
                  Загрузка шаблонов ТН...
                </div>
              ) : tnTemplates.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <div className="text-2xl mb-1">📄</div>
                  <div className="text-xs font-bold text-slate-700">
                    Нет сохраненных шаблонов ТН
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Откройте любую накладную ТН, отредактируйте поля и нажмите «💾 + Шаблон».
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {tnTemplates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base">📄</span>
                        <div className="truncate">
                          <span className="font-black text-xs text-slate-900">{t.name}</span>
                          {t.fields?.shipperName && (
                            <span className="ml-2 text-[11px] text-slate-600 truncate">
                              Отпр: {t.fields.shipperName.split(' ')[0]}
                            </span>
                          )}
                          {t.fields?.consigneeName && (
                            <span className="ml-2 text-[11px] text-slate-600 truncate">
                              Получ: {t.fields.consigneeName.split(' ')[0]}
                            </span>
                          )}
                          {t.updatedAt && (
                            <span className="ml-2 text-[10px] text-slate-400">
                              ({new Date(t.updatedAt).toLocaleDateString('ru-RU')})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={`/api/orders/blank/docs/tn-pdf?empty=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs transition"
                          title="Открыть бланк ТН"
                        >
                          📄 Бланк
                        </a>
                        <button
                          onClick={() => {
                            if (confirm(`Удалить шаблон накладной "${t.name}"?`)) {
                              deleteDocTemplateMutation.mutate({ id: t.id, type: 'tn' });
                            }
                          }}
                          className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition cursor-pointer"
                          title="Удалить шаблон"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ВКЛАДКА 3: ЭТрн (МЧД и ЭДО) ── */}
          {activeTab === 'etrn' && (
            <div>
              {/* Форма создания/редактирования пресета ЭТрн */}
              {isEtrnFormOpen && editingEtrn ? (
                <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 space-y-3.5 mb-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-900">
                      {editingEtrn.id ? '✏️ Редактирование пресета ЭТрн' : '➕ Новый пресет ЭТрн'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEtrnFormOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Отмена
                    </button>
                  </div>

                  {/* 1 строка: Название пресета */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Название пресета (для выбора в заявке) *
                    </label>
                    <input
                      type="text"
                      value={editingEtrn.title || ''}
                      onChange={(e) => setEditingEtrn({ ...editingEtrn, title: e.target.value })}
                      placeholder="Например: ВСМПО через экспедитора ИП Парфенов А.В."
                      className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-800 outline-none"
                    />
                  </div>

                  {/* 2 строка: Заказчик и Экспедитор */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Заказчик (Клиент)
                      </label>
                      <select
                        value={editingEtrn.client_counterparty_id || ''}
                        onChange={(e) =>
                          setEditingEtrn({ ...editingEtrn, client_counterparty_id: e.target.value })
                        }
                        className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-800 outline-none"
                      >
                        <option value="">(Не выбран)</option>
                        {counterparties.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.inn ? `(${c.inn})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Экспедитор (если есть)
                      </label>
                      <select
                        value={editingEtrn.forwarder_counterparty_id || ''}
                        onChange={(e) =>
                          setEditingEtrn({
                            ...editingEtrn,
                            forwarder_counterparty_id: e.target.value,
                          })
                        }
                        className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-800 outline-none"
                      >
                        <option value="">(Прямой договор, без экспедитора)</option>
                        {counterparties.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.inn ? `(${c.inn})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 3 строка: МЧД Подписант */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                    <span className="text-[11.5px] font-bold text-slate-900 block">
                      📝 Подписант по Машиночитаемой доверенности (МЧД)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Фамилия"
                        value={editingEtrn.emchd_signer?.fio?.lastName || ''}
                        onChange={(e) =>
                          setEditingEtrn({
                            ...editingEtrn,
                            emchd_signer: {
                              ...editingEtrn.emchd_signer,
                              fio: { ...editingEtrn.emchd_signer?.fio, lastName: e.target.value },
                            },
                          })
                        }
                        className="text-xs border border-slate-300 rounded-lg p-1.5 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Имя"
                        value={editingEtrn.emchd_signer?.fio?.firstName || ''}
                        onChange={(e) =>
                          setEditingEtrn({
                            ...editingEtrn,
                            emchd_signer: {
                              ...editingEtrn.emchd_signer,
                              fio: { ...editingEtrn.emchd_signer?.fio, firstName: e.target.value },
                            },
                          })
                        }
                        className="text-xs border border-slate-300 rounded-lg p-1.5 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Отчество"
                        value={editingEtrn.emchd_signer?.fio?.middleName || ''}
                        onChange={(e) =>
                          setEditingEtrn({
                            ...editingEtrn,
                            emchd_signer: {
                              ...editingEtrn.emchd_signer,
                              fio: { ...editingEtrn.emchd_signer?.fio, middleName: e.target.value },
                            },
                          })
                        }
                        className="text-xs border border-slate-300 rounded-lg p-1.5 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Номер доверенности (GUID)"
                        value={editingEtrn.emchd_signer?.power_of_attorney?.number || ''}
                        onChange={(e) =>
                          setEditingEtrn({
                            ...editingEtrn,
                            emchd_signer: {
                              ...editingEtrn.emchd_signer,
                              power_of_attorney: {
                                ...editingEtrn.emchd_signer?.power_of_attorney,
                                number: e.target.value,
                              },
                            },
                          })
                        }
                        className="text-xs border border-slate-300 rounded-lg p-1.5 outline-none font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Дата выдачи доверенности (DD.MM.YYYY)"
                        value={editingEtrn.emchd_signer?.power_of_attorney?.date || ''}
                        onChange={(e) =>
                          setEditingEtrn({
                            ...editingEtrn,
                            emchd_signer: {
                              ...editingEtrn.emchd_signer,
                              power_of_attorney: {
                                ...editingEtrn.emchd_signer?.power_of_attorney,
                                date: e.target.value,
                              },
                            },
                          })
                        }
                        className="text-xs border border-slate-300 rounded-lg p-1.5 outline-none"
                      />
                    </div>
                  </div>

                  {/* Кнопка сохранения */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEtrnFormOpen(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      disabled={!editingEtrn.title?.trim()}
                      onClick={() => saveEtrnPresetMutation.mutate(editingEtrn)}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-xs transition disabled:opacity-50"
                    >
                      ✓ Сохранить пресет ЭТрн
                    </button>
                  </div>
                </div>
              ) : null}

              {isLoadingEtrn ? (
                <div className="py-12 text-center text-xs text-slate-500 font-bold">
                  Загрузка пресетов ЭТрн...
                </div>
              ) : etrnPresets.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <div className="text-2xl mb-1">⚡</div>
                  <div className="text-xs font-bold text-slate-700">Нет пресетов ЭТрн</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Нажмите «+ Добавить пресет ЭТрн» выше, чтобы создать постоянную связку МЧД и
                    реквизитов.
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {etrnPresets.map((p) => {
                    const signer = p.emchd_signer?.fio
                      ? `${p.emchd_signer.fio.lastName || ''} ${p.emchd_signer.fio.firstName?.charAt(0) || ''}.${p.emchd_signer.fio.middleName?.charAt(0) || ''}.`
                      : '—';
                    const mchdNum = p.emchd_signer?.power_of_attorney?.number;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-base">⚡</span>
                          <div className="truncate">
                            <span className="font-black text-xs text-slate-900">{p.title}</span>
                            {p.client?.name && (
                              <span className="ml-2 text-[11px] text-slate-600 font-medium">
                                🏢 {p.client.name}
                              </span>
                            )}
                            {p.forwarder?.name && (
                              <span className="ml-2 text-[11px] text-indigo-700 font-medium bg-indigo-50 px-1.5 py-0.5 rounded-md">
                                🤝 {p.forwarder.name}
                              </span>
                            )}
                            <span className="ml-2 text-[11px] text-slate-500 font-mono">
                              ✍️ МЧД: {signer} {mchdNum ? `(${mchdNum.slice(0, 8)}...)` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingEtrn(p);
                              setIsEtrnFormOpen(true);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs transition"
                          >
                            ✏️ Изменить
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Удалить пресет ЭТрн "${p.title}"?`)) {
                                deleteEtrnPresetMutation.mutate(p.id);
                              }
                            }}
                            className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition cursor-pointer"
                            title="Удалить пресет"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Шаблоны сохраняются в центральной базе данных и доступны при выписке документов во всех
            интерфейсах.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs shadow-xs transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
