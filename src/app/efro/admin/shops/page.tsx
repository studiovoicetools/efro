// src/app/efro/admin/shops/page.tsx

"use client";

import { useEffect, useState } from "react";

type EfroShopRow = {
  id: string;
  shop_domain: string;
  brand_name: string | null;
  main_category: string | null;
  target_audience: string | null;
  price_level: string | null;
  language: string | null;
  country: string | null;
  currency: string | null;
  tone_of_voice: string | null;
  plan: string | null;
  onboarding_status: string | null;
  installed_at: string | null;
  last_seen_at: string | null;
  created_at?: string;
};

type FormState = {
  shopDomain: string;
  brandName: string;
  mainCategory: string;
  targetAudience: string;
  priceLevel: string;
  language: string;
  country: string;
  currency: string;
  toneOfVoice: string;
  plan: string;
};

const EMPTY_FORM: FormState = {
  shopDomain: "",
  brandName: "",
  mainCategory: "",
  targetAudience: "",
  priceLevel: "",
  language: "de",
  country: "",
  currency: "",
  toneOfVoice: "",
  plan: "starter",
};

export default function EfroShopsAdminPage() {
  const [shops, setShops] = useState<EfroShopRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  // Shops laden
  const loadShops = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/efro/shops", { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Fehler beim Laden der Shops: ${text}`);
      }

      const json = await res.json();
      setShops(json.shops ?? []);
    } catch (err: any) {
      console.error("[EfroShopsAdmin] loadShops error", err);
      setError(err?.message || "Unbekannter Fehler beim Laden der Shops");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, []);

  // Formular ändern
  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Bestehenden Shop in Formular laden
  const handleSelectShop = (row: EfroShopRow) => {
    setSelectedShopId(row.id);
    setForm({
      shopDomain: row.shop_domain || "",
      brandName: row.brand_name || "",
      mainCategory: row.main_category || "",
      targetAudience: row.target_audience || "",
      priceLevel: row.price_level || "",
      language: row.language || "de",
      country: row.country || "",
      currency: row.currency || "",
      toneOfVoice: row.tone_of_voice || "",
      plan: row.plan || "starter",
    });
    setSuccess(null);
    setError(null);
  };

  // Neues Formular
  const handleNewShop = () => {
    setSelectedShopId(null);
    setForm(EMPTY_FORM);
    setSuccess(null);
    setError(null);
  };

  // Speichern (nutzt /api/efro/onboard-shop)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.shopDomain.trim()) {
      setError("shopDomain darf nicht leer sein.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/efro/onboard-shop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shopDomain: form.shopDomain.trim(),
          brandName: form.brandName.trim() || null,
          mainCategory: form.mainCategory.trim() || null,
          targetAudience: form.targetAudience.trim() || null,
          priceLevel: form.priceLevel.trim() || null,
          language: form.language.trim() || "de",
          country: form.country.trim() || null,
          currency: form.currency.trim() || null,
          toneOfVoice: form.toneOfVoice.trim() || null,
          plan: form.plan.trim() || "starter",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Fehler beim Speichern: ${text}`);
      }

      const json = await res.json();
      setSuccess(`Shop gespeichert: ${json.shopDomain}`);
      setSelectedShopId(json.data?.id ?? selectedShopId);

      // Liste neu laden
      await loadShops();
    } catch (err: any) {
      console.error("[EfroShopsAdmin] handleSave error", err);
      setError(err?.message || "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              EFRO – Shop Onboarding & Metadaten
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Hier siehst du alle Shops aus Supabase (Tabelle{" "}
              <code className="text-xs bg-slate-800 px-1 rounded">
                efro_shops
              </code>
              ) und kannst sie bearbeiten oder neue Shops anlegen.
            </p>
          </div>
          <button
            onClick={handleNewShop}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-sm font-medium hover:bg-emerald-400 transition"
          >
            + Neuer Shop
          </button>
        </header>

        {/* Status-Messages */}
        {(error || success || loading || saving) && (
          <div className="space-y-2">
            {error && (
              <div className="rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                {success}
              </div>
            )}
            {(loading || saving) && (
              <div className="text-xs text-slate-400">
                {loading && "Lade Shops …"}
                {saving && "Speichere Shop …"}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Liste der Shops */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Vorhandene Shops</h2>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 max-h-[520px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-2 border-b border-slate-800">
                      Shop-Domain
                    </th>
                    <th className="text-left px-3 py-2 border-b border-slate-800">
                      Brand
                    </th>
                    <th className="text-left px-3 py-2 border-b border-slate-800">
                      Plan
                    </th>
                    <th className="text-left px-3 py-2 border-b border-slate-800">
                      Status
                    </th>
                    <th className="text-left px-3 py-2 border-b border-slate-800 whitespace-nowrap">
                      Installiert
                    </th>
                    <th className="text-left px-3 py-2 border-b border-slate-800 whitespace-nowrap">
                      Zuletzt aktiv
                    </th>
                    <th className="px-3 py-2 border-b border-slate-800" />
                  </tr>
                </thead>
                <tbody>
                  {shops.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-4 text-center text-slate-500 text-sm"
                      >
                        Noch keine Shops angelegt.
                      </td>
                    </tr>
                  )}
                  {shops.map((shop) => (
                    <tr
                      key={shop.id}
                      className={
                        "border-b border-slate-800/80 hover:bg-slate-900/60 transition " +
                        (selectedShopId === shop.id
                          ? "bg-slate-900/80"
                          : "")
                      }
                    >
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {shop.shop_domain}
                      </td>
                      <td className="px-3 py-2">
                        {shop.brand_name || (
                          <span className="text-slate-500">–</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {shop.plan ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 border border-emerald-500/60 text-emerald-300 bg-emerald-500/10">
                            {shop.plan}
                          </span>
                        ) : (
                          <span className="text-slate-500">–</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {shop.onboarding_status ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 border border-sky-500/60 text-sky-300 bg-sky-500/10">
                            {shop.onboarding_status}
                          </span>
                        ) : (
                          <span className="text-slate-500">–</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-300">
                        {shop.installed_at
                          ? new Date(shop.installed_at).toLocaleString()
                          : "–"}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-300">
                        {shop.last_seen_at
                          ? new Date(shop.last_seen_at).toLocaleString()
                          : "–"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleSelectShop(shop)}
                          className="text-xs px-3 py-1 rounded-md border border-slate-700 hover:bg-slate-800"
                        >
                          Bearbeiten
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Formular */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              {selectedShopId ? "Shop bearbeiten" : "Neuen Shop anlegen"}
            </h2>
            <form
              onSubmit={handleSave}
              className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  Shop-Domain (z. B. <code>test-shop.myshopify.com</code>)
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  value={form.shopDomain}
                  onChange={(e) => updateField("shopDomain", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">Brand Name</label>
                <input
                  type="text"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  value={form.brandName}
                  onChange={(e) => updateField("brandName", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">Hauptkategorie</label>
                <input
                  type="text"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  value={form.mainCategory}
                  onChange={(e) => updateField("mainCategory", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  Zielgruppe / Audience
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  value={form.targetAudience}
                  onChange={(e) =>
                    updateField("targetAudience", e.target.value)
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">
                    Preislevel (z. B. niedrig / mittel / hoch)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                    value={form.priceLevel}
                    onChange={(e) => updateField("priceLevel", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300">
                    Sprache (z. B. de / en)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                    value={form.language}
                    onChange={(e) => updateField("language", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Land</label>
                  <input
                    type="text"
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                    value={form.country}
                    onChange={(e) => updateField("country", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300">
                    Währung (z. B. EUR / USD)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                    value={form.currency}
                    onChange={(e) => updateField("currency", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  Tonfall / Tone of Voice
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  value={form.toneOfVoice}
                  onChange={(e) =>
                    updateField("toneOfVoice", e.target.value)
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  Plan (starter / pro / enterprise)
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  value={form.plan}
                  onChange={(e) => updateField("plan", e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleNewShop}
                  className="px-3 py-2 rounded-lg border border-slate-700 text-xs hover:bg-slate-800"
                >
                  Formular leeren
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-xs font-semibold hover:bg-emerald-400 disabled:opacity-60"
                >
                  {saving ? "Speichern …" : "Shop speichern (Upsert)"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
