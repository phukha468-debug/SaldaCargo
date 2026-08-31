/**
 * @saldacargo/domain-payroll
 *
 * Логика и правила расчёта заработной платы водителей и грузчиков.
 */

export interface OrderDirectionItem {
  id: string;
  label: string;
  desc: string;
  icon: string;
}

export const ORDER_DIRECTIONS: readonly OrderDirectionItem[] = [
  { id: 'local', label: 'По городу', desc: 'В. Салда, Н. Салда, окрестности', icon: '🏙️' },
  { id: 'ekb', label: 'Екатеринбург', desc: 'Прямой рейс', icon: '🏢' },
  {
    id: 'tagil_vagonka',
    label: 'Тагил · Вагонка',
    desc: 'Дзержинский район',
    icon: '🏭',
  },
  {
    id: 'tagil_tagilstroy',
    label: 'Тагил · Тагилстрой',
    desc: 'Тагилстроевский район',
    icon: '🏭',
  },
  {
    id: 'tagil_galinka',
    label: 'Тагил · Центр / ГГМ',
    desc: 'Гальянка, Выя, Кр. Камень, Ленинский',
    icon: '🏭',
  },
  { id: 'perm', label: 'Пермь', desc: 'Межгород', icon: '🌲' },
  { id: 'chelyabinsk', label: 'Челябинск', desc: 'Межгород', icon: '🏭' },
  { id: 'other', label: 'Другой город', desc: 'Межгород по км + суточные', icon: '🗺️' },
] as const;

export type OrderDirectionId = (typeof ORDER_DIRECTIONS)[number]['id'];

export interface OrderPayrollParams {
  direction?: string;
  amount: number;
  isDriverLoader: boolean;
  loadersCount: number; // количество сторонних грузчиков
  minMachineBase?: number; // по умолчанию 1000 ₽ (или 800 ₽ для спец. магазинов)
}

export interface OrderPayrollResult {
  driverCarPay: number; // ЗП водителя за автомобиль (30% от доли авто)
  driverLoaderPay: number; // ЗП водителя за погрузку (70% от доли грузчика)
  driverTotalPay: number; // Полная ЗП водителя (driverCarPay + driverLoaderPay)
  loaderPayEach: number; // ЗП каждого стороннего грузчика (70% от доли)
  totalLoadersPay: number; // Суммарная выплата всем сторонним грузчикам
  companyShare: number; // Доход компании
  machinePool: number; // Стоимость части "Машина" в заказе
  loadersPool: number; // Стоимость части "Грузчики" в заказе
  isAutomatic: boolean; // Произведён ли расчёт автоматически
}

/**
 * Расчёт распределения средств по заказу внутри города (и базовый fallback для межгорода).
 */
export function calculateOrderPayroll(params: OrderPayrollParams): OrderPayrollResult {
  const {
    direction = 'local',
    amount = 0,
    isDriverLoader = false,
    loadersCount = 0,
    minMachineBase = 1000,
  } = params;

  // Если направление НЕ городское, по умолчанию даём базовую подсказку 30% водителю,
  // но флаг isAutomatic = false (позволяет ручной ввод)
  const isCity = direction === 'local';

  if (!amount || amount <= 0) {
    return {
      driverCarPay: 0,
      driverLoaderPay: 0,
      driverTotalPay: 0,
      loaderPayEach: 0,
      totalLoadersPay: 0,
      companyShare: 0,
      machinePool: 0,
      loadersPool: 0,
      isAutomatic: isCity,
    };
  }

  const totalLoadersCount = (isDriverLoader ? 1 : 0) + loadersCount;

  // Сценарий 1: Только водитель (без погрузки)
  if (totalLoadersCount === 0) {
    const driverCarPay = Math.round(amount * 0.3);
    const driverTotalPay = driverCarPay;
    const companyShare = amount - driverTotalPay;
    return {
      driverCarPay,
      driverLoaderPay: 0,
      driverTotalPay,
      loaderPayEach: 0,
      totalLoadersPay: 0,
      companyShare,
      machinePool: amount,
      loadersPool: 0,
      isAutomatic: isCity,
    };
  }

  // Сценарий 2: Есть грузчики (водитель-грузчик и/или сторонние грузчики)
  const baseRate = minMachineBase > 0 ? minMachineBase : 1000;
  const fullPackageHourRate = (1 + totalLoadersCount) * baseRate;

  let machinePool = 0;
  let loadersPool = 0;

  if (amount >= fullPackageHourRate) {
    // Полные часы или стандартный тариф: делим пропорционально количеству долей (1 машина + N грузчиков)
    machinePool = Math.round(amount / (1 + totalLoadersCount));
    loadersPool = amount - machinePool;
  } else {
    // Быстрый/короткий заказ (меньше полного часа):
    // Машина забирает базовую ставку, остаток идёт в пул грузчиков
    machinePool = Math.min(amount, baseRate);
    loadersPool = Math.max(0, amount - machinePool);
  }

  // Доля водителя за автомобиль: 30%
  const driverCarPay = Math.round(machinePool * 0.3);

  // Доля одного грузчика: 70% от его доли в пуле грузчиков
  const poolPerLoader = totalLoadersCount > 0 ? loadersPool / totalLoadersCount : 0;
  const loaderPayEach = Math.round(poolPerLoader * 0.7);

  const driverLoaderPay = isDriverLoader ? loaderPayEach : 0;
  const driverTotalPay = driverCarPay + driverLoaderPay;
  const totalLoadersPay = loaderPayEach * loadersCount;
  const companyShare = amount - driverTotalPay - totalLoadersPay;

  return {
    driverCarPay,
    driverLoaderPay,
    driverTotalPay,
    loaderPayEach,
    totalLoadersPay,
    companyShare,
    machinePool,
    loadersPool,
    isAutomatic: isCity,
  };
}

/**
 * Подсказка ЗП водителя (обратная совместимость)
 */
export function suggestDriverPay(
  orderAmount: number,
  ruleType: 'percent' | 'fixed',
  ruleValue: number,
): number {
  if (ruleType === 'percent') {
    return Math.round((orderAmount * ruleValue) / 100);
  }
  return ruleValue;
}

/**
 * Суммирует ЗП водителя за период из утверждённых рейсов.
 */
export function calcPeriodPay(
  orders: Array<{ driver_pay: string; lifecycle_status: string }>,
): string {
  return orders
    .filter((o) => o.lifecycle_status === 'approved')
    .reduce((sum, o) => sum + parseFloat(o.driver_pay), 0)
    .toFixed(2);
}
