'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { PayrollUser } from './page';

interface ShiftCalendarModalProps {
  user: PayrollUser;
  initialYear: number;
  initialMonth: number; // 1..12
  onClose: () => void;
  onSaved?: () => void;
  onOpenPayslip?: () => void;
}

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const WEEKDAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const ShiftCalendarModal: React.FC<ShiftCalendarModalProps> = ({
  user,
  initialYear,
  initialMonth,
  onClose,
  onSaved,
  onOpenPayslip,
}) => {
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const [rate, setRate] = useState<number>(() => {
    const nameLower = (user.name || '').toLowerCase();
    const notesLower = (user.notes || '').toLowerCase();
    if (notesLower.includes('ставка:')) {
      const m = notesLower.match(/ставка[:\s]+(\d+)/i);
      if (m && m[1]) return parseInt(m[1], 10);
    }
    if (nameLower.includes('татьяна') || notesLower.includes('гараж')) return 1000;
    if (nameLower.includes('ирина') || notesLower.includes('офис')) return 250;
    return 1000;
  });

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('shift-modal-open');
    return () => {
      document.body.classList.remove('shift-modal-open');
    };
  }, []);

  // Загружаем сохранённые смены для данного месяца и сотрудника
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    fetch(`/api/staff/shifts?user_id=${user.id}&year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
        } else {
          if (Array.isArray(data.selected_dates)) {
            setSelectedDates(new Set(data.selected_dates));
          } else {
            setSelectedDates(new Set());
          }
          if (typeof data.current_rate === 'number' && data.current_rate > 0) {
            setRate(data.current_rate);
          }
          setIsSettled(Boolean(data.is_settled));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Ошибка загрузки смен');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user.id, year, month]);

  // Навигация по месяцам
  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  // Построение сетки календаря
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 0 = Понедельник ... 6 = Воскресенье

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      dayOfWeek: number; // 0..6 (Пн..Вс)
    }> = [];

    // Пустые ячейки до первого дня месяца
    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: dNum,
        isCurrentMonth: false,
        dayOfWeek: (firstDayOfWeek - 1 - i) % 7,
      });
    }

    // Дни текущего месяца
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayOfWeek = (new Date(year, month - 1, i).getDay() + 6) % 7;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        dayOfWeek,
      });
    }

    // Дополняем до полных недель (кратность 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextM = month === 12 ? 1 : month + 1;
      const nextY = month === 12 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayOfWeek = days.length % 7;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        dayOfWeek,
      });
    }

    return days;
  }, [year, month]);

  // Переключение выбора дня
  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  // Пресеты
  const applyPreset = (type: 'tue_fri' | 'mon_thu' | 'weekdays' | 'clear') => {
    if (type === 'clear') {
      setSelectedDates(new Set());
      return;
    }

    const next = new Set<string>();
    for (const d of calendarDays) {
      if (!d.isCurrentMonth) continue;

      if (type === 'tue_fri' && (d.dayOfWeek === 1 || d.dayOfWeek === 4)) {
        // Вторник (1) и Пятница (4) -> стандартные 8 раз в месяц (по 2 раза в неделю)
        next.add(d.dateStr);
      } else if (type === 'mon_thu' && (d.dayOfWeek === 0 || d.dayOfWeek === 3)) {
        // Понедельник (0) и Четверг (3)
        next.add(d.dateStr);
      } else if (type === 'weekdays' && d.dayOfWeek >= 0 && d.dayOfWeek <= 4) {
        next.add(d.dateStr);
      }
    }
    setSelectedDates(next);
  };

  const selectedCount = selectedDates.size;
  const totalAccrual = selectedCount * rate;

  // Сохранение и создание начисления
  const handleSave = async (andOpenPayslip = false) => {
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/staff/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          year,
          month,
          selected_dates: Array.from(selectedDates),
          rate,
          save_default_rate: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Ошибка сохранения табеля');
      }

      setSuccessMsg(
        `✓ Начислено ${totalAccrual.toLocaleString('ru-RU')} ₽ (${selectedCount} смен)`,
      );
      if (onSaved) onSaved();

      if (andOpenPayslip) {
        setTimeout(() => {
          onClose();
          if (onOpenPayslip) onOpenPayslip();
        }, 300);
      } else {
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const sortedDatesFormatted = useMemo(() => {
    return Array.from(selectedDates)
      .filter((d) => d.startsWith(`${year}-${String(month).padStart(2, '0')}`))
      .sort()
      .map((d) => {
        const parts = d.split('-');
        return parts[2];
      })
      .join(', ');
  }, [selectedDates, year, month]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Шапка модала */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-xl shrink-0">
              🧹
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black tracking-tight truncate flex items-center gap-2">
                <span>{user.name}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300">
                  {user.notes || 'Уборщица'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Табель рабочих смен и расчёт заработной платы
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Навигация по месяцу */}
        <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-white shrink-0">
          <button
            onClick={() => shiftMonth(-1)}
            className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-900 text-sm font-bold transition-colors"
          >
            ← Предыдущий
          </button>
          <div className="text-center font-black text-sm sm:text-base tracking-wide flex items-center gap-2">
            <span>
              📅 {MONTH_NAMES[month - 1]} {year}
            </span>
            {isSettled && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                ✓ Выплачено
              </span>
            )}
          </div>
          <button
            onClick={() => shiftMonth(1)}
            className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-900 text-sm font-bold transition-colors"
          >
            Следующий →
          </button>
        </div>

        {/* Основной контент */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Блок ставки за день */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Ставка за одну смену / выход:
                </label>
                <div className="relative inline-block w-40">
                  <input
                    type="number"
                    min="1"
                    step="50"
                    value={rate}
                    onChange={(e) => setRate(Math.max(0, parseInt(e.target.value || '0', 10)))}
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-300 font-black text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 font-bold">₽</span>
                </div>
              </div>

              {/* Быстрые фишки ставки */}
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                <span className="text-[11px] text-slate-400 w-full sm:w-auto text-left sm:text-right font-medium">
                  Пресеты:
                </span>
                {[250, 500, 1000, 1500].map((presetVal) => (
                  <button
                    key={presetVal}
                    type="button"
                    onClick={() => setRate(presetVal)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-bold border transition-all ${
                      rate === presetVal
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:bg-teal-50/50'
                    }`}
                  >
                    {presetVal.toLocaleString('ru-RU')} ₽
                  </button>
                ))}
              </div>
            </div>
            {rate === 1000 && (
              <p className="text-[11px] text-slate-500 mt-2">
                💡 Стандартная ставка для гаража (Татьяна): 1 000 ₽ за уборку.
              </p>
            )}
            {rate === 250 && (
              <p className="text-[11px] text-slate-500 mt-2">
                💡 Стандартная ставка для офиса (Ирина): 250 ₽ за уборку.
              </p>
            )}
          </div>

          {/* Быстрые кнопки заполнения графика */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">
                Быстрый выбор графика (8 раз в месяц):
              </span>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => applyPreset('clear')}
                  className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                >
                  Очистить все
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('tue_fri')}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-center transition-colors shadow-2xs"
                title="Стандартный график 2 раза в неделю: Вторник и Пятница"
              >
                🗓️ Вторник + Пятница (8)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('mon_thu')}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-center transition-colors shadow-2xs"
                title="График 2 раза в неделю: Понедельник и Четверг"
              >
                🗓️ Понедельник + Четверг (8)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('weekdays')}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-center transition-colors shadow-2xs col-span-2 sm:col-span-1"
              >
                Все будние дни
              </button>
            </div>
          </div>

          {/* Сетка календаря */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            {/* Заголовки дней недели */}
            <div className="grid grid-cols-7 bg-slate-100/80 border-b border-slate-200 text-center text-xs font-bold text-slate-500 py-1.5">
              {WEEKDAY_NAMES.map((name, i) => (
                <div key={name} className={i >= 5 ? 'text-rose-500' : ''}>
                  {name}
                </div>
              ))}
            </div>

            {/* Ячейки дней */}
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm font-medium">
                Загрузка табеля...
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-px bg-slate-200 p-px">
                {calendarDays.map((d) => {
                  const isSelected = selectedDates.has(d.dateStr);
                  const isWeekend = d.dayOfWeek >= 5;

                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => toggleDate(d.dateStr)}
                      className={`min-h-[58px] sm:min-h-[64px] p-1.5 sm:p-2 cursor-pointer select-none transition-all flex flex-col justify-between ${
                        !d.isCurrentMonth
                          ? 'bg-slate-50/70 text-slate-300 opacity-60'
                          : isSelected
                            ? 'bg-teal-500 text-white font-bold ring-2 ring-teal-600 ring-inset shadow-xs'
                            : 'bg-white hover:bg-teal-50/40 text-slate-800'
                      }`}
                    >
                      {/* Верхняя строка: число + чекбокс */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs sm:text-sm font-black ${
                            isSelected
                              ? 'text-white'
                              : isWeekend
                                ? 'text-rose-500'
                                : 'text-slate-800'
                          }`}
                        >
                          {d.dayNumber}
                        </span>

                        {/* Галочка / чекбокс */}
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-white border-white text-teal-700'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && (
                            <span className="text-[11px] font-black leading-none">✓</span>
                          )}
                        </div>
                      </div>

                      {/* Нижняя метка: сумма за день */}
                      {isSelected ? (
                        <div className="text-[10px] sm:text-[11px] font-black text-teal-100 tracking-tight leading-none mt-1">
                          +{rate.toLocaleString('ru-RU')} ₽
                        </div>
                      ) : (
                        <div className="text-[10px] text-transparent leading-none mt-1">0</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Итоги */}
          <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200/80 rounded-xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Итоговый расчёт за {MONTH_NAMES[month - 1]} {year}:
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-teal-950">
                    {totalAccrual.toLocaleString('ru-RU')} ₽
                  </span>
                  <span className="text-xs font-bold text-teal-700">
                    ({selectedCount}{' '}
                    {selectedCount === 1
                      ? 'смена'
                      : selectedCount >= 2 && selectedCount <= 4
                        ? 'смены'
                        : 'смен'}{' '}
                    × {rate.toLocaleString('ru-RU')} ₽)
                  </span>
                </div>
              </div>

              {sortedDatesFormatted ? (
                <div className="text-left sm:text-right max-w-xs">
                  <span className="text-[11px] text-slate-400 font-semibold block">
                    Отмеченные числа:
                  </span>
                  <span className="text-xs font-black text-slate-700 leading-snug">
                    {sortedDatesFormatted}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Смены ещё не отмечены</p>
              )}
            </div>
          </div>

          {/* Сообщения */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
              <span>✓</span>
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Подвал с действиями */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-bold transition-colors order-3 sm:order-1"
          >
            Закрыть
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2 justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="px-4 py-2.5 rounded-xl border border-teal-300 bg-white hover:bg-teal-50 text-teal-800 text-sm font-bold transition-all disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить табель'}
            </button>

            <button
              type="button"
              disabled={saving || selectedCount === 0}
              onClick={() => handleSave(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-sm font-black transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <span>📄</span>
              <span>{saving ? 'Формирование...' : 'Сформировать расчётный лист'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
