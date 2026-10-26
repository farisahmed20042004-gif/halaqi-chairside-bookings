import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Scissors, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { arabicError, safeRedirect } from "@/lib/rules";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";
type AccountType = "barber" | "customer";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    mode: s.mode === "signup" ? ("signup" as const) : s.mode === "signin" ? ("signin" as const) : undefined,
    as: s.as === "barber" ? ("barber" as const) : s.as === "customer" ? ("customer" as const) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "الدخول — حلاقي" },
      { name: "description", content: "سجّل الدخول أو أنشئ حساباً في حلاقي للحلاقين والزبائن." },
      { property: "og:title", content: "الدخول — حلاقي" },
      { property: "og:description", content: "أنشئ حسابك في حلاقي واحجز أو أدر مواعيدك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(search.mode ?? "signup");
  const [accountType, setAccountType] = useState<AccountType>(search.as ?? "customer");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function goNext(userId: string, type?: AccountType) {
    const target = safeRedirect(search.redirect);
    if (target) {
      navigate({ href: target, replace: true });
      return;
    }
    let dest: AccountType = type ?? "customer";
    if (!type) {
      const { data } = await supabase.from("barbers").select("id").eq("owner_id", userId).maybeSingle();
      dest = data ? "barber" : "customer";
    }
    navigate({ to: dest === "barber" ? "/barber" : "/customer", replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "signup" && fullName.trim().length < 2) return setError("اكتب اسمك الكامل.");
    if (password.length < 8) return setError("كلمة المرور يجب أن تكون ٨ أحرف على الأقل.");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim(), phone: phone.trim() || null, account_type: accountType },
          },
        });
        if (error) throw error;
        if (!data.session || !data.user) throw new Error("تعذّر إكمال التسجيل.");
        await goNext(data.user.id, accountType);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        await goNext(data.user.id);
      }
    } catch (err) {
      setError(arabicError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-10">
        <Link to="/" className="font-display text-4xl font-bold text-brass">
          حلاقي
        </Link>
        <p className="mt-2 text-ink-foreground/75">
          {mode === "signup" ? "أنشئ حسابك خلال دقيقة." : "أهلاً بعودتك."}
        </p>

        <div className="mt-8 rounded-3xl bg-card p-5 shadow-lift">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            {(["signup", "signin"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={cn(
                  "rounded-xl py-2.5 text-sm font-semibold transition",
                  mode === m ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
                )}
              >
                {m === "signup" ? "حساب جديد" : "تسجيل الدخول"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label>نوع الحساب</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <TypeOption active={accountType === "barber"} onClick={() => setAccountType("barber")} icon={<Scissors className="size-5" />} label="أنا حلاق" />
                    <TypeOption active={accountType === "customer"} onClick={() => setAccountType("customer")} icon={<User className="size-5" />} label="أنا زبون" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full-name">الاسم الكامل</Label>
                  <Input id="full-name" autoComplete="name" className="h-12 text-base" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف (اختياري)</Label>
                  <Input id="phone" dir="ltr" inputMode="tel" autoComplete="tel" className="h-12 text-right text-base" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXXX" maxLength={20} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" dir="ltr" autoComplete="email" required className="h-12 text-right text-base" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={8}
                className="h-12 text-right text-base"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === "signup" && <p className="text-xs text-muted-foreground">٨ أحرف على الأقل.</p>}
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" variant="ink" size="xl" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {mode === "signup" ? "إنشاء الحساب" : "دخول"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function TypeOption({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold transition",
        active ? "border-brass bg-accent text-accent-foreground ring-2 ring-brass" : "bg-card",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
