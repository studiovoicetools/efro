// components/ShopifyProductPageAvatar.tsx
"use client";

import { useEffect, useState } from "react";
import { MascotProvider, MascotRive } from "mascotbot-sdk-react";

export function ShopifyProductPageAvatar() {
  const [currentProduct, setCurrentProduct] = useState<any>(null);

  useEffect(() => {
    // Shopify Produktdaten von der aktuellen Seite abrufen
    const productData = {
      title: document.querySelector('.product-title')?.textContent || '',
      price: document.querySelector('.product-price')?.textContent || '',
      image: document.querySelector('.product-image')?.getAttribute('src') || '',
      handle: window.location.pathname.split('/').pop() || ''
    };
    
    setCurrentProduct(productData);
  }, []);

  const addToCart = async () => {
    // Shopify Cart API Call
    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{
            id: currentProduct?.variantId, // Variante ID benÃ¶tigt
            quantity: 1
          }]
        })
      });
      
      if (response.ok) {
        console.log('âœ… Produkt im Warenkorb');
        // Avatar spricht BestÃ¤tigung
      }
    } catch (error) {
      console.error('âŒ Warenkorb-Fehler:', error);
    }
  };

  return (
    <MascotProvider>
      <div className="fixed bottom-4 right-4 z-50">
        <div className="w-64 h-64 bg-white/95 backdrop-blur-md border-2 border-orange-200 shadow-2xl rounded-2xl overflow-hidden">
          <MascotRive />
        </div>
        
        {currentProduct && (
          <div className="mt-4 p-4 bg-white/95 rounded-2xl border-2 border-orange-200">
            <button 
              onClick={addToCart}
              className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
            >
              ğŸ›’ In den Warenkorb
            </button>
            
            {/* Cross-Selling VorschlÃ¤ge */}
            <div className="mt-3 text-sm text-gray-600">
              <p>ğŸ’¡ Charlie empfiehlt dieses Produkt!</p>
            </div>
          </div>
        )}
      </div>
    </MascotProvider>
  );
}

