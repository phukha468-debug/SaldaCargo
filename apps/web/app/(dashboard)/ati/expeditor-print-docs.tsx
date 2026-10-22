'use client';

import React from 'react';
import type { ExpeditorOrder } from '@/app/api/ati-expeditor/route';

interface ExpeditorPrintDocsProps {
  order: ExpeditorOrder;
  docType: 'order' | 'offer';
  onClose: () => void;
}

export const ExpeditorPrintDocs: React.FC<ExpeditorPrintDocsProps> = ({
  order,
  docType,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-4 sm:p-6 print:p-0 print:bg-white print:fixed print:inset-0">
      {/* Панель управления (не печатается) */}
      <div className="w-full max-w-4xl bg-slate-900 text-white rounded-2xl p-3 mb-4 flex items-center justify-between shadow-xl print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xl">🖨️</span>
          <div>
            <h3 className="font-bold text-sm">
              {docType === 'order'
                ? `Договор-Заявка ${order.order_number}`
                : `Договор-Оферта на перевозку (ред. ${order.order_date})`}
            </h3>
            <p className="text-xs text-slate-400">
              Официальный юридический документ со штампами и реквизитами Сторон
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl cursor-pointer shadow flex items-center gap-1.5 transition active:scale-95"
          >
            <span>Печать / Сохранить в PDF</span>
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition"
          >
            ✕ Закрыть
          </button>
        </div>
      </div>

      {/* Лист А4 документа */}
      <div className="w-full max-w-4xl bg-white text-slate-950 p-8 sm:p-12 shadow-2xl rounded-2xl print:shadow-none print:rounded-none print:p-6 font-serif text-[12px] leading-relaxed border border-slate-200 print:border-none">
        {docType === 'order' ? (
          /* =========================================================================
             ДОКУМЕНТ 1: ДОГОВОР-ЗАЯВКА НА ПЕРЕВОЗКУ ГРУЗА
             ========================================================================= */
          <div className="space-y-4">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2">
              <div>
                <h1 className="text-base sm:text-lg font-black font-sans uppercase tracking-tight">
                  ДОГОВОР-ЗАЯВКА НА ПЕРЕВОЗКУ ГРУЗА {order.order_number}
                </h1>
                <p className="text-[10px] text-slate-600 italic">
                  Неотъемлемая часть Договора-оферты на организацию перевозки грузов
                </p>
              </div>
              <div className="text-right text-[11px] font-sans">
                <div>
                  <strong>Дата:</strong> {order.order_date} г.
                </div>
                <div>
                  <strong>Место:</strong> г. Верхняя Салда
                </div>
              </div>
            </div>

            {/* Таблица разделов заявки */}
            <table className="w-full border-collapse border border-slate-900 text-[11px]">
              <tbody>
                {/* 1. ЭКСПЕДИТОР */}
                <tr className="border-b border-slate-900">
                  <td className="w-1/4 p-2 font-bold bg-slate-100 border-r border-slate-900 align-top uppercase">
                    1. ЭКСПЕДИТОР
                  </td>
                  <td className="p-2 align-top">
                    <div className="font-bold">ИП Нигамедьянов Александр Сергеевич</div>
                    <div>ОГРНИП: 321665800053976 | ИНН: 660704814106</div>
                    <div>
                      Адрес: 624760, Свердловская обл., г. Верхняя Салда, ул. 25 Октября, д. 11, кв.
                      22
                    </div>
                    <div>
                      Банк: АО «ТБАНК», Р/с 40802810500001961654, Корр. счет 30101810145250000974,
                      БИК 044525974
                    </div>
                    <div className="font-bold text-slate-900 mt-1">
                      Официальный номер для связи и фиксации инцидентов (MAX): +7 (922) 180-09-11
                    </div>
                  </td>
                </tr>

                {/* 1.1. ЗАКАЗЧИК ПЕРЕВОЗКИ */}
                <tr className="border-b border-slate-900 bg-sky-50/40">
                  <td className="p-2 font-bold bg-slate-100 border-r border-slate-900 align-top uppercase">
                    1.1. ЗАКАЗЧИК
                  </td>
                  <td className="p-2 align-top">
                    <div className="font-bold text-slate-950 text-[11.5px]">
                      {order.client_name || 'Вельбой Василий Михайлович'}
                    </div>
                    {order.client_type === 'individual' ? (
                      <div className="space-y-0.5 mt-0.5">
                        <div>
                          <strong>Паспортные данные:</strong>{' '}
                          {order.client_passport_series && order.client_passport_number ? (
                            <>
                              серия {order.client_passport_series} № {order.client_passport_number},
                              выдан {order.client_passport_issued_by}{' '}
                              {order.client_passport_issued_date}, код подразделения{' '}
                              {order.client_passport_code}
                            </>
                          ) : (
                            order.client_passport || 'Паспорт гражданина РФ'
                          )}
                        </div>
                        <div>
                          <strong>Адрес регистрации:</strong>{' '}
                          {order.client_reg_address ||
                            'Свердловская обл., г. Верхняя Салда, ул. Энгельса, д. 85, корп. 2, кв. 135'}
                        </div>
                        <div>
                          <strong>Телефон (мессенджер «MAX»):</strong>{' '}
                          <span className="font-mono font-bold text-slate-900">
                            {order.client_phone || '+7 961 226-94-95'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5 mt-0.5">
                        <div>
                          <strong>ИНН:</strong> {order.client_inn || '—'}
                        </div>
                        <div>
                          <strong>Телефон:</strong> {order.client_phone || '—'}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>

                {/* 2. ПЕРЕВОЗЧИК */}
                <tr className="border-b border-slate-900">
                  <td className="p-2 font-bold bg-slate-100 border-r border-slate-900 align-top uppercase">
                    2. ПЕРЕВОЗЧИК
                  </td>
                  <td className="p-2 align-top">
                    <div className="font-bold">
                      {order.carrier_name || 'ИП Салихов Руслан Маснавиевич'}
                    </div>
                    <div>
                      ОГРНИП: {order.carrier_ogrnip || '314745717500013'} | ИНН:{' '}
                      {order.carrier_inn || '741701150716'}
                    </div>
                    <div>
                      Паспорт:{' '}
                      {order.carrier_passport ||
                        'серия 75 25 № 412915, выдан 18.07.2025 г. ГУ МВД России по Челябинской обл., код 740-031'}
                    </div>
                    <div>
                      Адрес регистрации:{' '}
                      {order.carrier_reg_address ||
                        '456920, Челябинская обл., Саткинский р-н, рп. Сулея, ул. Лермонтова, д. 91'}
                    </div>
                    <div>
                      Банк: {order.carrier_bank || 'АО «ТБАНК»'}, Р/с{' '}
                      {order.carrier_account || '40802810400004121397'}, Корр. счет{' '}
                      {order.carrier_corr_account || '30101810145250000974'}, БИК{' '}
                      {order.carrier_bik || '044525974'}
                    </div>
                    <div>
                      Телефон: {order.carrier_phone || '+7 (982) 360-02-56'} | E-mail:{' '}
                      {order.carrier_email || 'ruslansalichov65@yandex.ru'}
                    </div>
                  </td>
                </tr>

                {/* 3. ТРАНСПОРТ И ВОДИТЕЛЬ */}
                <tr className="border-b border-slate-900">
                  <td className="p-2 font-bold bg-slate-100 border-r border-slate-900 align-top uppercase">
                    3. ТРАНСПОРТ И ВОДИТЕЛЬ
                  </td>
                  <td className="p-2 align-top">
                    <div>
                      <strong>Автомобиль:</strong>{' '}
                      {order.carrier_vehicle || 'ГАЗ 2824DH (бортовой тентованный)'}, Гос. номер:{' '}
                      <strong>{order.carrier_reg_number || 'В 003 ХС 174'}</strong> | VIN:{' '}
                      {order.carrier_vin || 'XU42824DHJ0003324'}
                    </div>
                    <div>
                      <strong>Водитель:</strong>{' '}
                      {order.carrier_driver_name || 'Салихов Руслан Маснавиевич'} |{' '}
                      {order.carrier_driver_license ||
                        'В/у: 74 32 432701 (кат. A, A1, B, B1, C, C1, M)'}{' '}
                      | Тел: {order.carrier_driver_phone || '+7 (982) 360-02-56'}
                    </div>
                    {order.passenger_in_cabin && (
                      <div className="mt-1 font-bold text-slate-900 bg-amber-50 p-1.5 border border-amber-300 rounded">
                        Пассажирское место в кабине: В кабине автомобиля совместно с водителем на
                        протяжении всего маршрута следует Заказчик перевозки (пассажирское место
                        закреплено и входит в условия рейса).
                      </div>
                    )}
                  </td>
                </tr>

                {/* 4. МАРШРУТ И АДРЕСА */}
                <tr className="border-b border-slate-900">
                  <td className="p-2 font-bold bg-slate-100 border-r border-slate-900 align-top uppercase">
                    4. МАРШРУТ И АДРЕСА
                  </td>
                  <td className="p-2 align-top">
                    <div>
                      <strong>Маршрут следования:</strong>{' '}
                      {order.pickup_route_title || 'г. Верхняя Салда (Свердловская обл.)'} —{' '}
                      {order.delivery_route_title || 'Новосибирская обл., р.п. Кольцово'}
                    </div>
                    <div className="mt-1">
                      <strong>Погрузка:</strong> {order.pickup_address}
                    </div>
                    <div className="mt-1">
                      <strong>Разгрузка:</strong> {order.delivery_address}
                    </div>
                  </td>
                </tr>

                {/* 5. СРОКИ И ГРАФИК ПОДАЧИ */}
                <tr className="border-b border-slate-900">
                  <td className="p-2 font-bold bg-slate-100 border-r border-slate-900 align-top uppercase">
                    5. СРОКИ И ГРАФИК ПОДАЧИ
                  </td>
                  <td className="p-2 align-top">
                    <div>
                      <strong>Точное время подачи автомобиля под погрузку:</strong>{' '}
                      {order.pickup_date_time || '30.10.2026 г. ровно к 08:00'}
                    </div>
                    <div>
                      Планируемый срок прибытия на разгрузку:{' '}
                      {order.delivery_date || '«___» _________ 2026 г. к ___:___'}
                    </div>
                  </td>
                </tr>

                {/* 6. ХАРАКТЕР ГРУЗА И РАБОТЫ */}
                <tr className="border-b border-slate-900">
                  <td className="p-2 font-bold bg-slate-100 border-r border-slate-900 align-top uppercase">
                    6. ХАРАКТЕР ГРУЗА И РАБОТЫ
                  </td>
                  <td className="p-2 align-top">
                    <div>
                      <strong>Груз:</strong>{' '}
                      {order.cargo_description ||
                        'Личные (домашние) вещи физического лица, бытовой инвентарь.'}
                    </div>
                    <div className="mt-1">
                      <strong>Условия ПРР:</strong>{' '}
                      {order.loading_conditions ||
                        'Погрузка на всех точках в г. Верхняя Салда осуществляется Заказчиком самостоятельно. Перевозчик (водитель) обязан оказать помощь при разгрузке на обеих точках в р.п. Кольцово (помощь включена в стоимость перевозки).'}
                    </div>
                  </td>
                </tr>

                {/* 7. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ */}
                <tr className="border-b border-slate-900">
                  <td className="p-2 font-bold bg-slate-100 border-r border-slate-900 align-top uppercase">
                    7. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ
                  </td>
                  <td className="p-2 align-top space-y-1.5">
                    {order.total_client_price ? (
                      <div className="font-bold text-slate-950">
                        Общая стоимость услуг для Заказчика:{' '}
                        {order.total_client_price.toLocaleString('ru-RU')} рублей (НДС не
                        облагается).
                      </div>
                    ) : null}

                    {order.deposit_amount ? (
                      <div className="bg-emerald-50/80 border border-emerald-300 p-1 rounded text-emerald-950 font-sans">
                        <strong>Задаток:</strong> {order.deposit_amount.toLocaleString('ru-RU')}{' '}
                        рублей{' '}
                        {order.deposit_paid ? '(внесён Заказчиком Экспедитору)' : '(к оплате)'}.
                      </div>
                    ) : null}

                    <div className="font-bold text-slate-800">
                      Ставка Перевозчика (фрахт):{' '}
                      {order.carrier_freight_price.toLocaleString('ru-RU')} рублей (НДС не
                      облагается).
                    </div>

                    {order.payment_scheme === 'two_stage' ? (
                      <div className="space-y-1 pt-1 border-t border-slate-300">
                        <div>
                          <strong>
                            1 этап: {order.stage1_amount?.toLocaleString('ru-RU')} рублей
                          </strong>{' '}
                          —{' '}
                          {order.stage1_terms ||
                            'выплачивается Экспедитором наличными денежными средствами сразу после завершения погрузки на обеих точках непосредственно перед отправлением автомобиля.'}
                        </div>
                        <div>
                          <strong>
                            2 этап: {order.stage2_amount?.toLocaleString('ru-RU')} рублей
                          </strong>{' '}
                          —{' '}
                          {order.stage2_terms ||
                            'оплачивается Заказчиком (физическим лицом) наличными денежными средствами Перевозчику на второй (конечной) точке разгрузки.'}
                        </div>
                      </div>
                    ) : (
                      <div>Оплата по договоренности: 100% постоплата по оригиналам документов.</div>
                    )}
                  </td>
                </tr>

                {/* 8. ШТРАФНЫЕ САНКЦИИ ЗА СРЫВ СРОКОВ */}
                <tr>
                  <td className="p-2 font-bold bg-slate-100 border-r border-slate-900 align-top uppercase">
                    8. ШТРАФНЫЕ САНКЦИИ ЗА СРЫВ СРОКОВ
                  </td>
                  <td className="p-2 align-top text-[10.5px]">
                    <div>
                      • <strong>Опоздание на погрузку:</strong> При подаче ТС позже назначенного
                      времени Перевозчик выплачивает штраф в размере{' '}
                      <strong>{order.penalty_delay_hourly || 1000} рублей</strong> за каждый полный
                      час просрочки.
                    </div>
                    <div className="mt-1">
                      • <strong>Неподача ТС:</strong> В случае непредоставления автомобиля более чем
                      на 24 часа с момента назначенного времени Экспедитор вправе в одностороннем
                      порядке отказаться от исполнения договора, а Перевозчик обязан уплатить штраф
                      в размере <strong>{order.penalty_cancellation || 24000} рублей</strong>.
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Блок фиксации инцидентов */}
            <div className="border border-slate-900 p-2 bg-slate-50 text-[10.5px]">
              <strong>Юридическая фиксация инцидентов:</strong> О любых задержках в пути,
              разногласиях, поломках или обстоятельствах, влияющих на исполнение рейса, Перевозчик
              обязан незамедлительно заявлять в момент их возникновения сообщением в мессенджер по
              номеру Экспедитора: <strong>+7 (922) 180-09-11</strong> для официальной фиксации.
            </div>

            {/* Подписи и печати */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-slate-400">
              <div className="space-y-1">
                <div className="font-bold uppercase text-[11px]">ЭКСПЕДИТОР</div>
                <div className="font-bold">ИП Нигамедьянов Александр Сергеевич</div>
                <div className="text-[10px] text-slate-600">
                  ИНН: 660704814106 / ОГРНИП: 321665800053976
                </div>
                <div className="pt-8 flex items-end">
                  <div className="border-b border-slate-900 w-full text-center text-[10px] text-slate-500">
                    / Нигамедьянов А.С. /
                  </div>
                  <div className="ml-1 text-[10px] text-slate-400">М.П.</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-bold uppercase text-[11px]">ПЕРЕВОЗЧИК</div>
                <div className="font-bold">{order.carrier_name}</div>
                <div className="text-[10px] text-slate-600">
                  ИНН: {order.carrier_inn} / ОГРНИП: {order.carrier_ogrnip}
                </div>
                <div className="pt-8 flex items-end">
                  <div className="border-b border-slate-900 w-full text-center text-[10px] text-slate-500">
                    / {order.carrier_driver_name || 'Салихов Р.М.'} /
                  </div>
                  <div className="ml-1 text-[10px] text-slate-400">М.П.</div>
                </div>
              </div>

              <div className="space-y-1 bg-slate-50 p-2 rounded border border-slate-300">
                <div className="font-bold uppercase text-[11px] text-slate-900">
                  ЗАКАЗЧИК ПЕРЕВОЗКИ
                </div>
                <div className="font-bold truncate">{order.client_name || 'Вельбой В.М.'}</div>
                <div className="text-[10px] text-slate-600">
                  {order.client_passport_series && order.client_passport_number
                    ? `Паспорт ${order.client_passport_series} ${order.client_passport_number}`
                    : 'Паспорт гражданина РФ'}
                </div>
                <div className="pt-6 flex items-end">
                  <div className="border-b border-slate-900 w-full text-center text-[10px] text-slate-500">
                    / {order.client_name.split(' ').slice(0, 2).join(' ') || 'Заказчик'} /
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             ДОКУМЕНТ 2: ДОГОВОР-ОФЕРТА НА ОРГАНИЗАЦИЮ ПЕРЕВОЗКИ ГРУЗОВ
             ========================================================================= */
          <div className="space-y-4 text-justify">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2">
              <div>
                <h1 className="text-base sm:text-lg font-black font-sans uppercase tracking-tight">
                  ДОГОВОР-ОФЕРТА НА ОРГАНИЗАЦИЮ ПЕРЕВОЗКИ ГРУЗОВ
                </h1>
                <p className="text-[10px] text-slate-600 italic">
                  Правила и юридические условия выполнения перевозок автомобильным транспортом
                </p>
              </div>
              <div className="text-right text-[11px] font-sans">
                <div>г. Верхняя Салда</div>
                <div>
                  <strong>Редакция от:</strong> {order.order_date} г.
                </div>
              </div>
            </div>

            <p className="text-[11px]">
              Индивидуальный предприниматель <strong>Нигамедьянов Александр Сергеевич</strong>{' '}
              (ОГРНИП 321665800053976, ИНН 660704814106), именуемый в дальнейшем «Экспедитор»,
              адресует настоящую Оферту любому лицу (индивидуальному предпринимателю или
              юридическому лицу), имеющему намерение оказать услуги перевозки (далее —
              «Перевозчик»).
            </p>

            <div className="space-y-2 text-[11px]">
              <div>
                <strong>1. Порядок заключения и юридическая сила:</strong> Настоящий Договор
                регулируется нормами ст. 421, 434, 435, 438, 784–806 ГК РФ, ФЗ № 87-ФЗ, ФЗ № 259-ФЗ.
                Полным и безоговорочным акцептом (принятием) условий Оферты признается: подписание
                соответствующей Договора-заявки, письменное согласование в мессенджере «MAX» или по
                электронной почте, либо фактическая подача транспортного средства по адресу
                погрузки.
              </div>

              <div>
                <strong>2. Требования к подвижному составу и обязанности Перевозчика:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>
                    Подать под загрузку технически исправный, сухой автотранспорт. Кузов
                    транспортного средства должен быть строго целым, без сквозных повреждений,
                    порезов тента, протечек и дефектов, способных привести к загрязнению, намоканию
                    или утрате груза.
                  </li>
                  <li>
                    Перевозчик обязан предоставить фото автомобиля сразу после подписания
                    Договора-заявки в мессенджере «MAX» в том фактическом состоянии (внешний вид,
                    состояние кузова изнутри и снаружи), в котором ТС будет непосредственно подано
                    на загрузку.
                  </li>
                  <li>
                    Перевозчик обеспечивает бережное размещение, надлежащую увязку груза ремнями и
                    несет полную материальную ответственность за сохранность вещей в пути.
                  </li>
                </ul>
              </div>

              <div>
                <strong>3. Категорический запрет догруза:</strong> В кузове автомобиля запрещается
                совместная перевозка сторонних грузов (догруз) без предварительного письменного
                согласования с Экспедитором в мессенджере «MAX». При нарушении штраф составляет{' '}
                <strong>100% от ставки перевозки</strong> с возмещением возникших убытков.
              </div>

              <div>
                <strong>4. Особый порядок расчетов и статус договоренностей:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>
                    Основным регулирующим документом для каждой отдельной перевозки является
                    Договор-заявка, в которой согласованы индивидуальные ставки, адреса, даты и
                    порядок расчетов.
                  </li>
                  <li>
                    Любые дополнительные условия перевозки, изменения адресов, времени подачи,
                    графиков и поручений, не нашедшие прямого отражения в тексте Договора-заявки,
                    обговариваются и фиксируются Сторонами в мессенджере «MAX» с авторизованных
                    телефонных номеров:
                    <div className="pl-3 mt-0.5 font-sans">
                      • Номер Перевозчика ({order.carrier_name}):{' '}
                      <strong>{order.carrier_phone || '+7 (982) 360-02-56'}</strong>
                      <br />• Номер Экспедитора (ИП Нигамедьянов А.С.):{' '}
                      <strong>+7 (922) 180-09-11</strong>
                    </div>
                  </li>
                  <li>
                    Все дополнительно обговорённые и письменно зафиксированные в мессенджере «MAX»
                    условия перевозки признаются обеими Сторонами юридически значимыми, имеют силу
                    простой электронной подписи и составляют неотъемлемую часть заключенного
                    договора.
                  </li>
                </ul>
              </div>

              <div>
                <strong>5. Защита коммерческих интересов:</strong> Перевозчику запрещается
                устанавливать прямые деловые контакты с клиентом (Заказчиком), озвучивать размер
                экспедиторского вознаграждения, вручать стороннюю рекламу либо заключать прямые
                контракты в течение 24 месяцев с даты перевозки. Штраф за нарушение —{' '}
                <strong>
                  {order.non_disclosure_penalty?.toLocaleString('ru-RU') || '200 000'} рублей
                </strong>
                .
              </div>

              <div>
                <strong>6. Разрешение разногласий:</strong> Досудебный претензионный порядок
                обязателен (срок ответа на претензию — 10 дней). При недостижении согласия спор
                рассматривается в Арбитражном суде Свердловской области.
              </div>
            </div>

            {/* Блок фиксации инцидентов */}
            <div className="border border-slate-900 p-2 bg-slate-50 text-[10.5px]">
              <strong>Юридическая фиксация инцидентов:</strong> Обо всех внештатных ситуациях,
              разногласиях или задержках Стороны обязаны незамедлительно направлять сообщения в
              мессенджер «MAX» по указанным официальным телефонным номерам. Фиксация в момент
              возникновения является основанием для урегулирования претензий.
            </div>

            {/* Подписи и реквизиты Сторон */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-400 text-[11px]">
              <div className="space-y-1">
                <div className="font-bold uppercase">ЭКСПЕДИТОР</div>
                <div className="font-bold">ИП Нигамедьянов Александр Сергеевич</div>
                <div className="text-[10px] text-slate-600">
                  ИНН: 660704814106 | ОГРНИП: 321665800053976
                </div>
                <div>Тел. (мессенджер «MAX»): +7 (922) 180-09-11</div>
                <div className="pt-6 flex items-end">
                  <div className="border-b border-slate-900 w-48 text-center text-[10px] text-slate-500">
                    / Нигамедьянов А.С. /
                  </div>
                  <div className="ml-2 text-[10px] text-slate-400">М.П.</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-bold uppercase">ПЕРЕВОЗЧИК</div>
                <div className="font-bold">{order.carrier_name}</div>
                <div className="text-[10px] text-slate-600">
                  ИНН: {order.carrier_inn} | ОГРНИП: {order.carrier_ogrnip}
                </div>
                <div>Тел. (мессенджер «MAX»): {order.carrier_phone || '+7 (982) 360-02-56'}</div>
                <div className="pt-6 flex items-end">
                  <div className="border-b border-slate-900 w-48 text-center text-[10px] text-slate-500">
                    / {order.carrier_driver_name || 'Салихов Р.М.'} /
                  </div>
                  <div className="ml-2 text-[10px] text-slate-400">М.П.</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
