import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut, Plus, Scissors, Trash2, User, Wallet } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog, CustomerNav, MobileFrame, PageHeader } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-session";
import { myBarbersQuery, profileQuery, removeMyBarber, requireRole, type SavedBarber } from "@/lib/halaqi-api";
import { arabicError } from "@/lib/rules";
import { removeSavedCode } from "@/lib/saved-barber";

export const Route = createFileRoute("/_authenticated/settings")({
  beforeLoad: ({ context }) => requireRole(context.queryClient, "customer"),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(profileQuery()), context.queryClient.ensureQueryData(myBarbersQuery())]),
  head: () => ({
    meta: [
      { title: "الإعدادات — حلاقي" },
      { name: "description", content: "إعدادات حسابك في حلاقي: حلاقوك المحفوظون وإضافة حلاق جديد وتسجيل الخروج." },
      { property: "og:title", content: "الإعدادات — حلاقي" },
      { property: "og:description", content: "أضف حلاقاً جديداً أو أزل حلاقاً محفوظاً أو سجّل الخروج." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const signOut = useSignOut();
  const { data: profile } = useSuspenseQuery(profileQuery());
  const { data: barbers } = useSuspenseQuery(myBarbersQuery());
  const [removing, setRemoving] = useState<SavedBarber | null>(null);

  const remove = useMutation({
    mutationFn: (b: SavedBarber) => removeMyBarber(b.id),
    onSuccess: (_, b) => {
      removeSavedCode(user.id, b.code);
      qc.setQueryData(myBarbersQuery().queryKey, (old: SavedBarber[] | undefined = []) => old.filter((x) => x.id !== b.id));
      setRemoving(null);
      toast.success(`أُزيل ${b.shop_name} من حلاقيك`);
    },
    onError: (e) => toast.error(arabicError(e)),
  });

  return (
    <MobileFrame withNav>
      <PageHeader title="الإعدادات" backTo={null} />
      <div className="space-y-4 px-4 pb-8 pt-4">
        <section className="rounded-2xl border bg-card p-4 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <Scissors className="size-4 text-brass" /> حلاقيني
          </h2>
          {barbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">لم تحفظ أي حلاق بعد.</p>
          ) : (
            <ul className="divide-y">
              {barbers.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-3 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold">{b.shop_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{b.barber_name}</p>
                    <p className="text-end font-mono text-xs text-muted-foreground" dir="ltr">
                      {b.code}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={`إزالة ${b.shop_name}`}
                    onClick={() => setRemoving(b)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="ink" size="lg" className="mt-3 w-full">
            <Link to="/customer" search={{ add: true }}>
              إضافة حلاق جديد <Plus />
            </Link>
          </Button>
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
          <Button asChild variant="outline" size="lg" className="mt-3 w-full bg-card">
            <Link to="/my-debts">
              <Wallet /> ديوني
            </Link>
          </Button>
        </section>

        <Button variant="outline" size="lg" className="w-full bg-card text-destructive" onClick={signOut}>
          <LogOut /> تسجيل الخروج
        </Button>
      </div>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`إزالة ${removing?.shop_name ?? "الحلاق"}؟`}
        description="سيُحذف من قائمة حلاقيك فقط، ويبقى باقي الحلاقين. مواعيدك السابقة تبقى محفوظة في «مواعيدي»."
        confirmLabel="نعم، أزله"
        pending={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
      <CustomerNav />
    </MobileFrame>
  );
}
