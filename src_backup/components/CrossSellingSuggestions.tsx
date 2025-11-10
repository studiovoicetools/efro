// components/CrossSellingSuggestions.tsx

"use client";

import React, { useState, useEffect } from "react";


interface CrossSellingProps {
  currentProduct: any;
  onProductSelect: (product: any) => void;
}

export function CrossSellingSuggestions({ currentProduct, onProductSelect }: CrossSellingProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    fetchCrossSellingProducts(currentProduct);
  }, [currentProduct]);

  const fetchCrossSellingProducts = async (product: any) => {
    try {
      // Basierend auf Tags/Kategorie verwandte Produkte finden
      const response = await fetch(`/api/shopify-products?category=${product.tags}&limit=3`);
      const data = await response.json();
      
      if (data.success) {
        // Aktuelles Produkt ausschließen
        const filtered = data.products.filter((p: any) => p.id !== product.id);
        setSuggestions(filtered);
      }
    } catch (error) {
      console.error('Cross-Selling Fehler:', error);
    }
  };

  if (!suggestions.length) return null;

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
      <h4 className="font-semibold text-blue-800 mb-2">💡 Passend dazu:</h4>
      <div className="space-y-2">
        {suggestions.map((product) => (
          <div 
            key={product.id}
            onClick={() => onProductSelect(product)}
            className="flex items-center gap-3 p-2 bg-white rounded-lg border border-blue-100 hover:shadow-sm transition-shadow cursor-pointer"
          >
            <img 
              src={product.imageUrl} 
              alt={product.title}
              className="w-10 h-10 rounded-md object-cover"
            />
            <div className="flex-1">
              <p className="text-xs font-medium">{product.title}</p>
              <p className="text-xs text-green-600 font-bold">{product.price} €</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

