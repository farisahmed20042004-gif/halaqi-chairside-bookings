import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut, RefreshCw, Scissors, User } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog, CustomerNav, MobileFrame, PageHeader } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-session";
import { forgetMyBarber, myBarberQuery, profileQuery, requireRole } from "@/lib/halaqi-api";
import { arabicError } from "@/lib/rules";
import { clearSavedCode } from "@/lib/saved-barber";

export const Route = createFileRoute("/_authenticated/settings")({
  beforeLoad: ({ context }) => requireRole(context.queryClient, "customer"),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(profileQuery()), context.queryClient.ensureQueryData(myBarberQuery())]),
  head: () => ({
    meta: [
      { title: "الإعدادات — حلاقي" },
      { name: "description", content: "إعدادات حسابك في حلاقي: حلاقك المحفوظ وتغيير الحلاق وتسجيل الخروج." },
      { property: "og:title", content: "الإعدادات — حلاقي" },
      { property: "og:description", content: "غيّر حلاقك المحفوظ أو سجّل الخروج." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const { data: profile } = useSuspenseQuery(profileQuery());
  const { data: barber } = useSuspenseQuery(myBarberQuery());
  const [confirm, setConfirm] = useState(false);

  const change = useMutation({
    mutationFn: forgetMyBarber,
    onSuccess: () => {
      clearSavedCode(user.id);
      qc.setQueryData(myBarberQuery().queryKey, null);
      setConfirm(false);
      toast.success("أدخل رمز الحلاق الجديد");
      navigate({ to: "/customer", search: {} });
    },
    onError: (e) => toast.error(arabicError(e)),
  });

  return (
    <MobileFrame withNav>
      <PageHeader title="الإعدادات" backTo={null} />
      <div className="space-y-4 px-4 pb-8 pt-4">
        <section className="rounded-2xl border bg-card p-4 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <Scissors className="size-4 text-brass" /> حلاقي
          </h2>
          {barber ? (
            <>
              <p className="font-display text-lg font-bold">{barber.shop_name}</p>
              <p className="text-sm text-muted-foreground">{barber.barber_name}</p>
              <p className="mt-1 font-mono text-sm" dir="ltr">
                {barber.code}
              </p>
              <Button variant="outline" size="lg" className="mt-4 w-full bg-card" onClick={() => setConfirm(true)}>
                <RefreshCw /> تغيير الحلاق
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">لم تحفظ حلاقاً بعد.</p>
              <Button asChild variant="ink" size="lg" className="mt-3 w-full">
                <Link to="/customer">أدخل رمز حلاقك</Link>
              </Button>
            </>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <User className="size-4 text-brass" /> حسابي
          </h2>
          <p className="font-semibold">{profile?.full_name || "—"}</p>
          {profile?.phone && (
            <p className="text-sm text-muted-foreground" dir="ltr">
              {profile.phone}
            </p>
          )}
          <p className="text-sm text-muted-foreground" dir="ltr">
            {user.email}
          </p>
        </section>

        <Button variant="outline" size="lg" className="w-full bg-card text-destructive" onClick={signOut}>
          <LogOut /> تسجيل الخروج
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="تغيير الحلاق؟"
        description="ستحتاج لإدخال رمز الحلاق الجديد. مواعيدك السابقة تبقى محفوظة في «مواعيدي»."
        confirmLabel="نعم، غيّر الحلاق"
        pending={change.isPending}
        onConfirm={() => change.mutate()}
      />
      <CustomerNav />
    </MobileFrame>
  );
}
