import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Vehicle } from '../../types';
import { Truck, PenTool as Tool, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const VehicleCard = ({ vehicle, key }: { vehicle: Vehicle, key?: React.Key }) => {
  const v = vehicle;
  const serviceGap = v.nextServiceKm - v.currentOdometer;
  const isOverdue = serviceGap < 0;
  const isWarning = serviceGap < 1000;

  return (
    <div className="card-base p-5 flex flex-col gap-4 hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <h4 className="font-bold text-navigation text-lg uppercase">{v.model}</h4>
          <span className="text-xs font-bold text-accent-gray tracking-widest">{v.plate}</span>
        </div>
        <div className={cn(
          "px-2 py-1 rounded-[4px] text-[10px] font-bold uppercase flex items-center gap-1",
          v.id === 'active' ? "bg-accent-emerald/10 text-accent-emerald" : "bg-accent-gray/10 text-accent-gray"
        )}>
          <div className={cn("w-1.5 h-1.5 rounded-full", v.id === 'active' ? "bg-accent-emerald animate-pulse" : "bg-accent-gray")} />
          {v.id === 'active' ? 'На линии' : 'Простой'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-accent-gray uppercase">Пробег</span>
          <span className="font-mono font-bold text-sm tabular-nums">{v.currentOdometer.toLocaleString()} км</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-accent-gray uppercase">ТО через</span>
          <span className={cn(
            "font-mono font-bold text-sm tabular-nums flex items-center gap-1",
            isOverdue ? "text-accent-red" : isWarning ? "text-accent-amber" : "text-accent-emerald"
          )}>
            {isOverdue ? <AlertCircle size={14} /> : isWarning ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            {Math.abs(serviceGap).toLocaleString()} км
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 pt-3 border-t border-[#E5E7EB]">
        <span className="text-[10px] font-bold text-accent-gray uppercase">Водитель</span>
        <span className="text-sm font-medium">Сёма (закреплен)</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-accent-gray uppercase">Остат. ст.</span>
        <span className="text-sm font-bold tabular-nums">1 587 000 ₽</span>
      </div>
      
      <div className="absolute bottom-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
         <button className="text-accent-blue bg-accent-blue/10 p-1.5 rounded-[4px]">
            <Tool size={16} />
         </button>
      </div>
    </div>
  );
};

export function FleetGrid() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    return onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle)));
    });
  }, []);

  const valdays = vehicles.filter(v => v.type === 'valday');
  const gazelles = vehicles.filter(v => v.type === 'gazelle');
  const others = vehicles.filter(v => v.type === 'mitsubishi');

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto p-6 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold flex items-center gap-3">
             <Truck className="text-accent-blue" />
             АВТОПАРК
          </h2>
          <p className="text-accent-gray">11 машин • 2 на линии • 18% загрузка</p>
        </div>
        <button className="btn-primary px-6">+ Машина</button>
      </header>

      <div className="flex flex-col gap-10">
        {valdays.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="section-title">Валдаи ({valdays.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {valdays.map(v => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
          </section>
        )}

        {gazelles.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="section-title">Газели ({gazelles.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {gazelles.map(v => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="section-title">Прочие ({others.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {others.map(v => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
