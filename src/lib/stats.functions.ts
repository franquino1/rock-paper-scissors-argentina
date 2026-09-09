import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PrivateStats {
  losses: number;
  bot_wins: number;
}

/** Derrotas y victorias contra la app: solo visibles para el propio usuario. */
export const getMyPrivateStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PrivateStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("losses, bot_wins")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return { losses: data?.losses ?? 0, bot_wins: data?.bot_wins ?? 0 };
  });
