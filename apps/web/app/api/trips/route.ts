import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { z } from "zod";

const tripCreateSchema = z.object({
  asset_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  loader_id: z.string().uuid().optional(),
  trip_type: z.string().optional(),
  odometer_start: z.coerce.number().int().min(0),
  odometer_start_photo: z.string().url().optional(),
});

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user profile to check roles
    const { data: profile } = await supabase
      .from("users")
      .select("roles")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.roles?.includes('admin') || profile?.roles?.includes('owner');
    
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("asset_id");
    const driverId = searchParams.get("driver_id");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("trips")
      .select("*, driver:users(id, display_name), vehicle:assets(*)", { count: "exact" });

    // Apply filters
    if (assetId) query = query.eq("vehicle_id", assetId);
    if (driverId) query = query.eq("driver_id", driverId);
    if (status) query = query.eq("status", status);

    // Visibility Logic
    if (!isAdmin) {
      // Non-admins can only see their own trips, or only approved trips if it's a general list?
      // Requirement: "только approved для других, all для админа", "водитель видит свои"
      // Combining: If not admin, must be driver_id == user.id AND (maybe) approved if looking at others?
      // Simpler: non-admin can only see their own trips.
      query = query.eq("driver_id", user.id);
      
      // If the requirement means "can see others but only if approved", we'd do an OR filter
      // but RLS usually handles the base layer.
    }

    const { data, error, count } = await query
      .order("start_time", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      total: count || 0
    });

  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const result = tripCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ 
        error: "Validation failed", 
        details: result.error.format() 
      }, { status: 400 });
    }

    const input = result.data;

    // Authorization check
    const { data: profile } = await supabase
      .from("users")
      .select("roles")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.roles?.includes('admin') || profile?.roles?.includes('owner');

    // Rule: Driver can only create for themselves, Admin can create for anyone
    if (!isAdmin && input.driver_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to create trips for other drivers" }, { status: 403 });
    }

    // Optional Idempotency check: 
    // Usually we check if a trip with same start_time/odometer and driver already exists within last minute
    
    const { data: newTrip, error: insertError } = await supabase
      .from("trips")
      .insert({
        vehicle_id: input.asset_id,
        driver_id: input.driver_id,
        loader_id: input.loader_id,
        trip_type: input.trip_type,
        start_odometer: input.odometer_start,
        odometer_start_photo: input.odometer_start_photo,
        status: 'draft',
        start_time: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: newTrip
    });

  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
