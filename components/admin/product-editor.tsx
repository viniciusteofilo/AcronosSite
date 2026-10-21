"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { codeOf, minorToInput, parseMoneyInput, slugify } from "@/lib/slug";
import { formatMoney } from "@/lib/money";
import type { ActionResult } from "@/server/admin/errors";
import type { EditorProduct } from "@/server/catalog/admin";
import type { MediaView } from "@/server/media/library";
import { MediaLibraryDialog } from "./media-library-dialog";
import { ProductGallery } from "./product-gallery";
import {
  Panel,
  SaveBar,
  StatusBadge,
  TextArea,
  TextInput,
  dangerButton,
  dateTime,
  inputClass,
  isoToLocalInput,
  localInputToIso,
  primaryButton,
  secondaryButton,
  smallButton,
  useUnsavedWarning,
} from "./ui";

type Status = EditorProduct["status"];

type VariantRow = {
  key: string;
  id?: string;
  sku: string;
  skuTouched: boolean;
  size: string;
  color: string;
  colorHex: string;
  usd: string;
  usdCompare: string;
  brl: string;
  brlCompare: string;
  stock: string;
  stockWas: number | null;
  reserved: number;
  weightGrams: string;
  isActive: boolean;
  hasOrders: boolean;
};

type Form = {
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  composition: string;
  care: string;
  technicalInfo: string;
  categoryId: string;
  collectionIds: string[];
  status: Status;
  publishAt: string;
  seoTitle: string;
  seoDescription: string;
};

type SaveData = { id: string; slug: string; notes: string[]; product: EditorProduct | null };

type Actions = {
  save: (input: unknown) => Promise<ActionResult<SaveData>>;
  duplicate: (id: string) => Promise<ActionResult<{ id: string }>>;
  remove: (id: string) => Promise<ActionResult<void>>;
  saveCategory: (input: unknown) => Promise<ActionResult<{ id: string; name: string; slug: string }>>;
  updateMedia: (p: { id: string; alt?: string; focalX?: number; focalY?: number }) => Promise<{ ok: boolean; message: string }>;
  listMedia: () => Promise<(MediaView & { originalName: string | null })[]>;
};

const SIZE_PRESETS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "ONE SIZE"];
const STATUS_TEXT: Record<Status, { label: string; help: string }> = {
  draft: { label: "Draft", help: "Only visible here. Use it while preparing." },
  published: { label: "Published", help: "In the shop (from the go-live time, if set)." },
  archived: { label: "Archived", help: "Hidden from the shop, kept for history and reports." },
};

/** Keeps sizes in the usual order (XS, S, M…), custom sizes after them. */
function sortSizes(list: string[]) {
  const rank = (x: string) => {
    const i = SIZE_PRESETS.indexOf(x);
    return i < 0 ? 100 + list.indexOf(x) : i;
  };
  return [...list].sort((a, b) => rank(a) - rank(b));
}

let rowCounter = 0;
const newKey = () => `row-${++rowCounter}`;

function toForm(p: EditorProduct | null): Form {
  return {
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    slugTouched: Boolean(p),
    description: p?.description ?? "",
    composition: p?.composition ?? "",
    care: p?.care ?? "",
    technicalInfo: p?.technicalInfo ?? "",
    categoryId: p?.categoryId ?? "",
    collectionIds: p?.collectionIds ?? [],
    status: p?.status ?? "draft",
    publishAt: isoToLocalInput(p?.publishedAt ?? null),
    seoTitle: p?.seoTitle ?? "",
    seoDescription: p?.seoDescription ?? "",
  };
}

function toRows(p: EditorProduct | null): VariantRow[] {
  return (p?.variants ?? []).map((v) => ({
    key: v.id,
    id: v.id,
    sku: v.sku,
    skuTouched: true,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    usd: minorToInput(v.usd),
    usdCompare: minorToInput(v.usdCompare),
    brl: minorToInput(v.brl),
    brlCompare: minorToInput(v.brlCompare),
    stock: String(v.onHand),
    stockWas: v.onHand,
    reserved: v.reserved,
    weightGrams: v.weightGrams ? String(v.weightGrams) : "",
    isActive: v.isActive,
    hasOrders: v.hasOrders,
  }));
}

function suggestSku(slug: string, color: string, size: string) {
  const base = (slug || "ITEM").toUpperCase().slice(0, 28).replace(/-+$/, "");
  return [base, color ? codeOf(color) : "", size ? size.toUpperCase().replace(/\s+/g, "") : ""].filter(Boolean).join("-");
}

/**
 * Everything about one product on one screen: photos, texts, sizes and colors, prices,
 * stock, visibility and search preview. Nothing reaches the shop until it is published.
 */
export function ProductEditor({
  product: initialProduct,
  options,
  actions,
  canAdjustStock,
  canEdit,
  created,
}: {
  product: EditorProduct | null;
  options: { categories: { id: string; name: string }[]; collections: { id: string; name: string; status: string }[]; knownColors: { name: string; hex: string }[] };
  actions: Actions;
  canAdjustStock: boolean;
  canEdit: boolean;
  created?: boolean;
}) {
  const router = useRouter();
  const [product, setProduct] = useState(initialProduct);
  const [form, setForm] = useState<Form>(() => toForm(initialProduct));
  const [images, setImages] = useState<MediaView[]>(initialProduct?.images ?? []);
  const [rows, setRows] = useState<VariantRow[]>(() => toRows(initialProduct));
  const [sizes, setSizes] = useState<string[]>(() => [...new Set(rows.map((r) => r.size).filter(Boolean))]);
  const [colors, setColors] = useState<{ name: string; hex: string }[]>(() => {
    const seen = new Map<string, { name: string; hex: string }>();
    for (const r of rows) if (r.color && !seen.has(r.color.toLowerCase())) seen.set(r.color.toLowerCase(), { name: r.color, hex: r.colorHex });
    return [...seen.values()];
  });
  const [categories, setCategories] = useState(options.categories);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(
    created ? { ok: true, message: "Product created as a draft. Add the rest and publish when ready." } : null,
  );
  const [pending, start] = useTransition();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [showSale, setShowSale] = useState(() => rows.some((r) => r.usdCompare || r.brlCompare));
  const [showShipping, setShowShipping] = useState(() => rows.some((r) => r.weightGrams));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState({ name: "", hex: "#111111" });
  const [bulk, setBulk] = useState({ usd: "", brl: "", stock: "" });
  const [newCategory, setNewCategory] = useState("");
  useUnsavedWarning(dirty);

  const touch = () => setDirty(true);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    const next = { ...form, [key]: value };
    if (key === "slug") next.slugTouched = true;
    if (key === "name" && !form.slugTouched) next.slug = slugify(String(value));
    if (next.slug !== form.slug) {
      setRows((rs) => rs.map((r) => (r.skuTouched ? r : { ...r, sku: suggestSku(next.slug, r.color, r.size) })));
    }
    setForm(next);
    touch();
  };
  const setRow = (key: string, patch: Partial<VariantRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    touch();
  };
  const setImagesDirty = (next: MediaView[] | ((prev: MediaView[]) => MediaView[])) => {
    setImages(next);
    touch();
  };

  function generateVariants() {
    const cs = colors.length ? colors : [{ name: "", hex: "" }];
    const ss = sizes.length ? sizes : [""];
    const next = [...rows];
    let added = 0;
    for (const c of cs) {
      for (const s of ss) {
        if (next.some((r) => r.size === s && r.color.toLowerCase() === c.name.toLowerCase())) continue;
        next.push({
          key: newKey(),
          sku: suggestSku(form.slug, c.name, s),
          skuTouched: false,
          size: s,
          color: c.name,
          colorHex: c.hex,
          usd: bulk.usd,
          usdCompare: "",
          brl: bulk.brl,
          brlCompare: "",
          stock: bulk.stock || "0",
          stockWas: null,
          reserved: 0,
          weightGrams: "",
          isActive: true,
          hasOrders: false,
        });
        added++;
      }
    }
    const ci = (r: VariantRow) => {
      const i = colors.findIndex((c) => c.name.toLowerCase() === r.color.toLowerCase());
      return i < 0 ? 99 : i;
    };
    const si = (r: VariantRow) => {
      const i = sizes.indexOf(r.size);
      return i < 0 ? 99 : i;
    };
    next.sort((a, b) => ci(a) - ci(b) || si(a) - si(b));
    setRows(next);
    if (added) touch();
    setNotice({ ok: true, message: added ? `${added} variant(s) added. Fill in prices and stock below.` : "All size and color combinations already exist." });
  }

  function applyBulk() {
    setRows((rs) =>
      rs.map((r) => ({
        ...r,
        usd: bulk.usd !== "" ? bulk.usd : r.usd,
        brl: bulk.brl !== "" ? bulk.brl : r.brl,
        stock: bulk.stock !== "" && canAdjustStock ? bulk.stock : r.stock,
      })),
    );
    touch();
  }

  const payload = () => ({
    id: product?.id,
    expectedUpdatedAt: product?.updatedAt,
    name: form.name,
    slug: form.slug,
    description: form.description,
    composition: form.composition,
    care: form.care,
    technicalInfo: form.technicalInfo,
    categoryId: form.categoryId || null,
    collectionIds: form.collectionIds,
    imageIds: images.map((m) => m.id),
    status: form.status,
    publishAt: localInputToIso(form.publishAt),
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
    variants: rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      size: r.size,
      color: r.color,
      colorHex: r.colorHex,
      usd: r.usd,
      usdCompare: r.usdCompare,
      brl: r.brl,
      brlCompare: r.brlCompare,
      stock: Number.parseInt(r.stock || "0", 10) || 0,
      stockWas: r.stockWas,
      weightGrams: r.weightGrams ? Number.parseInt(r.weightGrams, 10) || null : null,
      isActive: r.isActive,
    })),
  });

  function save(statusOverride?: Status) {
    const body = payload();
    if (statusOverride) body.status = statusOverride;
    start(async () => {
      const r = await actions.save(body);
      setNotice(r);
      if (!r.ok || !r.data) return;
      setDirty(false);
      if (!product) {
        router.replace(`/admin/products/${r.data.id}?created=1`);
        return;
      }
      const fresh = r.data.product;
      if (fresh) {
        setProduct(fresh);
        setForm(toForm(fresh));
        setRows(toRows(fresh));
        setImages(fresh.images);
      }
    });
  }

  const checklist = useMemo(() => {
    const active = rows.filter((r) => r.isActive);
    return [
      { ok: form.name.trim().length >= 2, text: "Name" },
      { ok: images.length > 0, text: "At least one photo" },
      ...(images.length ? [{ ok: images.every((m) => m.alt), text: "Photo descriptions (alt text)" }] : []),
      { ok: form.description.trim().length > 0, text: "Description" },
      { ok: active.length > 0, text: "At least one variant" },
      { ok: active.length > 0 && active.every((r) => r.usd.trim() !== ""), text: "USD price on every variant" },
      { ok: active.some((r) => (Number.parseInt(r.stock, 10) || 0) > 0), text: "Some stock to sell" },
    ];
  }, [form, images, rows]);

  const priceRange = useMemo(() => {
    const vals = rows.filter((r) => r.isActive).map((r) => parseMoneyInput(r.usd)).filter((v): v is number => typeof v === "number");
    if (!vals.length) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return min === max ? formatMoney(min, "USD") : `${formatMoney(min, "USD")} – ${formatMoney(max, "USD")}`;
  }, [rows]);

  const goLive = localInputToIso(form.publishAt);
  const scheduled = form.status === "published" && goLive && new Date(goLive) > new Date();
  const statusLine = dirty
    ? { text: "Unsaved changes", tone: "alert" as const }
    : product
      ? { text: scheduled ? `Scheduled · appears ${dateTime.format(new Date(goLive!))}` : `${STATUS_TEXT[product.status].label} · saved`, tone: product.status === "published" ? ("signal" as const) : ("muted" as const) }
      : { text: "New product · not saved yet", tone: "muted" as const };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <SaveBar status={statusLine.text} tone={statusLine.tone}>
        {product?.status === "published" && !dirty && (
          <a href={`/products/${product.slug}`} target="_blank" rel="noopener" className={secondaryButton}>
            View in shop
          </a>
        )}
        {canEdit && (
          <>
            <button type="button" disabled={pending} onClick={() => save()} className={secondaryButton}>
              {pending ? "Saving…" : "Save"}
            </button>
            {form.status !== "published" && (
              <button type="button" disabled={pending} onClick={() => save("published")} className={primaryButton}>
                Save and publish
              </button>
            )}
            {form.status === "published" && (
              <button type="button" disabled={pending} onClick={() => save()} className={primaryButton}>
                Save changes
              </button>
            )}
          </>
        )}
      </SaveBar>

      {!canEdit && <p className="border border-line bg-paper px-4 py-3 text-sm text-muted">Your role can view products but not change them.</p>}
      {notice && notice.message && (
        <p role={notice.ok ? "status" : "alert"} className={`border px-4 py-3 text-sm ${notice.ok ? "border-line bg-paper" : "border-alert bg-paper text-alert"}`}>
          {notice.message}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Product" id="basics">
            <TextInput label="Name" value={form.name} max={120} required onChange={(v) => set("name", v)} placeholder="e.g. Shell Jacket 01" />
            <TextInput
              label="Web address"
              value={form.slug}
              max={80}
              mono
              onChange={(v) => set("slug", v.toLowerCase())}
              hint={`acronos.com/products/${form.slug || "…"}${product?.status === "published" ? " · changing it breaks links already shared" : ""}`}
            />
            <TextArea label="Description" value={form.description} max={5000} rows={6} onChange={(v) => set("description", v)} hint="Shown next to the photos. Line breaks are kept." />
          </Panel>

          <Panel title="Photos" note="The first photo is the cover in the shop. Photos are resized automatically for phones and large screens." id="photos">
            <ProductGallery
              images={images}
              onChange={setImagesDirty}
              onPickFromLibrary={() => setLibraryOpen(true)}
              onUpdateMedia={async (p) => {
                const r = await actions.updateMedia(p);
                if (!r.ok) setNotice(r);
              }}
            />
          </Panel>

          <Panel title="Sizes, colors, prices and stock" note="Choose the sizes and colors, create the variants, then fill in prices and stock." id="variants">
            <div className="grid gap-5 lg:grid-cols-2">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-xs text-muted">Sizes</legend>
                <div className="flex flex-wrap gap-2">
                  {[...new Set([...SIZE_PRESETS, ...sizes])].map((s) => {
                    const on = sizes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSizes((all) => (on ? all.filter((x) => x !== s) : sortSizes([...all, s])))}
                        className={`h-9 min-w-11 border px-3 font-mono text-[11px] ${on ? "border-ink bg-ink text-canvas" : "border-field hover:border-ink"}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value.toUpperCase())}
                    maxLength={20}
                    placeholder="Other size (e.g. 42, W30)"
                    aria-label="Add another size"
                    className={`${inputClass} max-w-48`}
                  />
                  <button
                    type="button"
                    className={smallButton}
                    onClick={() => {
                      const s = newSize.trim();
                      if (s && !sizes.includes(s)) setSizes([...sizes, s]);
                      setNewSize("");
                    }}
                  >
                    Add size
                  </button>
                </div>
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-xs text-muted">Colors</legend>
                {colors.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {colors.map((c) => (
                      <li key={c.name} className="flex h-9 items-center gap-2 border border-field pl-2 pr-1 text-xs">
                        <span aria-hidden className="h-4 w-4 border border-line" style={{ background: c.hex || "transparent" }} />
                        {c.name}
                        <button type="button" aria-label={`Remove color ${c.name}`} onClick={() => setColors(colors.filter((x) => x !== c))} className="px-1 text-muted hover:text-alert">
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <input
                    value={newColor.name}
                    list="known-colors"
                    onChange={(e) => {
                      const name = e.target.value;
                      const known = options.knownColors.find((k) => k.name.toLowerCase() === name.toLowerCase());
                      setNewColor({ name, hex: known?.hex || newColor.hex });
                    }}
                    maxLength={40}
                    placeholder="Color name (e.g. Black)"
                    aria-label="Color name"
                    className={`${inputClass} max-w-48`}
                  />
                  <datalist id="known-colors">
                    {options.knownColors.map((k) => (
                      <option key={k.name} value={k.name} />
                    ))}
                  </datalist>
                  <input type="color" value={newColor.hex} onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })} aria-label="Swatch color shown to customers" className="h-10 w-12 border border-field bg-paper p-1" />
                  <button
                    type="button"
                    className={smallButton}
                    onClick={() => {
                      const name = newColor.name.trim();
                      if (name && !colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) setColors([...colors, { name, hex: newColor.hex }]);
                      setNewColor({ name: "", hex: newColor.hex });
                    }}
                  >
                    Add color
                  </button>
                </div>
              </fieldset>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t border-line pt-5">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Price USD for all
                <input value={bulk.usd} onChange={(e) => setBulk({ ...bulk, usd: e.target.value })} inputMode="decimal" placeholder="189.00" className={`${inputClass} w-28`} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Price BRL for all
                <input value={bulk.brl} onChange={(e) => setBulk({ ...bulk, brl: e.target.value })} inputMode="decimal" placeholder="990,00" className={`${inputClass} w-28`} />
              </label>
              {canAdjustStock && (
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Stock for all
                  <input value={bulk.stock} onChange={(e) => setBulk({ ...bulk, stock: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="0" className={`${inputClass} w-20`} />
                </label>
              )}
              <button type="button" onClick={generateVariants} className={`${smallButton} border-ink bg-ink text-canvas hover:bg-muted`}>
                Create variants
              </button>
              {rows.length > 0 && (
                <button type="button" onClick={applyBulk} className={smallButton}>
                  Apply to all variants
                </button>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="border border-dashed border-field p-6 text-center text-sm text-muted">
                No variants yet. Pick sizes and colors above and press “Create variants”. A product without sizes or colors still needs one variant: just press it.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-4 text-xs text-muted">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={showSale} onChange={(e) => setShowSale(e.target.checked)} /> Show sale prices (compare-at)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={showShipping} onChange={(e) => setShowShipping(e.target.checked)} /> Show weight
                  </label>
                </div>
                <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                        <th className="py-2 pr-3 font-normal">Variant</th>
                        <th className="py-2 pr-3 font-normal">SKU</th>
                        <th className="py-2 pr-3 font-normal">USD</th>
                        {showSale && <th className="py-2 pr-3 font-normal">USD was</th>}
                        <th className="py-2 pr-3 font-normal">BRL</th>
                        {showSale && <th className="py-2 pr-3 font-normal">BRL was</th>}
                        <th className="py-2 pr-3 font-normal">Stock</th>
                        {showShipping && <th className="py-2 pr-3 font-normal">Grams</th>}
                        <th className="py-2 pr-3 font-normal">On sale</th>
                        <th className="py-2 font-normal">
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const label = [r.color, r.size].filter(Boolean).join(" / ") || "Single variant";
                        const cell = "h-9 w-full border border-field bg-paper px-2 text-sm focus:border-ink";
                        const stockNum = Number.parseInt(r.stock, 10) || 0;
                        return (
                          <tr key={r.key} className={`border-b border-line align-middle ${r.isActive ? "" : "opacity-50"}`}>
                            <th scope="row" className="py-2 pr-3 text-left font-normal">
                              <span className="flex items-center gap-2">
                                {r.colorHex && <span aria-hidden className="h-3.5 w-3.5 shrink-0 border border-line" style={{ background: r.colorHex }} />}
                                <span className="whitespace-nowrap">{label}</span>
                              </span>
                            </th>
                            <td className="py-2 pr-3">
                              <input aria-label={`SKU for ${label}`} value={r.sku} maxLength={60} onChange={(e) => setRow(r.key, { sku: e.target.value.toUpperCase(), skuTouched: true })} className={`${cell} min-w-56 font-mono text-xs`} />
                            </td>
                            <td className="py-2 pr-3">
                              <input aria-label={`USD price for ${label}`} value={r.usd} inputMode="decimal" placeholder="0.00" onChange={(e) => setRow(r.key, { usd: e.target.value })} className={`${cell} w-24 ${r.isActive && !r.usd ? "border-alert" : ""}`} />
                            </td>
                            {showSale && (
                              <td className="py-2 pr-3">
                                <input aria-label={`USD compare-at price for ${label}`} value={r.usdCompare} inputMode="decimal" onChange={(e) => setRow(r.key, { usdCompare: e.target.value })} className={`${cell} w-24`} />
                              </td>
                            )}
                            <td className="py-2 pr-3">
                              <input aria-label={`BRL price for ${label}`} value={r.brl} inputMode="decimal" placeholder="0,00" onChange={(e) => setRow(r.key, { brl: e.target.value })} className={`${cell} w-24`} />
                            </td>
                            {showSale && (
                              <td className="py-2 pr-3">
                                <input aria-label={`BRL compare-at price for ${label}`} value={r.brlCompare} inputMode="decimal" onChange={(e) => setRow(r.key, { brlCompare: e.target.value })} className={`${cell} w-24`} />
                              </td>
                            )}
                            <td className="py-2 pr-3">
                              <input
                                aria-label={`Stock for ${label}`}
                                value={r.stock}
                                inputMode="numeric"
                                disabled={!canAdjustStock}
                                onChange={(e) => setRow(r.key, { stock: e.target.value.replace(/\D/g, "") })}
                                className={`${cell} w-20 ${stockNum === 0 ? "text-muted" : ""}`}
                              />
                              {r.reserved > 0 && <span className="mt-1 block text-[10px] text-muted">{r.reserved} in open orders</span>}
                            </td>
                            {showShipping && (
                              <td className="py-2 pr-3">
                                <input aria-label={`Weight in grams for ${label}`} value={r.weightGrams} inputMode="numeric" onChange={(e) => setRow(r.key, { weightGrams: e.target.value.replace(/\D/g, "") })} className={`${cell} w-20`} />
                              </td>
                            )}
                            <td className="py-2 pr-3 text-center">
                              <input type="checkbox" aria-label={`${label} is for sale`} checked={r.isActive} onChange={(e) => setRow(r.key, { isActive: e.target.checked })} className="h-4 w-4" />
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                aria-label={`Remove variant ${label}`}
                                onClick={() => {
                                  setRows(rows.filter((x) => x.key !== r.key));
                                  touch();
                                }}
                                className="px-2 font-mono text-xs text-muted hover:text-alert"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted">
                  Prices: USD is the shop price. BRL is the fixed price for Brazil; other countries see an automatic conversion at checkout. Stock changes are recorded in the inventory history.
                  {rows.some((r) => r.hasOrders) && " Variants that were already sold are hidden (not deleted) when removed."}
                </p>
              </>
            )}
          </Panel>

          <Panel title="Details" note="Shown in the product page tabs. Leave empty to hide." id="details">
            <TextArea label="Composition" value={form.composition} max={1000} rows={3} onChange={(v) => set("composition", v)} placeholder="e.g. Shell: 100% nylon ripstop. Lining: 100% polyester." />
            <TextArea label="Care" value={form.care} max={1000} rows={3} onChange={(v) => set("care", v)} placeholder="e.g. Machine wash cold. Do not tumble dry." />
            <TextArea label="Technical information" value={form.technicalInfo} max={3000} rows={4} onChange={(v) => set("technicalInfo", v)} placeholder="Fit, measurements, hardware, origin…" />
          </Panel>

          <Panel title="Search engines" note="Optional. When empty, the name and description are used." id="seo">
            <TextInput label="Title in Google" value={form.seoTitle} max={70} onChange={(v) => set("seoTitle", v)} placeholder={form.name} />
            <TextArea label="Description in Google" value={form.seoDescription} max={170} rows={2} onChange={(v) => set("seoDescription", v)} placeholder={form.description.slice(0, 160)} />
            <div className="border border-line bg-paper p-4" aria-label="Search result preview">
              <p className="truncate text-xs text-muted">acronos.com › products › {form.slug || "…"}</p>
              <p className="truncate text-base text-[#1a0dab]">{(form.seoTitle || form.name || "Product name") + " | ACRONOS"}</p>
              <p className="line-clamp-2 text-xs text-muted">{form.seoDescription || form.description.slice(0, 160) || "Description…"}</p>
            </div>
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Panel title="Visibility" id="visibility">
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Status</legend>
              {(Object.keys(STATUS_TEXT) as Status[]).map((s) => (
                <label key={s} className={`flex cursor-pointer gap-3 border p-3 text-sm ${form.status === s ? "border-ink bg-paper" : "border-line"}`}>
                  <input type="radio" name="status" value={s} checked={form.status === s} onChange={() => set("status", s)} className="mt-1" />
                  <span className="flex flex-col">
                    <span>{STATUS_TEXT[s].label}</span>
                    <span className="text-xs text-muted">{STATUS_TEXT[s].help}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Go live at (optional, for a drop)
              <input type="datetime-local" value={form.publishAt} onChange={(e) => set("publishAt", e.target.value)} className={inputClass} />
              <span className="text-[11px]">Your local time. Published products appear automatically at this time.</span>
            </label>
            {form.publishAt && (
              <button type="button" onClick={() => set("publishAt", "")} className="self-start text-xs text-muted underline hover:text-ink">
                Clear date
              </button>
            )}
          </Panel>

          <Panel title="Ready to sell?" id="checklist">
            <ul className="flex flex-col gap-2 text-sm">
              {checklist.map((c) => (
                <li key={c.text} className="flex items-center gap-2">
                  <span aria-hidden className={`font-mono text-xs ${c.ok ? "text-signal" : "text-alert"}`}>
                    {c.ok ? "✓" : "○"}
                  </span>
                  <span className={c.ok ? "" : "text-muted"}>
                    {c.text}
                    <span className="sr-only">{c.ok ? ": done" : ": missing"}</span>
                  </span>
                </li>
              ))}
            </ul>
            {priceRange && <p className="text-xs text-muted">Shop price: {priceRange}</p>}
          </Panel>

          <Panel title="Organization" id="organization">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Category (used in shop filters)
              <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputClass}>
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {canEdit && (
              <div className="flex gap-2">
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} maxLength={60} placeholder="New category" aria-label="New category name" className={inputClass} />
                <button
                  type="button"
                  className={smallButton}
                  disabled={!newCategory.trim() || pending}
                  onClick={() =>
                    start(async () => {
                      const r = await actions.saveCategory({ name: newCategory, slug: slugify(newCategory) });
                      if (r.ok && r.data) {
                        setCategories([...categories, { id: r.data.id, name: r.data.name }]);
                        set("categoryId", r.data.id);
                        setNewCategory("");
                      } else setNotice(r);
                    })
                  }
                >
                  Add
                </button>
              </div>
            )}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs text-muted">Collections</legend>
              {options.collections.length === 0 && (
                <p className="text-xs text-muted">
                  No collections yet. <Link href="/admin/collections/new" className="underline">Create one</Link>.
                </p>
              )}
              {options.collections.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.collectionIds.includes(c.id)}
                    onChange={(e) => set("collectionIds", e.target.checked ? [...form.collectionIds, c.id] : form.collectionIds.filter((x) => x !== c.id))}
                  />
                  {c.name}
                  {c.status !== "published" && <StatusBadge status={c.status} />}
                </label>
              ))}
            </fieldset>
          </Panel>

          {product && canEdit && (
            <Panel title="More" id="more">
              <button
                type="button"
                disabled={pending || dirty}
                title={dirty ? "Save first" : undefined}
                onClick={() =>
                  start(async () => {
                    const r = await actions.duplicate(product.id);
                    setNotice(r);
                    if (r.ok && r.data) router.push(`/admin/products/${r.data.id}`);
                  })
                }
                className={secondaryButton}
              >
                Duplicate as new draft
              </button>
              {confirmDelete ? (
                <div className="flex flex-col gap-2 border border-alert p-3 text-xs">
                  <p>Delete “{product.name}” permanently? Products that were sold cannot be deleted; archive them instead.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await actions.remove(product.id);
                          setNotice(r);
                          setConfirmDelete(false);
                          if (r.ok) {
                            setDirty(false);
                            router.push("/admin/products");
                          }
                        })
                      }
                      className="h-9 bg-alert px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-paper"
                    >
                      Yes, delete
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className={smallButton}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className={dangerButton}>
                  Delete product
                </button>
              )}
            </Panel>
          )}
        </aside>
      </div>

      <MediaLibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        load={actions.listMedia}
        onPick={(m) => setImagesDirty((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))}
      />
    </div>
  );
}
