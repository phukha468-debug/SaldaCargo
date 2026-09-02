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
  category: 'local' | 'intercity';
  baseMachinePrice?: number;
}

export const ORDER_DIRECTIONS: readonly OrderDirectionItem[] = [
  {
    id: 'local',
    label: 'По городу',
    desc: 'Верхняя Салда (базовый тариф)',
    icon: '🏙️',
    category: 'local',
    baseMachinePrice: 1000,
  },
  {
    id: 'n_salda',
    label: 'Нижняя Салда',
    desc: 'Тариф машины 1 500 ₽',
    icon: '🏙️',
    category: 'local',
    baseMachinePrice: 1500,
  },
  {
    id: 'n_salda_dam',
    label: 'Нижняя Салда (после плотины)',
    desc: 'Тариф машины 2 000 ₽',
    icon: '🌊',
    category: 'local',
    baseMachinePrice: 2000,
  },
  {
    id: 'nikitino',
    label: 'Никитино',
    desc: 'Тариф машины 1 500 ₽',
    icon: '🏡',
    category: 'local',
    baseMachinePrice: 1500,
  },
  {
    id: 'neloba',
    label: 'Нелоба',
    desc: 'Тариф машины 2 500 ₽',
    icon: '🌲',
    category: 'local',
    baseMachinePrice: 2500,
  },
  {
    id: 'basyanovka',
    label: 'Басьяновка',
    desc: 'Тариф машины 4 000 ₽',
    icon: '🏭',
    category: 'local',
    baseMachinePrice: 4000,
  },
  {
    id: 'akinfievo',
    label: 'Акинфьево',
    desc: 'Тариф машины 4 000 ₽',
    icon: '🗺️',
    category: 'local',
    baseMachinePrice: 4000,
  },
  {
    id: 'ekb',
    label: 'Екатеринбург',
    desc: 'Прямой рейс',
    icon: '🏢',
    category: 'intercity',
  },
  {
    id: 'tagil_vagonka',
    label: 'Тагил · Вагонка',
    desc: 'Дзержинский район',
    icon: '🏭',
    category: 'intercity',
  },
  {
    id: 'tagil_tagilstroy',
    label: 'Тагил · Тагилстрой',
    desc: 'Тагилстроевский район',
    icon: '🏭',
    category: 'intercity',
  },
  {
    id: 'tagil_galinka',
    label: 'Тагил · Центр / ГГМ',
    desc: 'Гальянка, Выя, Кр. Камень, Ленинский',
    icon: '🏭',
    category: 'intercity',
  },
  {
    id: 'perm',
    label: 'Пермь',
    desc: 'Межгород',
    icon: '🌲',
    category: 'intercity',
  },
  {
    id: 'chelyabinsk',
    label: 'Челябинск',
    desc: 'Межгород',
    icon: '🏭',
    category: 'intercity',
  },
  {
    id: 'other',
    label: 'Другой город',
    desc: 'Межгород по км + суточные',
    icon: '🗺️',
    category: 'intercity',
  },
] as const;

export type OrderDirectionId = (typeof ORDER_DIRECTIONS)[number]['id'];

export const DIRECTION_LABELS: Record<string, string> = {
  local: '🏙️ Верхняя Салда',
  n_salda: '🏙️ Нижняя Салда',
  n_salda_dam: '🌊 Н. Салда (после плотины)',
  nikitino: '🏡 Никитино',
  neloba: '🌲 Нелоба',
  basyanovka: '🏭 Басьяновка',
  akinfievo: '🗺️ Акинфьево',
  ekb: '🏢 Екатеринбург',
  tagil_vagonka: '🏭 Тагил (Вагонка)',
  tagil_tagilstroy: '🏭 Тагил (Тагилстрой)',
  tagil_galinka: '🏭 Тагил (Центр/ГГМ)',
  perm: '🌲 Пермь',
  chelyabinsk: '🏭 Челябинск',
  other: '🗺️ Другой город',
};

export function getDirectionLabel(id: string): string {
  return DIRECTION_LABELS[id] || '🏙️ По городу';
}

export function isLocalDirection(id: string): boolean {
  const dir = ORDER_DIRECTIONS.find((d) => d.id === id);
  return dir ? dir.category === 'local' : id === 'local';
}

export function getDirectionBasePrice(id: string, customLocalBase?: number): number {
  if (id === 'local' && customLocalBase && customLocalBase > 0) {
    return customLocalBase;
  }
  const dir = ORDER_DIRECTIONS.find((d) => d.id === id);
  return dir?.baseMachinePrice ?? (customLocalBase && customLocalBase > 0 ? customLocalBase : 1000);
}

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
 * Расчёт распределения средств по заказу внутри города / местных направлений (и базовый fallback для межгорода).
 */
export function calculateOrderPayroll(params: OrderPayrollParams): OrderPayrollResult {
  const {
    direction = 'local',
    amount = 0,
    isDriverLoader = false,
    loadersCount = 0,
    minMachineBase = 1000,
  } = params;

  // Автоматический расчет применяется ко всем местным направлениям
  const isAutomatic = isLocalDirection(direction);
  const baseRate = getDirectionBasePrice(direction, minMachineBase);

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
      isAutomatic,
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
      isAutomatic,
    };
  }

  // Сценарий 2: Есть грузчики (водитель-грузчик и/или сторонние грузчики)
  const loaderUnitRate = 1000;
  const nominalPackageRate = baseRate + totalLoadersCount * loaderUnitRate;

  let machinePool = 0;
  let loadersPool = 0;

  if (amount >= nominalPackageRate) {
    // Полные часы или стандартный тариф: делим пропорционально ставкам компонентов
    machinePool = Math.round(amount * (baseRate / nominalPackageRate));
    loadersPool = amount - machinePool;
  } else {
    // Быстрый/короткий заказ (меньше полного комплекта):
    // Машина забирает базовую ставку направления, остаток идёт в пул грузчиков
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
    isAutomatic,
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
