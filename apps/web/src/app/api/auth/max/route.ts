import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { z } from "zod";
import { cookies } from "next/headers";

const maxAuthSchema = z.object({
  code: z.string(),
  profile: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
  }).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = maxAuthSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    const { email, id, name } = result.data.profile || { 
      email: "mock@user.com", 
      id: "mock-id", 
      name: "Mock User" 
    };

    const supabase = createAdminClient();

    // 1. Check if user exists in our 'users' table
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    let userData = existingUser;

    // 2. If user doesn't exist, create it (or update if exists)
    // Note: In real flow, we'd use Supabase Auth's admin API to create a real auth user first
    // For this simulation, we'll assume the user ID matches or we upsert into our custom table
    const { data: updatedUser, error: upsertError } = await supabase
      .from("users")
      .upsert({
        id: existingUser?.id || id, // Ideally this comes from auth.users
        email,
        display_name: name,
        roles: existingUser?.roles || ['driver'],
      })
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json({ error: "Failed to sync user profile" }, { status: 500 });
    }

    userData = updatedUser;

    // 3. Set a mock JWT cookie for session simulation
    // In a real Supabase Auth setup, this is handled by Supabase session cookies
    const cookieStore = await cookies();
    cookieStore.set("sb-access-token", "mock-jwt-token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    return NextResponse.json({
      success: true,
      data: {
        user: userData,
        token: "mock-jwt-token"
      }
    });

  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
