# Accessibility (WCAG 2.2 AA)

## Automated checks (every CI run)

`tests/e2e/accessibility.spec.ts` runs axe-core with the WCAG 2.0/2.1/2.2 A and AA rules on desktop and mobile.

- **Public pages:** home, shop, collections, Sci-Fi, Lab, About, contact, cart, policies, login.
- **Mobile menu.**
- **Admin screens:** dashboard, products, new product, inventory, site editor, new story, page editor, orders, settings, reports, users.

Result on 2026-10-21: **0 violations**. One issue was found and fixed: cyan text on light surfaces was below 4.5:1, so cyan used as text now uses `--color-signal-ink` (5.1:1).

## Built in

- **Navigation:** skip link, a visible focus ring on every control, and a `lang` attribute.
- **Structure:** landmarks (header, nav, main, footer) and one h1 per page.
- **Text:**
  - Contrast tokens are checked in `app/globals.css`.
  - Meaning never depends on color alone (status badges carry text; sold-out sizes are announced).
- **Menus and dialogs:** the menu and search use native `<dialog>`, which traps focus, closes with Escape and makes the background inert.
- **Forms:**
  - Every field has a label.
  - Errors are linked to their field and announced.
  - Typed values are kept after an error.
- **Images:**
  - Admin uploads ask for a description (alt text).
  - The product checklist flags photos without one.
- **Motion:** honors reduced-motion settings.

## Manual checks before launch (with real photos and content)

1. Do the whole purchase with the keyboard only (Tab, Shift+Tab, Enter, Space, arrows).
2. Use a screen reader on the home, product and checkout pages: VoiceOver (macOS/iOS) and TalkBack (Android).
3. Zoom to 200% and 400% (reflow) on the product and checkout pages.
4. Check that every real photo has a meaningful description.
