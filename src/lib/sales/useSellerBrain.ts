// src/lib/sales/useSellerBrain.ts
"use client";

import { useMemo, useState } from "react";
import {
  EfroProduct,
  ShoppingIntent,
} from "@/lib/products/mockCatalog";
import { getRecommendationsForIntent } from "@/lib/products/recommendationEngine";
import { buildSalesMessage, SalesMessage } from "@/lib/sales/salesCopy";

export type CartItem = {
  product: EfroProduct;
  quantity: number;
};

export type SellerBrainState = {
  intent: ShoppingIntent;
  setIntent: (intent: ShoppingIntent) => void;

  recommendedProducts: EfroProduct[];
  salesMessage: SalesMessage;

  cart: CartItem[];
  cartTotal: number;

  addToCart: (product: EfroProduct) => void;
  removeOneFromCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
};

export function useSellerBrain(initialIntent: ShoppingIntent = "quick_buy"): SellerBrainState {
  const [intent, setIntent] = useState<ShoppingIntent>(initialIntent);
  const [cart, setCart] = useState<CartItem[]>([]);

  function addToCart(product: EfroProduct) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function removeOneFromCart(productId: string) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === productId);
      if (!existing) return prev;

      if (existing.quantity <= 1) {
        return prev.filter((item) => item.product.id !== productId);
      }

      return prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) =>
      prev.filter((item) => item.product.id !== productId)
    );
  }

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      ),
    [cart]
  );

  const recommendedProducts = useMemo(
    () => getRecommendationsForIntent(intent, 3),
    [intent]
  );

  const salesMessage = useMemo(
    () => buildSalesMessage(intent, recommendedProducts),
    [intent, recommendedProducts]
  );

  return {
    intent,
    setIntent,
    recommendedProducts,
    salesMessage,
    cart,
    cartTotal,
    addToCart,
    removeOneFromCart,
    removeFromCart,
  };
}
