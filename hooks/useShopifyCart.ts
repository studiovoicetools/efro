// ERSTELLE DIESE DATEI: hooks/useShopifyCart.ts
import { useState, useEffect } from 'react';

export function useShopifyCart() {
  const [cart, setCart] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Warenkorb abrufen
  const getCart = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/cart.js');
      const cartData = await response.json();
      setCart(cartData);
      return cartData;
    } catch (error) {
      console.error('Warenkorb laden fehlgeschlagen:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Produkt zum Warenkorb hinzufügen
  const addToCart = async (variantId: string, quantity: number = 1) => {
    try {
      setIsLoading(true);
      
      // Shopify Cart API Call
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{ 
            id: variantId, 
            quantity: quantity 
          }]
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        await getCart(); // Warenkorb aktualisieren
        console.log('✅ Produkt im Warenkorb:', result);
        return { success: true, data: result };
      } else {
        throw new Error('Hinzufügen fehlgeschlagen');
      }
    } catch (error) {
      console.error('❌ Warenkorb-Fehler:', error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  // Zum Checkout gehen
  const goToCheckout = () => {
    window.location.href = '/checkout';
  };

  // Warenkorb beim Start laden
  useEffect(() => {
    // Nur im Browser ausführen
    if (typeof window !== 'undefined') {
      getCart();
    }
  }, []);

  return { 
    cart, 
    addToCart, 
    goToCheckout, 
    getCart,
    isLoading 
  };
}
