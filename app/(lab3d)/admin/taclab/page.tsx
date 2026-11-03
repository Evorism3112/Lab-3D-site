import { TaclabAdmin, type AdminShopOrder, type AdminShopProduct } from "@/components/admin/TaclabAdmin";
import { prisma } from "@/lib/db";
import { fetchOrderStatusesFromLab } from "@/lib/labClient";
import { getShopCatalog, labCatalog } from "@/lib/taclab/catalog";

// TACLAB shop content: products come from the CRM catalog (price, weight, variants); here they get
// a page - copy, photos, which variants are sold, and whether they are shown at all.
export default async function AdminTaclabPage() {
  const [{ products, crmReachable }, lab, rows, orders] = await Promise.all([
    getShopCatalog({ includeHidden: true, fresh: true }),
    labCatalog(),
    prisma.taclabProduct.findMany(),
    prisma.taclabOrder.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const domain = (process.env.TACLAB_DOMAIN ?? "").split(",")[0].trim();
  const shopUrl = domain ? `https://${domain}` : "/shop";

  const adminProducts: AdminShopProduct[] = products.map((p) => {
    const row = rows.find((r) => r.crmName === p.crmName);
    return {
      crmName: p.crmName,
      priceRub: p.priceRub,
      modelCode: p.modelCode,
      revision: p.revision,
      allColors: p.modelId && lab ? lab.colors.map((c) => ({ letter: c.letter, name: c.shortLabel || c.label, swatch: c.swatch })) : [],
      allConnectors: p.modelId && lab ? lab.connectors.map((k) => ({ letter: k.letter, name: k.plugLabel || k.label })) : [],
      photos: p.shopPhotoIds,
      crmPhotos: p.photos.filter((src) => src.startsWith("/api/taclab/crm-photos/")),
      content: {
        slug: p.slug,
        visible: p.visible,
        inStock: p.inStock,
        leadTimeDays: p.leadTimeDays,
        tagline: row?.tagline ?? "",
        description: row?.description ?? "",
        specs: row?.specs ?? "",
        compatibility: row?.compatibility ?? "",
        kit: row?.kit ?? "",
        colors: row?.colors ?? "",
        connectors: row?.connectors ?? "",
        sortOrder: row?.sortOrder ?? 0,
      },
    };
  });

  // The CRM is where orders are worked on: show their status from there, and leave out the ones
  // deleted there (the site keeps its copy - the customer's "order placed" page still opens).
  const statuses = await fetchOrderStatusesFromLab(orders.filter((o) => o.sentToCrm).map((o) => `taclab-${o.id}`));
  const listed = orders.filter((o) => !(o.sentToCrm && statuses && statuses[`taclab-${o.id}`] === null));

  const adminOrders: AdminShopOrder[] = listed.map((o) => ({
    id: o.id,
    createdAt: o.createdAt.toISOString(),
    name: o.name,
    phone: o.phone,
    deliveryService: o.deliveryService,
    goodsTotalRub: o.goodsTotalRub,
    items: ((o.items as { crmName: string; quantity: number }[]) ?? []).map((i) => `${i.crmName} × ${i.quantity}`).join(", "),
    sentToCrm: o.sentToCrm,
    crmStatus: statuses?.[`taclab-${o.id}`]?.label ?? null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">TACLAB</h1>
      <p className="mt-1 text-sm text-muted">
        Магазин готовых изделий: товары, цены и фото — из каталога CRM (Настройки → Каталог), здесь — описание и
        характеристики. Товар из CRM сразу появляется в магазине; снимите «Показывать», чтобы скрыть. Заказы уходят в CRM.
      </p>
      <div className="mt-6">
        <TaclabAdmin products={adminProducts} orders={adminOrders} crmReachable={crmReachable} shopUrl={shopUrl} />
      </div>
    </div>
  );
}
