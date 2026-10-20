import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { HazardStripe } from "@/components/graphics";
import { Container, EmptyState, PageHeader } from "@/components/storefront/page-parts";
import { SimplePageBody } from "@/components/storefront/simple-page";
import { Badge } from "@/components/ui/badge";
import { getSimplePage } from "@/server/content/pages";
import { listLab } from "@/server/content/stories";

export const metadata: Metadata = {
  title: "Acronos Lab",
  description: "Acronos Lab: a social project in planning to open paths for young people in technology, design and innovation.",
  alternates: { canonical: "/lab" },
};

const AREAS = ["Technology", "Programming", "Robotics", "Sustainable design", "Research", "Innovation", "Entrepreneurship"];
const STATUS_LABEL = { planned: "Planned", in_progress: "In progress", completed: "Completed", paused: "Paused" } as const;
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function LabPage() {
  return (
    <Container className="pb-24">
      <PageHeader eyebrow="Acronos Lab // in planning" title="Building futures">
        <Badge>Project in planning</Badge>
      </PageHeader>
      <section aria-labelledby="areas" className="flex flex-col gap-5 border-b border-line py-10">
        <h2 id="areas" className="font-mono text-[11px] uppercase tracking-[0.2em]">Areas</h2>
        <ul className="flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <li key={a} className="border border-line bg-surface px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em]">
              {a}
            </li>
          ))}
        </ul>
      </section>
      <Suspense fallback={<div className="min-h-[30svh]" />}>
        <LabContent />
      </Suspense>
    </Container>
  );
}

async function LabContent() {
  await connection();
  const db = getDb();
  const [page, lab] = await Promise.all([getSimplePage(db, "lab"), listLab(db)]);
  return (
    <>
      <SimplePageBody
        page={
          page ?? {
            intro:
              "Acronos Lab is a social project in planning. Its purpose is to create opportunities for young people through technology, programming, robotics, sustainable design, research, innovation and entrepreneurship.",
            sections: [],
          }
        }
      />
      <section aria-labelledby="projects" className="flex flex-col gap-6 border-t border-line py-12">
        <div className="flex items-center justify-between">
          <h2 id="projects" className="font-mono text-[11px] uppercase tracking-[0.2em]">Projects</h2>
          <HazardStripe className="h-8 w-3 text-ink/40" />
        </div>
        {lab.projects.length === 0 ? (
          <EmptyState title="Projects will be announced here" text="No program, course or class is running yet." />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {lab.projects.map((p) => (
              <li key={p.slug} className="flex flex-col gap-3 border border-line bg-surface p-6">
                <Badge>{STATUS_LABEL[p.initiativeStatus]}</Badge>
                <h3 className="font-display text-lg uppercase tracking-[0.06em]">{p.title}</h3>
                {p.summary && <p className="text-sm text-muted">{p.summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {lab.updates.length > 0 && (
        <section aria-labelledby="updates" className="flex flex-col gap-4 border-t border-line py-12">
          <h2 id="updates" className="font-mono text-[11px] uppercase tracking-[0.2em]">Updates</h2>
          <ul className="divide-y divide-line">
            {lab.updates.map((u) => (
              <li key={u.slug} className="flex flex-wrap justify-between gap-2 py-4">
                <span>{u.title}</span>
                <time className="font-mono text-[11px] text-muted" dateTime={u.date.toISOString()}>{dateFmt.format(u.date)}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
