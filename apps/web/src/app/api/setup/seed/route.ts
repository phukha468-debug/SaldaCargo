import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { Database } from '@saldacargo/shared-types'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { legal, assets, initialBalances } = body

    const supabase = createAdminClient()

    // 1. Юрлицо (используем существующее или создаем новое)
    const { data: existingLegals } = await supabase
      .from('legal_entities')
      .select('*')
      .limit(1)

    let legalEntity = existingLegals?.[0]

    if (!legalEntity) {
      const { data, error: legalError } = await supabase
        .from('legal_entities')
        .insert({
          name: legal.name,
          type: legal.type,
          inn: legal.inn || null,
          tax_regime: legal.tax_regime,
          is_active: true,
        } as Database['public']['Tables']['legal_entities']['Insert'])
        .select()
        .single()

      if (legalError) throw new Error(`Юрлицо: ${legalError.message}`)
      legalEntity = data
    }

    // 2. Системные кошельки (ext_clients, ext_suppliers уже созданы в seed)
    // Обновляем legal_entity_id для ip_rs и cash_office
    await supabase
      .from('wallets')
      .update({ legal_entity_id: legalEntity.id } as Database['public']['Tables']['wallets']['Update'])
      .in('code', ['ip_rs', 'cash_office', 'opti24_cards'])

    // 3. Персонал (users) — без auth, только записи
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .insert(
        body.users.map((u: { full_name: string; role: string; phone?: string }) => ({
          full_name: u.full_name,
          role: u.role,
          phone: u.phone || null,
          is_active: true,
        })) as Database['public']['Tables']['users']['Insert'][]
      )
      .select()

    if (usersError) throw new Error(`Персонал: ${usersError.message}`)

    // 4. Активы (машины)
    const assetTypesRes = await supabase
      .from('asset_types')
      .select('id, code')

    const assetTypes = assetTypesRes.data || []

    const businessUnitsRes = await supabase
      .from('business_units')
      .select('id, code')

    const businessUnits = businessUnitsRes.data || []

    const assetsToInsert = assets
      .filter((a: { skip?: boolean }) => !a.skip)
      .map((a: {
        plate_number: string
        asset_type_code: string
        business_unit_code: string
        status: string
        year?: number
        odometer_current?: number
        residual_value: number
        remaining_life_months: number
        notes?: string
      }) => {
        const assetType = assetTypes.find(t => t.code === a.asset_type_code)
        const businessUnit = businessUnits.find(b => b.code === a.business_unit_code)
        return {
          plate_number: a.plate_number,
          asset_type_id: assetType?.id || '',
          business_unit_id: businessUnit?.id || '',
          legal_entity_id: legalEntity.id,
          status: a.status,
          year: a.year || null,
          odometer_current: a.odometer_current || 0,
          residual_value: a.residual_value,
          remaining_life_months: a.remaining_life_months,
          current_book_value: a.residual_value,
          notes: a.notes || null,
        }
      })

    // Проверяем существующие активы, чтобы не было конфликтов по plate_number
    const { data: existingAssets } = await supabase
      .from('assets')
      .select('plate_number')

    const existingPlates = new Set((existingAssets || []).map((a) => a.plate_number))
    const uniqueAssetsToInsert = assetsToInsert.filter((a: any) => !existingPlates.has(a.plate_number))

    if (uniqueAssetsToInsert.length > 0) {
      const { error: assetsError } = await supabase
        .from('assets')
        .insert(uniqueAssetsToInsert as Database['public']['Tables']['assets']['Insert'][])

      if (assetsError) throw new Error(`Активы: ${assetsError.message}`)
    }

    // 5. Начальные остатки (transactions типа initial_balance)
    if (initialBalances && initialBalances.length > 0) {
      const walletsRes = await supabase
        .from('wallets')
        .select('id, code')

      const wallets = walletsRes.data || []
      const extSupplier = wallets.find(w => w.code === 'ext_suppliers')

      const balanceTxs = initialBalances
        .filter((b: { amount: number }) => b.amount > 0)
        .map((b: { wallet_code: string; amount: number }) => {
          const wallet = wallets.find(w => w.code === b.wallet_code)
          return {
            direction: 'income',
            amount: b.amount,
            from_wallet_id: extSupplier?.id || null,
            to_wallet_id: wallet?.id || null,
            transaction_type: 'initial_balance',
            lifecycle_status: 'approved',
            settlement_status: 'completed',
            description: 'Начальный остаток',
            actual_date: new Date().toISOString().split('T')[0],
          }
        })
        .filter((tx: { to_wallet_id: string | null }) => tx.to_wallet_id)

      if (balanceTxs.length > 0) {
        const { error: txError } = await supabase
          .from('transactions')
          .insert(balanceTxs as Database['public']['Tables']['transactions']['Insert'][])

        if (txError) throw new Error(`Остатки: ${txError.message}`)
      }
    }

    return NextResponse.json({ success: true, message: 'Система настроена успешно' })
  } catch (error) {
    console.error('[setup/seed] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Неизвестная ошибка' },
      { status: 500 }
    )
  }
}
