import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Vehicle } from '../../types';
import { Camera, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export function TripWizard({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [selectedLoader, setSelectedLoader] = useState<string>('none');
  const [odometer, setOdometer] = useState<string>('');
  const [odometerPhoto, setOdometerPhoto] = useState<string | null>(null);

  useEffect(() => {
    const fetchVehicles = async () => {
      const snapshot = await getDocs(collection(db, 'vehicles'));
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
      setVehicles(list);
      if (list.length > 0) setSelectedVehicle(list[0].id);
    };
    fetchVehicles();
  }, []);

  const handleStartTrip = async () => {
    if (!profile) return;
    
    await addDoc(collection(db, 'trips'), {
      driverId: profile.id,
      vehicleId: selectedVehicle,
      loaderId: selectedLoader === 'none' ? null : selectedLoader,
      startTime: serverTimestamp(),
      startOdometer: parseInt(odometer),
      status: 'draft',
      revenue: 0,
      driverSalary: 0,
      loaderSalary: 0,
      expenses: 0,
      profit: 0
    });
    
    onClose();
  };

  const currentVehicleType = vehicles.find(v => v.id === selectedVehicle)?.type;
  const isPhotoRequired = currentVehicleType === 'gazelle';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] bg-workspace flex flex-col overflow-hidden"
    >
      <header className="h-[56px] px-4 flex items-center justify-between border-b border-[#E5E7EB] bg-white">
        <button onClick={onClose} className="text-accent-gray">Отмена</button>
        <span className="font-bold text-navigation uppercase text-sm tracking-widest">
          НАЧАЛО РЕЙСА ({step}/3)
        </span>
        <div className="w-10" />
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        {step === 1 && (
          <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold">На какой машине едешь?</h2>
            <div className="flex flex-col gap-3">
              {vehicles.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVehicle(v.id)}
                  className={cn(
                    "card-base p-4 flex items-center justify-between text-left transition-all",
                    selectedVehicle === v.id ? "border-accent-blue ring-2 ring-accent-blue/20" : ""
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-bold uppercase">{v.model} {v.plate}</span>
                    <span className="text-sm text-accent-gray capitalize">{v.type} • {v.capacity}</span>
                  </div>
                  {selectedVehicle === v.id && <div className="w-6 h-6 bg-accent-blue rounded-full flex items-center justify-center text-white"><Check size={14} /></div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold">Кто с тобой в экипаже?</h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setSelectedLoader('none')}
                className={cn(
                  "card-base p-4 flex items-center justify-between text-left transition-all",
                  selectedLoader === 'none' ? "border-accent-blue ring-2 ring-accent-blue/20" : ""
                )}
              >
                <div className="flex flex-col">
                  <span className="font-bold">Без напарника</span>
                  <span className="text-sm text-accent-gray">(ЗП грузчика = 0)</span>
                </div>
                {selectedLoader === 'none' && <div className="w-6 h-6 bg-accent-blue rounded-full flex items-center justify-center text-white"><Check size={14} /></div>}
              </button>
              
              <button
                onClick={() => setSelectedLoader('loader_1')}
                className={cn(
                  "card-base p-4 flex items-center justify-between text-left transition-all",
                  selectedLoader === 'loader_1' ? "border-accent-blue ring-2 ring-accent-blue/20" : ""
                )}
              >
                <div className="flex flex-col">
                  <span className="font-bold">Серёга (грузчик)</span>
                </div>
                {selectedLoader === 'loader_1' && <div className="w-6 h-6 bg-accent-blue rounded-full flex items-center justify-center text-white"><Check size={14} /></div>}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold">Введи пробег на старте</h2>
            <div className="flex flex-col gap-4">
              <input 
                type="number"
                inputMode="numeric"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="0"
                autoFocus
                className="input-base text-4xl font-bold text-center h-20 tabular-nums"
              />
              
              <div className="flex flex-col gap-3 mt-4">
                <span className="font-semibold flex items-center gap-2">
                  <Camera size={18} /> Фото одометра
                </span>
                <button 
                  onClick={() => setOdometerPhoto('mock_photo_url')}
                  className={cn(
                    "w-full h-[120px] rounded-[8px] border-2 border-dashed border-[#E5E7EB] flex flex-col items-center justify-center gap-2 text-accent-gray hover:bg-white transition-colors",
                    odometerPhoto && "border-accent-emerald bg-accent-emerald/5 text-accent-emerald border-solid"
                  )}
                >
                  {odometerPhoto ? (
                    <>
                      <div className="w-full h-full flex items-center justify-center">📷 ФОТО ГОТОВО</div>
                    </>
                  ) : (
                    <>
                      <Camera size={32} />
                      <span className="text-sm">Сделать фото</span>
                    </>
                  )}
                </button>
                {isPhotoRequired && <p className="text-xs text-accent-amber">* Обязательно для Газелей</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="p-6 bg-white border-t border-[#E5E7EB] flex gap-3">
        {step > 1 && (
          <button 
            onClick={() => setStep(step - 1)}
            className="flex-1 h-[56px] border border-[#E5E7EB] rounded-[4px] font-bold flex items-center justify-center gap-2"
          >
            <ChevronLeft size={20} /> НАЗАД
          </button>
        )}
        
        {step < 3 ? (
          <button 
            onClick={() => setStep(step + 1)}
            disabled={step === 1 && !selectedVehicle}
            className="flex-[2] h-[56px] btn-primary flex items-center justify-center gap-2"
          >
            ДАЛЕЕ <ChevronRight size={20} />
          </button>
        ) : (
          <button 
            onClick={handleStartTrip}
            disabled={!odometer || (isPhotoRequired && !odometerPhoto)}
            className="flex-[2] h-[56px] btn-primary flex items-center justify-center gap-2"
          >
            ПОЕХАЛИ! <Check size={20} />
          </button>
        )}
      </footer>
    </motion.div>
  );
}
