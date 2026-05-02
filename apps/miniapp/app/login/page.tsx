'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@saldacargo/ui';

type Step = 'role' | 'user' | 'pin';
type Role = 'driver' | 'mechanic' | 'admin';

const ROLES: { value: Role; label: string; icon: string }[] = [
  { value: 'driver', label: 'Водитель', icon: '🚚' },
  { value: 'mechanic', label: 'Механик', icon: '🔧' },
  { value: 'admin', label: 'Админ', icon: '🔑' },
];

export default function LoginPage() {
  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Загружаем список пользователей при выборе роли
  useEffect(() => {
    if (selectedRole) {
      setLoading(true);
      fetch(`/api/auth/users?role=${selectedRole}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setUsers(data);
          } else {
            setError('Ошибка загрузки пользователей');
          }
        })
        .catch(() => setError('Ошибка сервера'))
        .finally(() => setLoading(false));
    }
  }, [selectedRole]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, pin }),
      });

      if (response.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || 'Ошибка входа');
      }
    } catch (_err) {
      setError('Ошибка сервера');
    } finally {
      setLoading(false);
    }
  }

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep('user');
  };

  const handleUserSelect = (userId: string) => {
    console.log('Selected user:', userId);
    setSelectedUserId(userId);
    setStep('pin');
  };

  const selectedUserName = users.find(u => u.id === selectedUserId)?.name || 'Пользователь';

  const reset = () => {
    // Очищаем куку сессии для чистого теста
    document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setStep('role');
    setSelectedRole(null);
    setSelectedUserId('');
    setPin('');
    setError('');
  };

  return (
    <main className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      {/* Кнопка сброса для тестов */}
      <button 
        onClick={reset}
        className="fixed top-4 right-4 bg-zinc-200 text-zinc-500 text-[10px] font-bold uppercase px-3 py-1 rounded-full hover:bg-zinc-300 transition-colors"
      >
        Сбросить сессию
      </button>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-zinc-200/50 border border-zinc-100 overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight uppercase italic">
              Salda<span className="text-orange-600">Cargo</span>
            </h1>
            <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest mt-1">
              Система управления
            </p>
          </div>

          {step === 'role' && (
            <div className="space-y-3">
              <h2 className="text-center font-black text-zinc-900 uppercase tracking-tight mb-6">
                Кто заходит?
              </h2>
              <div className="grid gap-3">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => handleRoleSelect(r.value)}
                    className="flex items-center gap-4 bg-zinc-50 hover:bg-zinc-100 border-2 border-zinc-100 rounded-2xl p-4 transition-all active:scale-[0.98] group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{r.icon}</span>
                    <span className="font-bold text-zinc-800 uppercase tracking-wide">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'user' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-6">
                <button onClick={reset} className="text-zinc-400 hover:text-zinc-600">←</button>
                <h2 className="flex-1 text-center font-black text-zinc-900 uppercase tracking-tight">
                  Выбери себя
                </h2>
              </div>
              
              {loading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-6 h-6 border-4 border-zinc-200 border-t-orange-600 rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleUserSelect(u.id)}
                      className="bg-zinc-50 hover:bg-zinc-100 border-2 border-zinc-100 rounded-2xl p-4 text-left font-bold text-zinc-800 uppercase tracking-wide transition-all active:scale-[0.98]"
                    >
                      {u.name}
                    </button>
                  ))}
                  {users.length === 0 && !loading && (
                    <p className="text-center text-zinc-400 text-sm py-8 font-bold uppercase tracking-widest">
                      Пользователи не найдены
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'pin' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setStep('user')} className="text-zinc-400 hover:text-zinc-600">←</button>
                <div className="flex-1 text-center">
                   <h2 className="font-black text-zinc-900 uppercase tracking-tight">
                    Введи ПИН-код
                  </h2>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    {selectedUserName}
                  </p>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 ${
                        pin.length > i ? 'bg-orange-600 border-orange-600' : 'bg-zinc-100 border-zinc-200'
                      } transition-all duration-100`}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map((btn) => (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => {
                        if (btn === 'C') setPin('');
                        else if (btn === '←') setPin(p => p.slice(0, -1));
                        else if (pin.length < 4) setPin(p => p + btn);
                      }}
                      className="h-16 rounded-2xl bg-zinc-50 hover:bg-zinc-100 border-2 border-zinc-100 font-black text-xl text-zinc-800 transition-all active:scale-90"
                    >
                      {btn}
                    </button>
                  ))}
                </div>

                {error && (
                  <p className="text-center text-red-500 text-[10px] font-bold uppercase tracking-widest animate-shake">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  size="hero"
                  disabled={loading || pin.length < 4}
                  className="font-black uppercase tracking-widest"
                >
                  {loading ? 'Проверка...' : 'Войти'}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
      
      <p className="mt-8 text-zinc-400 font-bold text-[10px] uppercase tracking-widest">
        v1.0.4 • SaldaCargo
      </p>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 10px; }
      `}</style>
    </main>
  );
}
