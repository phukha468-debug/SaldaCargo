'use client';

import type { AtiOrder } from './types';

export function AtiClaimPrintModal({ order, onClose }: { order: AtiOrder; onClose: () => void }) {
  const freight = Number(order.price || 30000);
  const penalty = Number(
    order.claim_penalty_amount || order.claim_amount || Math.round(freight * 0.2),
  );
  const penaltyPct = Math.round(
    (Number(order.claim_penalty_amount || order.claim_amount || 6000) / freight) * 100,
  );
  const claimTotal = Number(order.claim_amount || 6000);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden my-auto print:max-h-none print:border-none print:shadow-none print:rounded-none">
        <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xl">📄</span>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide">
                Официальная Претензия Исх. № {order.claim_number || '01-ПР'}
              </h3>
              <p className="text-[10px] text-slate-400">
                Готовый к отправке и печати документ по ст. 35 УАТ РФ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
            >
              <span>🖨️</span>
              <span>Распечатать / Сохранить в PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer px-2"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-8 sm:p-12 overflow-y-auto flex-1 font-serif text-[13px] leading-relaxed text-slate-950 bg-white">
          <div className="grid grid-cols-2 gap-8 border-b-2 border-slate-950 pb-4 mb-4">
            <div className="space-y-1">
              <div className="font-bold text-[11px] uppercase tracking-wide text-slate-600 font-sans">
                КОМУ (ЗАКАЗЧИК):
              </div>
              <div className="font-black text-sm font-sans">
                {order.counterparty_name || 'ООО «ТРАНССЕРВИС»'}
              </div>
              <div className="text-[11px] leading-tight text-slate-700 font-sans space-y-0.5">
                <div>ИНН: {order.counterparty_inn || '6679091866'} / КПП: 667001001</div>
                <div>ОГРН: 1169658048560</div>
                <div>
                  Адрес: 620041, Свердловская обл., г. Екатеринбург, ул. Уральская, д. 1, кв. 31
                </div>
                <div>Почтовый адрес: 620000, г. Екатеринбург, пр-кт Ленина, стр. 39, а/я 494</div>
                <div>Тел.: {order.counterparty_phone || '(343) 286-73-65, +7-952-147-6114'}</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-bold text-[11px] uppercase tracking-wide text-slate-600 font-sans">
                ОТ КОГО (ПЕРЕВОЗЧИК):
              </div>
              <div className="font-black text-sm font-sans">
                ИП Нигамедьянов Александр Сергеевич
              </div>
              <div className="text-[11px] leading-tight text-slate-700 font-sans space-y-0.5">
                <div>ИНН: 660704814106</div>
                <div>ОГРНИП: 321665800053976</div>
                <div>
                  Адрес: 624760, Свердловская обл., г. Верхняя Салда, ул. 25 Октября, д. 11, кв. 22
                </div>
                <div>Тел.: +7 (922) 180-09-11 (Александр)</div>
                <div className="font-bold">АТИ: 923131</div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center my-4 font-sans text-xs">
            <div>
              <strong>Исх. № {order.claim_number || '01-ПР'}</strong>
            </div>
            <div>
              «<strong>{order.claim_date || '15'}</strong>» октября 2026 г., г. Екатеринбург
            </div>
          </div>

          <div className="text-center space-y-1 my-6 font-sans">
            <h1 className="text-base font-black uppercase tracking-wider">ПРЕТЕНЗИЯ № 1</h1>
            <p className="text-xs font-bold text-slate-800 max-w-xl mx-auto leading-normal">
              о возмещении штрафа и расходов в связи с непредставлением груза / отказом от
              использования транспортного средства
            </p>
          </div>

          <div className="space-y-3 text-justify text-xs leading-relaxed font-sans">
            <p>
              Между Перевозчиком (ИП Нигамедьянов А. С.) и Заказчиком ({order.counterparty_name})
              был заключен Договор-заявка {order.order_number} от 14.10.2026 г. на междугороднюю
              перевозку груза ({order.cargo_description || 'подоконники, 4 т, 5 поддонов'}) по
              маршруту: {order.pickup_address || 'г. Арамиль'} —{' '}
              {order.delivery_address || 'г. Уфа'}. Согласованная стоимость фрахта составляет{' '}
              <strong>
                {freight.toLocaleString('ru-RU')} (тридцать тысяч) рублей 00 копеек, без НДС
              </strong>
              .
            </p>

            <p>
              Во исполнение взятых на себя обязательств Перевозчиком под погрузку к назначенному
              сроку ({order.pickup_date_time || '15.10.2026 г. к 09:00'}) было предоставлено
              надлежащее транспортное средство:{' '}
              <strong>{order.asset_name || 'Валдай, г/н О 188 ТА 196'}</strong>, под управлением
              водителя {order.driver_name || 'Насртдинов В. А.'}. Автомобиль своевременно прибыл по
              указанному в заявке адресу погрузки грузоотправителя.
            </p>

            <p>
              Однако 15.10.2026 г. Заказчик уведомил об отказе от использования предоставленного
              автотранспорта (груз к отправке не предоставлен / срыв погрузки по вине Заказчика).
              Согласно п. 3 условий Договора-заявки {order.order_number}, а также в соответствии с
              ч. 1 ст. 35 Федерального закона от 08.11.2007 № 259-ФЗ «Устав автомобильного
              транспорта и городского наземного электрического транспорта», в случае
              непредоставления груза и отказа Клиента от использования ТС Перевозчик вправе
              потребовать от Клиента выплаты{' '}
              <strong>
                штрафа в размере 20% от стоимости согласованного фрахта, а также возмещения
                фактических расходов
              </strong>
              .
            </p>

            <table className="w-full border-collapse border-2 border-slate-900 my-3 text-xs">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-900 font-bold">
                  <th className="border border-slate-400 p-1.5 w-8 text-center">№</th>
                  <th className="border border-slate-400 p-1.5 text-left">
                    Наименование требования / Основание
                  </th>
                  <th className="border border-slate-400 p-1.5 w-36 text-center">Расчет суммы</th>
                  <th className="border border-slate-400 p-1.5 w-28 text-right">Сумма, руб.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-400 p-1.5 text-center">1</td>
                  <td className="border border-slate-400 p-1.5">
                    Штраф за непредоставление груза / отказ от использования ТС (п. 3
                    Договора-заявки {order.order_number}, ч. 1 ст. 35 УАТ РФ)
                  </td>
                  <td className="border border-slate-400 p-1.5 text-center">
                    {penaltyPct}% от {freight.toLocaleString('ru-RU')} руб.
                  </td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">
                    {penalty.toLocaleString('ru-RU')},00
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 p-1.5 text-center">2</td>
                  <td className="border border-slate-400 p-1.5">
                    Компенсация расходов на холостой пробег и подачу ТС к месту погрузки (г.
                    Арамиль)
                  </td>
                  <td className="border border-slate-400 p-1.5 text-center">
                    По фактическим затратам
                  </td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">
                    {Number(order.claim_empty_run_amount || 0).toLocaleString('ru-RU')},00
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 p-1.5 text-center">3</td>
                  <td className="border border-slate-400 p-1.5">
                    Простой автотранспорта в ожидании погрузки / отмены рейса
                  </td>
                  <td className="border border-slate-400 p-1.5 text-center">
                    По подтверждающим док.
                  </td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">
                    {Number(order.claim_idle_amount || 0).toLocaleString('ru-RU')},00
                  </td>
                </tr>
                <tr className="bg-slate-100 font-black border-t-2 border-slate-900">
                  <td colSpan={3} className="border border-slate-400 p-1.5 text-right uppercase">
                    ИТОГО К ОПЛАТЕ:
                  </td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono text-sm">
                    {claimTotal.toLocaleString('ru-RU')},00
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="font-bold">
              Общая сумма требований составляет: {claimTotal.toLocaleString('ru-RU')} рублей 00
              копеек.
              {order.claim_notes && (
                <span className="block font-normal text-slate-600 text-[11px] mt-0.5">
                  Условия согласования: {order.claim_notes}
                </span>
              )}
            </p>

            <div className="border border-slate-300 p-2.5 rounded-lg bg-slate-50 space-y-1 font-sans text-[11px] my-3">
              <div className="font-black text-slate-800">
                Реквизиты для перечисления денежных средств:
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                <div>Получатель: ИП Нигамедьянов Александр Сергеевич</div>
                <div>Расчетный счет: 40802810500001961654</div>
                <div>Банк получателя: АО «ТБанк»</div>
                <div>Корр. счет: 30101810145250000974</div>
                <div>БИК банка: 044525974</div>
                <div>ИНН получателя / банка: 660704814106 / 7710140679</div>
              </div>
            </div>

            <p>
              На основании изложенного, руководствуясь условиями Договора-заявки{' '}
              {order.order_number}, нормами ст. 309, 310, 784, 794 ГК РФ и ст. 35, 39 ФЗ «УАТ и
              ГНЭТ» № 259-ФЗ, просим перечислить указанную сумму в течение{' '}
              <strong>{order.claim_due_days || 5} (пяти) банковских дней</strong> с момента
              получения настоящей претензии. В случае неудовлетворения законных требований в
              установленный срок мы будем вынуждены обратиться в Арбитражный суд Свердловской
              области с отнесением на Ваш счет расходов на оплату госпошлины, услуг представителя и
              процентов по ст. 395 ГК РФ.
            </p>

            <div className="pt-2 text-[11px] text-slate-700">
              <div className="font-bold">Приложения:</div>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Копия Договора-заявки {order.order_number} с отметками сторон;</li>
                <li>
                  Копия путевого листа / подтверждение прибытия автомобиля{' '}
                  {order.asset_name || 'Валдай О 188 ТА 196'} на погрузку в г. Арамиль;
                </li>
                <li>Письменное / электронное подтверждение Заказчика об отказе от перевозки;</li>
                <li>Расчет и подтверждающие документы понесенных расходов.</li>
              </ol>
            </div>

            <div className="pt-6 flex justify-between items-end font-sans">
              <div>
                <div className="font-bold">Индивидуальный предприниматель</div>
                <div className="font-black text-sm">ИП Нигамедьянов А. С.</div>
              </div>
              <div className="text-right">
                <div className="inline-block border-b border-slate-900 w-44 pb-1 text-center italic text-slate-500 text-[11px]">
                  / Нигамедьянов А. С. /
                </div>
                <div className="text-[10px] text-slate-500 font-bold mt-1">М.П.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
