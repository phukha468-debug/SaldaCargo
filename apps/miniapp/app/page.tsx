'use client';

import { useEffect, useState } from 'react';

type Step = 'restoring' | 'role' | 'user' | 'vehicle' | 'pin';

interface User {
  id: string;
  name: string;
  roles: string[];
  has_pin?: boolean;
  current_asset_id: string | null;
}

interface Vehicle {
  id: string;
  short_name: string;
  reg_number: string;
}

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)'));
  return match?.[2] ? decodeURIComponent(match[2]) : null;
}

function setClientCookie(name: string, value: string, maxAgeDays = 30) {
  if (typeof document === 'undefined') return;
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const sameSitePolicy = isHttps ? '; SameSite=None; Secure' : '; SameSite=Lax';
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * maxAgeDays}${sameSitePolicy}`;
}

function clearClientCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=None; Secure;`;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}

export default function RootDispatcher() {
  const [step, setStep] = useState<Step>('restoring');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  const handleResetAll = () => {
    try {
      clearClientCookie('salda_user_id');
      localStorage.clear();
      fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
    } catch (e) {
      console.error('Reset error:', e);
    }
    setStep('role');
  };

  // При монтировании: надёжно проверяем сохранённую сессию с защитой от зависания
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const cookieId = getCookieValue('salda_user_id');
        const localId =
          typeof window !== 'undefined' ? localStorage.getItem('salda_user_id') : null;
        const savedRole =
          typeof window !== 'undefined' ? localStorage.getItem('selected_role') : null;
        const userId = cookieId || localId;

        // Если сессия не сохранена — мгновенно открываем выбор роли без ожидания
        if (!userId || !savedRole) {
          if (!cancelled) setStep('role');
          return;
        }

        // Синхронизируем куку, если она была только в localStorage
        if (!cookieId && localId) {
          setClientCookie('salda_user_id', localId);
        }

        // Проверяем валидность сессии через API
        const res = await fetch('/api/driver/me', { cache: 'no-store' });
        if (cancelled) return;

        if (res.ok) {
          const user = await res.json();
          if (user && user.id) {
            const targetPath =
              savedRole === 'driver'
                ? '/driver'
                : savedRole === 'admin' || savedRole === 'owner'
                  ? '/admin'
                  : savedRole === 'mechanic'
                    ? '/mechanic'
                    : null;

            if (targetPath) {
              window.location.replace(targetPath);
              return;
            }
          }
        }

        // Если сессия недействительна (пользователь удалён или 401) — сбрасываем и даём выбрать роль
        console.warn('Session verification failed, resetting to role picker');
        handleResetAll();
      } catch (e) {
        console.error('Session restore error:', e);
        if (!cancelled) setStep('role');
      }
    }

    restoreSession();

    // Страховочный таймаут: не более 1.5 сек на проверку, затем принудительно открываем выбор роли
    const timer = setTimeout(() => {
      if (!cancelled) {
        setStep((current) => (current === 'restoring' ? 'role' : current));
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const handleRoleSelect = async (role: string) => {
    setSelectedRole(role);
    setLoading(true);
    try {
      const res = await fetch(`/api/users/public?role=${role}`);
      const data = await res.json();
      setUsers(data);
      setStep('user');
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const finishLogin = async (user: User) => {
    setClientCookie('salda_user_id', user.id);
    try {
      localStorage.setItem('salda_user_id', user.id);
      localStorage.setItem('selected_role', selectedRole ?? '');
    } catch (e) {
      console.warn('localStorage not accessible:', e);
    }
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
    } catch (e) {
      console.warn('Session API error:', e);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pinLoading) return;
    setPinError('');
    setPinValue((prev) => {
      const next = prev + digit;
      if (next.length === 4) {
        verifyPin(next);
      }
      return next.length <= 4 ? next : prev;
    });
  };

  const verifyPin = async (pin: string) => {
    if (!pendingUser) return;
    setPinLoading(true);
    setPinError('');
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: pendingUser.id, pin }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setPinError('Неверный PIN-код');
        setPinValue('');
        return;
      }
      await finishLogin(pendingUser);
      window.location.replace('/admin');
    } catch {
      setPinError('Ошибка соединения');
      setPinValue('');
    } finally {
      setPinLoading(false);
    }
  };

  const handleUserSelect = async (user: User) => {
    if ((selectedRole === 'admin' || selectedRole === 'owner') && user.has_pin) {
      setPendingUser(user);
      setPinValue('');
      setPinError('');
      setStep('pin');
      return;
    }
    await finishLogin(user);

    if (selectedRole === 'driver') {
      // Если машина уже закреплена — пропускаем выбор
      if (user.current_asset_id) {
        localStorage.setItem('active_vehicle_id', user.current_asset_id);
        window.location.replace('/driver');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/vehicles/public', { cache: 'no-store' });
        const data = await res.json();
        setVehicles(Array.isArray(data) ? data : []);
        setStep('vehicle');
      } catch (error) {
        console.error('Failed to fetch vehicles:', error);
      } finally {
        setLoading(false);
      }
    } else {
      const path =
        selectedRole === 'admin' || selectedRole === 'owner' ? '/admin' : `/${selectedRole}`;
      window.location.replace(path);
    }
  };

  const handleVehicleSelect = async (vehicleId: string) => {
    localStorage.setItem('active_vehicle_id', vehicleId);
    try {
      await fetch('/api/driver/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: vehicleId }),
      });
    } catch (err) {
      console.error('Failed to sync active vehicle to DB:', err);
    }
    window.location.replace('/driver');
  };

  const renderStep = () => {
    if (step === 'restoring' || loading) {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest italic">
            {step === 'restoring' ? 'Восстановление...' : 'Загрузка...'}
          </p>
          <button
            type="button"
            onClick={handleResetAll}
            className="mt-4 text-xs font-bold text-zinc-400 hover:text-zinc-600 uppercase underline tracking-wider py-1 px-3"
          >
            Нажмите, если экран завис (сброс)
          </button>
        </div>
      );
    }

    switch (step) {
      case 'role':
        return (
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center mb-6">
              <div className="w-24 h-24 mx-auto mb-3 rounded-2xl overflow-hidden shadow-md flex items-center justify-center">
                <img src="/logo.png" alt="TK501" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-tight italic">
                TK<span className="text-orange-600">501</span>
              </h1>
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mt-2">
                Выберите роль
              </p>
            </div>
            <div className="grid gap-4">
              {[
                { id: 'driver', label: '🚛 ВОДИТЕЛЬ', color: 'hover:border-orange-200' },
                { id: 'mechanic', label: '🔧 МЕХАНИК', color: 'hover:border-green-200' },
                { id: 'admin', label: '👑 АДМИНИСТРАЦИЯ', color: 'hover:border-blue-200' },
              ].map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  className={`w-full p-6 bg-white border border-zinc-200 rounded-3xl shadow-sm shadow-zinc-200/50 text-left text-zinc-800 font-black uppercase tracking-wide active:scale-[0.98] transition-all ${role.color} group`}
                >
                  <div className="flex items-center justify-between">
                    <span>{role.label}</span>
                    <span className="text-zinc-300 group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="pt-8 text-center">
              <button
                onClick={handleResetAll}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 hover:text-zinc-500 transition-colors"
              >
                Очистить кэш и сбросить всё
              </button>
            </div>
          </div>
        );

      case 'user':
        return (
          <div className="w-full max-w-sm space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => setStep('role')}
                className="text-zinc-400 hover:text-zinc-600 font-bold"
              >
                ← Назад
              </button>
              <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                Выберите себя
              </h2>
            </div>
            <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className="w-full p-5 bg-white border border-zinc-100 rounded-3xl shadow-sm text-left text-zinc-800 font-bold uppercase tracking-wide active:scale-[0.98] transition-all hover:border-orange-200"
                >
                  {user.name}
                </button>
              ))}
              {users.length === 0 && (
                <p className="text-center text-zinc-400 font-bold uppercase py-10">
                  Сотрудники не найдены
                </p>
              )}
            </div>
          </div>
        );

      case 'vehicle':
        return (
          <div className="w-full max-w-sm space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => setStep('user')}
                className="text-zinc-400 hover:text-zinc-600 font-bold"
              >
                ← Назад
              </button>
              <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                Выберите машину
              </h2>
            </div>
            <div className="grid gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {vehicles.map((v) => {
                const isSelected = selectedVehicleId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`w-full p-5 border rounded-3xl shadow-sm text-left active:scale-[0.98] transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50'
                        : 'bg-white border-zinc-100 hover:border-orange-200'
                    }`}
                  >
                    <div>
                      <div className="font-black text-zinc-800 uppercase">{v.short_name}</div>
                      <div className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase">
                        {v.reg_number}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-extrabold text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full uppercase">
                        Выбрана
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedVehicleId) handleVehicleSelect(selectedVehicleId);
                }}
                disabled={!selectedVehicleId}
                className="w-full p-4 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-3xl font-black uppercase tracking-wider text-base shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                ОК
              </button>
              <button
                type="button"
                onClick={() => window.location.replace('/driver')}
                className="w-full p-4 bg-zinc-50 border border-dashed border-zinc-200 rounded-3xl text-center text-zinc-400 font-bold uppercase tracking-widest hover:border-orange-200 text-xs"
              >
                Пропустить выбор машины
              </button>
            </div>
          </div>
        );

      case 'pin':
        return (
          <div className="w-full max-w-xs space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl overflow-hidden shadow-md flex items-center justify-center">
                <img src="/logo.png" alt="TK501" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-tight italic">
                TK<span className="text-orange-600">501</span>
              </h1>
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mt-2">
                {pendingUser?.name}
              </p>
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    i < pinValue.length
                      ? 'bg-orange-500 border-orange-500'
                      : 'bg-transparent border-zinc-300'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-center text-xs font-black text-rose-600 uppercase tracking-widest -mt-4">
                {pinError}
              </p>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  onClick={() => handlePinDigit(d)}
                  disabled={pinLoading || pinValue.length >= 4}
                  className="p-5 bg-white border border-zinc-200 rounded-2xl text-xl font-black text-zinc-800 active:scale-95 active:bg-zinc-100 transition-all disabled:opacity-40"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => {
                  setPinValue('');
                  setPinError('');
                }}
                disabled={pinLoading}
                className="p-5 bg-white border border-zinc-200 rounded-2xl text-sm font-black text-zinc-400 active:scale-95 active:bg-zinc-100 transition-all disabled:opacity-40"
              >
                C
              </button>
              <button
                onClick={() => handlePinDigit('0')}
                disabled={pinLoading || pinValue.length >= 4}
                className="p-5 bg-white border border-zinc-200 rounded-2xl text-xl font-black text-zinc-800 active:scale-95 active:bg-zinc-100 transition-all disabled:opacity-40"
              >
                0
              </button>
              <button
                onClick={() => setPinValue((p) => p.slice(0, -1))}
                disabled={pinLoading}
                className="p-5 bg-white border border-zinc-200 rounded-2xl text-xl font-black text-zinc-500 active:scale-95 active:bg-zinc-100 transition-all disabled:opacity-40"
              >
                ⌫
              </button>
            </div>

            <button
              onClick={() => {
                setPendingUser(null);
                setStep('user');
              }}
              className="w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 hover:text-zinc-500 transition-colors"
            >
              ← Назад
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6 font-sans antialiased">
      {renderStep()}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e4e4e7;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
