import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Trip, Vehicle } from '../../types';
import { formatMoney, cn } from '../../lib/utils';
import { Play, ClipboardList, Wallet, AlertCircle, ChevronRight } from 'lucide-react';
import { TripWizard } from './TripWizard';
import { ActiveTrip } from './ActiveTrip';
import { motion, AnimatePresence } from 'motion/react';

export function DriverHome() {
  const { profile } = useAuth();
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    // Listen for active trip
    const activeQuery = query(
      collection(db, 'trips'),
      where('driverId', '==', profile.id),
      where('status', '==', 'draft'),
      orderBy('startTime', 'desc'),
      limit(1)
    );

    const unsubscribeActive = onSnapshot(activeQuery, (snapshot) => {
      const trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
      // Only set active if it doesn't have an endTime
      const current = trips.find(t => !t.endTime);
      setActiveTrip(current || null);
      setLoading(false);
    });

    // Listen for recent trips
    const recentQuery = query(
      collection(db, 'trips'),
      where('driverId', '==', profile.id),
      where('status', 'in', ['approved', 'draft']),
      orderBy('startTime', 'desc'),
      limit(5)
    );

    const unsubscribeRecent = onSnapshot(recentQuery, (snapshot) => {
      setRecentTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip)));
    });

    return () => {
      unsubscribeActive();
      unsubscribeRecent();
    };
  }, [profile]);

  if (loading) return null;

  if (activeTrip) {
    return <ActiveTrip trip={activeTrip} />;
  }

  return (
    <div className="p-4 flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-base p-4 flex flex-col gap-1">
          <span className="text-[14px] font-medium text-accent-gray">💵 ПОДОТЧЁТ</span>
          <span className="text-[32px] font-bold tabular-nums leading-tight">
            {formatMoney(profile?.balance || 0)}
          </span>
          <div className="flex items-center gap-1 text-[12px] text-accent-emerald">
            <span>▲ 2 400 за сегодня</span>
          </div>
        </div>

        <div className="card-base p-4 flex flex-col gap-1">
          <span className="text-[14px] font-medium text-accent-gray">📊 ЗП АПРЕЛЬ</span>
          <span className="text-[32px] font-bold tabular-nums leading-tight">
            {formatMoney(45200)}
          </span>
          <span className="text-[12px] text-accent-gray">из ≈60 000 к выплате</span>
        </div>
      </div>

      {/* Start Trip Action */}
      <button 
        onClick={() => setShowWizard(true)}
        className="w-full h-[64px] bg-accent-blue text-white rounded-[8px] flex items-center justify-center gap-3 shadow-md hover:bg-[#1D4ED8] active:scale-[0.98] transition-all"
        id="btn-start-trip"
      >
        <Play fill="currentColor" size={20} />
        <span className="text-[18px] font-bold">НАЧАТЬ РЕЙС</span>
      </button>

      {/* Recent Trips */}
      <div className="flex flex-col">
        <h3 className="section-title flex items-center gap-2">
          <ClipboardList size={18} />
          ПОСЛЕДНИЕ РЕЙСЫ
        </h3>
        
        <div className="flex flex-col gap-3">
          {recentTrips.length === 0 ? (
            <div className="card-base p-8 text-center text-accent-gray flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-workspace rounded-full flex items-center justify-center text-4xl">🚚</div>
              <p>Пока нет рейсов. Нажми «Начать рейс» когда будешь готов еехать.</p>
            </div>
          ) : (
            recentTrips.filter(t => t.id !== activeTrip?.id).map((trip) => (
              <div key={trip.id} className="order-card !border-l-accent-emerald mb-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navigation">
                      {trip.startTime?.toDate ? trip.startTime.toDate().toLocaleDateString('ru-RU') : '...'}
                    </span>
                    <span className="text-accent-gray text-sm">• {trip.vehicleId}</span>
                  </div>
                  <span className="text-sm text-accent-gray">Выручка {formatMoney(trip.revenue)}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-accent-emerald font-bold tabular-nums">{formatMoney(trip.profit)} ✅</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {showWizard && (
          <TripWizard onClose={() => setShowWizard(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
