import { createAdminClient } from '@/lib/supabase/admin'
import { ASSETS_PRESET } from '@/lib/setup-data'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = createAdminClient()

    // 1. Проверяем, есть ли уже активы
    const { count } = await supabase.from('assets').select('*', { count: 'exact', head: true })
    
    if (count && count > 0) {
      return NextResponse.json({ message: 'Fleet already has data', count })
    }

    // 2. Получаем необходимые ID для связей
    const { data: assetTypes } = await supabase.from('asset_types').select('id, code')
    const { data: businessUnits } = await supabase.from('business_units').select('id, code')
    const { data: legalEntities } = await supabase.from('legal_entities').select('id').limit(1).single()

    if (!legalEntities) {
      throw new Error('No legal entity found. Run setup first.')
    }

    // 3. Подготавливаем данные для вставки
    const assetsToInsert = ASSETS_PRESET.map(preset => {
      const type = assetTypes?.find(t => t.code === (preset.asset_type_code || 'GAZELLE_3M'))
      const bu = businessUnits?.find(b => b.code === preset.business_unit_code)
      
      return {
        plate_number: preset.plate_number,
        model: preset.asset_type_code?.includes('VALDAI') ? 'Валдай' : (preset.asset_type_code?.includes('CANTER') ? 'Mitsubishi Canter' : 'Газель'),
        asset_type_id: type?.id,
        business_unit_id: bu?.id,
        legal_entity_id: legalEntities.id,
        status: preset.status || 'active',
        year: preset.year || 2015 + Math.floor(Math.random() * 8),
        odometer_current: 100000 + Math.floor(Math.random() * 200000),
        residual_value: preset.asset_type_code?.includes('VALDAI') ? 2500000 : 1200000,
        remaining_life_months: 60,
        notes: preset.notes
      }
    })

    // 4. Вставляем данные
    const { data, error } = await supabase.from('assets').insert(assetsToInsert).select()

    if (error) throw error

    return NextResponse.json({ message: 'Seed successful', count: data.length })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: (error as any).message }, { status: 500 })
  }
}
