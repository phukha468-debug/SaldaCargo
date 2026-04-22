import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Trip, PaymentMethod } from '../../types';
import { ChevronLeft, Check, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export function OrderForm({ trip, onClose }: { trip: Trip, onClose: () => void }) {
  const [clientName, setClientName] = useState('б/н');
  const [amount, setAmount] = useState('');
  const [driverSalary, setDriverSalary] = useState('');
  const [loaderSalary, setLoaderSalary] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [loading, setLoading] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Autofocus amount
    setTimeout(() => amountRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    const val = parseFloat(amount) || 0;
    // Basic dynamic suggestion: 30%
    const suggestion = Math.round(val * 0.3);
    setDriverSalary(suggestion.toString());
    if (trip.loaderId) {
      setLoaderSalary(suggestion.toString());
    } else {
      setLoaderSalary('0');
    }
  }, [amount, trip.loaderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || loading) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        tripId: trip.id,
        clientName,
        amount: parseFloat(amount),
        driverSalary: parseFloat(driverSalary),
        loaderSalary: parseFloat(loaderSalary),
        paymentMethod,
        settlementStatus: paymentMethod === 'debt' ? 'pending' : 'completed',
        lifecycleStatus: 'draft',
        createdAt: serverTimestamp()
      });
      
      if ('vibrate' in navigator) navigator.vibrate([20, 30, 20]);
      onClose();
    } catch (error) {
      console.error(error);
      if ('vibrate' in navigator) navigator.vibrate([50, 50, 50]);
    } finally {
      setLoading(false);
    }
  };

  const paymentMethods: { id: PaymentMethod, label: string, icon: string }[] = [
    { id: 'cash', label: 'Нал', icon: '💵' },
    { id: 'qr', label: 'QR', icon: '📱' },
    { id: 'invoice', label: 'Счёт', icon: '🏦' },
    { id: 'debt', label: 'Долг', icon: '⏳' },
    { id: 'card', label: 'Карта', icon: '💳' },
  ];

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[100] bg-workspace flex flex-col"
    >
      <header className="h-[56px] px-4 flex items-center justify-between border-b border-[#E5E7EB] bg-white">
        <button onClick={onClose} className="text-accent-gray flex items-center gap-1">
          <ChevronLeft size={20} /> Назад
        </button>
        <span className="font-bold text-navigation uppercase text-sm tracking-widest">
          НОВЫЙ ЗАКАЗ
        </span>
        <div className="w-10" />
      </header>

      <form onSubmit={handleSubmit} className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        {/* Client Selector */}
        <div className="flex flex-col gap-2 text-sm">
          <label className="font-bold text-accent-gray uppercase tracking-wider">Клиент</label>
          <div className="flex gap-2">
            <select 
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="flex-1 input-base h-12"
            >
              <option value="б/н">б/н (без названия)</option>
              <option value="Левша">Левша</option>
              <option value="Интерьер">Интерьер</option>
              <option value="ВСМПО">ВСМПО</option>
            </select>
            <button type="button" className="bg-white border border-[#E5E7EB] rounded-[4px] px-3 flex items-center justify-center text-accent-blue">
              <UserPlus size={20} />
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-2">
          <label className="font-bold text-accent-gray uppercase tracking-wider text-sm flex justify-between">
            Сумма заказа 
            <span className="text-accent-blue tabular-nums">АВТОФОКУС</span>
          </label>
          <div className="relative">
            <input 
              ref={amountRef}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
              className="input-base text-5xl font-bold text-center h-24 w-full pr-10 tabular-nums"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-accent-gray">₽</span>
          </div>
        </div>

        {/* Salaries */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-bold text-accent-gray uppercase tracking-wider text-[10px]">ЗП Водителя</label>
            <input 
              type="number"
              value={driverSalary}
              onChange={(e) => setDriverSalary(e.target.value)}
              className="input-base text-xl font-bold text-center h-12 tabular-nums"
            />
            <span className="text-[10px] text-accent-emerald font-bold">💡 ~{Math.round((parseFloat(amount) || 0) * 0.3)} (30%)</span>
          </div>
          <div className="flex flex-col gap-2 opacity-50 transition-opacity">
            <label className="font-bold text-accent-gray uppercase tracking-wider text-[10px]">ЗП Грузчика</label>
            <input 
              type="number"
              disabled={!trip.loaderId}
              value={loaderSalary}
              onChange={(e) => setLoaderSalary(e.target.value)}
              className="input-base text-xl font-bold text-center h-12 tabular-nums disabled:bg-gray-100"
            />
          </div>
        </div>

        {/* Payment Methods */}
        <div className="flex flex-col gap-3">
          <label className="font-bold text-accent-gray uppercase tracking-wider text-sm">Способ оплаты</label>
          <div className="grid grid-cols-5 gap-2">
            {paymentMethods.map(pm => (
              <button
                key={pm.id}
                type="button"
                onClick={() => {
                  setPaymentMethod(pm.id);
                  if ('vibrate' in navigator) navigator.vibrate(10);
                }}
                className={cn(
                  "aspect-square rounded-[8px] border-2 flex flex-col items-center justify-center gap-1 transition-all",
                  paymentMethod === pm.id 
                    ? "border-accent-blue bg-accent-blue/5 text-accent-blue scale-105 shadow-sm" 
                    : "border-[#E5E7EB] bg-white text-accent-gray"
                )}
              >
                <span className="text-xl">{pm.icon}</span>
                <span className="text-[10px] font-bold uppercase">{pm.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button 
          type="submit"
          disabled={!amount || loading}
          className="btn-primary h-[64px] w-full mt-auto flex items-center justify-center gap-2 text-lg shadow-lg"
        >
          {loading ? '...' : <><Check size={24} /> ДОБАВИТЬ ЗАКАЗ</>}
        </button>
      </form>
    </motion.div>
  );
}
