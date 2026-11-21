"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SHARE_TOKEN } from "@/lib/share-token";

// "Listen" on a share link (ADR 0005): sign the visitor in anonymously if they have no session, redeem
// the link (creates their grant), then go to the song. This runs on a click, never on page load, so
// link-preview bots (iMessage, Slack, email) don't create anonymous users.
export async function openSharedMix(token: string): Promise<{ error: string } | void> {
  if (typeof token !== "string" || !SHARE_TOKEN.test(token)) return { error: "This link isn't valid." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("signInAnonymously:", error.status, error.code);
      return {
        error:
          error.status === 429
            ? "Too many people opened links from this network recently. Try again in a few minutes."
            : "Couldn't open the mix. Try again.",
      };
    }
  }

  const { data: songId, error } = await supabase.rpc("redeem_share_link", { link_token: token });
  if (error) {
    console.error("redeem_share_link:", error.code, error.message);
    return { error: "Couldn't open the mix. Try again." };
  }
  if (!songId) return { error: "This link is no longer active. Ask for a new one." };
  redirect(`/listen/${songId}`);
}
