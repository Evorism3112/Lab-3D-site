"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type AdminShopProduct = {
  crmName: string;
  priceRub: number;
  modelCode: string | null;
  revision: string | null;
  allColors: { letter: string; name: string; swatch: string }[];
  allConnectors: { letter: string; name: string }[];
  /** Site-uploaded photo ids. */
  photos: string[];
  /** Photo URLs from the CRM catalog: shown first in the shop, edited in the CRM. */
  crmPhotos: string[];
  content: {
    slug: string;
    visible: boolean;
    inStock: boolean;
    leadTimeDays: number | null;
    tagline: string;
    description: string;
    specs: string;
    compatibility: string;
    kit: string;
    colors: string;
    connectors: string;
    sortOrder: number;
  };
};

export type AdminShopOrder = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  deliveryService: string;
  goodsTotalRub: number;
  items: string;
  sentToCrm: boolean;
};

const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;

function Text({ label, value, onChange, rows, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-2 text-sm" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-1.5 text-sm" />
      )}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

function ProductEditor({ product, shopUrl }: { product: AdminShopProduct; shopUrl: string }) {
  const router = useRouter();
  const [c, setC] = useState(product.content);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof c>(key: K, value: (typeof c)[K]) => {
    setC({ ...c, [key]: value });
    setStatus(null);
  };
  // Empty letters = every variant of the model; a toggle narrows the list.
  const toggle = (key: "colors" | "connectors", letter: string, all: string[]) => {
    const current = c[key] ? c[key].split("") : all;
    const next = current.includes(letter) ? current.filter((l) => l !== letter) : [...current, letter];
    set(key, next.length === all.length ? "" : all.filter((l) => next.includes(l)).join(""));
  };

  const save = async () => {
    setBusy(true);
    const res = await fetch("/api/admin/taclab/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crmName: product.crmName, ...c, leadTimeDays: c.leadTimeDays || null }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setStatus(res.ok ? { text: "Сохранено", error: false } : { text: data.error ?? "Не сохранилось", error: true });
    if (res.ok) router.refresh();
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setStatus({ text: "Загружаем и уменьшаем фото…", error: false });
    const form = new FormData();
    form.set("crmName", product.crmName);
    for (const f of Array.from(files)) form.append("file", f);
    const res = await fetch("/api/admin/taclab/photos", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setStatus(res.ok ? { text: "Фото добавлены", error: false } : { text: data.error ?? "Не загрузилось", error: true });
    if (res.ok) router.refresh();
  };

  const photoAction = async (id: string, method: "PATCH" | "DELETE") => {
    if (method === "DELETE" && !confirm("Удалить это фото?")) return;
    await fetch(`/api/admin/taclab/photos/${id}`, { method });
    router.refresh();
  };

  const colorLetters = product.allColors.map((x) => x.letter);
  const connectorLetters = product.allConnectors.map((x) => x.letter);

  return (
    <div className={`card p-5 ${c.visible ? "" : "opacity-80"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-accent">{product.crmName}</h2>
          <p className="text-xs text-muted">
            Из CRM: {rub(product.priceRub)}
            {product.modelCode && ` · ${product.modelCode} ${product.revision}`} — цена и вес меняются в CRM (Настройки → Каталог)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={c.visible} onChange={(e) => set("visible", e.target.checked)} className="w-auto" />
            Показывать в магазине
          </label>
          {c.visible && (
            <a href={`${shopUrl}/p/${c.slug}`} className="text-accent hover:underline">
              Открыть →
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Text label="Адрес страницы" value={c.slug} onChange={(v) => set("slug", v)} hint={`${shopUrl}/p/${c.slug}`} />
        <Text label="Коротко (под названием)" value={c.tagline} onChange={(v) => set("tagline", v)} />
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-4 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={c.inStock} onChange={(e) => set("inStock", e.target.checked)} className="w-auto" />
          В наличии
        </label>
        {!c.inStock && (
          <label className="flex items-center gap-2">
            <span className="text-xs text-muted">Под заказ, дней:</span>
            <input
              type="number"
              min={1}
              value={c.leadTimeDays ?? ""}
              onChange={(e) => set("leadTimeDays", e.target.value ? Number(e.target.value) : null)}
              className="w-20 px-2 py-1 text-sm"
            />
          </label>
        )}
        <label className="flex items-center gap-2">
          <span className="text-xs text-muted">Порядок в каталоге:</span>
          <input type="number" min={0} value={c.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} className="w-20 px-2 py-1 text-sm" />
        </label>
      </div>

      {product.allColors.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <span className="text-xs text-muted">Цвета в продаже (все включены — значит все цвета модели из CRM)</span>
          <div className="flex flex-wrap gap-3">
            {product.allColors.map((x) => (
              <label key={x.letter} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  className="w-auto"
                  checked={!c.colors || c.colors.includes(x.letter)}
                  onChange={() => toggle("colors", x.letter, colorLetters)}
                />
                <span className="h-3 w-3 rounded-full border border-border" style={{ background: x.swatch }} />
                {x.name}
              </label>
            ))}
          </div>
          <span className="text-xs text-muted">Разъёмы</span>
          <div className="flex flex-wrap gap-3">
            {product.allConnectors.map((x) => (
              <label key={x.letter} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  className="w-auto"
                  checked={!c.connectors || c.connectors.includes(x.letter)}
                  onChange={() => toggle("connectors", x.letter, connectorLetters)}
                />
                {x.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Text label="Описание" rows={5} value={c.description} onChange={(v) => set("description", v)} />
        <Text label="Характеристики" rows={5} value={c.specs} onChange={(v) => set("specs", v)} hint="По строке: «Материал: PETG»" />
        <Text label="Совместимость" rows={3} value={c.compatibility} onChange={(v) => set("compatibility", v)} />
        <Text label="Комплект" rows={3} value={c.kit} onChange={(v) => set("kit", v)} />
      </div>

      <div className="mt-4">
        <span className="text-xs text-muted">
          Фото: сначала из CRM (меняются в CRM → Настройки → Каталог → Фото), потом загруженные здесь. Фото с камеры
          уменьшаются при загрузке.
        </span>
        <div className="mt-2 flex flex-wrap gap-3">
          {product.crmPhotos.map((src) => (
            <div key={src} className="flex w-28 flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="aspect-square w-28 rounded-md border border-border object-cover" />
              <span className="text-xs text-muted">из CRM</span>
            </div>
          ))}
          {product.photos.map((id, i) => (
            <div key={id} className="flex w-28 flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/taclab/photos/${id}`} alt="" className="aspect-square w-28 rounded-md border border-border object-cover" />
              <div className="flex justify-between text-xs">
                {/* With CRM photos the main one is the CRM's first: order here only among these. */}
                {product.crmPhotos.length > 0 ? (
                  <span className="text-muted">доп.</span>
                ) : i > 0 ? (
                  <button type="button" onClick={() => photoAction(id, "PATCH")} className="text-accent hover:underline">
                    Главное
                  </button>
                ) : (
                  <span className="text-muted">главное</span>
                )}
                <button type="button" onClick={() => photoAction(id, "DELETE")} className="text-danger hover:underline">
                  Удалить
                </button>
              </div>
            </div>
          ))}
          <label className="flex aspect-square w-28 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-center text-xs text-muted hover:text-accent">
            + Фото
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary px-4 py-1.5 text-sm">
          {busy ? "…" : "Сохранить"}
        </button>
        {status && <span className={`text-sm ${status.error ? "text-danger" : "text-accent"}`}>{status.text}</span>}
      </div>
    </div>
  );
}

export function TaclabAdmin({
  products,
  orders,
  crmReachable,
  shopUrl,
}: {
  products: AdminShopProduct[];
  orders: AdminShopOrder[];
  crmReachable: boolean;
  shopUrl: string;
}) {
  const router = useRouter();
  const [resending, setResending] = useState<string | null>(null);

  const resend = async (id: string) => {
    setResending(id);
    const res = await fetch(`/api/admin/taclab/orders/${id}`, { method: "POST" });
    setResending(null);
    if (!res.ok) alert((await res.json().catch(() => ({}))).error ?? "Не отправилось");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      {!crmReachable && (
        <p className="card p-4 text-sm text-danger">
          CRM не отвечает — товары берутся из её каталога (LAB_API_URL, LAB_API_KEY). Пока она недоступна, магазин пуст.
        </p>
      )}
      {crmReachable && products.length === 0 && (
        <p className="card p-4 text-sm text-muted">В каталоге CRM пока нет товаров: добавьте их в CRM → Настройки → Каталог.</p>
      )}
      {products.map((p) => (
        <ProductEditor key={p.crmName} product={p} shopUrl={shopUrl} />
      ))}

      <div className="card p-5">
        <h2 className="font-semibold text-text">Последние заказы</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Заказов пока нет.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="py-2 pr-3 text-muted">{new Date(o.createdAt).toLocaleString("ru-RU")}</td>
                    <td className="py-2 pr-3">
                      {o.name}, {o.phone}
                    </td>
                    <td className="py-2 pr-3 text-muted">{o.items}</td>
                    <td className="py-2 pr-3">{rub(o.goodsTotalRub)}</td>
                    <td className="py-2 pr-3 text-muted">{o.deliveryService}</td>
                    <td className="py-2">
                      {o.sentToCrm ? (
                        <span className="text-accent">в CRM</span>
                      ) : (
                        <button type="button" onClick={() => resend(o.id)} disabled={resending === o.id} className="text-danger hover:underline">
                          {resending === o.id ? "…" : "не дошёл — отправить"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
