import { NextResponse } from 'next/server';

/**
 * POST /api/driver/counterparties/new — создание контрагентов водителями отключено.
 * Водители используют «Частный клиент», а постоянных клиентов и юрлиц заводит диспетчер/администратор.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'forbidden',
      message:
        'Создание новых клиентов водителями отключено. Для разовых заказов выберите «Частный клиент» (с примечанием), либо обратитесь к администратору.',
    },
    { status: 403 },
  );
}
