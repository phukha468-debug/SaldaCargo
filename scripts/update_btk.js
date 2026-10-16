const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  // 1. Обновляем контрагента ООО «Байт-Транзит-Континент»
  const cpUpdate = {
    name: 'ООО «Байт-Транзит-Континент»',
    inn: '5407124986',
    kpp: '540601001',
    ogrn: '1025403196180',
    legal_address: '630099, Новосибирская область, г. Новосибирск, ул. Фрунзе, д. 18/1, офис 18',
    actual_address:
      '630001, Новосибирская область, г. Новосибирск, ул. Владимировская, д. 26/1, офис 309',
    phone: '+79095309791',
    email: 'btk@sibtrans.ru',
    contact_person: 'Керимова Юлия Викторовна (+7 909 530-97-91)',
    bank_name: 'ФИЛИАЛ «ЦЕНТРАЛЬНЫЙ» БАНКА ВТБ (ПАО)',
    bik: '044525411',
    bank_account: '40702810712519008272',
    corr_account: '30101810145250000411',
    client_role: 'forwarder',
    is_legal_entity: true,
    is_active: true,
    notes:
      'Оригиналы документов отправлять: 620134, г. Екатеринбург, ул. Ангарская 77, офис 208, Байт Транзит Континент. К оригиналам прикрепить доверенность от ИП на водителя. Гендиректор: Шпикельман А.А., подписант: Горбунов К.Н. (дов. № 1 от 01.01.2026)',
    updated_at: new Date().toISOString(),
  };

  const { data: updatedCp, error: cpErr } = await supabase
    .from('counterparties')
    .update(cpUpdate)
    .eq('id', '4b621f23-ad97-4853-b2d6-53c7339c69b4')
    .select();

  if (cpErr) {
    console.error('Error updating counterparty:', cpErr);
    process.exit(1);
  }
  console.log(
    'Counterparty updated successfully:',
    updatedCp?.[0]?.name,
    'INN:',
    updatedCp?.[0]?.inn,
  );

  // 2. Обновляем заявку № 1 от 15.10.2026 в audit_log
  const { data: orderRow, error: orderFetchErr } = await supabase
    .from('audit_log')
    .select('*')
    .eq('id', 'd8477ef3-0e3e-454c-b5e8-b37ed58192bd')
    .single();

  if (orderFetchErr) {
    console.error('Error fetching order:', orderFetchErr);
    process.exit(1);
  }

  const oldVals = orderRow.new_values || {};
  const updatedOrder = {
    ...oldVals,
    order_number: '№ 1 от 15.10.2026',
    order_date: '2026-10-15',
    stage: 6, // 6. Документооборот (ЭДО / Почта)
    doc_type: 'paper',
    counterparty_id: '4b621f23-ad97-4853-b2d6-53c7339c69b4',
    counterparty_name: 'ООО «Байт-Транзит-Континент»',
    counterparty_inn: '5407124986',
    counterparty_contact: 'Керимова Юлия Викторовна (+7 909 530-97-91)',
    counterparty_phone: '+7 909 530-97-91',
    counterparty_email: 'btk@sibtrans.ru',
    carrier_name: 'ИП Нигамедьянов Александр Сергеевич',
    carrier_inn: '660704814106',
    carrier_contact: '7 922 180-09-11 Александр',
    carrier_account: '40802810500001961654',
    carrier_bank: 'АО «ТБанк»',
    carrier_bik: '044525974',
    asset_name: 'Валдай О188ТА 196 (тент)',
    asset_reg_number: 'О 188 ТА 196',
    driver_name: 'Насртдинов Вячеслав Аксанович',
    driver_phone: '+7 995 661-05-85',
    driver_passport: 'серия 6521 № 342609, выдан 27.07.2021 ГУ МВД России по Свердловской области',
    driver_license: '99 31 051064',
    shipper_name: 'ООО «БТК» (г. Екатеринбург)',
    pickup_address: '620050, Свердловская обл., г. Екатеринбург, ул. Ангарская, д. 77, Склад 10',
    pickup_date_time: '15.10.2026 14:30 (Задняя погрузка)',
    pickup_contact: '8-909-530-97-91 Юлия',
    cargo_description: 'Сборный груз, 1 коробка, 5 000 кг, 40 м3 (наличие ремней 8-10 штук)',
    consignee_name: 'ООО «БТК» (г. Уфа)',
    delivery_address: '450019, Республика Башкортостан, г. Уфа, ул. Кирзаводская, д. 1/1',
    delivery_date: '16.10.2026 09:00 (Задняя выгрузка)',
    delivery_contact: '+7 964 957-42-00, +7 987 475-39-09 Антон, Евгений',
    price: 18000,
    payment_terms:
      '10 банковских дней по оригиналу ТТН, счёта, акта, доверенности на водителя и заявки',
    postal_address:
      '620134, Свердловская обл., г. Екатеринбург, ул. Ангарская, д. 77, офис 208, Байт Транзит Континент',
    notes:
      'ТРЕБОВАНИЯ К ОПЛАТЕ: Отправить оригиналы документов по адресу: 620134, г. Екатеринбург, ул. Ангарская 77, офис 208, Байт Транзит Континент. К оригиналам обязательно прикрепить доверенность от ИП на водителя! Срок оплаты: 10 банковских дней после получения оригиналов.',
    updated_at: new Date().toISOString(),
  };

  const { data: updatedOrderRow, error: updateOrderErr } = await supabase
    .from('audit_log')
    .update({
      new_values: updatedOrder,
      changed_at: new Date().toISOString(),
    })
    .eq('id', 'd8477ef3-0e3e-454c-b5e8-b37ed58192bd')
    .select();

  if (updateOrderErr) {
    console.error('Error updating order:', updateOrderErr);
    process.exit(1);
  }

  console.log('ATI Order updated successfully:', updatedOrderRow?.[0]?.new_values?.order_number);
}

main().catch(console.error);
