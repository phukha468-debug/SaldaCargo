import { NextResponse } from 'next/server';

/** GET /api/driver/repair-requests — заявки водителя отключены */
export async function GET() {
  return NextResponse.json([]);
}

/** POST /api/driver/repair-requests — отключено */
export async function POST() {
  return NextResponse.json({ error: 'Заявки водителей на ремонт отключены' }, { status: 410 });
}
