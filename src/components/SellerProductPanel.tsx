"use client";

import React, { useEffect, useState } from "react";
import type { EfroProduct } from "@/lib/products/mockCatalog";
import EFROProductCards from "./EFROProductCards";

type SellerProductPanelProps = {
  shopDomain: string;
};

export default function SellerProductPanel({ shopDomain }: SellerProductPanelProps) {
  const [products, setProducts] = useState<EfroProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const shopParam = encodeURIComponent(shopDomain || "local-dev");
        const res = await fetch(`/api/efro/debug-products?shop=${shopParam}`);
        if (!res.ok) {
          const text = await res.text();
          console.error("EFRO debug-products error:", res.status, text);
          setError("Produkte konnten nicht geladen werden.");
          setProducts([]);
          return;
        }

        const data = await res.json();
        const list = (data.products || []) as EfroProduct[];
        setProducts(list);
      } catch (err) {
        console.error("EFRO debug-products error:", err);
        setError("Produkte konnten nicht geladen werden.");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [shopDomain]);

  return (
    <div className="w-full h-full">
      <h2 className="text-xl font-semibold mb-4">EFRO Produktvorschau</h2>
      {loading && <p>Produkte werden geladen...</p>}
      {error && !loading && <p>{error}</p>}
      {!loading && !error && <EFROProductCards products={products} />}
    </div>
  );
}
