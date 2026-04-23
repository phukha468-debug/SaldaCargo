import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
        driver:users!trips_driver_id_fkey(id, full_name),
        vehicle:assets(id, plate_number, notes),
        orders:trip_orders(amount),
        expenses:trip_expenses(amount)
      `)
      .gte("started_at", start)
      .lte("started_at", end);

    if (error) {
      console.error("[api/trips/summary] Database error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const summary = (trips || []).map(trip => {
      const orders = Array.isArray(trip.orders) ? trip.orders : [];
      const expenses = Array.isArray(trip.expenses) ? trip.expenses : [];
      
      const revenue = orders.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
      const expenses_total = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      
      return {
        ...trip,
        revenue,
        expenses_total,
        order_count: orders.length,
        staff_pay: 0
      };
    });

    return NextResponse.json({ success: true, data: summary });

  } catch (error) {
    console.error("[api/trips/summary] Catch-all error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
