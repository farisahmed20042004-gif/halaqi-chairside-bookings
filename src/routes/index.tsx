import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Scissors, User } from "lucide-react";
import { useEffect, useState } from "react";

import heroImg from "@/assets/barbershop.jpg";
import { supabase } from "@/integrations/supabase/client";
import { roleHome, type AccountRole } from "@/lib/rules";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "حلاقي — مواعيد الحلاقة بسهولة" },
      { name: "description", content: "حلاقي: تطبيق للحلاقين وزبائنهم لإدارة المواعيد والحجوزات والديون." },
      { property: "og:title", content: "حلاقي — مواعيد الحلاقة بسهولة" },
      { property: "og:description", content: "احجز موعدك عند حلاقك، أو أدر مواعيد صالونك وديون زبائنك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  // Until we know whether this phone already has a signed-in account, show a
  // short splash instead of the landing so returning users never see it flash.
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        if (!cancelled) setChecked(true);
        return;
      }
      // Fast path: the role cached on this phone for this same account.
      let role: AccountRole | null = null;
      if (localStorage.getItem("halaqi_user_id") === user.id) {
        const cached = localStorage.getItem("halaqi_role");
        if (cached === "barber" || cached === "customer") role = cached;
      }
      if (!role) {
        const { data: row } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
        role = row?.role === "barber" ? "barber" : "customer";
      }
      localStorage.setItem("halaqi_user_id", user.id);
      localStorage.setItem("halaqi_role", role);
      if (!cancelled) navigate({ href: roleHome(role), replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <div className="h-16 w-5 overflow-hidden rounded-full ring-2 ring-brass">
          <div className="barber-pole h-full w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-ink-foreground">
      <img
        src={heroImg}
        alt=""
        width={1024}
        height={1280}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-hero-fade" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-14">
        <div className="animate-rise flex items-center gap-3">
          <div className="h-12 w-3 overflow-hidden rounded-full ring-2 ring-brass">
            <div className="barber-pole h-full w-full" />
          </div>
          <span className="text-sm font-medium tracking-wide text-brass">صالونك في جيبك</span>
        </div>

        <div className="mt-auto">
          <h1 className="animate-rise font-display text-7xl font-bold leading-none text-ink-foreground [animation-delay:80ms]">
            حلاقي
          </h1>
          <p className="animate-rise mt-4 max-w-xs text-lg leading-relaxed text-ink-foreground/80 [animation-delay:160ms]">
            احجز موعدك عند حلاقك بدون انتظار، وأدر صالونك ومواعيدك وديون زبائنك من مكان واحد.
          </p>

          <div className="mt-10 space-y-4">
            <RoleButton
              to="/barber"
              title="أنا حلاق"
              hint="إدارة المواعيد والزبائن والديون"
              icon={<Scissors className="size-7" />}
              variant="brass"
              delay="[animation-delay:240ms]"
            />
            <RoleButton
              to="/customer"
              title="أنا زبون"
              hint="أدخل رمز حلاقك واحجز موعداً"
              icon={<User className="size-7" />}
              variant="glass"
              delay="[animation-delay:320ms]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleButton({
  to,
  title,
  hint,
  icon,
  variant,
  delay,
}: {
  to: "/barber" | "/customer";
  title: string;
  hint: string;
  icon: React.ReactNode;
  variant: "brass" | "glass";
  delay: string;
}) {
  const styles =
    variant === "brass"
      ? "bg-gradient-brass text-brass-foreground shadow-lift"
      : "border border-ink-foreground/25 bg-ink-foreground/10 text-ink-foreground backdrop-blur-md";
  return (
    <Link
      to={to}
      className={`animate-rise flex min-h-24 items-center gap-4 rounded-3xl px-5 py-4 transition active:scale-[0.98] ${styles} ${delay}`}
    >
      <span
        className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${
          variant === "brass" ? "bg-brass-foreground/10" : "bg-ink-foreground/15"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-display text-2xl font-bold">{title}</span>
        <span className="mt-0.5 block text-sm opacity-80">{hint}</span>
      </span>
      <ChevronLeft className="size-6 shrink-0 opacity-70" />
    </Link>
  );
}
