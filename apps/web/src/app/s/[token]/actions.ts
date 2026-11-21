"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SHARE_TOKEN } from "@/lib/share-token";

// Redeem a share link for the CURRENT session (ADR 0005). The anonymous sign-in happens in the
// browser beforehand (open-button.tsx), so Supabase's per-IP anonymous limit counts each visitor's
// own IP. This action never creates users, so it can't be used to burn that limit or create junk users.
export async function redeemSharedMix(token: string): Promise<{ error: string } | void> {
  if (typeof token !== "string" || !SHARE_TOKEN.test(token)) return { error: "This link isn't valid." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Couldn't start your listening session. Try again." };

  const { data: songId, error } = await supabase.rpc("redeem_share_link", { link_token: token });
  if (error) {
    console.error("redeem_share_link:", error.code, error.message);
    return { error: "Couldn't open the mix. Try again." };
  }
  if (!songId) return { error: "This link is no longer active. Ask for a new one." };
  redirect(`/listen/${songId}`);
}
