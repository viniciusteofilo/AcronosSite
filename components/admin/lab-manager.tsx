"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slugify } from "@/lib/slug";
import type { ActionResult } from "@/server/admin/errors";
import { Notice, Panel, TextArea, TextInput, inputClass, isoToLocalInput, localInputToIso, primaryButton, smallButton } from "./ui";

type Pub = "draft" | "published" | "archived";
type Project = { id?: string; title: string; slug: string; summary: string; body: string; initiativeStatus: "planned" | "in_progress" | "completed" | "paused"; status: Pub };
type Update = { id?: string; projectId: string | null; title: string; slug: string; body: string; status: Pub; publishAt: string | null };

const STAGES = { planned: "Planned", in_progress: "In progress", completed: "Completed", paused: "Paused" } as const;

/**
 * Acronos Lab is in planning: projects show their real stage and nothing is presented as
 * running until ACRONOS marks it so.
 */
export function LabManager({
  projects,
  updates,
  actions,
}: {
  projects: Project[];
  updates: Update[];
  actions: {
    saveProject: (input: unknown) => Promise<ActionResult<{ id: string }>>;
    saveUpdate: (input: unknown) => Promise<ActionResult<{ id: string }>>;
    remove: (kind: "project" | "update", id: string) => Promise<ActionResult<void>>;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ kind: "project"; item: Project } | { kind: "update"; item: Update } | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const done = (r: ActionResult<unknown>) => {
    setNotice(r);
    if (r.ok) {
      setEditing(null);
      router.refresh();
    }
  };

  const statusSelect = (value: Pub, onChange: (v: Pub) => void) => (
    <label className="flex flex-col gap-1 text-xs text-muted">
      Visibility
      <select value={value} onChange={(e) => onChange(e.target.value as Pub)} className={inputClass}>
        <option value="draft">Draft (only here)</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <Notice result={notice} />
      {editing?.kind === "project" && (
        <Panel title={editing.item.id ? "Edit project" : "New project"}>
          <TextInput label="Title" required value={editing.item.title} max={120} onChange={(v) => setEditing({ kind: "project", item: { ...editing.item, title: v, slug: editing.item.id ? editing.item.slug : slugify(v) } })} />
          <TextArea label="Summary (shown on the Lab page)" value={editing.item.summary} max={600} rows={3} onChange={(v) => setEditing({ kind: "project", item: { ...editing.item, summary: v } })} />
          <TextArea label="Notes / details" value={editing.item.body} max={20000} rows={6} onChange={(v) => setEditing({ kind: "project", item: { ...editing.item, body: v } })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Stage (be accurate: nothing is shown as running unless it is)
              <select value={editing.item.initiativeStatus} onChange={(e) => setEditing({ kind: "project", item: { ...editing.item, initiativeStatus: e.target.value as Project["initiativeStatus"] } })} className={inputClass}>
                {Object.entries(STAGES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {statusSelect(editing.item.status, (v) => setEditing({ kind: "project", item: { ...editing.item, status: v } }))}
          </div>
          <div className="flex gap-2">
            <button type="button" className={primaryButton} disabled={pending} onClick={() => start(async () => done(await actions.saveProject(editing.item)))}>
              Save project
            </button>
            <button type="button" className={smallButton} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </Panel>
      )}
      {editing?.kind === "update" && (
        <Panel title={editing.item.id ? "Edit update" : "New update"}>
          <TextInput label="Title" required value={editing.item.title} max={160} onChange={(v) => setEditing({ kind: "update", item: { ...editing.item, title: v, slug: editing.item.id ? editing.item.slug : slugify(v) } })} />
          <TextArea label="Text" value={editing.item.body} max={20000} rows={6} onChange={(v) => setEditing({ kind: "update", item: { ...editing.item, body: v } })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Project (optional)
              <select value={editing.item.projectId ?? ""} onChange={(e) => setEditing({ kind: "update", item: { ...editing.item, projectId: e.target.value || null } })} className={inputClass}>
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            {statusSelect(editing.item.status, (v) => setEditing({ kind: "update", item: { ...editing.item, status: v } }))}
            <label className="flex flex-col gap-1 text-xs text-muted">
              Date (optional, future = scheduled)
              <input type="datetime-local" value={isoToLocalInput(editing.item.publishAt)} onChange={(e) => setEditing({ kind: "update", item: { ...editing.item, publishAt: localInputToIso(e.target.value) } })} className={inputClass} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" className={primaryButton} disabled={pending} onClick={() => start(async () => done(await actions.saveUpdate(editing.item)))}>
              Save update
            </button>
            <button type="button" className={smallButton} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </Panel>
      )}

      <Panel title={`Projects (${projects.length})`}>
        <List
          items={projects.map((p) => ({ id: p.id!, title: p.title, meta: `${STAGES[p.initiativeStatus]} · ${p.status}`, edit: () => setEditing({ kind: "project", item: p }) }))}
          empty="No projects yet. The Lab page says projects will be announced."
          onDelete={(id) => start(async () => done(await actions.remove("project", id)))}
        />
        <button type="button" className={`${smallButton} self-start`} onClick={() => setEditing({ kind: "project", item: { title: "", slug: "", summary: "", body: "", initiativeStatus: "planned", status: "draft" } })}>
          + New project
        </button>
      </Panel>
      <Panel title={`Updates (${updates.length})`} note="Short news shown on the Lab page.">
        <List
          items={updates.map((u) => ({ id: u.id!, title: u.title, meta: `${u.status}${u.publishAt ? ` · ${new Date(u.publishAt).toLocaleDateString("en-US", { dateStyle: "medium" })}` : ""}`, edit: () => setEditing({ kind: "update", item: u }) }))}
          empty="No updates yet."
          onDelete={(id) => start(async () => done(await actions.remove("update", id)))}
        />
        <button type="button" className={`${smallButton} self-start`} onClick={() => setEditing({ kind: "update", item: { projectId: null, title: "", slug: "", body: "", status: "draft", publishAt: null } })}>
          + New update
        </button>
      </Panel>
    </div>
  );
}

function List({ items, empty, onDelete }: { items: { id: string; title: string; meta: string; edit: () => void }[]; empty: string; onDelete: (id: string) => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-line border border-line bg-paper">
      {items.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-sm">{i.title}</span>
            <span className="text-xs capitalize text-muted">{i.meta.replace("_", " ")}</span>
          </span>
          <span className="flex gap-2">
            <button type="button" className={smallButton} onClick={i.edit}>
              Edit
            </button>
            {confirm === i.id ? (
              <button type="button" className="h-9 bg-alert px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-paper" onClick={() => onDelete(i.id)}>
                Confirm delete
              </button>
            ) : (
              <button type="button" className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-alert hover:underline" onClick={() => setConfirm(i.id)}>
                Delete
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
