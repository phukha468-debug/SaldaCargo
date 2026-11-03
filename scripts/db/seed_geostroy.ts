import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  console.log('--- Updating ООО "Геостройиндустрия" ---');
  const { data: cp, error: cpErr } = await supabase
    .from('counterparties')
    .update({
      name: 'ООО "Геостройиндустрия"',
      inn: '6623101234',
      kpp: '662301001',
      ogrn: '1146623005678',
      legal_address: '624760, Свердловская область, г. Верхняя Салда, ул. Ленина, д 10',
      actual_address: '624760, Свердловская область, г. Верхняя Салда, ул. Ленина, д 10',
      structured_address: {
        index: '624760',
        region_code: '66',
        city: 'Верхняя Салда',
        street: 'ул. Ленина',
        house: 'д 10',
      },
      contact_person: 'Вера',
      contact_person_fio: 'Вера Александровна',
      contact_phone: '+79514330711',
      default_contract_name: 'Договор перевозки',
      default_contract_number: 'ГСИ-2026/01',
      default_contract_date: '2026-01-15',
    })
    .eq('id', '83db41b2-c050-4013-a878-bda2ab5c226e')
    .select();

  if (cpErr) {
    console.error('Error updating CP:', cpErr);
    return;
  }
  console.log('Counterparty updated:', cp);

  // Добавляем точку погрузки ООО "Геостройиндустрия"
  const { data: existingLp } = await supabase
    .from('loading_points_directory')
    .select('*')
    .ilike('name', '%Геострой%');

  let lpId: string | null = null;
  if (!existingLp || existingLp.length === 0) {
    const { data: newLp } = await supabase
      .from('loading_points_directory')
      .insert({
        name: 'ООО "Геостройиндустрия"',
        inn: '6623101234',
        kpp: '662301001',
        structured_address: {
          index: '624760',
          region_code: '66',
          city: 'Верхняя Салда',
          street: 'ул. Ленина',
          house: 'д 10',
        },
        contact_phone: '+79514330711',
        contact_fio: 'Вера Александровна',
        contact_position: 'Диспетчер',
      })
      .select()
      .single();
    lpId = newLp?.id || null;
  } else {
    lpId = existingLp[0].id;
  }

  // Добавляем пресет
  const { data: existingPreset } = await supabase
    .from('order_presets')
    .select('*')
    .ilike('title', '%Геострой%');

  if (!existingPreset || existingPreset.length === 0) {
    const { data: newPreset } = await supabase
      .from('order_presets')
      .insert({
        title: 'ООО "Геостройиндустрия" (Прямой заказчик)',
        client_counterparty_id: '83db41b2-c050-4013-a878-bda2ab5c226e',
        forwarder_counterparty_id: null,
        default_loading_point_id: lpId,
        carrier_settings: {
          name: 'ИП Нигамедьянов Александр Сергеевич',
          inn: '660704814106',
          ogrnip: '321665800053976',
          phone: '+79222970911',
        },
        emchd_signer: {
          position: 'Индивидуальный предприниматель',
          fio: {
            lastName: 'Нигамедьянов',
            firstName: 'Александр',
            middleName: 'Сергеевич',
          },
        },
      })
      .select();
    console.log('Created Preset for Geostroy:', newPreset);
  } else {
    console.log('Preset already exists:', existingPreset);
  }
}

main().catch(console.error);
