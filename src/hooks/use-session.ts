import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { SAVED_BARBERS_KEY } from "@/lib/rules";

/** Session for showing signed-in/out UI on public pages (read after hydration). */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    // Drop everything this account left on the phone: cached role, saved
    // barbers list, and the session tokens (signOut removes those itself).
    localStorage.removeItem("halaqi_role");
    localStorage.removeItem("halaqi_user_id");
    localStorage.removeItem(SAVED_BARBERS_KEY);
    await supabase.auth.signOut();
    // Back to the landing page; with no session it shows the two role buttons.
    navigate({ to: "/", replace: true });
  };
}
