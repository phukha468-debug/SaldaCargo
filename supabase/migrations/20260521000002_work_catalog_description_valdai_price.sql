-- ============================================================
-- SaldaCargo — work_catalog: добавить default_price_client_valdai и description
-- Откат:
--   ALTER TABLE work_catalog DROP COLUMN IF EXISTS default_price_client_valdai;
--   ALTER TABLE work_catalog DROP COLUMN IF EXISTS description;
-- ============================================================

ALTER TABLE work_catalog
  ADD COLUMN IF NOT EXISTS default_price_client_valdai DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Заполняем default_price_client_valdai для существующих записей
-- Формула: norm_minutes_valdai / 60 * 2000 (ставка клиентской машины)
UPDATE work_catalog
SET default_price_client_valdai = ROUND(norm_minutes_valdai::NUMERIC / 60.0 * 2000)
WHERE norm_minutes_valdai IS NOT NULL
  AND default_price_client_valdai IS NULL;

-- ============================================================
-- Описания для каждого вида работ (авто-заполнение при добавлении в наряд)
-- ============================================================

UPDATE work_catalog SET description = 'Произведено плановое ТО-1: замена моторного масла, воздушного и топливного фильтров. Проверка технических жидкостей.' WHERE code = 'TO_1';
UPDATE work_catalog SET description = 'Произведено полное плановое ТО-2: замена масла, всех фильтров, свечей, проверка тормозов, ходовой и технических жидкостей.' WHERE code = 'TO_2';
UPDATE work_catalog SET description = 'Произведена замена моторного масла и масляного фильтра. Старое масло слито, фильтр заменён.' WHERE code = 'OIL_CHANGE';
UPDATE work_catalog SET description = 'Произведена замена воздушного фильтра двигателя. Корпус фильтра очищен.' WHERE code = 'AIR_FILTER';
UPDATE work_catalog SET description = 'Произведена замена топливного фильтра. Система проверена на герметичность.' WHERE code = 'FUEL_FILTER';
UPDATE work_catalog SET description = 'Произведена замена салонного фильтра. Старый фильтр утилизирован.' WHERE code = 'CABIN_FILTER';
UPDATE work_catalog SET description = 'Произведена замена охлаждающей жидкости (антифриза). Система охлаждения промыта, заправлена свежей ОЖ.' WHERE code = 'ANTIFREEZE';
UPDATE work_catalog SET description = 'Произведена замена тормозной жидкости. Система прокачана, воздух удалён.' WHERE code = 'BRAKE_FLUID';
UPDATE work_catalog SET description = 'Произведена замена жидкости гидроусилителя руля. Бачок промыт, залита свежая жидкость.' WHERE code = 'GUR_FLUID';

UPDATE work_catalog SET description = 'Произведена замена ремня ГРМ в сборе (ремень, ролики). Метки выставлены, натяжение проверено.' WHERE code = 'TIMING_BELT';
UPDATE work_catalog SET description = 'Произведена замена цепи ГРМ, натяжителя и успокоителя. Фазы ГРМ выставлены по меткам.' WHERE code = 'TIMING_CHAIN';
UPDATE work_catalog SET description = 'Выполнена компьютерная диагностика двигателя. Считаны коды неисправностей, составлено заключение.' WHERE code = 'ENGINE_DIAG';
UPDATE work_catalog SET description = 'Произведена замена прокладки головки блока цилиндров. Головка проверена на геометрию, болты затянуты по моменту.' WHERE code = 'HEAD_GASKET';
UPDATE work_catalog SET description = 'Выполнена регулировка тепловых зазоров клапанов. Зазоры выставлены по норме.' WHERE code = 'VALVE_ADJUST';
UPDATE work_catalog SET description = 'Произведена замена форсунок. Система топливопитания проверена на герметичность.' WHERE code = 'INJECTORS';
UPDATE work_catalog SET description = 'Произведена замена свечей накала. Момент затяжки проверен.' WHERE code = 'GLOW_PLUGS';
UPDATE work_catalog SET description = 'Произведена замена свечей зажигания на новые.' WHERE code = 'SPARK_PLUGS';
UPDATE work_catalog SET description = 'Произведена замена турбокомпрессора. Маслоподводящая трубка промыта, уровень масла проверен.' WHERE code = 'TURBO_REPLACE';
UPDATE work_catalog SET description = 'Выполнена диагностика турбины: проверка давления наддува, осевого/радиального люфта вала.' WHERE code = 'TURBO_DIAG';
UPDATE work_catalog SET description = 'Выполнена чистка клапана рециркуляции ОГ (EGR). Клапан промыт специальным составом, проверена подвижность.' WHERE code = 'EGR_CLEAN';
UPDATE work_catalog SET description = 'Произведена замена подушек двигателя. Двигатель выставлен, крепёж затянут по моменту.' WHERE code = 'ENGINE_MOUNT';
UPDATE work_catalog SET description = 'Произведена замена радиатора охлаждения. Система заправлена антифризом, проверена на герметичность.' WHERE code = 'RADIATOR_REPLACE';
UPDATE work_catalog SET description = 'Произведена замена термостата. Работа системы охлаждения проверена.' WHERE code = 'THERMOSTAT';
UPDATE work_catalog SET description = 'Произведена замена водяной помпы. Ремень ГРМ проверен, система охлаждения заправлена.' WHERE code = 'WATER_PUMP';
UPDATE work_catalog SET description = 'Произведена замена приводного (навесного) ремня. Натяжение и состояние ролика проверены.' WHERE code = 'BELT_DRIVE';
UPDATE work_catalog SET description = 'Произведена замена натяжного ролика приводного ремня.' WHERE code = 'BELT_TENSIONER';
UPDATE work_catalog SET description = 'Произведена замена сальников/прокладок двигателя. Течи устранены, поверхности обезжирены.' WHERE code = 'SEALS_GASKETS';

UPDATE work_catalog SET description = 'Произведена замена комплекта сцепления (диск, корзина, выжимной). Система отрегулирована.' WHERE code = 'CLUTCH';
UPDATE work_catalog SET description = 'Произведена замена троса привода сцепления. Свободный ход педали отрегулирован.' WHERE code = 'CLUTCH_CABLE';
UPDATE work_catalog SET description = 'Произведена замена главного/рабочего цилиндра сцепления. Система прокачана, воздух удалён.' WHERE code = 'CLUTCH_CYLINDER';
UPDATE work_catalog SET description = 'Произведена замена масла в коробке переключения передач. Старое масло слито.' WHERE code = 'GEARBOX_OIL';
UPDATE work_catalog SET description = 'Произведена замена масла заднего моста. Пробка слива и заливки проверены.' WHERE code = 'REAR_AXLE_OIL';
UPDATE work_catalog SET description = 'Произведена замена коробки переключения передач. КПП установлена, масло залито, работа проверена.' WHERE code = 'GEARBOX_REPLACE';
UPDATE work_catalog SET description = 'Выполнена регулировка кулисы и чёткости переключения передач КПП.' WHERE code = 'GEARBOX_ADJUST';
UPDATE work_catalog SET description = 'Произведена замена карданного вала. Крестовины проверены, балансировка выполнена.' WHERE code = 'CARDAN_REPLACE';
UPDATE work_catalog SET description = 'Произведена замена крестовины карданного вала. Биение вала проверено.' WHERE code = 'CARDAN_CROSS';
UPDATE work_catalog SET description = 'Произведена замена крестовины карданного вала.' WHERE code = 'CARDAN_CROSS_150';
UPDATE work_catalog SET description = 'Произведена замена переднего ступичного подшипника. Момент затяжки гайки проверен, шплинт установлен.' WHERE code = 'HUB_BEARING_FRONT';
UPDATE work_catalog SET description = 'Произведена замена заднего ступичного подшипника. Регулировочные прокладки подобраны по люфту.' WHERE code = 'HUB_BEARING_REAR';
UPDATE work_catalog SET description = 'Задний мост снят в сборе, установлен на место. Крепление на раме затянуто по моменту, масло залито.' WHERE code = 'REAR_AXLE_REMOVE';
UPDATE work_catalog SET description = 'Задний мост разобран, произведена дефектовка деталей. Изношенные элементы заменены, мост собран.' WHERE code = 'REAR_AXLE_OVERHAUL';

UPDATE work_catalog SET description = 'Произведена замена передних тормозных колодок. Состояние дисков проверено, направляющие смазаны.' WHERE code = 'BRAKE_PADS_FRONT';
UPDATE work_catalog SET description = 'Произведена замена задних тормозных колодок. Барабаны проверены, стяжные пружины заменены.' WHERE code = 'BRAKE_PADS_REAR';
UPDATE work_catalog SET description = 'Произведена замена передних тормозных дисков. Колодки установлены новые.' WHERE code = 'BRAKE_DISCS_FRONT';
UPDATE work_catalog SET description = 'Произведена замена задних тормозных барабанов. Колодки и стяжные пружины заменены.' WHERE code = 'BRAKE_DRUMS_REAR';
UPDATE work_catalog SET description = 'Произведена замена передних амортизаторов. Крепёж затянут по моменту.' WHERE code = 'SHOCK_FRONT';
UPDATE work_catalog SET description = 'Произведена замена задних амортизаторов. Крепёж затянут по моменту.' WHERE code = 'SHOCK_REAR';
UPDATE work_catalog SET description = 'Выполнена регулировка углов развала и схождения колёс. Параметры выставлены в норму.' WHERE code = 'ALIGNMENT';
UPDATE work_catalog SET description = 'Выполнена диагностика ходовой части: проверка люфтов, состояния сайлентблоков, амортизаторов, рулевого.' WHERE code = 'SUSPENSION_DIAG';
UPDATE work_catalog SET description = 'Произведена замена шаровой опоры. Крепёж затянут по моменту, люфт устранён.' WHERE code = 'BALL_JOINT';
UPDATE work_catalog SET description = 'Произведена замена рулевой тяги. Сход-развал проверен после установки.' WHERE code = 'TIE_ROD';
UPDATE work_catalog SET description = 'Произведена замена рулевого наконечника. Люфт в рулевом управлении устранён.' WHERE code = 'TIE_ROD_END';
UPDATE work_catalog SET description = 'Произведена замена сайлентблоков передней подвески. Крепёж затянут по моменту.' WHERE code = 'SILENTBLOCK_FRONT';
UPDATE work_catalog SET description = 'Произведена замена сайлентблоков задней подвески. Стремянки и крепёж затянуты.' WHERE code = 'SILENTBLOCK_REAR';
UPDATE work_catalog SET description = 'Произведена замена рессоры/пружины подвески. Стремянки затянуты по моменту.' WHERE code = 'SPRING_REPLACE';
UPDATE work_catalog SET description = 'Произведена замена втулок стабилизатора поперечной устойчивости.' WHERE code = 'STABILIZER_BUSH';
UPDATE work_catalog SET description = 'Произведена замена стоек стабилизатора поперечной устойчивости.' WHERE code = 'STABILIZER_LINK';
UPDATE work_catalog SET description = 'Произведена замена рулевой рейки. Система ГУР прокачана, отрегулирован люфт.' WHERE code = 'STEERING_RACK';
UPDATE work_catalog SET description = 'Произведена замена насоса гидроусилителя руля. Система заправлена и прокачана.' WHERE code = 'STEERING_PUMP';
UPDATE work_catalog SET description = 'Произведена замена подшипника колеса. Люфт колеса устранён.' WHERE code = 'WHEEL_BEARING';
UPDATE work_catalog SET description = 'Произведена замена датчика ABS. Кольцо АБС проверено на загрязнение.' WHERE code = 'ABS_SENSOR';
UPDATE work_catalog SET description = 'Рессора снята, сайлентблоки заменены на новые, рессора установлена. Стремянки затянуты по моменту.' WHERE code = 'SPRING_SILENTBLOCK_REPLACE';
UPDATE work_catalog SET description = 'Произведена замена втулок проушин амортизатора (верхних и нижних). Крепёж затянут.' WHERE code = 'SHOCK_ABSORBER_BUSH';
UPDATE work_catalog SET description = 'Выполнена прокачка тормозного контура. Воздух удалён из всех цилиндров, уровень жидкости проверен.' WHERE code = 'BRAKE_BLEED';
UPDATE work_catalog SET description = 'Выполнено срезание закисших стремянок рессор. Метизы заменены на новые.' WHERE code = 'SPRING_STUD_REMOVE';

UPDATE work_catalog SET description = 'Произведена замена генератора. Ремень и крепление проверены, зарядный ток проверен мультиметром.' WHERE code = 'ALTERNATOR';
UPDATE work_catalog SET description = 'Произведена замена стартера. Работа стартера под нагрузкой проверена.' WHERE code = 'STARTER';
UPDATE work_catalog SET description = 'Выполнена диагностика электрооборудования. Считаны коды ошибок ЭБУ, составлено заключение по неисправностям.' WHERE code = 'ELECTRIC_DIAG';
UPDATE work_catalog SET description = 'Произведена замена АКБ. Клеммы обработаны смазкой, ток покоя проверен.' WHERE code = 'BATTERY_REPLACE';
UPDATE work_catalog SET description = 'Выполнен поиск и устранение обрыва/КЗ в цепи. Повреждённый участок проводки восстановлен.' WHERE code = 'WIRING_REPAIR';
UPDATE work_catalog SET description = 'Произведена замена фары/фонаря. Регулировка светового пучка выполнена.' WHERE code = 'HEADLIGHT_REPLACE';
UPDATE work_catalog SET description = 'Произведена замена ламп (фара/габарит/стоп-сигнал). Работа световых приборов проверена.' WHERE code = 'LAMP_REPLACE';
UPDATE work_catalog SET description = 'Произведена замена катушки зажигания. Работа цилиндра проверена.' WHERE code = 'IGNITION_COIL';
UPDATE work_catalog SET description = 'Произведена замена жгута проводки. Все цепи проверены на целостность.' WHERE code = 'WIRING_HARNESS';
UPDATE work_catalog SET description = 'Выполнен ремонт участка кабельной трассы: повреждённый провод заменён, изоляция восстановлена.' WHERE code = 'WIRING_HARNESS_PARTIAL';
UPDATE work_catalog SET description = 'Выполнен выходной контроль электрических цепей. Целостность и сопротивление цепей в норме.' WHERE code = 'ELECTRIC_CIRCUIT_CHECK';
UPDATE work_catalog SET description = 'Выполнена компьютерная диагностика систем ABS/EBS. Считаны коды ошибок, составлено заключение.' WHERE code = 'ABS_EBS_DIAG';
UPDATE work_catalog SET description = 'Выполнен контроль цепи датчика ABS. Зубчатый ротор ступицы очищен от загрязнений.' WHERE code = 'ABS_CIRCUIT_CHECK';
UPDATE work_catalog SET description = 'Произведён демонтаж датчика ABS для замены или диагностики.' WHERE code = 'ABS_SENSOR_REMOVE';
UPDATE work_catalog SET description = 'Произведён монтаж датчика ABS. Зазор между датчиком и ротором выставлен по норме.' WHERE code = 'ABS_SENSOR_INSTALL_ADJ';
UPDATE work_catalog SET description = 'Выполнен сброс кодов ошибок ЭБУ. Финальное тестирование систем пройдено успешно.' WHERE code = 'ECU_RESET_TEST';

UPDATE work_catalog SET description = 'Выполнен мелкий кузовной ремонт: выправлены вмятины, зашпаклёваны и подкрашены повреждённые места.' WHERE code = 'BODY_REPAIR';
UPDATE work_catalog SET description = 'Выполнена покраска кузовного элемента. Подготовка, грунтование, нанесение краски и лака.' WHERE code = 'BODY_PAINT';
UPDATE work_catalog SET description = 'Произведена замена стекла (лобового/бокового). Герметик нанесён, уплотнители установлены.' WHERE code = 'GLASS_REPLACE';
UPDATE work_catalog SET description = 'Произведена замена ручки двери / замка. Работа механизма проверена.' WHERE code = 'DOOR_HANDLE';
UPDATE work_catalog SET description = 'Произведена замена зеркала. Регулировка угла выполнена.' WHERE code = 'MIRROR_REPLACE';
UPDATE work_catalog SET description = 'Произведена замена механизма (трапеции) стеклоочистителей. Работа дворников проверена.' WHERE code = 'WIPER_MECH';
UPDATE work_catalog SET description = 'Произведена замена радиатора отопителя (печки). Система охлаждения заправлена, герметичность проверена.' WHERE code = 'HEATER_CORE';
UPDATE work_catalog SET description = 'Произведена замена вентилятора отопителя. Работа на всех скоростях проверена.' WHERE code = 'HEATER_FAN';
UPDATE work_catalog SET description = 'Выполнена заправка системы кондиционирования хладагентом. Давление в контуре проверено.' WHERE code = 'AC_CHARGE';
UPDATE work_catalog SET description = 'Произведена замена компрессора кондиционера. Система заправлена, утечки проверены.' WHERE code = 'AC_COMPRESSOR';

UPDATE work_catalog SET description = 'Произведена замена глушителя. Хомуты затянуты, герметичность соединений проверена.' WHERE code = 'EXHAUST_MUFFLER';
UPDATE work_catalog SET description = 'Произведена замена приёмной трубы выхлопной системы. Прокладка заменена.' WHERE code = 'EXHAUST_PIPE';
UPDATE work_catalog SET description = 'Произведена замена прокладки выпускного коллектора. Болты затянуты по моменту.' WHERE code = 'EXHAUST_GASKET';
UPDATE work_catalog SET description = 'Произведена замена гофрированной вставки (гофры) выхлопной системы.' WHERE code = 'EXHAUST_FLEX';

UPDATE work_catalog SET description = 'Произведена замена топливного насоса. Давление топлива в рейке проверено.' WHERE code = 'FUEL_PUMP';
UPDATE work_catalog SET description = 'Произведена замена топливного бака. Система проверена на герметичность.' WHERE code = 'FUEL_TANK';
UPDATE work_catalog SET description = 'Произведена замена топливных магистралей. Соединения проверены на герметичность.' WHERE code = 'FUEL_LINES';

UPDATE work_catalog SET description = 'Произведён шиномонтаж комплекта из 4 колёс. Давление в шинах выставлено по норме.' WHERE code = 'TYRE_MOUNT_SET';
UPDATE work_catalog SET description = 'Произведён шиномонтаж 1 колеса. Давление проверено.' WHERE code = 'TYRE_MOUNT_ONE';
UPDATE work_catalog SET description = 'Выполнена балансировка колеса. Биение устранено.' WHERE code = 'TYRE_BALANCE';
UPDATE work_catalog SET description = 'Выполнен ремонт прокола шины методом вулканизации (жгут/заплатка).' WHERE code = 'TYRE_REPAIR';

UPDATE work_catalog SET description = 'Выполнено снятие и установка газового баллона пропан-бутан (ГБО). Крепление и герметичность соединений проверены.' WHERE code = 'GBO_BALLOON_LP';
UPDATE work_catalog SET description = 'Выполнены сварочно-восстановительные работы на чулке заднего моста. Трещины заварены, поверхность покрашена.' WHERE code = 'AXLE_WELD_PAINT';
