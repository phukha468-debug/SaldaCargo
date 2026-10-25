'use client';

import { useState } from 'react';

interface ChangePinModalProps {
  userId: string;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ChangePinModal({
  userId,
  userName,
  isOpen,
  onClose,
  onSuccess,
}: ChangePinModalProps) {
  const [step, setStep] = useState<0 | 1>(0); // 0 = новый PIN, 1 = подтверждение
  const [firstPin, setFirstPin] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (loading || isDone) return;
    setError('');

    setPinValue((prev) => {
      const next = prev + digit;
      if (next.length === 4) {
        if (step === 0) {
          // Шаг 1 завершен
          setFirstPin(next);
          setStep(1);
          return '';
        } else {
          // Шаг 2: проверка
          if (next === firstPin) {
            savePin(next);
          } else {
            setError('PIN-коды не совпали. Попробуйте снова');
            setStep(0);
            setFirstPin('');
            return '';
          }
        }
      }
      return next.length <= 4 ? next : prev;
    });
  };

  const savePin = async (newPin: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, pin: newPin }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Ошибка смены PIN-кода');
        setStep(0);
        setFirstPin('');
        setPinValue('');
        return;
      }

      setIsDone(true);
      setTimeout(() => {
        setIsDone(false);
        setStep(0);
        setFirstPin('');
        setPinValue('');
        onSuccess?.();
        onClose();
      }, 1500);
    } catch {
      setError('Ошибка сети при сохранении PIN');
      setStep(0);
      setFirstPin('');
      setPinValue('');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setFirstPin('');
    setPinValue('');
    setError('');
    setIsDone(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-zinc-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔒</span>
            <h3 className="text-lg font-black text-zinc-900 tracking-tight">Смена PIN-кода</h3>
          </div>
          <button
            onClick={handleReset}
            className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-400 hover:text-zinc-600 flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {userName && (
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
            {userName}
          </p>
        )}

        {isDone ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-2 animate-bounce">
              ✓
            </div>
            <h4 className="text-base font-black text-zinc-900">PIN-код успешно изменен!</h4>
            <p className="text-xs text-zinc-500 font-medium">
              Теперь используйте новый пароль для входа.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
                {step === 0 ? 'Шаг 1 из 2: Новый PIN' : 'Шаг 2 из 2: Подтверждение'}
              </span>
              <p className="text-xs font-bold text-zinc-600">
                {step === 0
                  ? 'Введите 4 цифры нового личного пароля'
                  : 'Повторите новый PIN-код для подтверждения'}
              </p>
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    i < pinValue.length
                      ? 'bg-orange-500 border-orange-500'
                      : 'bg-transparent border-zinc-300'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-center text-xs font-black text-rose-600 uppercase tracking-wide -mt-2">
                {error}
              </p>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDigit(d)}
                  disabled={loading || pinValue.length >= 4}
                  className="p-4 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-2xl text-lg font-black text-zinc-800 active:scale-95 transition-all disabled:opacity-40"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => {
                  setPinValue('');
                  setError('');
                  if (step === 1) {
                    setStep(0);
                    setFirstPin('');
                  }
                }}
                disabled={loading}
                className="p-4 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-2xl text-xs font-black text-zinc-400 active:scale-95 transition-all disabled:opacity-40"
              >
                C
              </button>
              <button
                onClick={() => handleDigit('0')}
                disabled={loading || pinValue.length >= 4}
                className="p-4 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-2xl text-lg font-black text-zinc-800 active:scale-95 transition-all disabled:opacity-40"
              >
                0
              </button>
              <button
                onClick={() => setPinValue((p) => p.slice(0, -1))}
                disabled={loading}
                className="p-4 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-2xl text-lg font-black text-zinc-500 active:scale-95 transition-all disabled:opacity-40"
              >
                ⌫
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
