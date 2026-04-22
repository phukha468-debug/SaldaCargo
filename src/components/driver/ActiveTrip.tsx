import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Trip, Order, Expense } from '../../types';
import { formatMoney, cn } from '../../lib/utils';
import { Plus, Minus, Check, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { OrderForm } from './OrderForm';
import { ExpenseForm } from './ExpenseForm';
import { AnimatePresence, motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export function ActiveTrip({ trip }: { trip: Trip }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [tripDuration, setTripDuration] = useState('');

  useEffect(() => {
    // Listen for orders
    const ordersQuery = query(
      collection(db, 'orders'),
      where('tripId', '==', trip.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    // Listen for expenses
    const expensesQuery = query(
      collection(db, 'expenses'),
      where('tripId', '==', trip.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    });

    const interval = setInterval(() => {
      if (trip.startTime?.toDate) {
        setTripDuration(formatDistanceToNow(trip.startTime.toDate(), { locale: ru, addSuffix: false }));
      }
    }, 1000);

    return () => {
      unsubscribeOrders();
      unsubscribeExpenses();
      clearInterval(interval);
    };
  }, [trip.id, trip.startTime]);

  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const totalDriverSalary = orders.reduce((sum, o) => sum + o.driverSalary, 0);
  const totalLoaderSalary = orders.reduce((sum, o) => sum + o.loaderSalary, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalRevenue - totalDriverSalary - totalLoaderSalary - totalExpenses;

  const handleFinishTrip = async () => {
    // In a real app, this would open a final odometer check
    if (confirm('Завершить рейс?')) {
      await updateDoc(doc(db, 'trips', trip.id), {
        endTime: serverTimestamp(),
        revenue: totalRevenue,
        driverSalary: totalDriverSalary,
        loaderSalary: totalLoaderSalary,
        expenses: totalExpenses,
        profit: profit,
        status: 'draft' // status remains draft for admin review
      });
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-20">
      {/* Header */}
      <div className="bg-white p-4 border-b border-[#E5E7EB] flex items-center justify-between sticky top-[56px] z-40">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-accent-blue uppercase tracking-tight">🚚 РЕЙС #{trip.id.slice(0, 4)}</span>
            <span className="badge-draft text-[10px] bg-accent-gray/10 text-accent-gray px-1.5 rounded uppercase font-bold">В ПУТИ</span>
          </div>
          <span className="text-[14px] font-medium text-navigation bg-workspace px-2 rounded-full inline-block mt-1">
            {trip.vehicleId} • {trip.loaderId ? 'С грузчиком' : 'Один'}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[14px] font-bold tabular-nums flex items-center gap-1">
            <Clock size={14} className="text-accent-gray" />
            {tripDuration}
          </span>
          <span className="text-[12px] text-accent-gray">в пути</span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-6">
        {/* Orders section */}
        <div className="flex flex-col gap-1">
          <h3 className="section-title">
            ЗАКАЗЫ ({orders.length})
          </h3>
          
          <div className="flex flex-col">
            {orders.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-[#E5E7EB] rounded-[8px] text-center text-accent-gray text-sm">
                Нет заказов. Нажмите «+ ЗАКАЗ», чтобы добавить.
              </div>
            ) : (
              orders.map(order => (
                <div 
                  key={order.id} 
                  className={cn(
                    "order-card",
                    order.lifecycleStatus === 'draft' && "order-card-draft",
                    order.settlementStatus === 'pending' && "order-card-pending"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-navigation text-lg">{order.clientName}</span>
                    <span className="text-sm text-accent-gray">ЗП {formatMoney(order.driverSalary)} + {formatMoney(order.loaderSalary)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-lg tabular-nums">{formatMoney(order.amount)}</span>
                    <div className="flex items-center gap-1 text-[12px] font-bold uppercase mt-1">
                      {order.paymentMethod === 'cash' && '💵 '}
                      {order.paymentMethod === 'qr' && '📱 '}
                      {order.paymentMethod === 'debt' && '⏳ '}
                      {order.settlementStatus === 'completed' ? (
                        <span className="text-accent-emerald">Оплачено ✅</span>
                      ) : (
                        <span className="text-accent-amber">{order.lifecycleStatus === 'draft' ? 'draft' : 'pending'}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expenses section */}
        {expenses.length > 0 && (
          <div className="flex flex-col gap-1">
             <h3 className="section-title">
              РАСХОДЫ ({expenses.length})
            </h3>
            <div className="flex flex-col">
              {expenses.map(expense => (
                <div key={expense.id} className="order-card !border-l-accent-red border-l-[4px]">
                  <div className="flex flex-col">
                    <span className="font-bold text-lg">{expense.category}</span>
                    <span className="text-sm text-accent-gray font-bold uppercase">{expense.paymentMethod}</span>
                  </div>
                  <span className="font-bold text-lg text-accent-red tabular-nums">-{formatMoney(expense.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Card */}
        <div className="card-base p-6 flex flex-col gap-3 mt-2 shadow-md">
          <div className="flex justify-between items-center text-accent-gray">
            <span className="text-sm font-medium">Выручка:</span>
            <span className="font-mono tabular-nums text-navigation font-semibold">{formatMoney(totalRevenue)}</span>
          </div>
          <div className="flex justify-between items-center text-accent-gray">
            <span className="text-sm font-medium">ЗП (моя):</span>
            <span className="font-mono tabular-nums text-accent-emerald font-bold">+{formatMoney(totalDriverSalary)}</span>
          </div>
          <div className="flex justify-between items-center text-accent-gray">
            <span className="text-sm font-medium">ЗП (напарник):</span>
            <span className="font-mono tabular-nums text-navigation">{formatMoney(totalLoaderSalary)}</span>
          </div>
          <div className="h-[1px] border-t border-dashed border-[#E5E7EB] my-1" />
          <div className="flex justify-between items-center pt-1">
            <span className="font-bold text-navigation">ИТОГО ПРИБЫЛЬ:</span>
            <span className="text-2xl font-bold text-accent-emerald tabular-nums">
              {formatMoney(profit)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button 
            onClick={() => setShowOrderForm(true)}
            className="btn-primary"
          >
            ➕ ЗАКАЗ
          </button>
          <button 
            onClick={() => setShowExpenseForm(true)}
            className="btn-secondary"
          >
            💸 РАСХОД
          </button>
          <button 
            onClick={handleFinishTrip}
            className="btn-amber col-span-2 shadow-sm"
          >
            🏁 ЗАВЕРШИТЬ РЕЙС
          </button>
        </div>
      </div>


      <AnimatePresence>
        {showOrderForm && (
          <OrderForm trip={trip} onClose={() => setShowOrderForm(false)} />
        )}
        {showExpenseForm && (
          <ExpenseForm trip={trip} onClose={() => setShowExpenseForm(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
