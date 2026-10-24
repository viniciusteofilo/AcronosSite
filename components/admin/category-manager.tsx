"use client";

import { useState, useTransition } from "react";
import { slugify } from "@/lib/slug";
import type { ActionResult } from "@/server/admin/errors";
import { Notice, inputClass, smallButton } from "./ui";

type Category = { id: string; name: string; slug: string; sortOrder: number; products: number };

/** Categories drive the "Category" filter in the shop (e.g. Outerwear, Pants, Accessories). */
export function CategoryManager({
  initial,
  canEdit,
  save,
  remove,
}: {
  initial: Category[];
  canEdit: boolean;
  save: (input: unknown) => Promise<ActionResult<{ id: string; name: string; slug: string }>>;
  remove: (id: string) => Promise<ActionResult<void>>;
}) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState({ name: "", slug: "" });
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);

  const patch = (id: string, p: Partial<Category>) => setItems((all) => all.map((c) => (c.id === id ? { ...c, ...p } : c)));

  return (
    <div className="flex flex-col gap-4">
      <Notice result={notice} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              <th className="py-2 pr-3 font-normal">Name</th>
              <th className="py-2 pr-3 font-normal">Web address</th>
              <th className="py-2 pr-3 font-normal">Order</th>
              <th className="py-2 pr-3 font-normal">Products</th>
              <th className="py-2 font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-line">
                <td className="py-2 pr-3">
                  <input aria-label="Category name" disabled={!canEdit} value={c.name} maxLength={60} onChange={(e) => patch(c.id, { name: e.target.value })} className={inputClass} />
                </td>
                <td className="py-2 pr-3">
                  <input aria-label="Category web address" disabled={!canEdit} value={c.slug} maxLength={80} onChange={(e) => patch(c.id, { slug: e.target.value.toLowerCase() })} className={`${inputClass} font-mono text-xs`} />
                </td>
                <td className="py-2 pr-3">
                  <input aria-label="Display order" disabled={!canEdit} type="number" min={0} max={999} value={c.sortOrder} onChange={(e) => patch(c.id, { sortOrder: Number(e.target.value) || 0 })} className={`${inputClass} w-20`} />
                </td>
                <td className="py-2 pr-3 text-muted">{c.products}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        className={smallButton}
                        onClick={() => start(async () => setNotice(await save({ id: c.id, name: c.name, slug: c.slug, sortOrder: c.sortOrder })))}
                      >
                        Save
                      </button>
                      {confirm === c.id ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="ml-2 h-9 bg-alert px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-paper"
                          onClick={() =>
                            start(async () => {
                              const r = await remove(c.id);
                              setNotice(r.ok ? { ok: true, message: `“${c.name}” deleted.${c.products ? ` ${c.products} product(s) now have no category.` : ""}` } : r);
                              if (r.ok) setItems((all) => all.filter((x) => x.id !== c.id));
                              setConfirm(null);
                            })
                          }
                        >
                          Confirm delete
                        </button>
                      ) : (
                        <button type="button" className="ml-2 px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-alert hover:underline" onClick={() => setConfirm(c.id)}>
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-4 text-sm text-muted">No categories yet.</p>}
      </div>
      {canEdit && (
        <form
          className="flex flex-wrap items-end gap-3 border border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await save({ name: draft.name, slug: draft.slug || slugify(draft.name), sortOrder: items.length });
              setNotice(r);
              if (r.ok && r.data) {
                setItems([...items, { ...r.data, sortOrder: items.length, products: 0 }]);
                setDraft({ name: "", slug: "" });
              }
            });
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            New category
            <input value={draft.name} maxLength={60} required onChange={(e) => setDraft({ name: e.target.value, slug: slugify(e.target.value) })} placeholder="e.g. Outerwear" className={`${inputClass} w-56`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Web address
            <input value={draft.slug} maxLength={80} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })} className={`${inputClass} w-56 font-mono text-xs`} />
          </label>
          <button type="submit" disabled={pending} className="h-10 bg-ink px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted disabled:opacity-50">
            Add category
          </button>
        </form>
      )}
    </div>
  );
}
