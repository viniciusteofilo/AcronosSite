import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { addresses, newsletterSubscribers, supportRequests, userRoles } from "@/db/schema";
import { runAdmin } from "@/server/admin/errors";
import { exportSubscribersCsv, getCustomer, grantRoleByEmail, listCustomers, listMessages, listStaff, revokeStaffRole, setMessageStatus } from "@/server/admin/people";
import { getSimplePage } from "@/server/content/pages";
import { getPageForEditor, getPageRevision, listPagesAdmin, savePage } from "@/server/content/pages-admin";
import { getStoryBySlug, listLab } from "@/server/content/stories";
import { createStoryCategory, getStoryForEditor, getStoryRevision, saveLabProject, saveLabUpdate, saveStory } from "@/server/content/stories-admin";
import { AccessDeniedError } from "@/server/rbac/access";
import { ctxFor, makeUser, testDb } from "../helpers";

const { db, client } = testDb();
afterAll(() => client.end());
const T = `c${Date.now().toString(36)}`;

let editor: ReturnType<typeof ctxFor>;
let manager: ReturnType<typeof ctxFor>;
let orders: ReturnType<typeof ctxFor>;
let owner: ReturnType<typeof ctxFor>;

beforeAll(async () => {
  editor = ctxFor(await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true }), ["content_editor"]);
  manager = ctxFor(await makeUser(db, { roles: ["manager"], twoFactorEnabled: true }), ["manager"]);
  orders = ctxFor(await makeUser(db, { roles: ["order_manager"], twoFactorEnabled: true }), ["order_manager"]);
  owner = ctxFor(await makeUser(db, { roles: ["super_admin"], twoFactorEnabled: true }), ["super_admin"]);
});

describe("pages", () => {
  it("saves About as draft, publishes it, keeps history and restores a version", async () => {
    await expect(savePage(db, orders, { slug: "about", title: "About", status: "draft" })).rejects.toBeInstanceOf(AccessDeniedError);
    await savePage(db, editor, { slug: "about", title: "About Acronos", intro: `Draft ${T}`, sections: [{ heading: "History", body: "Since 2018." }], status: "draft" });
    expect(await getSimplePage(db, "about")).toBeNull(); // draft: the site keeps its fallback
    await savePage(db, editor, { slug: "about", title: "About Acronos", intro: `Live ${T}`, sections: [{ heading: "History", body: "Since 2018." }, { heading: "", body: "" }], status: "published" });
    const live = await getSimplePage(db, "about");
    expect(live).toMatchObject({ intro: `Live ${T}`, sections: [{ heading: "History", body: "Since 2018." }] }); // empty section dropped
    const ed = await getPageForEditor(db, editor, "about");
    expect(ed!.revisions.length).toBeGreaterThanOrEqual(1);
    const old = await getPageRevision(db, editor, "about", ed!.revisions[0].id);
    expect(old.intro).toBe(`Draft ${T}`);
    expect((await listPagesAdmin(db, editor)).find((p) => p.slug === "about")?.status).toBe("published");
  });

  it("refuses unknown pages and policies published without review confirmation", async () => {
    const r1 = await runAdmin(() => savePage(db, editor, { slug: "home", title: "x x", status: "draft" }), "ok");
    expect(r1.ok).toBe(false);
    const r2 = await runAdmin(() => savePage(db, editor, { slug: "policy-privacy", title: "Privacy", intro: "Text", status: "published" }), "ok");
    expect(r2.message).toMatch(/reviewed/);
    await savePage(db, editor, { slug: "policy-privacy", title: "Privacy policy", intro: "Reviewed text.", status: "published", legalReviewed: true });
    expect((await getSimplePage(db, "policy-privacy"))?.intro).toBe("Reviewed text.");
  });
});

describe("Sci-Fi stories", () => {
  it("creates, sanitizes, schedules, publishes and keeps revisions", async () => {
    const cat = await createStoryCategory(db, editor, { name: "Short story", slug: `short-${T}` });
    const r = await runAdmin(() => saveStory(db, editor, { title: "Signal", slug: `signal-${T}`, authorName: "ACRONOS", body: "<p>x</p>", status: "scheduled" }), "ok");
    expect(r.message).toMatch(/future date/);
    const { id } = await saveStory(db, editor, {
      title: "Signal",
      slug: `signal-${T}`,
      authorName: "ACRONOS",
      body: `<p onclick="evil()">The city <strong>woke</strong>.</p><script>alert(1)</script><p style="color:red">End.</p>`,
      status: "draft",
      categoryIds: [cat.id],
    });
    const ed = await getStoryForEditor(db, editor, id);
    expect(ed!.body).toBe("<p>The city <strong>woke</strong>.</p><p>End.</p>");
    expect(ed!.categoryIds).toEqual([cat.id]);
    expect(await getStoryBySlug(db, `signal-${T}`)).toBeNull();

    await saveStory(db, editor, { id, expectedUpdatedAt: ed!.updatedAt, title: "Signal", slug: `signal-${T}`, authorName: "ACRONOS", body: "<p>Final text.</p>", status: "published" });
    const live = await getStoryBySlug(db, `signal-${T}`);
    expect(live?.bodyHtml).toBe("<p>Final text.</p>");
    const after = await getStoryForEditor(db, editor, id);
    const rev = await getStoryRevision(db, editor, id, after!.revisions[0].id);
    expect(rev.body).toContain("woke");

    const stale = await runAdmin(() => saveStory(db, editor, { id, expectedUpdatedAt: ed!.updatedAt, title: "S", slug: `signal-${T}`, authorName: "A", body: "<p>x</p>", status: "draft" }), "ok");
    expect(stale.message).toMatch(/Someone else/);
  });
});

describe("Acronos Lab", () => {
  it("only shows published projects and due updates", async () => {
    await saveLabProject(db, editor, { title: `Draft project ${T}`, slug: `dp-${T}`, initiativeStatus: "planned", status: "draft" });
    await saveLabProject(db, editor, { title: `Robotics ${T}`, slug: `rob-${T}`, summary: "In planning.", initiativeStatus: "planned", status: "published" });
    await saveLabUpdate(db, editor, { title: `Future note ${T}`, slug: `fn-${T}`, status: "published", publishAt: new Date(Date.now() + 86_400_000).toISOString() });
    await saveLabUpdate(db, editor, { title: `Now note ${T}`, slug: `nn-${T}`, status: "published" });
    const lab = await listLab(db);
    const titles = [...lab.projects.map((p) => p.title), ...lab.updates.map((u) => u.title)];
    expect(titles).toContain(`Robotics ${T}`);
    expect(titles).toContain(`Now note ${T}`);
    expect(titles).not.toContain(`Draft project ${T}`);
    expect(titles).not.toContain(`Future note ${T}`);
  });
});

describe("customers, messages, newsletter, staff", () => {
  it("lists customers without staff, hides addresses from roles without shipping access", async () => {
    const cust = await makeUser(db);
    await db.insert(addresses).values({ userId: cust.id, fullName: "C", line1: "1 St", city: "Orlando", postalCode: "32801", country: "US" });
    const list = await listCustomers(db, manager, { q: cust.email });
    expect(list.items.map((i) => i.id)).toEqual([cust.id]);
    expect((await listCustomers(db, manager, { q: manager.email })).items).toHaveLength(0); // staff are not customers
    await expect(listCustomers(db, editor, {})).rejects.toBeInstanceOf(AccessDeniedError);
    expect((await getCustomer(db, manager, cust.id))?.addresses).toHaveLength(1);
    await expect(getCustomer(db, orders, cust.id)).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("messages from the contact form can be read and closed", async () => {
    const [m] = await db.insert(supportRequests).values({ name: "N", email: `m-${T}@example.test`, topic: "wholesale", message: "Hello there, wholesale?" }).returning();
    const list = await listMessages(db, manager, { status: "new" });
    expect(list.items.map((i) => i.id)).toContain(m.id);
    await setMessageStatus(db, manager, m.id, "closed");
    const [row] = await db.select().from(supportRequests).where(eq(supportRequests.id, m.id));
    expect(row.status).toBe("closed");
  });

  it("exports subscribers as CSV, neutralizing spreadsheet formulas", async () => {
    await db.insert(newsletterSubscribers).values({ email: `=cmd-${T}@example.test`, status: "pending", consentSource: "footer", consentAt: new Date() });
    await expect(exportSubscribersCsv(db, editor)).rejects.toBeInstanceOf(AccessDeniedError);
    const csv = await exportSubscribersCsv(db, manager);
    expect(csv.split("\r\n")[0]).toBe("email,status,source,consent_at,created_at,unsubscribe_url");
    expect(csv).toContain(`"'=cmd-${T}@example.test"`);
  });

  it("super admin grants and removes roles by e-mail; the last super admin is protected", async () => {
    const person = await makeUser(db);
    await expect(grantRoleByEmail(db, manager, { email: person.email, role: "content_editor" })).rejects.toBeInstanceOf(AccessDeniedError);
    const missing = await runAdmin(() => grantRoleByEmail(db, owner, { email: `nobody-${T}@example.test`, role: "manager" }), "ok");
    expect(missing.message).toMatch(/create an account/);
    await grantRoleByEmail(db, owner, { email: person.email.toUpperCase(), role: "content_editor" });
    expect((await listStaff(db, owner)).find((s) => s.id === person.id)?.roles).toEqual(["content_editor"]);
    await revokeStaffRole(db, owner, { targetUserId: person.id, role: "content_editor" });
    expect(await db.select().from(userRoles).where(eq(userRoles.userId, person.id))).toHaveLength(0);
    const self = await runAdmin(() => revokeStaffRole(db, owner, { targetUserId: owner.userId, role: "super_admin" }), "ok");
    expect(self.ok).toBe(false);
  });
});

describe("story import", () => {
  it("creates drafts only, keeps provenance, never reuses a web address, sanitizes", async () => {
    const { importStories } = await import("@/server/content/stories-admin");
    const { stories } = await import("@/db/schema");
    const { eq: eq2 } = await import("drizzle-orm");
    const { AccessDeniedError: Denied } = await import("@/server/rbac/access");
    const { runAdmin: run } = await import("@/server/admin/errors");
    const { ctxFor: ctx, makeUser: mk } = await import("../helpers");
    const editor = ctx(await mk(db, { roles: ["content_editor"], twoFactorEnabled: true }), ["content_editor"]);
    const title = `Imported Gate ${Date.now()}`;
    const item = { title, body: "<p>Text <script>alert(1)</script>here.</p>", fileName: "gate.docx" };
    const r = await importStories(db, editor, { authorName: "A. Writer", items: [item, item] });
    expect(r.every((x) => x.ok)).toBe(true);
    const rows = await Promise.all(r.map(async (x) => (await db.select().from(stories).where(eq2(stories.id, x.id!)))[0]));
    expect(rows.map((s) => s.status)).toEqual(["draft", "draft"]);
    expect(rows[1].slug).toBe(`${rows[0].slug}-2`);
    expect(rows[0]).toMatchObject({ authorName: "A. Writer", importedFrom: "file: gate.docx" });
    expect(rows[0].body).not.toContain("script");
    expect((await run(() => importStories(db, editor, { authorName: "", items: [item] }), "ok")).ok).toBe(false);
    const customer = ctx(await mk(db), []);
    await expect(importStories(db, customer, { authorName: "X", items: [item] })).rejects.toBeInstanceOf(Denied);
  });
});
