import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trip_id } = await params
    const body = await request.json()
    const { category_code, amount, payment_method, description } = body

    if (!amount || !category_code) {
      return NextResponse.json(
        { error: 'Сумма и категория обязательны' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('code', category_code)
      .single()

    if (!category) {
      return NextResponse.json({ error: 'Категория не найдена' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('trip_expenses')
      .insert({
        trip_id,
        category_id: category.id,
        amount: Number(amount),
        payment_method: payment_method || 'cash',
        description: description || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('[trips/expenses] Error:', error)
    return NextResponse.json({ error: 'Ошибка добавления расхода' }, { status: 500 })
  }
}
