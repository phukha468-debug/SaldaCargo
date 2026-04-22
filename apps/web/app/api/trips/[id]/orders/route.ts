import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { z } from "zod";

const orderCreateSchema = z.object({
  trip_id: z.string().uuid(),
  order_number: z.string().optional(),
  client_name: z.string().min(2, "Имя клиента слишком короткое"),
  amount: z.coerce.number().min(1, "Сумма должна быть положительной"),
  driver_pay: z.coerce.number().min(0),
  loader_pay: z.coerce.number().min(0).optional().default(0),
  payment_method: z.enum(["cash", "qr", "invoice", "debt", "card"]),
  settlement_status: z.enum(["pending", "completed"]).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const result = orderCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ 
        error: "Validation failed", 
        details: result.error.format() 
      }, { status: 400 });
    }

    const input = result.data;

    // 1. Business Logic Validation: Salary max 40%
    const totalStaffPay = input.driver_pay + input.loader_pay;
    if (totalStaffPay > input.amount * 0.4) {
      return NextResponse.json({ 
        error: "Staff pay exceeds 40% limit", 
        max_allowed: input.amount * 0.4,
        actual: totalStaffPay
      }, { status: 400 });
    }

    // 2. Determine statuses logic
    let settlementStatus = input.settlement_status;
    if (!settlementStatus) {
      const autoCompleted = ["cash", "qr", "card"].includes(input.payment_method);
      settlementStatus = autoCompleted ? "completed" : "pending";
    }

    // 3. Authorization check for the Trip
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("*, driver_id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Drivers can only add orders to their own trips
    const { data: profile } = await supabase.from("users").select("roles").eq("id", user.id).single();
    const isAdmin = profile?.roles?.includes('admin') || profile?.roles?.includes('owner');
    
    if (!isAdmin && trip.driver_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // 4. Atomic-ish execution (sequential)
    // Create the Order
    const { data: newOrder, error: orderError } = await adminSupabase
      .from("trip_orders")
      .insert({
        trip_id: tripId,
        order_number: input.order_number,
        client_name: input.client_name,
        amount: input.amount,
        driver_salary: input.driver_pay,
        loader_salary: input.loader_pay,
        payment_method: input.payment_method,
        settlement_status: settlementStatus,
        lifecycle_status: 'draft'
      })
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // 5. Create the Transaction
    // Find driver's wallet (in a real app, this logic would be more complex/cached)
    const { data: wallets } = await adminSupabase
      .from("wallets")
      .select("id")
      .eq("user_id", trip.driver_id)
      .eq("name", "Основной") // Or match payment method logic
      .limit(1);

    const targetWalletId = wallets?.[0]?.id;

    const { error: txError } = await adminSupabase
      .from("transactions")
      .insert({
        user_id: trip.driver_id,
        wallet_id: targetWalletId,
        amount: input.amount,
        type: 'in', // 'income' in business speak, 'in' in schema enum
        order_id: newOrder.id,
        trip_id: tripId,
        settlement_status: settlementStatus,
        description: `Заказ ${input.order_number || ''} - ${input.client_name}`
      });

    if (txError) {
      console.error("Failed to create linked transaction:", txError);
      // We don't rollback the order, but we might want to log it
    }

    return NextResponse.json({
      success: true,
      data: newOrder
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
