import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { BarberNav, MobileFrame, PageHeader } from "@/components/app-ui";
import { NoShop } from "@/components/no-shop";
import { ServicesManager } from "@/components/services-manager";
import { myShopQuery, shopServicesQuery } from "@/lib/halaqi-api";

export const Route = createFileRoute("/_authenticated/services")({
  loader: async ({ context }) => {
    const shop = await context.queryClient.ensureQueryData(myShopQuery());
    if (shop) await context.queryClient.ensureQueryData(shopServicesQuery(shop.id));
  },
  head: () => ({
    meta: [
      { title: "خدماتي — حلاقي" },
      { name: "description", content: "أضف خدمات صالونك وأسعارها بالدينار العراقي ومدة كل خدمة." },
      { property: "og:title", content: "خدماتي — حلاقي" },
      { property: "og:description", content: "إدارة خدمات الصالون وأسعارها ومدتها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { data: shop } = useSuspenseQuery(myShopQuery());
  if (!shop) return <NoShop title="خدماتي" />;
  return (
    <MobileFrame withNav>
      <PageHeader title="خدماتي" subtitle="ما يختاره الزبون قبل الحجز" backTo="/barber" />
      <div className="px-4 pt-4">
        <ServicesManager shop={shop} />
      </div>
      <BarberNav />
    </MobileFrame>
  );
}
