import { calculateOrderPayroll } from './index';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

console.log('Testing calculateOrderPayroll...');

// 1. 2000 ₽ только водитель
const t1 = calculateOrderPayroll({ amount: 2000, isDriverLoader: false, loadersCount: 0 });
console.log('T1 (2000, driver only):', t1);
assert(t1.driverTotalPay === 600, 'T1 driverTotalPay should be 600');
assert(t1.companyShare === 1400, 'T1 companyShare should be 1400');

// 2. 2000 ₽ водитель-грузчик
const t2 = calculateOrderPayroll({ amount: 2000, isDriverLoader: true, loadersCount: 0 });
console.log('T2 (2000, driver loader):', t2);
assert(t2.driverCarPay === 300, 'T2 driverCarPay should be 300');
assert(t2.driverLoaderPay === 700, 'T2 driverLoaderPay should be 700');
assert(t2.driverTotalPay === 1000, 'T2 driverTotalPay should be 1000');
assert(t2.companyShare === 1000, 'T2 companyShare should be 1000');

// 3. 10 000 ₽ водитель-грузчик (5 часов)
const t3 = calculateOrderPayroll({ amount: 10000, isDriverLoader: true, loadersCount: 0 });
console.log('T3 (10000, 5 hours driver loader):', t3);
assert(t3.driverCarPay === 1500, 'T3 driverCarPay should be 1500');
assert(t3.driverLoaderPay === 3500, 'T3 driverLoaderPay should be 3500');
assert(t3.driverTotalPay === 5000, 'T3 driverTotalPay should be 5000');
assert(t3.companyShare === 5000, 'T3 companyShare should be 5000');

// 4. 3000 ₽ водитель-грузчик + 1 доп. грузчик
const t4 = calculateOrderPayroll({ amount: 3000, isDriverLoader: true, loadersCount: 1 });
console.log('T4 (3000, driver loader + 1 loader):', t4);
assert(t4.driverCarPay === 300, 'T4 driverCarPay should be 300');
assert(t4.driverLoaderPay === 700, 'T4 driverLoaderPay should be 700');
assert(t4.driverTotalPay === 1000, 'T4 driverTotalPay should be 1000');
assert(t4.loaderPayEach === 700, 'T4 loaderPayEach should be 700');
assert(t4.companyShare === 1300, 'T4 companyShare should be 1300');

// 5. 2500 ₽ водитель-грузчик + 1 доп. грузчик (быстрый заказ)
const t5 = calculateOrderPayroll({ amount: 2500, isDriverLoader: true, loadersCount: 1 });
console.log('T5 (2500, fast order driver loader + 1 loader):', t5);
assert(t5.driverCarPay === 300, 'T5 driverCarPay should be 300');
assert(t5.driverLoaderPay === 525, 'T5 driverLoaderPay should be 525');
assert(t5.driverTotalPay === 825, 'T5 driverTotalPay should be 825');
assert(t5.loaderPayEach === 525, 'T5 loaderPayEach should be 525');
assert(t5.companyShare === 1150, 'T5 companyShare should be 1150');

// 6. 1500 ₽ водитель-грузчик (быстрый заказ без доп. грузчиков)
const t6 = calculateOrderPayroll({ amount: 1500, isDriverLoader: true, loadersCount: 0 });
console.log('T6 (1500, fast order driver loader):', t6);
assert(t6.driverCarPay === 300, 'T6 driverCarPay should be 300');
assert(t6.driverLoaderPay === 350, 'T6 driverLoaderPay should be 350');
assert(t6.driverTotalPay === 650, 'T6 driverTotalPay should be 650');
assert(t6.companyShare === 850, 'T6 companyShare should be 850');

// 7. 2000 ₽ водитель НЕ грузчик + 1 сторонний грузчик
const t7 = calculateOrderPayroll({ amount: 2000, isDriverLoader: false, loadersCount: 1 });
console.log('T7 (2000, driver only + 1 loader):', t7);
assert(t7.driverCarPay === 300, 'T7 driverCarPay should be 300');
assert(t7.driverLoaderPay === 0, 'T7 driverLoaderPay should be 0');
assert(t7.driverTotalPay === 300, 'T7 driverTotalPay should be 300');
assert(t7.loaderPayEach === 700, 'T7 loaderPayEach should be 700');
assert(t7.companyShare === 1000, 'T7 companyShare should be 1000');

// 8. 1500 ₽ водитель НЕ грузчик + 1 сторонний грузчик (быстрый заказ)
const t8 = calculateOrderPayroll({ amount: 1500, isDriverLoader: false, loadersCount: 1 });
console.log('T8 (1500, driver only + 1 loader fast):', t8);
assert(t8.driverCarPay === 300, 'T8 driverCarPay should be 300');
assert(t8.driverLoaderPay === 0, 'T8 driverLoaderPay should be 0');
assert(t8.driverTotalPay === 300, 'T8 driverTotalPay should be 300');
assert(t8.loaderPayEach === 350, 'T8 loaderPayEach should be 350');
assert(t8.companyShare === 850, 'T8 companyShare should be 850');

// 9. Спец. магазин с зоной 800 ₽
const t9 = calculateOrderPayroll({
  direction: 'local',
  amount: 800,
  isDriverLoader: false,
  loadersCount: 0,
  minMachineBase: 800,
});
console.log('T9 (800, store zone):', t9);
assert(t9.driverCarPay === 240, 'T9 driverCarPay should be 240');
assert(t9.companyShare === 560, 'T9 companyShare should be 560');

// 10. Нижняя Салда (1500 ₽ машина): 1800 ₽, водитель-грузчик + 1 сторонний грузчик
const t10 = calculateOrderPayroll({
  direction: 'n_salda',
  amount: 1800,
  isDriverLoader: true,
  loadersCount: 1,
});
console.log('T10 (1800, n_salda driver loader + 1 loader):', t10);
assert(t10.machinePool === 1500, 'T10 machinePool should be 1500');
assert(t10.loadersPool === 300, 'T10 loadersPool should be 300');
assert(t10.driverCarPay === 450, 'T10 driverCarPay should be 450');
assert(t10.driverLoaderPay === 105, 'T10 driverLoaderPay should be 105');
assert(t10.driverTotalPay === 555, 'T10 driverTotalPay should be 555');
assert(t10.loaderPayEach === 105, 'T10 loaderPayEach should be 105');
assert(t10.companyShare === 1140, 'T10 companyShare should be 1140');
assert(t10.isAutomatic === true, 'T10 should be isAutomatic');

// 11. Басьяновка (4000 ₽ машина): 4000 ₽, только водитель
const t11 = calculateOrderPayroll({
  direction: 'basyanovka',
  amount: 4000,
  isDriverLoader: false,
  loadersCount: 0,
});
console.log('T11 (4000, basyanovka driver only):', t11);
assert(t11.driverCarPay === 1200, 'T11 driverCarPay should be 1200 (30% of 4000)');
assert(t11.companyShare === 2800, 'T11 companyShare should be 2800 (70% of 4000)');
assert(t11.isAutomatic === true, 'T11 should be isAutomatic');

// 12. Межгород (Екатеринбург): isAutomatic должен быть false
const t12 = calculateOrderPayroll({
  direction: 'ekb',
  amount: 15000,
  isDriverLoader: false,
  loadersCount: 0,
});
console.log('T12 (15000, ekb intercity):', t12);
assert(t12.isAutomatic === false, 'T12 isAutomatic should be false for intercity');

console.log('ALL PAYROLL TESTS PASSED SUCCESSFULLY! ✅');
