/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);

  const { data: user, isLoading } = useQuery<any>({
    queryKey: ['driver-profile'],
    queryFn: () => fetch('/api/driver/profile').then((r) => r.json()),
    staleTime: 60000,
  });

  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ['vehicles-public'],
    queryFn: () => fetch('/api/vehicles/public').then((r) => r.json()),
    staleTime: 300000,
    enabled: showVehiclePicker,
  });

  const updateVehicle = useMutation({
    mutationFn: (asset_id: string | null) =>
      fetch('/api/driver/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id }),
      }).then((r) => r.json()),
    onSuccess: (_, asset_id) => {
      localStorage.setItem('active_vehicle_id', asset_id ?? '');
      queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
      setShowVehiclePicker(false);
    },
  });

  const handleLogout = () => {
    document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    localStorage.clear();
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-32 bg-zinc-200 rounded-full w-32 mx-auto" />
        <div className="h-8 w-48 bg-zinc-200 rounded mx-auto" />
        <div className="space-y-3 pt-10">
          <div className="h-14 bg-zinc-200 rounded-lg" />
          <div className="h-14 bg-zinc-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-8">
      <header className="text-center pt-8">
        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border-4 border-zinc-100 shadow-lg">
          👤
        </div>
        <h1 className="text-2xl font-black text-zinc-900">{user?.name ?? '—'}</h1>
        <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mt-1">
          {user?.roles?.includes('driver') ? 'Водитель' : (user?.roles?.[0] ?? 'Пользователь')}
        </p>
      </header>

      <section className="space-y-3">
        {user?.phone && <InfoRow label="Телефон" value={user.phone} />}

        {/* Машина с возможностью смены */}
        <div className="bg-white rounded-lg p-4 border border-zinc-200 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight">Машина</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-black text-zinc-900">
                {user?.asset
                  ? `${user.asset.short_name} · ${user.asset.reg_number}`
                  : 'Не закреплена'}
              </span>
              <button
                onClick={() => setShowVehiclePicker((v) => !v)}
                className="text-[10px] font-black uppercase tracking-widest text-orange-600 active:opacity-70"
              >
                Сменить
              </button>
            </div>
          </div>

          {showVehiclePicker && (
            <div className="mt-3 border-t border-zinc-100 pt-3 space-y-2 max-h-64 overflow-y-auto">
              {vehicles.map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => updateVehicle.mutate(v.id)}
                  disabled={updateVehicle.isPending}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all active:scale-[0.98] ${
                    user?.current_asset_id === v.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-zinc-100 hover:border-orange-200'
                  }`}
                >
                  <div className="font-black text-zinc-800 text-sm uppercase">{v.short_name}</div>
                  <div className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase">
                    {v.reg_number}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3 pt-4">
        <button
          onClick={handleLogout}
          className="w-full h-14 bg-red-50 text-red-600 rounded-lg font-black uppercase tracking-widest active:bg-red-100 transition-colors border border-red-100"
        >
          Выйти / Сменить сотрудника
        </button>
      </section>

      <footer className="text-center text-[10px] text-zinc-300 font-bold uppercase tracking-[0.3em] pt-4">
        SaldaCargo v1.0
      </footer>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-zinc-200 flex justify-between items-center shadow-sm">
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight">{label}</span>
      <span className="text-sm font-black text-zinc-900">{value}</span>
    </div>
  );
}
