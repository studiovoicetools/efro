/**
 * EFRO Gate-2 Commerce Actions – minimal contract (stable + testable).
 * Scope requirement (Shopify Admin): write_draft_orders,read_draft_orders
 */

export type CommerceActionType =
  | "CREATE_DRAFT_ORDER_CHECKOUT"
  | "UPDATE_DRAFT_ORDER_LINE_QTY";

export type CreateDraftOrderCheckoutAction = {
  type: "CREATE_DRAFT_ORDER_CHECKOUT";
  /**
   * Shopify variantId (Admin API GraphQL uses gid format:
   * gid://shopify/ProductVariant/1234567890)
   */
  variantId: string;
  quantity: number;
  /**
   * Optional: discount in percent (0-100). Keep minimal for now.
   */
  discountPercent?: number | null;
  /**
   * Optional: customer email (if you already have it).
   */
  email?: string | null;
};

export type UpdateDraftOrderLineQtyAction = {
  type: "UPDATE_DRAFT_ORDER_LINE_QTY";
  draftOrderId: string; // gid://shopify/DraftOrder/...
  lineItemUuid: string; // DraftOrder line item uuid (NOT gid)
  quantity: number;
};

export type CommerceAction =
  | CreateDraftOrderCheckoutAction
  | UpdateDraftOrderLineQtyAction;

export type CommerceActionRequest = {
  shop: string; // myshopify domain
  correlationId?: string | null;
  action: CommerceAction;
};

export type CommerceActionResponse = {
  ok: boolean;
  shop: string;
  correlationId: string;
  actionType: CommerceActionType;
  result?: unknown;
  error?: string;
};
