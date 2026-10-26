import { Link } from "@tanstack/react-router";

import { MobileFrame, PageHeader } from "@/components/app-ui";

export function NoShop({ title }: { title: string }) {
  return (
    <MobileFrame>
      <PageHeader title={title} />
      <div className="space-y-4 px-5 pt-10 text-center">
        <h2 className="text-2xl font-bold">هذه الصفحة للحلاقين</h2>
        <p className="text-muted-foreground">جهّز صالونك أولاً لتظهر هنا مواعيدك وديون زبائنك.</p>
        <Link to="/barber" className="inline-flex h-12 items-center rounded-xl bg-gradient-ink px-6 font-semibold text-ink-foreground">
          تجهيز الصالون
        </Link>
      </div>
    </MobileFrame>
  );
}
