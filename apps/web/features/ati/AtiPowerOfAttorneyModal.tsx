'use client';

import type { AtiOrder } from './types';

export function AtiPowerOfAttorneyModal({
  order,
  onClose,
}: {
  order: AtiOrder;
  onClose: () => void;
}) {
  const shortDriverSignature = order.driver_name
    ? `${order.driver_name.split(' ')[0]} ${order.driver_name.split(' ')[1]?.[0] || ''}.${order.driver_name.split(' ')[2]?.[0] || ''}.`
    : 'Насртдинов В. А.';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden my-auto print:max-h-none print:border-none print:shadow-none print:rounded-none">
        <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xl">📄</span>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide">
                Доверенность от ИП на водителя
              </h3>
              <p className="text-[10px] text-slate-400">
                Для сдачи оригиналов документов в {order.counterparty_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/Doverennost_Voditel_Bayt_Tranzit.docx"
              download
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
            >
              <span>📥</span>
              <span>Скачать Word (.docx)</span>
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
            >
              <span>🖨️</span>
              <span>Распечатать / PDF</span>
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
          <div className="border-b-2 border-slate-950 pb-3 mb-4 font-sans text-xs space-y-0.5 text-slate-800">
            <div className="font-black text-sm text-slate-950">
              {order.carrier_name ||
                'Индивидуальный предприниматель Нигамедьянов Александр Сергеевич'}
            </div>
            <div>
              <strong>Юридический адрес:</strong> 624760, Россия, Свердловская обл., г. Верхняя
              Салда, ул. 25 Октября, д. 11, кв. 22
            </div>
            <div>
              <strong>ИНН:</strong> {order.carrier_inn || '660704814106'} &nbsp;|&nbsp;{' '}
              <strong>ОГРНИП:</strong> 321665800053976
            </div>
            <div>
              <strong>Банк:</strong> {order.carrier_bank || 'АО «ТБанк» г. Москва'} &nbsp;|&nbsp;{' '}
              <strong>БИК:</strong> {order.carrier_bik || '044525974'}
            </div>
            <div>
              <strong>Р/С:</strong> {order.carrier_account || '40802810500001961654'} &nbsp;|&nbsp;{' '}
              <strong>К/С:</strong> 30101810145250000974
            </div>
            <div>
              <strong>Контакты:</strong> {order.carrier_contact || '7 922 180-09-11 Александр'}{' '}
              &nbsp;|&nbsp; uralavto707@mail.ru
            </div>
          </div>

          <div className="text-center my-6">
            <h1 className="text-xl font-bold tracking-widest uppercase">ДОВЕРЕННОСТЬ</h1>
          </div>

          <div className="flex justify-between items-center mb-6 text-sm font-sans">
            <div>г. Верхняя Салда / г. Екатеринбург</div>
            <div className="font-bold">«15» октября 2026 г.</div>
          </div>

          <div className="text-justify indent-8 space-y-3 mb-6 text-sm leading-relaxed">
            <p>
              Индивидуальный предприниматель <strong>Нигамедьянов Александр Сергеевич</strong>{' '}
              (ОГРНИП 321665800053976, ИНН 660704814106), настоящей доверенностью уполномочивает
              гражданина РФ{' '}
              <strong>{order.driver_name || 'Насртдинова Вячеслава Аксановича'}</strong>,{' '}
              {order.driver_passport ||
                'паспорт серия 6521 номер 342609, выдан 27.07.2021 г. ГУ МВД России по Свердловской области'}
              , водительское удостоверение <strong>{order.driver_license || '99 31 051064'}</strong>
              , управляющего грузовым автомобилем{' '}
              <strong>
                {order.asset_name || 'Валдай'} ({order.asset_reg_number || 'О 188 ТА 196'})
              </strong>
              , производить в{' '}
              <strong>
                {order.counterparty_name || 'ООО «Байт Транзит Континент» (ООО «БТК»)'}
              </strong>{' '}
              следующие операции:
            </p>

            <ol className="list-decimal pl-8 space-y-2 mt-3 font-normal">
              <li>Сдавать и получать грузы для транспортировки;</li>
              <li>
                Подписывать заявки на транспортировку груза, транспортные накладные (ТрН / ТТН),
                акты выполненных работ (оказанных услуг), акты сдачи-приемки, экспедиторские
                расписки, а также совершать все иные фактические и юридические действия и
                формальности, связанные с выполнением настоящего поручения.
              </li>
            </ol>

            <p className="pt-2">
              Настоящая доверенность выдана сроком с <strong>15.10.2026 г.</strong> и действительна
              по <strong>31.12.2026 г.</strong> включительно без права передоверия.
            </p>
          </div>

          <div className="my-6 text-sm">
            Образец подписи доверенного лица:{' '}
            <span className="inline-block border-b border-slate-900 w-44 pb-0.5"></span> /{' '}
            <strong>{shortDriverSignature}</strong> / подтверждаю.
          </div>

          <div className="mt-8 pt-4 flex justify-between items-end font-sans">
            <div>
              <div className="font-bold text-xs uppercase text-slate-600">Доверитель:</div>
              <div className="font-bold text-sm">Индивидуальный предприниматель</div>
              <div className="font-black text-base">ИП Нигамедьянов А. С.</div>
              <div className="font-bold text-xs mt-3 text-slate-500">М. П.</div>
            </div>
            <div className="text-right">
              <div className="inline-block border-b border-slate-900 w-48 pb-1 text-center italic text-slate-500 text-xs">
                / Нигамедьянов А. С. /
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
