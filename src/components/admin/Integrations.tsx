import React from 'react';
import { Fuel, MapPin, Landmark, TrendingDown, RefreshCcw, Settings, FileUp, Play } from 'lucide-react';
import { formatMoney } from '../../lib/utils';

export function Integrations() {
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto p-6 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-1 border-b border-[#E5E7EB] pb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <RefreshCcw className="text-accent-blue" />
          ИНТЕГРАЦИИ
        </h2>
        <p className="text-accent-gray">Подключение внешних сервисов и автоматизация учёта</p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {/* OPTI24 */}
        <div className="card-base p-6 flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#F3F4F6] rounded-[8px] flex items-center justify-center text-accent-amber">
                <Fuel size={28} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-lg font-bold">⛽ ОПТИ24</h3>
                <span className="text-sm text-accent-gray uppercase font-bold tracking-tighter">Топливные карты</span>
              </div>
            </div>
            <span className="bg-accent-emerald/10 text-accent-emerald px-2 py-1 rounded text-[10px] font-bold uppercase">Подключено</span>
          </div>
          
          <div className="bg-workspace p-4 rounded-[4px] flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-accent-gray">Последняя синхронизация:</span>
              <span className="font-bold">22.04.2026 14:32</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-accent-gray">Новых заправок:</span>
              <span className="font-bold text-accent-amber">?</span>
            </div>
          </div>

          <button className="btn-primary w-full flex items-center justify-center gap-2">
            <RefreshCcw size={18} /> СИНХРОНИЗИРОВАТЬ СЕЙЧАС
          </button>
        </div>

        {/* WIALON */}
        <div className="card-base p-6 flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#F3F4F6] rounded-[8px] flex items-center justify-center text-accent-blue">
                <MapPin size={28} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-lg font-bold">📍 WIALON</h3>
                <span className="text-sm text-accent-gray uppercase font-bold tracking-tighter">GPS Валдаев</span>
              </div>
            </div>
            <span className="bg-accent-emerald/10 text-accent-emerald px-2 py-1 rounded text-[10px] font-bold uppercase">4 Объекта ✅</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
             <button className="btn-secondary h-12 flex items-center gap-2">
               <Settings size={18} /> Настройки API
             </button>
             <button className="btn-secondary h-12 flex items-center gap-2">
               <Landmark size={18} /> Сверить с рейсами
             </button>
          </div>
        </div>

        {/* BANK */}
        <div className="card-base p-6 flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#F3F4F6] rounded-[8px] flex items-center justify-center text-navigation">
                <Landmark size={28} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-lg font-bold">🏦 БАНК</h3>
                <span className="text-sm text-accent-gray uppercase font-bold tracking-tighter">Выписка Р/с</span>
              </div>
            </div>
          </div>
          
          <div className="border-2 border-dashed border-[#E5E7EB] rounded-[8px] p-8 flex flex-col items-center justify-center gap-3">
             <FileUp size={32} className="text-accent-gray" />
             <p className="text-sm text-accent-gray font-medium">Перетащите CSV выписку сюда</p>
             <button className="btn-secondary h-10 px-6">📁 ЗАГРУЗИТЬ ВЫПИСКУ</button>
          </div>
        </div>

        {/* AMORTIZATION */}
        <div className="card-base p-6 flex flex-col gap-6 bg-navigation text-white border-none shadow-xl">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-[8px] flex items-center justify-center text-accent-amber">
                <TrendingDown size={28} />
              </div>
              <div className="flex flex-col text-white">
                <h3 className="text-lg font-bold">📉 АМОРТИЗАЦИЯ</h3>
                <span className="text-sm text-white/50 uppercase font-bold tracking-tighter">Снижение стоимости парка</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 text-sm text-white/80">
            <div className="flex justify-between">
              <span>Последнее начисление:</span>
              <span className="font-bold underline decoration-accent-amber decoration-2 underline-offset-4">01.04.2026</span>
            </div>
            <div className="flex justify-between">
              <span>Следующее:</span>
              <span className="font-bold">01.05.2026</span>
            </div>
          </div>

          <button className="btn-amber h-14 flex items-center justify-center gap-2 shadow-lg shadow-accent-amber/20">
            <Play size={18} fill="currentColor" /> НАЧИСЛИТЬ АМОРТИЗАЦИЮ ЗА МЕСЯЦ
          </button>
        </div>
      </div>
    </div>
  );
}
