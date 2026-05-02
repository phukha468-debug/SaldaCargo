/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

// TODO: получать из авторизации
const MOCK_DRIVER_ID = '00000000-0000-0000-0000-000000000000';

export default function FinancePage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'pay' ? 'pay' : 'accountable';
  const [activeTab, setActiveTab] = useState<'accountable' | 'pay'>(initialTab);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['driver-finance', MOCK_DRIVER_ID],
    queryFn: async () => {
      const res = await fetch(`/api/driver/finance?driver_id=${MOCK_DRIVER_ID}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-10 bg-zinc-200 rounded mb-6" />
        <div className="h-32 bg-zinc-200 rounded-lg" />
        <div className="space-y-3 pt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-zinc-200 rounded-lg h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Переключатель вкладок */}
      <div className="bg-white border-b-2 border-zinc-200 p-2 flex sticky top-0 z-50">
        <button
          onClick={() => setActiveTab('accountable')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'accountable' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-400 active:bg-zinc-100'
          }`}
        >
          💳 Подотчёт
        </button>
        <button
          onClick={() => setActiveTab('pay')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'pay' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-400 active:bg-zinc-100'
          }`}
        >
          💰 Зарплата
        </button>
      </div>

      <main className="p-4 space-y-6">
        {activeTab === 'accountable' ? (
          <AccountableTab data={data?.accountable} />
        ) : (
          <SalaryTab trips={data?.salary?.trips} />
        )}
      </main>
    </div>
  );
}

function AccountableTab({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border-2 border-zinc-200 p-6 text-center shadow-sm">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">На руках сейчас</p>
        <Money amount={data?.balance ?? '0'} className="text-4xl font-black text-zinc-900" />
      </div>

      <div className="space-y-3">
        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b-2 border-zinc-100 pb-2">
          История операций
        </h2>
        {data?.transactions?.length === 0 ? (
          <p className="text-center py-10 text-zinc-400 font-bold uppercase text-xs">Операций нет</p>
        ) : (
          data?.transactions?.map((tx: any) => (
            <div key={tx.id} className="bg-white rounded-lg p-4 border border-zinc-200 flex justify-between items-center shadow-sm">
              <div>
                <p className="font-bold text-zinc-900 text-sm">
                  {tx.category?.name ?? tx.description ?? 'Перевод'}
                </p>
                <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
                  {formatDate(tx.created_at)}
                </p>
              </div>
              <div className="text-right">
                <Money 
                  amount={tx.amount} 
                  className={`font-black text-sm ${tx.direction === 'income' ? 'text-green-600' : 'text-red-600'}`} 
                  showSign
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SalaryTab({ trips }: { trips: any[] }) {
  const approved = (trips ?? [])
    .flatMap((t: any) => t.trip_orders)
    .filter((o: any) => o.lifecycle_status === 'approved')
    .reduce((s: number, o: any) => s + parseFloat(o.driver_pay), 0);

  const draft = (trips ?? [])
    .flatMap((t: any) => t.trip_orders)
    .filter((o: any) => o.lifecycle_status === 'draft')
    .reduce((s: number, o: any) => s + parseFloat(o.driver_pay), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border-2 border-zinc-200 p-6 shadow-sm flex flex-col items-center">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Утверждено к выплате</p>
        <Money amount={approved.toString()} className="text-4xl font-black text-green-600" />
        {draft > 0 && (
          <div className="mt-2 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
            В черновиках: <Money amount={draft.toString()} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b-2 border-zinc-100 pb-2">
          Начисления за месяц
        </h2>
        {trips?.length === 0 ? (
          <p className="text-center py-10 text-zinc-400 font-bold uppercase text-xs">Начислений нет</p>
        ) : (
          trips?.map((trip: any) => {
            const pay = trip.trip_orders
              .filter((o: any) => o.lifecycle_status !== 'cancelled')
              .reduce((s: number, o: any) => s + parseFloat(o.driver_pay), 0);
            return (
              <div key={trip.id} className="bg-white rounded-lg p-4 border border-zinc-200 flex justify-between items-center shadow-sm relative overflow-hidden">
                {trip.lifecycle_status === 'approved' ? (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                ) : (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>
                )}
                <div className="pl-2">
                  <p className="font-bold text-zinc-900 text-sm">
                    Рейс №{trip.trip_number} · {trip.asset.short_name}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
                    {formatDate(trip.started_at)}
                  </p>
                </div>
                <div className="text-right">
                  <Money amount={pay.toString()} className="font-black text-sm text-zinc-900" />
                  <div className="mt-1">
                    <LifecycleBadge status={trip.lifecycle_status} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
