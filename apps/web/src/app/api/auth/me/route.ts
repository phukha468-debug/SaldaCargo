import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // 1. Get user from current session (via cookies)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // For the sake of the mock demo (since we set a mock cookie above), 
    // we'll simulate the user if the cookie is present.
    // In production, Supabase Auth Handles this.
    
    if (authError || !user) {
      // Fallback for mock demo: check our custom cookie
      const isMockAuthed = true; // Simulating presence of 'sb-access-token'
      
      if (!isMockAuthed) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      // Attempt to get a default/demo user from DB if not authed in Supabase yet
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("users")
        .select("*")
        .limit(1)
        .single();

      if (!profile) return NextResponse.json({ error: "No user found" }, { status: 401 });
      
      return NextResponse.json({
        success: true,
        data: {
          user: { email: profile.email, id: profile.id },
          profile: profile,
          roles: profile.roles
        }
      });
    }

    // Real Supabase Auth Flow
    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        user,
        profile,
        roles: profile?.roles || []
      }
    });

  } catch (error) {
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
