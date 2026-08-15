/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@saldacargo/ui';
import { cn } from '@saldacargo/ui';

/* ─────────────────────────────────────────────────────────────────────────────
   1. LOADER SELECT DROPDOWN
───────────────────────────────────────────────────────────────────────────── */

interface LoaderOption {
  id: string;
  name: string;
}

interface LoaderSelectDropdownProps {
  label: string;
  value?: string | null;
  onChange: (id: string | null) => void;
  loaders: LoaderOption[];
  disabledIds?: string[];
  onRemoveSlot?: () => void;
  canRemoveSlot?: boolean;
}

function LoaderSelectDropdown({
  label,
  value,
  onChange,
  loaders,
  disabledIds = [],
  onRemoveSlot,
  canRemoveSlot = false,
}: LoaderSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const filteredLoaders = loaders.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase().trim()),
  );
  const selectedLoader = loaders.find((l) => l.id === value);

  return (
    <div ref={dropdownRef} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          {label}
        </label>
        {canRemoveSlot && onRemoveSlot && (
          <button
            type="button"
            onClick={onRemoveSlot}
            className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer lowercase hover:underline"
          >
            ✕ Убрать слот
          </button>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            'w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all text-left bg-white cursor-pointer shadow-2xs',
            selectedLoader
              ? 'border-sky-300 bg-sky-50/50 text-slate-900 ring-1 ring-sky-200'
              : 'border-slate-300 text-slate-500 hover:border-slate-400',
            open && 'ring-2 ring-sky-500 border-sky-500',
          )}
        >
          <div className="flex items-center gap-2.5 truncate">
            <span
              className={cn(
                'material-symbols-outlined text-[20px] shrink-0',
                selectedLoader ? 'text-sky-600' : 'text-slate-400',
              )}
            >
              {selectedLoader ? 'engineering' : 'person_outline'}
            </span>
            <span
              className={cn(
                'truncate',
                selectedLoader ? 'font-bold text-slate-900' : 'font-medium',
              )}
            >
              {selectedLoader ? selectedLoader.name : 'Без грузчика'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedLoader && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                className="p-1 hover:bg-sky-200/70 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
                title="Снять грузчика"
              >
                <span className="material-symbols-outlined text-[16px] block">close</span>
              </span>
            )}
            <span className="material-symbols-outlined text-[20px] text-slate-400">
              {open ? 'expand_less' : 'expand_more'}
            </span>
          </div>
        </button>

        {/* Popover Menu */}
        {open && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Search */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/60">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по имени..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
              {/* Option: Без грузчика */}
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setSearch('');
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors text-left cursor-pointer',
                  !selectedLoader
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-slate-400">
                    block
                  </span>
                  <span>Без грузчика</span>
                </div>
                {!selectedLoader && (
                  <span className="material-symbols-outlined text-[18px] text-slate-600">
                    check
                  </span>
                )}
              </button>

              <div className="border-t border-slate-100 my-1" />

              {/* Loader options */}
              {filteredLoaders.length === 0 ? (
                <div className="py-3 text-center text-xs text-slate-400 font-medium">
                  Грузчик не найден
                </div>
              ) : (
                filteredLoaders.map((loader) => {
                  const isSelected = loader.id === value;
                  const isDisabled = disabledIds?.includes(loader.id);

                  return (
                    <button
                      key={loader.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        onChange(loader.id);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left',
                        isDisabled
                          ? 'opacity-40 cursor-not-allowed text-slate-400'
                          : isSelected
                            ? 'bg-sky-50 text-sky-900 font-bold cursor-pointer'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={cn(
                            'material-symbols-outlined text-[18px]',
                            isSelected ? 'text-sky-600' : 'text-slate-400',
                          )}
                        >
                          engineering
                        </span>
                        <span className="truncate">{loader.name}</span>
                        {isDisabled && (
                          <span className="text-[10px] text-amber-600 font-normal">
                            (уже выбран)
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[18px] text-sky-600">
                          check
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. CLIENT / COUNTERPARTY SELECT DROPDOWN (Search + Groups + Create)
───────────────────────────────────────────────────────────────────────────── */

interface CounterpartyOption {
  id: string;
  name: string;
  phone?: string | null;
  is_legal_entity?: boolean;
}

interface ClientSelectDropdownProps {
  value?: string | null;
  onChange: (id: string | null) => void;
  counterparties: CounterpartyOption[];
}

function ClientSelectDropdown({ value, onChange, counterparties }: ClientSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'legal' | 'individual'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newIsLegal, setNewIsLegal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setIsCreating(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const selectedCp = counterparties.find((c) => c.id === value);

  const filtered = counterparties.filter((c) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q || c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));

    if (!matchesSearch) return false;
    if (filterTab === 'legal') return Boolean(c.is_legal_entity);
    if (filterTab === 'individual') return !c.is_legal_entity;
    return true;
  });

  const legalList = filtered.filter((c) => Boolean(c.is_legal_entity));
  const individualList = filtered.filter((c) => !c.is_legal_entity);

  const totalLegal = counterparties.filter((c) => Boolean(c.is_legal_entity)).length;
  const totalIndiv = counterparties.filter((c) => !c.is_legal_entity).length;

  async function handleCreateClient(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!newName.trim()) return;

    setCreateLoading(true);
    setCreateError('');

    try {
      const res = await fetch('/api/counterparties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          is_legal_entity: newIsLegal,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setCreateError(err.error ?? 'Ошибка создания клиента');
        setCreateLoading(false);
        return;
      }

      const created = await res.json();
      await queryClient.invalidateQueries({ queryKey: ['counterparties-active'] });
      onChange(created.id);
      setIsCreating(false);
      setNewName('');
      setNewPhone('');
      setOpen(false);
    } catch {
      setCreateError('Ошибка сети при создании');
    } finally {
      setCreateLoading(false);
    }
  }

  const renderClientItem = (cp: CounterpartyOption) => {
    const isSelected = cp.id === value;
    return (
      <button
        key={cp.id}
        type="button"
        onClick={() => {
          onChange(cp.id);
          setOpen(false);
          setSearch('');
        }}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer',
          isSelected
            ? 'bg-sky-50 text-sky-900 font-bold'
            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className={cn(
              'material-symbols-outlined text-[18px] shrink-0',
              cp.is_legal_entity ? 'text-indigo-600' : 'text-emerald-600',
            )}
          >
            {cp.is_legal_entity ? 'domain' : 'person'}
          </span>
          <div className="truncate">
            <div className="truncate font-bold text-slate-800">{cp.name}</div>
            {cp.phone && <div className="text-[10px] text-slate-400 font-normal">{cp.phone}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              'text-[10px] font-extrabold px-1.5 py-0.5 rounded border',
              cp.is_legal_entity
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200',
            )}
          >
            {cp.is_legal_entity ? 'Юрлицо' : 'Физлицо'}
          </span>
          {isSelected && (
            <span className="material-symbols-outlined text-[18px] text-sky-600">check</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
        Клиент / Контрагент
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            'w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all text-left bg-white cursor-pointer shadow-2xs min-h-[38px]',
            selectedCp
              ? selectedCp.is_legal_entity
                ? 'border-indigo-300 bg-indigo-50/40 text-slate-900 ring-1 ring-indigo-200'
                : 'border-emerald-300 bg-emerald-50/40 text-slate-900 ring-1 ring-emerald-200'
              : 'border-slate-300 text-slate-600 hover:border-slate-400',
            open && 'ring-2 ring-sky-500 border-sky-500',
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <span
              className={cn(
                'material-symbols-outlined text-[18px] shrink-0',
                selectedCp
                  ? selectedCp.is_legal_entity
                    ? 'text-indigo-600'
                    : 'text-emerald-600'
                  : 'text-slate-400',
              )}
            >
              {selectedCp ? (selectedCp.is_legal_entity ? 'domain' : 'person') : 'person_outline'}
            </span>
            <div className="truncate">
              <span
                className={cn('truncate', selectedCp ? 'font-bold text-slate-900' : 'font-medium')}
              >
                {selectedCp ? selectedCp.name : 'Частное лицо (разовый заказ)'}
              </span>
              {selectedCp?.phone && (
                <span className="text-[10px] text-slate-400 ml-1.5 font-normal">
                  ({selectedCp.phone})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedCp && (
              <span
                className={cn(
                  'text-[10px] font-extrabold px-1.5 py-0.5 rounded border',
                  selectedCp.is_legal_entity
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300',
                )}
              >
                {selectedCp.is_legal_entity ? 'Юрлицо' : 'Физлицо'}
              </span>
            )}
            {selectedCp && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors"
                title="Сбросить на разового клиента"
              >
                <span className="material-symbols-outlined text-[15px] block">close</span>
              </span>
            )}
            <span className="material-symbols-outlined text-[18px] text-slate-400">
              {open ? 'expand_less' : 'expand_more'}
            </span>
          </div>
        </button>

        {/* Dropdown Menu */}
        {open && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 w-full min-w-[320px]">
            {isCreating ? (
              /* Inline Create Client Form */
              <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <span className="material-symbols-outlined text-sky-600 text-[18px]">
                      person_add
                    </span>
                    <span>Новый клиент</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕ Отмена
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                      Название компании / ФИО <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Например: ООО Вектор или Иванов И.И."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                      Телефон (опционально)
                    </label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+7 900 000-00-00"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Тип контрагента
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewIsLegal(true)}
                        className={cn(
                          'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer',
                          newIsLegal
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-800 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
                        )}
                      >
                        <span className="material-symbols-outlined text-[16px]">domain</span>
                        <span>🏢 Юрлицо</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewIsLegal(false)}
                        className={cn(
                          'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer',
                          !newIsLegal
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
                        )}
                      >
                        <span className="material-symbols-outlined text-[16px]">person</span>
                        <span>👤 Физлицо</span>
                      </button>
                    </div>
                  </div>

                  {createError && (
                    <div className="text-[11px] font-bold text-rose-600 bg-rose-50 p-1.5 rounded border border-rose-200">
                      {createError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      disabled={createLoading || !newName.trim()}
                      onClick={() => handleCreateClient()}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      {createLoading ? 'Создание...' : '💾 Создать и выбрать'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Search & Tabs Header */}
                <div className="p-2 border-b border-slate-100 bg-slate-50/70 space-y-2">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      search
                    </span>
                    <input
                      type="text"
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Поиск по названию или телефону..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  {/* Category Tabs */}
                  <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setFilterTab('all')}
                      className={cn(
                        'flex-1 py-1 px-2 rounded-md transition-all text-center cursor-pointer',
                        filterTab === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      Все ({counterparties.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab('legal')}
                      className={cn(
                        'flex-1 py-1 px-2 rounded-md transition-all text-center cursor-pointer flex items-center justify-center gap-1',
                        filterTab === 'legal'
                          ? 'bg-white text-indigo-900 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      🏢 Юрлица ({totalLegal})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab('individual')}
                      className={cn(
                        'flex-1 py-1 px-2 rounded-md transition-all text-center cursor-pointer flex items-center justify-center gap-1',
                        filterTab === 'individual'
                          ? 'bg-white text-emerald-900 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      👤 Физлица ({totalIndiv})
                    </button>
                  </div>
                </div>

                {/* List Container */}
                <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
                  {/* Default Option: Разовый клиент */}
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors text-left cursor-pointer',
                      !selectedCp
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-slate-400">
                        person_outline
                      </span>
                      <span>Частное лицо (разовый заказ)</span>
                    </div>
                    {!selectedCp && (
                      <span className="material-symbols-outlined text-[18px] text-slate-600">
                        check
                      </span>
                    )}
                  </button>

                  <div className="border-t border-slate-100 my-1" />

                  {/* Grouped or Tabbed Lists */}
                  {filtered.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400 font-medium space-y-1">
                      <div>Клиент не найден</div>
                    </div>
                  ) : filterTab === 'all' ? (
                    <>
                      {legalList.length > 0 && (
                        <div>
                          <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-500 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">domain</span>
                            <span>Юридические лица ({legalList.length})</span>
                          </div>
                          {legalList.map(renderClientItem)}
                        </div>
                      )}

                      {individualList.length > 0 && (
                        <div className="mt-1">
                          <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1 border-t border-slate-100 pt-2">
                            <span className="material-symbols-outlined text-[14px]">person</span>
                            <span>Физические лица ({individualList.length})</span>
                          </div>
                          {individualList.map(renderClientItem)}
                        </div>
                      )}
                    </>
                  ) : (
                    filtered.map(renderClientItem)
                  )}
                </div>

                {/* Footer: Add new client button */}
                <div className="p-2 border-t border-slate-100 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(true);
                      setNewName(search.trim());
                      setNewPhone('');
                      setNewIsLegal(filterTab === 'legal');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-dashed border-sky-300 bg-sky-50/70 hover:bg-sky-100 text-sky-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    <span>
                      + Добавить {search.trim() ? `«${search.trim()}»` : 'нового клиента'}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. SCHEMAS & CONSTANTS (Empty inputs allowed without forced 0)
───────────────────────────────────────────────────────────────────────────── */

const preprocessNumber = (v: unknown) => (v === '' || v === undefined || v === null ? 0 : v);

const orderSchema = z.object({
  amount: z.preprocess(preprocessNumber, z.coerce.number().min(0, 'Сумма обязательна')),
  driver_pay: z.preprocess(preprocessNumber, z.coerce.number().min(0)),
  loader_pay: z.preprocess(preprocessNumber, z.coerce.number().min(0)),
  loader2_pay: z.preprocess(preprocessNumber, z.coerce.number().min(0).optional()),
  payment_method: z.enum(['cash', 'qr', 'debt_cash', 'card_driver', 'bank_invoice']),
  counterparty_id: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const expenseSchema = z.object({
  amount: z.preprocess(preprocessNumber, z.coerce.number().min(0)),
  payment_method: z.enum(['fuel_card', 'cash', 'card_driver']),
  description: z.string().optional().nullable(),
});

const schema = z.object({
  driver_id: z.string().min(1, 'Выберите водителя'),
  asset_id: z.string().min(1, 'Выберите машину'),
  loader_id: z.string().optional().nullable(),
  loader2_id: z.string().optional().nullable(),
  trip_type: z.enum(['local', 'intercity', 'moving', 'hourly']),
  odometer_start: z.preprocess(preprocessNumber, z.coerce.number().min(0)),
  odometer_end: z.preprocess(preprocessNumber, z.coerce.number().min(0)),
  started_at: z.string().min(1, 'Укажите дату и время начала'),
  ended_at: z.string().min(1, 'Укажите дату и время окончания'),
  driver_note: z.string().optional().nullable(),
  orders: z.array(orderSchema).min(1, 'Добавьте хотя бы один заказ'),
  expenses: z.array(expenseSchema).optional(),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_METHODS = [
  {
    value: 'cash',
    label: '💵 Наличные',
    color: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  },
  {
    value: 'debt_cash',
    label: '⏳ Долг клиента (нал)',
    color: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  {
    value: 'qr',
    label: '📱 QR-код / Эквайринг',
    color: 'bg-purple-50 text-purple-800 border-purple-300',
  },
  {
    value: 'card_driver',
    label: '💳 На карту водителя',
    color: 'bg-blue-50 text-blue-800 border-blue-300',
  },
  {
    value: 'bank_invoice',
    label: '📄 Безнал (Юрлица)',
    color: 'bg-slate-100 text-slate-800 border-slate-300',
  },
] as const;

/* ─────────────────────────────────────────────────────────────────────────────
   4. MAIN RETRO PAGE
───────────────────────────────────────────────────────────────────────────── */

export default function RetroPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showLoader2, setShowLoader2] = useState(false);

  // Default dates: Today 08:00 to 18:00
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const defaultStart = `${todayStr}T08:00`;
  const defaultEnd = `${todayStr}T18:00`;

  // 1. Fetch Assets
  const { data: assets = [] } = useQuery<
    Array<{
      id: string;
      short_name: string;
      reg_number: string;
      odometer_current: number;
      assigned_driver_id?: string;
    }>
  >({
    queryKey: ['assets'],
    queryFn: () => fetch('/api/assets').then((r) => r.json()),
    staleTime: 60000,
  });

  // 2. Fetch Drivers
  const { data: drivers = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['drivers'],
    queryFn: () => fetch('/api/users?role=driver').then((r) => r.json()),
    staleTime: 60000,
  });

  // 3. Fetch Loaders
  const { data: loaders = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['loaders'],
    queryFn: () => fetch('/api/users?role=loader').then((r) => r.json()),
    staleTime: 60000,
  });

  // 4. Fetch Counterparties
  const { data: counterparties = [] } = useQuery<CounterpartyOption[]>({
    queryKey: ['counterparties-active'],
    queryFn: () => fetch('/api/counterparties?active=1').then((r) => r.json()),
    staleTime: 60000,
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema as any),
    defaultValues: {
      trip_type: 'local',
      started_at: defaultStart,
      ended_at: defaultEnd,
      odometer_start: '' as any,
      odometer_end: '' as any,
      loader_id: null,
      loader2_id: null,
      orders: [
        {
          amount: '' as any,
          driver_pay: '' as any,
          loader_pay: '' as any,
          loader2_pay: '' as any,
          payment_method: 'cash',
          counterparty_id: null,
          description: 'Перевозка груза',
        },
      ],
      expenses: [],
    },
  });

  const {
    fields: orderFields,
    append: appendOrder,
    remove: removeOrder,
  } = useFieldArray({
    control,
    name: 'orders',
  });

  const {
    fields: expenseFields,
    append: appendExpense,
    remove: removeExpense,
  } = useFieldArray({
    control,
    name: 'expenses',
  });

  const selectedAssetId = watch('asset_id');
  const loaderId = watch('loader_id');
  const loader2Id = watch('loader2_id');

  const selectedLoader1 = loaders.find((l) => l.id === loaderId);
  const selectedLoader2 = loaders.find((l) => l.id === loader2Id);
  const isSecondLoaderActive = showLoader2 || Boolean(loader2Id);

  const odoStart = Number(watch('odometer_start')) || 0;
  const odoEnd = Number(watch('odometer_end')) || 0;
  const distance = Math.max(0, odoEnd - odoStart);

  // When asset is selected, prefill odometer_start if it's currently 0 or empty
  const onAssetChange = (assetId: string) => {
    setValue('asset_id', assetId);
    const selected = assets.find((a) => a.id === assetId);
    if (selected) {
      if ((odoStart === 0 || !watch('odometer_start')) && selected.odometer_current > 0) {
        setValue('odometer_start', selected.odometer_current);
        setValue('odometer_end', selected.odometer_current + 100);
      }
      if (selected.assigned_driver_id && !watch('driver_id')) {
        setValue('driver_id', selected.assigned_driver_id);
      }
    }
  };

  const orders = watch('orders') || [];
  const expenses = watch('expenses') || [];

  const totalRevenue = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const totalDriverPay = orders.reduce((s, o) => s + (Number(o.driver_pay) || 0), 0);
  const totalLoader1Pay = orders.reduce((s, o) => s + (Number(o.loader_pay) || 0), 0);
  const totalLoader2Pay = orders.reduce((s, o) => s + (Number(o.loader2_pay) || 0), 0);
  const totalLoaderPay = totalLoader1Pay + totalLoader2Pay;
  const totalFuelExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalPayroll = totalDriverPay + totalLoaderPay;
  const estimatedProfit = totalRevenue - (totalPayroll + totalFuelExpenses);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          odometer_start: Number(data.odometer_start) || 0,
          odometer_end: Number(data.odometer_end) || 0,
          loader_id: data.loader_id || null,
          loader2_id: data.loader2_id || null,
          orders: data.orders.map((o) => ({
            ...o,
            counterparty_id: o.counterparty_id || null,
            amount: String(Number(o.amount) || 0),
            driver_pay: String(Number(o.driver_pay) || 0),
            loader_pay: String(Number(o.loader_pay) || 0),
            loader2_pay: String(Number(o.loader2_pay) || 0),
          })),
          expenses: (data.expenses || []).map((e) => ({
            ...e,
            amount: String(Number(e.amount) || 0),
          })),
        }),
      });

      if (!res.ok) {
        const result = (await res.json()) as { error?: string };
        setError(result.error ?? 'Ошибка сохранения рейса');
        setSubmitting(false);
        return;
      }

      router.push('/review');
      router.refresh();
    } catch {
      setError('Ошибка сети или сервера');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Top Header Banner ────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-400 text-[26px]">history_edu</span>
            <h1 className="text-xl font-black tracking-tight text-white">Ретро-ввод рейса</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Ручное внесение завершённых смен и путевых листов. После сохранения рейс моментально
            попадает в раздел «Ревью».
          </p>
        </div>

        {/* Live Summary Counter */}
        <div className="bg-slate-800/90 border border-slate-700/60 rounded-xl px-4 py-2.5 text-right">
          <div className="text-[10px] uppercase font-extrabold text-slate-400">
            Итого прибыль рейса
          </div>
          <div
            className={cn(
              'text-lg font-black leading-none mt-0.5',
              estimatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400',
            )}
          >
            {estimatedProfit >= 0 ? '+' : ''}
            {Math.round(estimatedProfit).toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Выручка: {totalRevenue.toLocaleString('ru-RU')} ₽ · ЗП:{' '}
            {totalPayroll.toLocaleString('ru-RU')} ₽
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ═══════════════════════════════════════════════════════════════
            BLOCK 1: АВТОМОБИЛЬ И ЭКИПАЖ
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-slate-700">local_shipping</span>
            <h2 className="text-base font-extrabold text-slate-900">1. Автомобиль и Экипаж</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Asset Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Машина автопарка <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedAssetId || ''}
                onChange={(e) => onAssetChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="">Выберите автомобиль...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.short_name} {a.reg_number ? `(${a.reg_number})` : ''} ·{' '}
                    {a.odometer_current
                      ? `${a.odometer_current.toLocaleString('ru-RU')} км`
                      : '0 км'}
                  </option>
                ))}
              </select>
              {errors.asset_id && (
                <p className="text-rose-600 text-xs font-bold mt-1">{errors.asset_id.message}</p>
              )}
            </div>

            {/* Driver Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Водитель <span className="text-rose-500">*</span>
              </label>
              <select
                {...register('driver_id')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="">Выберите водителя...</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {errors.driver_id && (
                <p className="text-rose-600 text-xs font-bold mt-1">{errors.driver_id.message}</p>
              )}
            </div>

            {/* Loader #1 Selection */}
            <div>
              <LoaderSelectDropdown
                label="Грузчик #1"
                value={loaderId}
                onChange={(id) => setValue('loader_id', id)}
                loaders={loaders}
                disabledIds={loader2Id ? [loader2Id] : []}
              />
            </div>

            {/* Loader #2 Selection or Add Button */}
            <div>
              {isSecondLoaderActive ? (
                <LoaderSelectDropdown
                  label="Грузчик #2"
                  value={loader2Id}
                  onChange={(id) => setValue('loader2_id', id)}
                  loaders={loaders}
                  disabledIds={loaderId ? [loaderId] : []}
                  canRemoveSlot={true}
                  onRemoveSlot={() => {
                    setValue('loader2_id', null);
                    setShowLoader2(false);
                    orders.forEach((_, idx) => {
                      setValue(`orders.${idx}.loader2_pay`, '' as any);
                    });
                  }}
                />
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Второй грузчик
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowLoader2(true)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-sky-300 bg-sky-50/50 hover:bg-sky-100 text-sky-700 px-3 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">group_add</span>
                    <span>+ Добавить 2-го грузчика</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Тип рейса
              </label>
              <select
                {...register('trip_type')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="local">По городу</option>
                <option value="intercity">Межгород</option>
                <option value="moving">Переезд</option>
                <option value="hourly">Почасовой</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Дата и время начала
              </label>
              <input
                type="datetime-local"
                {...register('started_at')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Дата и время окончания
              </label>
              <input
                type="datetime-local"
                {...register('ended_at')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            {/* Mileage calculation */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                  Дистанция
                </span>
                <span className="text-base font-black text-slate-900">
                  {distance.toLocaleString('ru-RU')} км
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Старт / Финиш</span>
                <span className="text-xs font-bold text-slate-700">
                  {odoStart} → {odoEnd}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Одометр старт (км)
              </label>
              <input
                type="number"
                {...register('odometer_start')}
                placeholder="0 км"
                onFocus={(e) => e.target.select()}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Одометр финиш (км)
              </label>
              <input
                type="number"
                {...register('odometer_end')}
                placeholder="0 км"
                onFocus={(e) => e.target.select()}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Примечание / Маршрут
              </label>
              <input
                type="text"
                {...register('driver_note')}
                placeholder="Например: Салда - Тагил - Екб, доставка оборудования"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            BLOCK 2: ЗАКАЗЫ И ОПЛАТЫ
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">receipt_long</span>
              <h2 className="text-base font-extrabold text-slate-900">
                2. Заказы и Оплаты ({orderFields.length})
              </h2>
            </div>
            <div className="text-xs font-bold text-slate-500">
              Выручка:{' '}
              <span className="text-emerald-600 font-extrabold">
                {totalRevenue.toLocaleString('ru-RU')} ₽
              </span>{' '}
              · ЗП водителя:{' '}
              <span className="text-amber-600 font-extrabold">
                {totalDriverPay.toLocaleString('ru-RU')} ₽
              </span>
              {totalLoaderPay > 0 && (
                <>
                  {' '}
                  · ЗП грузчиков:{' '}
                  <span className="text-sky-600 font-extrabold">
                    {totalLoaderPay.toLocaleString('ru-RU')} ₽
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {orderFields.map((field, i) => (
              <div
                key={field.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md">
                    Заказ #{i + 1}
                  </span>
                  {orderFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOrder(i)}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                    >
                      Удалить заказ ✕
                    </button>
                  )}
                </div>

                <div
                  className={cn(
                    'grid gap-3',
                    isSecondLoaderActive
                      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-5'
                      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
                  )}
                >
                  {/* Amount */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Сумма заказа (₽) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      {...register(`orders.${i}.amount`)}
                      placeholder="0 ₽"
                      onFocus={(e) => e.target.select()}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Способ оплаты <span className="text-rose-500">*</span>
                    </label>
                    <select
                      {...register(`orders.${i}.payment_method`)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Driver Pay */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      ЗП Водителя (₽)
                    </label>
                    <input
                      type="number"
                      {...register(`orders.${i}.driver_pay`)}
                      placeholder="0 ₽"
                      onFocus={(e) => e.target.select()}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-amber-600 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Loader #1 Pay */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 truncate">
                      {selectedLoader1
                        ? `ЗП ${selectedLoader1.name.split(' ')[0]} (₽)`
                        : isSecondLoaderActive
                          ? 'ЗП Грузчика 1 (₽)'
                          : 'ЗП Грузчика (₽)'}
                    </label>
                    <input
                      type="number"
                      {...register(`orders.${i}.loader_pay`)}
                      placeholder="0 ₽"
                      onFocus={(e) => e.target.select()}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-sky-700 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  {/* Loader #2 Pay (if active) */}
                  {isSecondLoaderActive && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 truncate">
                        {selectedLoader2
                          ? `ЗП ${selectedLoader2.name.split(' ')[0]} (₽)`
                          : 'ЗП Грузчика 2 (₽)'}
                      </label>
                      <input
                        type="number"
                        {...register(`orders.${i}.loader2_pay`)}
                        placeholder="0 ₽"
                        onFocus={(e) => e.target.select()}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-sky-700 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Counterparty / Client Dropdown */}
                  <div>
                    <ClientSelectDropdown
                      value={watch(`orders.${i}.counterparty_id`)}
                      onChange={(cpId) => setValue(`orders.${i}.counterparty_id`, cpId)}
                      counterparties={counterparties}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Описание груза
                    </label>
                    <input
                      type="text"
                      {...register(`orders.${i}.description`)}
                      placeholder="Например: Доставка мебели / Металлопрокат"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              appendOrder({
                amount: '' as any,
                driver_pay: '' as any,
                loader_pay: '' as any,
                loader2_pay: '' as any,
                payment_method: 'cash',
                counterparty_id: null,
                description: '',
              })
            }
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-4 py-2 rounded-xl transition-all border border-sky-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>+ Добавить еще один заказ</span>
          </button>

          {errors.orders && (
            <p className="text-rose-600 text-xs font-bold mt-2">{errors.orders.message}</p>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            BLOCK 3: ПУТЕВЫЕ РАСХОДЫ И ТОПЛИВО (ГСМ)
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600">local_gas_station</span>
              <h2 className="text-base font-extrabold text-slate-900">
                3. Расходы на ГСМ и Топливо
              </h2>
            </div>
            <div className="text-xs font-bold text-rose-600">
              Сумма топлива: {totalFuelExpenses.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          {expenseFields.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              В этом рейсе не было заправок или расходов на ГСМ.
            </div>
          )}

          <div className="space-y-2.5">
            {expenseFields.map((field, i) => (
              <div
                key={field.id}
                className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              >
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Сумма (₽)
                  </label>
                  <input
                    type="number"
                    {...register(`expenses.${i}.amount`)}
                    placeholder="0 ₽"
                    onFocus={(e) => e.target.select()}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-rose-600 bg-white"
                  />
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Способ оплаты
                  </label>
                  <select
                    {...register(`expenses.${i}.payment_method`)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white"
                  >
                    <option value="fuel_card">Топливная карта (ГСМ)</option>
                    <option value="cash">Наличные из кассы рейса</option>
                    <option value="card_driver">Карта компании / водителя</option>
                  </select>
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Описание / АЗС
                  </label>
                  <input
                    type="text"
                    {...register(`expenses.${i}.description`)}
                    placeholder="АЗС Газпромнефть / Лукойл"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeExpense(i)}
                  className="text-rose-600 hover:text-rose-800 font-bold p-1.5 rounded mt-4 cursor-pointer"
                  title="Удалить расход"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              appendExpense({
                amount: '' as any,
                payment_method: 'fuel_card',
                description: 'Заправка ДТ',
              })
            }
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-xl transition-all border border-rose-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">local_gas_station</span>
            <span>+ Добавить заправку ГСМ</span>
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm font-bold flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Submit Button Bar ────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={() => router.push('/review')}
            className="px-5 py-3 rounded-xl border border-slate-300 text-slate-600 hover:text-slate-900 font-bold text-sm transition-colors cursor-pointer"
          >
            Отмена
          </button>

          <Button type="submit" size="hero" disabled={submitting} className="min-w-[240px]">
            {submitting ? 'Сохраняем рейс...' : '💾 Сохранить и отправить в Ревью'}
          </Button>
        </div>
      </form>
    </div>
  );
}
