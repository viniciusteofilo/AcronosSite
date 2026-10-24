/** Formats an integer amount in minor units (cents) for display. */
export function formatMoney(amountMinor: number, currency: string, locale = "en-US"): string {
  const digits = new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amountMinor / 10 ** digits,
  );
}
