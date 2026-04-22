import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { startOfDay, endOfDay } from "date-fns";

export async function GET() {
  try {
    const supabase = createAdminClient();
    
    const today = new Date();
    const start = startOfDay(today).toISOString();
    const end = endOfDay(today).toISOString();

    const { data: trips, error } = await supabase
      .from("trips")
      .select(`
        *,
        driver:users(id, display_name),
        vehicle:assets(id, plate, model),
        orders:trip_orders(amount),
        expenses:trip_expenses(amount)
      `)
      .gte("start_time", start)
      .lte("start_time", end);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const summary = (trips || []).map(trip => {
      const revenue = (trip.orders || []).reduce((s: number, o: any) => s + Number(o.amount), 0);
      const expenses = (trip.expenses || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
      return {
        ...trip,
        revenue,
        expenses_total: expenses,
        order_count: trip.orders?.length || 0,
        staff_pay: Number(trip.driver_salary) + Number(trip.loader_salary)
      };
    });

    return NextResponse.json({ success: true, data: summary });

  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
