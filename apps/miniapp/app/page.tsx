'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'restoring' | 'role' | 'user' | 'vehicle' | 'pin' | 'pin_setup';

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
  const expire = '=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  document.cookie = `${name}${expire} SameSite=None; Secure;`;
  document.cookie = `${name}${expire} SameSite=Lax;`;
  document.cookie = `${name}${expire}`;
}

export default function RootDispatcher() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Состояние авторизации по PIN
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Состояние первичной настройки PIN (если ещё нет пароля)
  const [pinSetupStep, setPinSetupStep] = useState<0 | 1>(0);
  const [firstPinValue, setFirstPinValue] = useState('');

  const handleResetAll = () => {
    try {
      clearClientCookie('salda_user_id');
      if (typeof window !== 'undefined') {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {
          // ignore
        }
      }
      fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
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
        // Если перешли с явным запросом выхода или выбора роли — сбрасываем и не восстанавливаем
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('logout') === 'true' || urlParams.get('step') === 'role') {
            handleResetAll();
            if (!cancelled) setStep('role');
            return;
          }
        }

        const cookieId = getCookieValue('salda_user_id');
        const localId =
          typeof window !== 'undefined' ? localStorage.getItem('salda_user_id') : null;
        const savedRole =
          typeof window !== 'undefined' ? localStorage.getItem('selected_role') : null;
        const userId = cookieId || localId;

        // Если сессия не сохранена — остаёмся на экране выбора роли
        if (!userId || !savedRole) {
          if (!cancelled) setStep('role');
          return;
        }

        // Проверяем валидность сохранённого пользователя
        const res = await fetch('/api/driver/me', {
          headers: { 'x-salda-user-id': userId },
          cache: 'no-store',
        });

        if (cancelled) return;

        if (res.ok) {
          const user = await res.json();
          if (user && user.id) {
            setSelectedRole(savedRole);
            setClientCookie('salda_user_id', user.id);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('salda_user_id', user.id);
              } catch (e) {
                console.warn('localStorage write failed:', e);
              }
            }

            const targetPath =
              savedRole === 'driver'
                ? '/driver'
                : savedRole === 'admin' || savedRole === 'owner'
                  ? '/admin'
                  : savedRole === 'mechanic'
                    ? '/mechanic'
                    : '/loader';

            router.replace(targetPath);
            return;
          }
        }

        // Если пользователь не найден в БД — сбрасываем битую сессию
        handleResetAll();
        if (!cancelled) setStep('role');
      } catch (err) {
        console.error('Session restore error:', err);
        handleResetAll();
        if (!cancelled) setStep('role');
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleRoleSelect = async (role: string) => {
    setSelectedRole(role);
    setLoading(true);
    try {
      const res = await fetch(`/api/users/public?role=${role}`, { cache: 'no-store' });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
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
      if (typeof window !== 'undefined') {
        localStorage.setItem('salda_user_id', user.id);
        if (selectedRole) {
          localStorage.setItem('selected_role', selectedRole);
        }
      }
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

  const proceedAfterAuth = async (user: User) => {
    await finishLogin(user);

    if (selectedRole === 'driver') {
      // Если машина уже закреплена — пропускаем выбор
      if (user.current_asset_id) {
        localStorage.setItem('active_vehicle_id', user.current_asset_id);
        router.replace('/driver');
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
        selectedRole === 'admin' || selectedRole === 'owner'
          ? '/admin'
          : selectedRole === 'mechanic'
            ? '/mechanic'
            : '/loader';
      router.replace(path);
    }
  };

  const handleUserSelect = async (user: User) => {
    setPendingUser(user);
    setPinValue('');
    setPinError('');

    // Если PIN установлен — экран ввода PIN, если нет — экран создания личного PIN
    if (user.has_pin) {
      setStep('pin');
    } else {
      setPinSetupStep(0);
      setFirstPinValue('');
      setStep('pin_setup');
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
        setPinError(data.error || 'Неверный PIN-код');
        setPinValue('');
        return;
      }
      await proceedAfterAuth(pendingUser);
    } catch {
      setPinError('Ошибка соединения');
      setPinValue('');
    } finally {
      setPinLoading(false);
    }
  };

  const handlePinSetupDigit = (digit: string) => {
    if (pinLoading) return;
    setPinError('');
    setPinValue((prev) => {
      const next = prev + digit;
      if (next.length === 4) {
        if (pinSetupStep === 0) {
          // Шаг 1 завершен, переходим к подтверждению
          setFirstPinValue(next);
          setPinSetupStep(1);
          return '';
        } else {
          // Шаг 2: проверка совпадения
          if (next === firstPinValue) {
            saveNewPin(next);
          } else {
            setPinError('PIN-коды не совпали. Попробуйте снова');
            setPinSetupStep(0);
            setFirstPinValue('');
            return '';
          }
        }
      }
      return next.length <= 4 ? next : prev;
    });
  };

  const saveNewPin = async (pin: string) => {
    if (!pendingUser) return;
    setPinLoading(true);
    setPinError('');
    try {
      const res = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: pendingUser.id, pin }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setPinError(data.error || 'Ошибка сохранения PIN');
        setPinSetupStep(0);
        setFirstPinValue('');
        setPinValue('');
        return;
      }
      await proceedAfterAuth(pendingUser);
    } catch {
      setPinError('Ошибка сети при сохранении PIN');
      setPinSetupStep(0);
      setFirstPinValue('');
      setPinValue('');
    } finally {
      setPinLoading(false);
    }
  };

  const handleVehicleConfirm = () => {
    if (selectedVehicleId) {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('active_vehicle_id', selectedVehicleId);
        }
      } catch (e) {
        console.warn('localStorage write failed:', e);
      }
      router.replace('/driver');
    }
  };

  const roles = [
    { id: 'driver', label: 'Водитель', color: 'hover:border-orange-500 hover:text-orange-600' },
    { id: 'loader', label: 'Грузчик', color: 'hover:border-blue-500 hover:text-blue-600' },
    { id: 'mechanic', label: 'Цех / СТО', color: 'hover:border-green-500 hover:text-green-600' },
    {
      id: 'admin',
      label: 'Руководство',
      color: 'hover:border-purple-500 hover:text-purple-600',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 'role':
        return (
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl overflow-hidden shadow-md flex items-center justify-center">
                <img src="/logo.png" alt="TK501" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight italic">
                TK<span className="text-orange-600">501</span>
              </h1>
              <p className="text-zinc-400 font-bold text-xs uppercase tracking-widest mt-1">
                Выберите вашу роль
              </p>
            </div>

            <div className="grid gap-3">
              {roles.map((role) => (
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
                  className="w-full p-5 bg-white border border-zinc-100 rounded-3xl shadow-sm text-left active:scale-[0.98] transition-all hover:border-orange-200 flex items-center justify-between"
                >
                  <div>
                    <div className="text-zinc-900 font-black uppercase tracking-wide">
                      {user.name}
                    </div>
                    <div className="text-[11px] font-medium text-zinc-400 mt-0.5">
                      {user.has_pin ? 'Вход по личному PIN' : 'Нужно создать PIN'}
                    </div>
                  </div>
                  {user.has_pin ? (
                    <span className="text-sm">🔒</span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                      🔑 Создать PIN
                    </span>
                  )}
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
                onClick={handleVehicleConfirm}
                disabled={!selectedVehicleId}
                className="w-full p-5 bg-orange-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-lg shadow-orange-600/30 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                ОК
              </button>
              <button
                type="button"
                onClick={() => router.replace('/driver')}
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
              <p className="text-zinc-800 font-black text-sm uppercase tracking-wide mt-2">
                {pendingUser?.name}
              </p>
              <p className="text-zinc-400 text-xs mt-1">Введите ваш личный 4-значный PIN-код</p>
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
              className="w-full text-center text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              ← Выбрать другого сотрудника
            </button>
          </div>
        );

      case 'pin_setup':
        return (
          <div className="w-full max-w-xs space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm flex items-center justify-center text-2xl">
                🔑
              </div>
              <h1 className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                Создание PIN-кода
              </h1>
              <p className="text-zinc-800 font-bold text-xs uppercase tracking-wider mt-1">
                {pendingUser?.name}
              </p>
              <div className="inline-block mt-2 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black uppercase tracking-wider">
                {pinSetupStep === 0 ? 'Шаг 1 из 2: Придумайте PIN' : 'Шаг 2 из 2: Подтвердите PIN'}
              </div>
              <p className="text-zinc-500 text-xs mt-2">
                {pinSetupStep === 0
                  ? 'Введите 4 цифры вашего личного пароля'
                  : 'Повторите те же 4 цифры для подтверждения'}
              </p>
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    i < pinValue.length
                      ? 'bg-amber-500 border-amber-500'
                      : 'bg-transparent border-zinc-300'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-center text-xs font-black text-rose-600 uppercase tracking-wide -mt-2">
                {pinError}
              </p>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  onClick={() => handlePinSetupDigit(d)}
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
                  if (pinSetupStep === 1) {
                    setPinSetupStep(0);
                    setFirstPinValue('');
                  }
                }}
                disabled={pinLoading}
                className="p-5 bg-white border border-zinc-200 rounded-2xl text-sm font-black text-zinc-400 active:scale-95 active:bg-zinc-100 transition-all disabled:opacity-40"
              >
                C
              </button>
              <button
                onClick={() => handlePinSetupDigit('0')}
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
                setPinSetupStep(0);
                setFirstPinValue('');
                setPinValue('');
                setStep('user');
              }}
              className="w-full text-center text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              ← Выбрать другого сотрудника
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
