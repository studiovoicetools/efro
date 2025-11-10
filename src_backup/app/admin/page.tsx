"use client";

import { useState, useEffect } from "react";

interface ShopConfig {
  id: string;
  name: string;
  domain: string;
  primaryColor: string;
  avatarName: string;
  apiKeys: {
    elevenlabs: string;
    mascotbot: string;
    shopify?: string;
  };
  createdAt: string;
  active: boolean;
}

export default function AdminDashboard() {
  const [shops, setShops] = useState<ShopConfig[]>([]);
  const [currentShop, setCurrentShop] = useState<ShopConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Beispiel-Shops für Demo
  const defaultShops: ShopConfig[] = [
    {
      id: "shop-1",
      name: "AvatarSalesPro",
      domain: "avatarsalespro.myshopify.com",
      primaryColor: "#FF6B35",
      avatarName: "Charlie",
      apiKeys: {
        elevenlabs: "",
        mascotbot: "",
        shopify: ""
      },
      createdAt: new Date().toISOString(),
      active: true
    },
    {
      id: "shop-2", 
      name: "FashionStore",
      domain: "fashionstore.myshopify.com",
      primaryColor: "#2EC4B6",
      avatarName: "Max",
      apiKeys: {
        elevenlabs: "",
        mascotbot: "",
        shopify: ""
      },
      createdAt: new Date().toISOString(),
      active: true
    }
  ];

  useEffect(() => {
    // Shops aus localStorage laden (in Praxis: von API)
    const savedShops = localStorage.getItem('avatar-shops');
    if (savedShops) {
      setShops(JSON.parse(savedShops));
    } else {
      setShops(defaultShops);
      localStorage.setItem('avatar-shops', JSON.stringify(defaultShops));
    }
  }, []);

  const saveShop = async (shop: ShopConfig) => {
    setIsLoading(true);
    try {
      // In Praxis: API Call zum Speichern
      const updatedShops = shops.map(s => s.id === shop.id ? shop : s);
      setShops(updatedShops);
      localStorage.setItem('avatar-shops', JSON.stringify(updatedShops));
      
      // API Keys validieren (vereinfacht)
      if (shop.apiKeys.elevenlabs && shop.apiKeys.mascotbot) {
        const isValid = await validateApiKeys(shop.apiKeys);
        if (isValid) {
          alert("✅ Shop-Konfiguration erfolgreich gespeichert und validiert!");
        } else {
          alert("⚠️ Shop gespeichert, aber API Keys könnten ungültig sein.");
        }
      }
      
      setIsEditing(false);
      setCurrentShop(null);
    } catch (error) {
      alert("❌ Fehler beim Speichern der Shop-Konfiguration");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateApiKeys = async (apiKeys: any): Promise<boolean> => {
    // Vereinfachte Validierung - in Praxis echte API Calls
    return apiKeys.elevenlabs.length > 10 && apiKeys.mascotbot.length > 10;
  };

  const addNewShop = () => {
    const newShop: ShopConfig = {
      id: `shop-${Date.now()}`,
      name: "Neuer Shop",
      domain: "mein-shop.myshopify.com",
      primaryColor: "#3B82F6",
      avatarName: "Alex",
      apiKeys: {
        elevenlabs: "",
        mascotbot: "",
        shopify: ""
      },
      createdAt: new Date().toISOString(),
      active: true
    };
    setCurrentShop(newShop);
    setIsEditing(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🛍️ Multi-Shop Avatar Management
          </h1>
          <p className="text-gray-600">
            Verwalte deine Shops und konfiguriere die Voice Avatare
          </p>
        </div>

        {/* Shops Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {shops.map((shop) => (
            <div key={shop.id} className="bg-white rounded-2xl shadow-lg p-6 border-2 border-transparent hover:border-orange-200 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" 
                     style={{ backgroundColor: shop.primaryColor }}>
                  {shop.name.charAt(0)}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  shop.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {shop.active ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{shop.name}</h3>
              <p className="text-gray-600 text-sm mb-1">Domain: {shop.domain}</p>
              <p className="text-gray-600 text-sm mb-4">Avatar: {shop.avatarName}</p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCurrentShop(shop);
                    setIsEditing(true);
                  }}
                  className="flex-1 bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => {
                    // Shop als aktiv setzen
                    const updatedShops = shops.map(s => ({
                      ...s,
                      active: s.id === shop.id
                    }));
                    setShops(updatedShops);
                    localStorage.setItem('avatar-shops', JSON.stringify(updatedShops));
                    alert(`✅ ${shop.name} ist jetzt der aktive Shop`);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Aktivieren
                </button>
              </div>
            </div>
          ))}
          
          {/* Add New Shop Card */}
          <div 
            onClick={addNewShop}
            className="bg-white rounded-2xl shadow-lg p-6 border-2 border-dashed border-gray-300 hover:border-orange-300 hover:bg-orange-50 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px]"
          >
            <div className="text-4xl text-gray-400 mb-2">+</div>
            <div className="text-gray-600 font-medium">Neuen Shop hinzufügen</div>
          </div>
        </div>

        {/* Edit Form */}
        {isEditing && currentShop && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {currentShop.id.startsWith('shop-') ? 'Neuen Shop' : 'Shop'} konfigurieren
                </h2>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shop Name *
                    </label>
                    <input
                      type="text"
                      value={currentShop.name}
                      onChange={(e) => setCurrentShop({...currentShop, name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Mein Shop Name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shop Domain *
                    </label>
                    <input
                      type="text"
                      value={currentShop.domain}
                      onChange={(e) => setCurrentShop({...currentShop, domain: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="mein-shop.myshopify.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Avatar Name *
                    </label>
                    <input
                      type="text"
                      value={currentShop.avatarName}
                      onChange={(e) => setCurrentShop({...currentShop, avatarName: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Charlie"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Primärfarbe *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={currentShop.primaryColor}
                        onChange={(e) => setCurrentShop({...currentShop, primaryColor: e.target.value})}
                        className="w-12 h-12 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        value={currentShop.primaryColor}
                        onChange={(e) => setCurrentShop({...currentShop, primaryColor: e.target.value})}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="#FF6B35"
                      />
                    </div>
                  </div>
                </div>

                {/* API Keys Section */}
                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">API Keys</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ElevenLabs API Key *
                      </label>
                      <input
                        type="password"
                        value={currentShop.apiKeys.elevenlabs}
                        onChange={(e) => setCurrentShop({
                          ...currentShop, 
                          apiKeys: {...currentShop.apiKeys, elevenlabs: e.target.value}
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="sk_..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        MascotBot API Key *
                      </label>
                      <input
                        type="password"
                        value={currentShop.apiKeys.mascotbot}
                        onChange={(e) => setCurrentShop({
                          ...currentShop, 
                          apiKeys: {...currentShop.apiKeys, mascotbot: e.target.value}
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="sk-mascotbot-..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Shopify Admin Token (Optional)
                      </label>
                      <input
                        type="password"
                        value={currentShop.apiKeys.shopify || ''}
                        onChange={(e) => setCurrentShop({
                          ...currentShop, 
                          apiKeys: {...currentShop.apiKeys, shopify: e.target.value}
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="shpat_..."
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setCurrentShop(null);
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    disabled={isLoading}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={() => saveShop(currentShop)}
                    disabled={isLoading || !currentShop.name || !currentShop.domain || !currentShop.avatarName}
                    className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Speichere...' : 'Shop speichern'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

