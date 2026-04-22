import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Trip } from '../../types';
import { ChevronLeft, Check, Camera } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export function ExpenseForm({ trip, onClose }: { trip: Trip, onClose: () => void }) {
  const [category, setCategory] = useState('ГСМ');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Нал');
  const [loading, setLoading] = useState(false);

  const categories = ['ГСМ', 'Запчасти', 'Штраф', 'Парковка', 'Мойка', 'Прочее'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || loading) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        tripId: trip.id,
        category,
        amount: parseFloat(amount),
        paymentMethod,
        lifecycleStatus: 'draft',
        createdAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 z-[100] bg-workspace flex flex-col"
    >
      <header className="h-[56px] px-4 flex items-center justify-between border-b border-[#E5E7EB] bg-white">
        <button onClick={onClose} className="text-accent-gray flex items-center gap-1">
          <ChevronLeft size={20} /> Назад
        </button>
        <span className="font-bold text-navigation uppercase text-sm tracking-widest">
          НОВЫЙ РАСХОД
        </span>
        <div className="w-10" />
      </header>

      <form onSubmit={handleSubmit} className="flex-1 p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="font-bold text-accent-gray uppercase tracking-wider text-sm">Категория</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "py-3 rounded-[4px] border text-sm font-bold transition-all",
                  category === cat ? "border-accent-red bg-accent-red/5 text-accent-red" : "border-[#E5E7EB] bg-white text-accent-gray"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-bold text-accent-gray uppercase tracking-wider text-sm">Сумма расхода</label>
          <input 
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            required
            autoFocus
            className="input-base text-4xl font-bold text-center h-20 tabular-nums"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-bold text-accent-gray uppercase tracking-wider text-sm">Фото чека (опц.)</label>
          <button type="button" className="w-full h-32 border-2 border-dashed border-[#E5E7EB] rounded-[8px] flex flex-col items-center justify-center text-accent-gray gap-2">
            <Camera size={32} />
            <span className="text-xs uppercase font-bold">Сделать фото</span>
          </button>
        </div>

        <button 
          type="submit"
          disabled={!amount || loading}
          className="bg-accent-red text-white h-[64px] rounded-[4px] font-bold text-lg flex items-center justify-center gap-2 mt-auto shadow-lg"
        >
          {loading ? '...' : <><Check size={20} /> ДОБАВИТЬ РАСХОД</>}
        </button>
      </form>
    </motion.div>
  );
}
