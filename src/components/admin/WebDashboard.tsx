import React, { useState, useEffect } from 'react';
import { formatMoney, cn } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Truck, Wallet, AlertCircle, ArrowUpRight, ClipboardList, RefreshCcw, LayoutDashboard } from 'lucide-react';
import { ShiftReview } from './ShiftReview';
import { FleetGrid } from './FleetGrid';
import { Integrations } from './Integrations';

const mockChartData = [
  { name: '15 апр', revenue: 45000, profit: 12000 },
  { name: '16 апр', revenue: 52000, profit: 15000 },
  { name: '17 апр', revenue: 48000, profit: 11000 },
  { name: '18 апр', revenue: 61000, profit: 18000 },
  { name: '19 апр', revenue: 55000, profit: 14000 },
  { name: '20 апр', revenue: 65000, profit: 21000 },
  { name: '21 апр', revenue: 72000, profit: 25000 },
];

export function WebDashboard() {
  const [activeTab, setActiveTab] = useState<'map' | 'review' | 'fleet' | 'integrations'>('map');
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'review': return <ShiftReview />;
      case 'fleet': return <FleetGrid />;
      case 'integrations': return <Integrations />;
      default: return (
        <div className="p-6 bg-workspace flex flex-col gap-8 max-w-7xl mx-auto animate-in fade-in duration-500">
          <header className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-navigation">Главная</h1>
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full bg-accent-emerald transition-opacity duration-300",
                  pulse ? "opacity-100" : "opacity-40"
                )} />
              </div>
              <p className="text-accent-secondary">Генеральная сводка по активам и прибыли • Live</p>
            </div>
            <div className="flex gap-4">
              <div className="card-base p-4 bg-white flex flex-col items-end shadow-sm">
                <span className="text-[10px] font-bold text-accent-gray uppercase tracking-widest leading-none mb-1">Чистая позиция</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold tabular-nums font-mono">{formatMoney(1245000)}</span>
                  <div className="flex items-center text-accent-emerald bg-accent-emerald/10 px-2 py-0.5 rounded-full text-xs font-bold">
                    <ArrowUpRight size={14} /> +12%
                  </div>
                </div>
                <span className="text-[10px] text-accent-gray font-bold mt-1 uppercase">Δ7д рассч. на сервере</span>
              </div>
            </div>
          </header>

          {/* Main Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card-base p-6 flex flex-col gap-4 border-t-[4px] border-t-accent-blue shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between text-accent-blue">
                <Wallet size={24} />
                <span className="text-xs font-bold uppercase tracking-widest text-accent-gray">Активы</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold tabular-nums font-mono">{formatMoney(850400)}</span>
                <span className="text-sm text-accent-secondary">Кассы + Расч. счёт</span>
              </div>
              <div className="flex flex-col gap-1 mt-2 border-t border-[#E5E7EB] pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-accent-gray font-medium">Нал у водителей</span>
                  <span className="font-mono font-bold">{formatMoney(150400)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-accent-gray font-medium">Сбер (Олег)</span>
                  <span className="font-mono font-bold">{formatMoney(450000)}</span>
                </div>
              </div>
            </div>

            <div className="card-base p-6 flex flex-col gap-4 border-t-[4px] border-t-accent-red shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between text-accent-red">
                <AlertCircle size={24} />
                <span className="text-xs font-bold uppercase tracking-widest text-accent-gray">Обязательства</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold tabular-nums font-mono text-accent-red">{formatMoney(320000)}</span>
                <span className="text-sm text-accent-red/80 font-medium">ЗП к выплате + Долги</span>
              </div>
              <div className="flex flex-col gap-1 mt-2 border-t border-[#E5E7EB] pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-accent-gray font-medium">ЗП Апрель (прогноз)</span>
                  <span className="font-mono font-bold">{formatMoney(280000)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-accent-gray font-medium">Поставщики</span>
                  <span className="font-mono font-bold">{formatMoney(40000)}</span>
                </div>
              </div>
            </div>

            <div className="card-base p-6 flex flex-col gap-4 border-t-[4px] border-t-accent-emerald shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between text-accent-emerald">
                <TrendingUp size={24} />
                <span className="text-xs font-bold uppercase tracking-widest text-accent-gray">P&L Апрель</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold tabular-nums font-mono text-accent-emerald">{formatMoney(415000)}</span>
                <span className="text-sm text-accent-secondary">Чистая прибыль</span>
              </div>
              
              <div className="flex gap-[2px] mt-2">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex-1 h-2 rounded-[1px] transition-all duration-700",
                      i < 9 ? "bg-accent-emerald shadow-[0_0_8px_rgba(5,150,105,0.4)]" : "bg-[#E5E7EB]"
                    )} 
                  />
                ))}
              </div>
              <span className="text-[10px] text-accent-gray text-center font-bold uppercase tracking-tighter">
                9/12 сегментов к цели 1.5М
              </span>
            </div>

            <div className="card-base p-6 flex flex-col gap-4 border-t-[4px] border-t-accent-amber shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between text-accent-amber">
                <Truck size={24} />
                <span className="text-xs font-bold uppercase tracking-widest text-accent-gray">Сегодня</span>
              </div>
              <div className="flex flex-col">
                <span className={cn(
                  "text-3xl font-bold tabular-nums font-mono",
                  "text-accent-red" 
                )}>2 / 11</span>
                <span className="text-sm text-accent-secondary font-medium">Машин на линии (18%) ⚠️</span>
              </div>
              <div className="flex flex-col gap-1 mt-2 border-t border-[#E5E7EB] pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-accent-gray font-medium">Выручка (прогноз)</span>
                  <span className="font-mono font-bold">{formatMoney(65000)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-accent-gray font-medium">Рейсов завершено</span>
                  <span className="font-mono font-bold">2</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card-base p-6 flex flex-col gap-6">
              <h3 className="text-xl font-bold text-navigation">Динамика выручки и прибыли</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}к`} />
                    <Tooltip 
                      cursor={{fill: '#F5F5F0'}}
                      contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} name="Выручка" />
                    <Bar dataKey="profit" fill="#059669" radius={[4, 4, 0, 0]} name="Прибыль" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="card-base p-6 flex flex-col gap-4">
                <h3 className="text-lg font-bold text-navigation flex items-center justify-between">
                  Требует внимания
                  <span className="bg-accent-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">3</span>
                </h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3 p-3 bg-accent-amber/5 border-l-4 border-accent-amber rounded-r-[4px]">
                    <AlertCircle className="text-accent-amber shrink-0" size={20} />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">ТО Газель 866</span>
                      <span className="text-xs text-accent-gray">Пробег до ТО: 450 км</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-accent-red/5 border-l-4 border-accent-red rounded-r-[4px]">
                    <AlertCircle className="text-accent-red shrink-0" size={20} />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">Аномальная ЗП (38%)</span>
                      <span className="text-xs text-accent-gray">Рейс #245 (Вова)</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-accent-blue/5 border-l-4 border-accent-blue rounded-r-[4px]">
                    <AlertCircle className="text-accent-blue shrink-0" size={20} />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">Долг клиента "Левша"</span>
                      <span className="text-xs text-accent-gray">Просрочено на 3 дня (4 500 ₽)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="flex h-full bg-workspace">
      {/* Sidebar for Desktop WebApp */}
      <aside className="w-[260px] bg-navigation border-r border-white/10 flex flex-col shrink-0 hidden lg:flex">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-8">Dashboard</h2>
          <nav className="flex flex-col gap-2">
            {[
              { id: 'map', icon: LayoutDashboard, label: 'Главная' },
              { id: 'review', icon: ClipboardList, label: 'Ревью смены' },
              { id: 'fleet', icon: Truck, label: 'Автопарк' },
              { id: 'integrations', icon: RefreshCcw, label: 'Интеграции' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-[8px] transition-all font-medium",
                  activeTab === item.id 
                    ? "bg-accent-blue text-white shadow-lg shadow-accent-blue/20" 
                    : "text-[#F5F5F0]/60 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 overflow-auto">
        <div className="lg:hidden bg-navigation p-4 flex gap-2 overflow-x-auto border-b border-white/10 no-scrollbar">
           {[
              { id: 'map', label: 'Главная' },
              { id: 'review', label: 'Ревью' },
              { id: 'fleet', label: 'Парк' },
              { id: 'integrations', label: 'Связи' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  "whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all",
                  activeTab === item.id ? "bg-accent-blue text-white" : "bg-white/10 text-white/60"
                )}
              >
                {item.label}
              </button>
            ))}
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
