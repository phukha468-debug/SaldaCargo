'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MODULE_META, SALDA_MODULES, type SaldaModule } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);

  // Form fields
  const [inviteCode, setInviteCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [inn, setInn] = useState('');
  const [selectedModules, setSelectedModules] = useState<SaldaModule[]>([
    'transport',
    'finance',
    'payroll',
  ]);
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPin, setOwnerPin] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/register-organization')
      .then((res) => res.json())
      .then((data: { enabled?: boolean }) => setRegistrationEnabled(Boolean(data.enabled)))
      .catch(() => setRegistrationEnabled(false));
  }, []);

  function toggleModule(mod: SaldaModule) {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: inviteCode.trim(),
          company_name: companyName.trim(),
          inn: inn.trim(),
          enabled_modules: selectedModules,
          owner_name: ownerName.trim(),
          owner_phone: ownerPhone.trim(),
          owner_pin: ownerPin.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось зарегистрировать компанию');
        return;
      }
      router.push('/settings');
      router.refresh();
    } catch {
      setError('Ошибка сети при создании компании');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white p-4">
      <div className="w-full max-w-lg bg-slate-800/95 border border-slate-700 rounded-3xl p-6 sm:p-7 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-black tracking-tight">Подключение компании</h1>
            <p className="text-xs text-slate-400">SALDA ERP · Private Beta</p>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Шаг {step} из 3
          </span>
        </div>

        {registrationEnabled === false ? (
          <div className="space-y-4 py-4 text-center">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700 text-sm text-slate-300">
              Регистрация новых компаний сейчас закрыта (режим Private Beta). Для тестового доступа
              задайте <code className="text-amber-400">ORG_REGISTRATION_INVITE_CODE</code> на
              сервере.
            </div>
            <Link
              href="/login"
              className="inline-block px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white"
            >
              Вернуться ко входу
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                    Инвайт-код (Private Beta) *
                  </label>
                  <input
                    type="password"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Введите код приглашения"
                    className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3.5 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                    Название компании / юрлица *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="ООО «УралЛогистика» или ИП Иванов И.И."
                    className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3.5 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                    ИНН (10 или 12 цифр, опционально)
                  </label>
                  <input
                    type="text"
                    value={inn}
                    onChange={(e) => setInn(e.target.value)}
                    placeholder="6607000000"
                    className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3.5 py-2.5 text-sm font-mono text-white"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  Выберите нужные модули (их можно изменить позже в «Настройках»):
                </p>
                <div className="space-y-1.5">
                  {SALDA_MODULES.map((modId) => {
                    const meta = MODULE_META[modId];
                    const active = selectedModules.includes(modId);
                    return (
                      <button
                        key={modId}
                        type="button"
                        onClick={() => toggleModule(modId)}
                        className={cn(
                          'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer',
                          active
                            ? 'bg-amber-500/15 border-amber-500/60 text-white'
                            : 'bg-slate-900/70 border-slate-700 text-slate-400 hover:border-slate-500',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full shrink-0',
                              active ? 'bg-amber-400' : 'bg-slate-600',
                            )}
                          />
                          <span className="text-xs font-bold truncate">{meta.label}</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase shrink-0">
                          {active ? 'Вкл' : 'Выкл'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                    Имя владельца *
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Иван Петров"
                    className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3.5 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                    Телефон владельца *
                  </label>
                  <input
                    type="tel"
                    required
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="+7 922 000 0000"
                    className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3.5 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                    ПИН-код для входа (4–6 цифр) *
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={6}
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value)}
                    placeholder="••••"
                    className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3.5 py-2.5 text-sm text-white tracking-widest"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300 font-medium">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              {step === 1 ? (
                <Link
                  href="/login"
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  ← Ко входу
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep((s) => (s === 3 ? 2 : 1));
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Назад
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    if (step === 1 && (!inviteCode.trim() || companyName.trim().length < 2)) {
                      setError('Укажите инвайт-код и название компании');
                      return;
                    }
                    if (step === 2 && selectedModules.length === 0) {
                      setError('Выберите хотя бы один модуль');
                      return;
                    }
                    setStep((s) => (s === 1 ? 2 : 3));
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white cursor-pointer"
                >
                  Далее →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Создаём компанию...' : 'Создать компанию'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
