'use client';

"use client";

import { useState, useEffect } from "react";

const pricingPlans = [
  {
    tier: 'basic',
    name: 'Basic',
    price: '299â‚¬',
    period: 'einmalig',
    description: 'Perfekt fÃ¼r kleine Shops und Starter',
    features: [
      'Avatar spricht & zeigt Produkte',
      'Bis zu 10 Produkte',
      'Standard Sprachausgabe',
      'Shopify Integration'
    ],
    buttonText: 'Basic AuswÃ¤hlen',
    popular: false
  },
  {
    tier: 'pro', 
    name: 'Pro',
    price: '699â‚¬',
    period: 'einmalig',
    description: 'Ideal fÃ¼r wachsende Shops',
    features: [
      'Alles aus Basic',
      'Unbegrenzte Produkte', 
      'Spracherkennung (STT)',
      'Cross-Selling & Upselling',
      'Emotionale Sprachmodulation',
      'Mehrsprachig (DE/EN/TR)'
    ],
    buttonText: 'Pro AuswÃ¤hlen',
    popular: true
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: '999â‚¬',
    period: 'pro Monat',
    description: 'KomplettlÃ¶sung fÃ¼r Marken',
    features: [
      'Alles aus Pro',
      'Multi-Store Support',
      'Kunden-Analyse & Chat-Logs',
      'Eigene Voice & Gestik',
      'DSGVO Dashboard',
      'Priority Support',
      'White-Label Option'
    ],
    buttonText: 'Enterprise Kontakt',
    popular: false
  }
];

export default function BillingPage() {
  const [currentShop, setCurrentShop] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');

  useEffect(() => {
    // Shop aus URL-Parameter holen
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop') || 'mein-shop.myshopify.com';
    setCurrentShop(shop);
  }, []);

  const handleUpgrade = async (planTier: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop: currentShop,
          plan: planTier,
          returnUrl: window.location.origin + '/admin/success'
        })
      });

      const data = await response.json();
      
      if (response.ok && data.confirmationUrl) {
        // Zur Shopify ZahlungsbestÃ¤tigung weiterleiten
        window.location.href = data.confirmationUrl;
      } else {
        alert('Fehler bei der Abo-Buchung: ' + (data.error || 'Unbekannter Fehler'));
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es spÃ¤ter erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AIVA Avatar Abonnements
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            WÃ¤hlen Sie das perfekte Paket fÃ¼r Ihren Shopify Store. 
            Steigern Sie Ihre Conversion Rate mit unserem KI-Verkaufsavatar.
          </p>
        </div>

        {/* Aktueller Shop */}
        <div className="text-center mb-8">
          <div className="inline-block bg-white rounded-lg shadow-sm px-6 py-3 border">
            <span className="text-gray-600">Aktueller Shop:</span>
            <span className="font-semibold ml-2 text-orange-600">{currentShop}</span>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan) => (
            <div
              key={plan.tier}
              className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all hover:scale-105 ${
                plan.popular 
                  ? 'border-orange-500 shadow-xl' 
                  : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Beliebt
                  </span>
                </div>
              )}
              
              <div className="p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline justify-center mb-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {plan.price}
                    </span>
                    <span className="text-gray-600 ml-2">
                      {plan.period}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.tier)}
                  disabled={isLoading}
                  className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-colors ${
                    plan.popular
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoading ? 'Wird verarbeitet...' : plan.buttonText}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Enterprise Contact */}
        <div className="text-center mt-16 bg-white rounded-2xl shadow-lg p-8 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Enterprise LÃ¶sung benÃ¶tigt?
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            FÃ¼r individuelle Anforderungen, Multi-Store Setup oder White-Label LÃ¶sungen 
            kontaktieren Sie unser Sales-Team fÃ¼r ein maÃŸgeschneidertes Angebot.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
              ğŸ“ Sales kontaktieren
            </button>
            <button className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
              ğŸ“§ Demo anfragen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


