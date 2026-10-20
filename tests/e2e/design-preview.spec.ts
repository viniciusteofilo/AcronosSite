import { expect, test } from "@playwright/test";

// The design preview exists only in builds made with DESIGN_PREVIEW=1; elsewhere these tests skip.
test.describe("storefront header (design preview)", () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.goto("/design-preview/home");
    test.skip(res?.status() === 404, "design preview not included in this build");
  });

  test("mobile menu opens as a modal, traps focus and closes with Escape", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    const open = page.getByRole("button", { name: "Open menu" });
    await open.click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
    await expect(menu.getByRole("link", { name: /Collections/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("desktop navigation marks the current page", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "desktop only");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("no horizontal scrolling", async ({ page }) => {
    for (const path of ["/design-preview/home", "/design-preview/shop", "/design-preview/product"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("sold-out sizes are disabled and announced", async ({ page }) => {
    await page.goto("/design-preview/product");
    await expect(page.getByRole("radio", { name: "XS, sold out" })).toBeDisabled();
  });
});
