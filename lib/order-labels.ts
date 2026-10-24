/** Plain-language order states for screens. */
export const PAY_LABEL: Record<string, string> = {
  pending: "Awaiting payment",
  authorized: "Authorized",
  paid: "Paid",
  partially_refunded: "Partly refunded",
  refunded: "Refunded",
  failed: "Failed",
  canceled: "Canceled",
};
export const SHIP_LABEL: Record<string, string> = { unfulfilled: "Not shipped", partially_shipped: "Partly shipped", shipped: "Shipped", delivered: "Delivered", returned: "Returned" };
