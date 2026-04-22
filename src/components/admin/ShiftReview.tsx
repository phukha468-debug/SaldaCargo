import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Trip, Order, Expense, LifecycleStatus, SettlementStatus } from '../../types';
import { formatMoney, cn } from '../../lib/utils';
import { Check, Edit3, AlertTriangle, FileDown, Truck, Clock, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TripWithDetails extends Trip {
  orders: Order[];
  expenseItems: Expense[];
}

export function ShiftReview() {
  const [trips, setTrips] = useState<TripWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    fetchDailyTrips();
  }, [selectedDate]);

  const fetchDailyTrips = async () => {
    setLoading(true);
    // In a real app we'd filter by date, for demo we fetch all drafts
    const tripsQuery = query(
      collection(db, 'trips'),
      where('status', '==', 'draft'),
      orderBy('startTime', 'desc')
    );

    const tripsSnapshot = await getDocs(tripsQuery);
    const tripsData = await Promise.all(tripsSnapshot.docs.map(async (tripDoc) => {
      const trip = { id: tripDoc.id, ...tripDoc.data() } as Trip;
      
      const ordersSnapshot = await getDocs(query(collection(db, 'orders'), where('tripId', '==', trip.id)));
      const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), where('tripId', '==', trip.id)));
      
      return {
        ...trip,
        orders: ordersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)),
        expenseItems: expensesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense)),
      };
    }));

    setTrips(tripsData);
    setLoading(false);
  };

  const approveTrip = async (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    const batch = writeBatch(db);
    
    // Approve Trip
    batch.update(doc(db, 'trips', tripId), { status: 'approved' });
    
    // Approve Orders
    trip.orders.forEach(order => {
      batch.update(doc(db, 'orders', order.id), { lifecycleStatus: 'approved' });
    });

    // Approve Expenses
    trip.expenseItems.forEach(expense => {
      batch.update(doc(db, 'expenses', expense.id), { lifecycleStatus: 'approved' });
    });

    await batch.commit();
    fetchDailyTrips();
  };

  const approveAll = async () => {
    const batch = writeBatch(db);
    trips.forEach(trip => {
      batch.update(doc(db, 'trips', trip.id), { status: 'approved' });
      trip.orders.forEach(order => batch.update(doc(db, 'orders', order.id), { lifecycleStatus: 'approved' }));
      trip.expenseItems.forEach(expense => batch.update(doc(db, 'expenses', expense.id), { lifecycleStatus: 'approved' }));
    });
    await batch.commit();
    fetchDailyTrips();
  };

  const totals = trips.reduce((acc, t) => {
    acc.revenue += t.revenue;
    acc.driverSalary += t.driverSalary;
    acc.loaderSalary += t.loaderSalary;
    acc.expenses += t.expenses;
    acc.profit += t.profit;
    return acc;
  }, { revenue: 0, driverSalary: 0, loaderSalary: 0, expenses: 0, profit: 0 });

  if (loading) {
    return <div className="p-8 text-center animate-pulse text-accent-gray">Загрузка данных для ревью...</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-6">
      <header className="flex justify-between items-start card-base p-6 bg-white shadow-sm border-l-[6px] border-l-accent-blue">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ClipboardList className="text-accent-blue" />
            РЕВЬЮ СМЕНЫ · {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
          </h1>
          <p className="text-accent-secondary">
            {trips.length} записей · {formatMoney(totals.revenue)} выручки · Ожидает подтверждения
          </p>
        </div>
        <div className="flex gap-3">
           <button className="btn-secondary flex items-center gap-2">
             <FileDown size={18} /> ЭКСПОРТ CSV
           </button>
           <button onClick={approveAll} className="btn-primary flex items-center gap-2">
             <Check size={18} /> ПОДТВЕРДИТЬ ВСЁ ЗА {format(selectedDate, 'dd.MM')}
           </button>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {trips.length === 0 ? (
          <div className="card-base p-12 text-center text-accent-gray flex flex-col items-center gap-4">
            <Check size={48} className="text-accent-emerald" />
            <p className="text-lg font-medium">Все смены за этот день проверены!</p>
          </div>
        ) : (
          trips.map(trip => (
            <div key={trip.id} className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                  <Truck className="text-accent-gray" />
                  <h3 className="text-lg font-bold">
                    Машина {trip.vehicleId} · Водитель {trip.id.slice(0,4)}
                  </h3>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveTrip(trip.id)} className="btn-primary h-10 text-sm px-4">✓ Подтв.</button>
                  <button className="btn-secondary h-10 text-sm px-4">✏️ Ред.</button>
                </div>
              </div>

              <div className="card-base overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-workspace border-b border-[#E5E7EB]">
                    <tr>
                      <th className="p-3 font-bold uppercase text-[10px] text-accent-gray">#</th>
                      <th className="p-3 font-bold uppercase text-[10px] text-accent-gray">Клиент</th>
                      <th className="p-3 font-bold uppercase text-[10px] text-accent-gray text-right">Сумма</th>
                      <th className="p-3 font-bold uppercase text-[10px] text-accent-gray text-right">ЗП Вод</th>
                      <th className="p-3 font-bold uppercase text-[10px] text-accent-gray text-center">%</th>
                      <th className="p-3 font-bold uppercase text-[10px] text-accent-gray text-right">ЗП Гр</th>
                      <th className="p-3 font-bold uppercase text-[10px] text-accent-gray">Оплата</th>
                      <th className="p-3 font-bold uppercase text-[10px] text-accent-gray">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trip.orders.map((order, idx) => {
                      const payPercent = order.amount > 0 ? Math.round((order.driverSalary / order.amount) * 100) : 0;
                      const hasAlert = payPercent > 40 || payPercent < 25;
                      
                      return (
                        <tr key={order.id} className={cn(
                          "border-b border-[#E5E7EB] hover:bg-workspace/50 transition-colors",
                          hasAlert && "bg-[#FEF3C7]/40"
                        )}>
                          <td className="p-3 text-accent-gray text-[12px]">{idx + 1}</td>
                          <td className="p-3 font-medium">
                            <div className="flex items-center gap-1">
                              {order.clientName}
                              {order.settlementStatus === 'pending' && <span className="text-[14px]">⏳</span>}
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono tabular-nums font-bold">{formatMoney(order.amount)}</td>
                          <td className="p-3 text-right">
                             <input 
                               type="number"
                               className="w-20 bg-transparent text-right font-mono tabular-nums p-1 border border-transparent hover:border-accent-blue focus:border-accent-blue outline-none cursor-pointer"
                               defaultValue={order.driverSalary}
                               onBlur={(e) => {
                                 const val = Number(e.target.value);
                                 if (val !== order.driverSalary) {
                                   updateDoc(doc(db, 'orders', order.id), { driverSalary: val });
                                 }
                               }}
                             />
                          </td>
                          <td className="p-3 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[12px] font-bold",
                              hasAlert ? "bg-accent-amber text-white" : "text-accent-secondary"
                            )}>
                              {payPercent}% {hasAlert && '⚠️'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                             <input 
                               type="number"
                               className="w-20 bg-transparent text-right font-mono tabular-nums p-1 border border-transparent hover:border-accent-blue focus:border-accent-blue outline-none cursor-pointer"
                               defaultValue={order.loaderSalary}
                               onBlur={(e) => {
                                 const val = Number(e.target.value);
                                 if (val !== order.loaderSalary) {
                                   updateDoc(doc(db, 'orders', order.id), { loaderSalary: val });
                                 }
                               }}
                             />
                          </td>
                          <td className="p-3">
                            <span className="flex items-center gap-1">
                              {order.paymentMethod === 'cash' && '💵'}
                              {order.paymentMethod === 'debt' && '⏳'}
                              {order.paymentMethod === 'qr' && '📱'}
                              {order.paymentMethod === 'invoice' && '🏦'}
                              <span className="capitalize">{order.paymentMethod}</span>
                            </span>
                          </td>
                          <td className="p-3 flex items-center gap-1">
                            {order.lifecycleStatus === 'draft' && <span className="text-accent-gray">✏️ draft</span>}
                            {order.settlementStatus === 'pending' && <span className="text-accent-amber">⏳</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-workspace/30 font-bold border-t border-[#E5E7EB]">
                    <tr>
                      <td colSpan={2} className="p-3 text-right uppercase text-[10px] text-accent-gray">Сумма рейса</td>
                      <td className="p-3 text-right font-mono tabular-nums">{formatMoney(trip.revenue)}</td>
                      <td className="p-3 text-right font-mono tabular-nums">{formatMoney(trip.driverSalary)}</td>
                      <td className="p-3 text-center">{Math.round((trip.driverSalary/trip.revenue)*100)}%</td>
                      <td className="p-3 text-right font-mono tabular-nums">{formatMoney(trip.loaderSalary)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
                <div className="p-4 bg-workspace/10 flex items-center justify-between text-sm text-accent-secondary italic border-t border-[#E5E7EB]">
                  <div className="flex items-center gap-6">
                    <span className="flex items-center gap-2">⛽ ГСМ {formatMoney(trip.expenses)}</span>
                    <span className="flex items-center gap-2">💰 Прибыль <span className="text-accent-emerald font-bold">{formatMoney(trip.profit)}</span></span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="flex items-center gap-2"><Truck size={14} /> Пробег (60 км)</span>
                    <span className="flex items-center gap-2"><Clock size={14} /> 08:30 → 18:00 (9ч 30м)</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <footer className="card-base bg-navigation text-white p-6 mt-8 flex flex-col gap-4">
        <h2 className="text-lg font-bold uppercase tracking-widest text-[#F5F5F0]/60">💰 ИТОГО ЗА ДЕНЬ</h2>
        <div className="flex flex-wrap items-center gap-x-12 gap-y-2 text-xl font-bold">
           <span>Выручка: <span className="tabular-nums font-mono">{formatMoney(totals.revenue)}</span></span>
           <span className="text-accent-emerald">Прибыль: <span className="tabular-nums font-mono">{formatMoney(totals.profit)}</span></span>
           <span className="text-[#F5F5F0]/70 text-base font-medium">ФОТ: {formatMoney(totals.driverSalary + totals.loaderSalary)} ({Math.round(((totals.driverSalary + totals.loaderSalary)/totals.revenue)*100)}%)</span>
           <span className="text-[#F5F5F0]/70 text-base font-medium">ГСМ: {formatMoney(totals.expenses)}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-4 text-sm font-bold">
               <span className="bg-accent-amber/20 text-accent-amber px-2 py-1 rounded">Долги: {formatMoney(1700)}</span>
               <span className="bg-accent-emerald/20 text-accent-emerald px-2 py-1 rounded">Машин на линии: 2/11 (18%) ⚠️</span>
            </div>
            <button onClick={approveAll} className="btn-primary !h-12 px-8 shadow-lg shadow-accent-blue/20">
              ✓ ПОДТВЕРДИТЬ ВСЁ ЗА {format(selectedDate, 'dd.MM')}
            </button>
        </div>
      </footer>
    </div>
  );
}

// (removed redundant import)
