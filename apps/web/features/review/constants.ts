export const PAYMENT_LABELS: Record<string, string> = {
  cash: '💵 Наличные',
  qr: '⚡ QR-код',
  bank_invoice: '🏛️ Безнал (Р/С)',
  debt_cash: '⏳ Долг',
  card_driver: '⚡ QR-код',
  fuel_card: '⛽ Топливная карта ТК',
  cube: '🛢️ Кубик (Дизель)',
};

export const PAYMENT_STYLES: Record<string, string> = {
  cash: 'bg-emerald-600 text-white font-black border-emerald-700 shadow-xs',
  qr: 'bg-purple-600 text-white font-black border-purple-700 shadow-xs ring-2 ring-purple-300',
  bank_invoice: 'bg-blue-600 text-white font-bold border-blue-700',
  debt_cash: 'bg-rose-600 text-white font-bold border-rose-700',
  card_driver:
    'bg-purple-600 text-white font-black border-purple-700 shadow-xs ring-2 ring-purple-300',
  fuel_card: 'bg-amber-600 text-white font-black border-amber-700 shadow-xs',
  cube: 'bg-indigo-600 text-white font-black border-indigo-700 shadow-xs',
};

export const PAYMENT_EDIT_OPTIONS = [
  { value: 'bank_invoice', label: '🏛️ Безнал (Р/С)' },
  { value: 'debt_cash', label: '⏳ Долг' },
  { value: 'qr', label: '⚡ QR-код' },
  { value: 'cash', label: '💵 Наличный' },
];
