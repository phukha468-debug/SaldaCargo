'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'role' | 'user' | 'vehicle';

interface User {
  id: string;
  name: string;
  roles: string[];
}

interface Vehicle {
  id: string;
  short_name: string;
  reg_number: string;
}

export default function RootDispatcher() {
  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 1. При входе сбрасываем старую куку, если мы на первом шаге
  useEffect(() => {
    if (step === 'role') {
      document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
  }, [step]);

  const handleResetAll = () => {
    document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    localStorage.clear();
    window.location.reload();
  };

  // Загрузка пользователей при выборе роли
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

  // Загрузка машин для водителя
  const handleUserSelect = async (user: User) => {
    // Сохраняем ID пользователя в куку для Middleware
    document.cookie = `salda_user_id=${user.id}; path=/; max-age=${60 * 60 * 24 * 7}`;

    if (selectedRole === 'driver') {
      setLoading(true);
      try {
        const res = await fetch('/api/vehicles/public', { cache: 'no-store' });
        const data = await res.json();
        setVehicles(Array.isArray(data) ? data : []);
        setStep('vehicle');
      } catch (error) {
        console.error('Failed to fetch vehicles:', error);
        // Оставляем на текущем шаге, чтобы пользователь увидел ошибку в консоли
      } finally {
        setLoading(false);
      }
    } else {
      // Для других ролей - сразу редирект
      const path =
        selectedRole === 'admin' || selectedRole === 'owner' ? '/admin' : `/${selectedRole}`;
      router.push(path);
    }
  };

  const handleVehicleSelect = (vehicleId: string) => {
    localStorage.setItem('active_vehicle_id', vehicleId);
    router.push('/driver');
  };

  const renderStep = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest italic">
            Загрузка...
          </p>
        </div>
      );
    }

    switch (step) {
      case 'role':
        return (
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-tight italic">
                Salda<span className="text-orange-600">Cargo</span>
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
            <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleVehicleSelect(v.id)}
                  className="w-full p-5 bg-white border border-zinc-100 rounded-3xl shadow-sm text-left active:scale-[0.98] transition-all hover:border-orange-200"
                >
                  <div className="font-black text-zinc-800 uppercase">{v.short_name}</div>
                  <div className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase">
                    {v.reg_number}
                  </div>
                </button>
              ))}
              <button
                onClick={() => router.push('/driver')}
                className="w-full p-5 bg-zinc-50 border border-dashed border-zinc-200 rounded-3xl text-center text-zinc-400 font-bold uppercase tracking-widest hover:border-orange-200"
              >
                Пропустить выбор машины
              </button>
            </div>
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
