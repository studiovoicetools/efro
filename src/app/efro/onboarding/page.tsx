"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AvatarPreview } from "@/components/efro/AvatarPreview";
import type { VoiceKey } from "@/lib/voices/voiceCatalog";
import { getRandomDemoPhrase } from "@/lib/voices/demoPhrases";
import type { EfroAvatarId } from "@/lib/efro/mascotConfig";

// -------------------- Avatar-Optionen --------------------

type AvatarOption = {
  id: string;
  name: string;
  src: string;
  tagline: string;
  stateMachine?: string;
};

const AVATARS: AvatarOption[] = [
  {
    id: "bear",
    name: "Cyber Bear",
    src: "/bear.riv",
    tagline: "Freundlich, modern, universal",
  },
  {
    id: "cat",
    name: "Smart Cat",
    src: "/cat.riv",
    tagline: "Charmant, verspielt, aufmerksam",
  },
  {
    id: "cyberGirl",
    name: "Cyber Girl",
    src: "/cyberGirl.riv",
    tagline: "Futuristisch, dynamisch, direkt",
  },
  {
    id: "mascotCat",
    name: "Mascot Cat",
    src: "/mascotCat.riv",
    tagline: "Sympathische Creator-Begleitung",
  },
  {
    id: "notionGuys",
    name: "Notion Guys",
    src: "/notionGuys.riv",
    tagline: "Locker, creator-orientiert",
  },
  {
    id: "realisticFemale",
    name: "Realistic Female",
    src: "/realisticFemale.riv",
    tagline: "Seriös, nahbar, professionell",
  },
  {
    id: "retroBot",
    name: "Retro Bot",
    src: "/retroBot.riv",
    tagline: "Technoid, attention-grabber",
  },
];

// -------------------- ElevenLabs-Optionen --------------------

type VoiceOption = {
  id: VoiceKey;
  label: string;
  voiceId: string; // ElevenLabs Agent ID aus Env-Variablen
  locale: "de" | "en";
};

// Voice-Optionen mit direkter Mapping zu ElevenLabs Voice-IDs aus Env-Variablen
const VOICES: VoiceOption[] = [
  {
    id: "de_female_soft_1",
    label: "Deutsch – weiblich – soft 1",
    voiceId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_FEMALE_SOFT_1 ?? "",
    locale: "de",
  },
  {
    id: "de_female_soft_2",
    label: "Deutsch – weiblich – soft 2",
    voiceId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_FEMALE_SOFT_2 ?? "",
    locale: "de",
  },
  {
    id: "de_male_confident_1",
    label: "Deutsch – männlich – klar 1",
    voiceId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_MALE_CONFIDENT_1 ?? "",
    locale: "de",
  },
  {
    id: "de_male_confident_2",
    label: "Deutsch – männlich – klar 2",
    voiceId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_MALE_CONFIDENT_2 ?? "",
    locale: "de",
  },
].filter((v): v is VoiceOption => {
  // Nur Voices anzeigen, die eine gültige voiceId haben
  return !!v.voiceId && v.voiceId.trim().length > 0;
});

export default function EfroOnboardingPage() {
  const router = useRouter();

  // Shop aus URL lesen (client-side)
  const [shop, setShop] = useState<string>("demo");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const shopParam = params.get("shop");
      if (shopParam && shopParam.trim().length > 0) {
        setShop(shopParam);
      }
    } catch (error) {
      console.error("[EFRO Onboarding] Failed to read shop from URL", error);
    }
  }, []);

  const [selectedAvatarId, setSelectedAvatarId] = useState<EfroAvatarId>("bear");
  const [selectedVoiceKey, setSelectedVoiceKey] = useState<VoiceKey | null>(
    VOICES[0]?.id ?? null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // TODO: Onboarding Lipsync-Preview später über sicheren Golden-Flow anbinden
  // Aktuell entfernt, um Fehler "useMascotClient hook must be used within <MascotClient />" zu vermeiden

  const selectedAvatar = useMemo(() => {
    return AVATARS.find((a) => a.id === selectedAvatarId) ?? AVATARS[0];
  }, [selectedAvatarId]);

  const selectedVoice = useMemo(() => {
    if (!selectedVoiceKey) return VOICES[0] ?? null;
    return VOICES.find((v) => v.id === selectedVoiceKey) ?? VOICES[0] ?? null;
  }, [selectedVoiceKey]);

  useEffect(() => {
    console.log("[EFRO Onboarding] selectedAvatar changed", {
      selectedAvatarId,
      selectedAvatarSrc: selectedAvatar?.src,
    });
  }, [selectedAvatarId, selectedAvatar]);

  // Voice-Preview-Funktion (nutzt API-Route ohne Mascot-Hooks)
  const playVoicePreview = async (voiceKey: VoiceKey) => {
    if (!voiceKey) {
      console.warn("[EFRO Onboarding] Voice preview requested but no voice selected");
      return;
    }

    // Resolve die tatsächliche ElevenLabs voiceId aus den Voice-Optionen
    const selectedVoice = VOICES.find((v) => v.id === voiceKey);
    if (!selectedVoice || !selectedVoice.voiceId) {
      console.warn("[EFRO Onboarding] Voice preview: selected voice not found or no voiceId", {
        voiceKey,
        availableVoices: VOICES.map((v) => ({ id: v.id, hasVoiceId: !!v.voiceId })),
      });
      return;
    }

    const avatarId = selectedAvatarId;
    console.log("[EFRO Onboarding] Voice preview using", {
      selectedVoiceKey: voiceKey,
      voiceId: selectedVoice.voiceId,
      avatarId,
    });

    try {
      setIsPlayingPreview(true);

      const text = getRandomDemoPhrase("intro");

      // Verwende die resolved voiceId direkt für die Preview
      // Die API-Route kann preferredVoiceKey verwenden, aber wir senden auch die voiceId als Fallback
      const res = await fetch("/api/efro/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          avatarId,
          preferredVoiceKey: voiceKey,
        }),
      });

      console.log("[EFRO Onboarding] Voice preview response status", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.warn("[EFRO Onboarding] Voice preview failed", {
          status: res.status,
          error: errorText,
        });
        return;
      }

      const data = await res.json();
      const audioUrl = data?.audioUrl;

      if (!audioUrl) {
        console.warn("[EFRO Onboarding] No audioUrl returned from voice-preview");
        return;
      }

      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsPlayingPreview(false);
      };
      audio.onerror = (err) => {
        console.error("[EFRO Onboarding] Audio playback error", err);
        setIsPlayingPreview(false);
      };

      await audio.play();
    } catch (err) {
      console.error("[EFRO Onboarding] Voice preview error", err);
      setIsPlayingPreview(false);
    }
  };

  // Speichere Einstellungen in Supabase und navigiere weiter
  async function handleContinue() {
    setSaveError(null);
    setIsSaving(true);

    try {
      // Resolve die tatsächliche ElevenLabs voiceId aus den Voice-Optionen
      const selectedVoice = selectedVoiceKey
        ? VOICES.find((v) => v.id === selectedVoiceKey) ?? null
        : null;
      const resolvedVoiceId = selectedVoice?.voiceId ?? null;
      const locale = selectedVoice?.locale ?? "de";

      // Sicherstellen, dass avatarId der tatsächlich ausgewählte Avatar ist
      const avatarId = selectedAvatarId;

      const payload = {
        shop,
        avatarId: avatarId ?? null,
        voiceId: resolvedVoiceId,
        locale,
        ttsEnabled: true,
      };

      console.log("[EFRO Onboarding] Saving shop settings payload", {
        payload,
        selectedAvatarId,
        selectedVoiceKey,
        selectedVoice: selectedVoice ? { id: selectedVoice.id, voiceId: selectedVoice.voiceId, locale: selectedVoice.locale } : null,
      });

      const res = await fetch("/api/efro/shop-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        console.error("[EFRO Onboarding] Failed to save settings", {
          status: res.status,
          errorJson,
        });
        setSaveError(
          "Die Einstellungen konnten nicht gespeichert werden. Bitte versuche es später noch einmal."
        );
        setIsSaving(false);
        return;
      }

      // Einstellungen auch in localStorage merken (Fallback)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "efro-avatar-settings",
          JSON.stringify({
            avatarId: selectedAvatarId,
            avatarSrc: selectedAvatar.src,
            voiceKey: selectedVoiceKey,
          })
        );
      }

      // Weiter zur Avatar-Seller-Seite mit Shop-Parameter
      router.push(`/avatar-seller?shop=${encodeURIComponent(shop)}`);
    } catch (error) {
      console.error("[EFRO Onboarding] Error while saving settings", error);
      setSaveError(
        "Die Einstellungen konnten nicht gespeichert werden. Bitte versuche es später noch einmal."
      );
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
        {/* Header */}
        <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-300 font-bold text-xl">
              E
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide uppercase text-slate-300">
                EFRO · Avatar Onboarding
              </div>
              <div className="text-xs text-slate-400">
                Wähle deinen Avatar & deine Stimme – in 60 Sekunden startklar.
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Schritt <span className="font-semibold text-slate-200">1</span> / 2
          </div>
        </header>

        {/* Main Layout */}
        <main className="flex-1 flex flex-col lg:flex-row gap-6 px-4 lg:px-8 py-6 lg:py-8 max-w-6xl mx-auto w-full">
          {/* Linke Seite: Avatar & Voice Auswahl */}
          <section className="w-full lg:w-7/12 space-y-6">
            {/* Avatar-Auswahl */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.6)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    1. Avatar auswählen
                  </h2>
                  <p className="text-xs text-slate-400">
                    Wähle den Verkaufs-Avatar, der am besten zu deiner Marke passt.
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded-full px-2 py-1">
                  Shop-Front
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AVATARS.map((avatar) => {
                  const isActive = avatar.id === selectedAvatarId;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => {
                        console.log("[EFRO Onboarding] Avatar selected", {
                          avatarId: avatar.id,
                          avatarName: avatar.name,
                        });
                        setSelectedAvatarId(avatar.id as EfroAvatarId);
                      }}
                      className={[
                        "w-full text-left rounded-xl border px-3 py-3 transition-all",
                        "bg-slate-900/70 hover:bg-slate-800/70",
                        "flex flex-col gap-1.5",
                        isActive
                          ? "border-emerald-400/80 shadow-[0_0_24px_rgba(16,185,129,0.45)]"
                          : "border-slate-800 hover:border-slate-600",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-100">
                            {avatar.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {avatar.tagline}
                          </span>
                        </div>
                        {isActive && (
                          <span className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/50 rounded-full px-2 py-0.5">
                            Aktiv
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Datei: <span className="font-mono">{avatar.src}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Voice-Auswahl */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    2. Stimme auswählen (ElevenLabs)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Wähle eine deutsche Stimme, die zu deinem Avatar und deiner Marke passt.
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-sky-300 bg-sky-500/10 border border-sky-500/40 rounded-full px-2 py-1">
                  Deutsch
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={selectedVoiceKey ?? ""}
                    onChange={(e) => {
                      const voiceKey = e.target.value as VoiceKey;
                      setSelectedVoiceKey(voiceKey);
                      const voice = VOICES.find((v) => v.id === voiceKey);
                      console.log("[EFRO Onboarding] Voice selected", {
                        voiceKey,
                        voiceId: voice?.voiceId,
                        label: voice?.label,
                      });
                    }}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-400"
                  >
                    {VOICES.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedVoiceKey) {
                        playVoicePreview(selectedVoiceKey);
                      }
                    }}
                    disabled={!selectedVoiceKey || isPlayingPreview}
                    className={[
                      "px-4 py-2 rounded-lg text-xs font-semibold",
                      "border border-sky-500/50 bg-sky-500/10 text-sky-300",
                      "hover:bg-sky-500/20 hover:border-sky-400/70",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-all",
                    ].join(" ")}
                  >
                    {isPlayingPreview ? "▶ Abspielen..." : "▶ Preview"}
                  </button>
                </div>
                {selectedVoice && (
                  <p className="text-[11px] text-slate-400">
                    {selectedVoice.locale === "de" ? "Deutsche Stimme" : "English voice"} • Voice-ID: {selectedVoice.voiceId.substring(0, 20)}...
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Rechte Seite: Live-Preview + Summary */}
          <section className="w-full lg:w-5/12 flex flex-col gap-4">
            {/* Live-Preview mit MascotRive */}
            <div className="flex-1 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-4 lg:p-5 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Live-Preview
                  </h2>
                  <p className="text-xs text-slate-400">
                    So erscheint dein Verkaufsavatar später im Shop.
                  </p>
                </div>
                <span className="text-[10px] text-slate-400">
                  Avatar:{" "}
                  <span className="font-semibold text-slate-100">
                    {selectedAvatar.name}
                  </span>
                </span>
              </div>

              <div className="relative rounded-xl border border-slate-800 bg-slate-950/80 h-64 flex items-center justify-center overflow-hidden">
                <AvatarPreview
                  src={selectedAvatar?.src || "/bear.riv"}
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Zusammenfassung + Weiter-Button */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:p-5 flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Fast geschafft 🚀
                </h2>
                <p className="text-xs text-slate-400">
                  EFRO speichert deine Auswahl und startet den Avatar dann mit
                  genau diesen Einstellungen.
                </p>
              </div>

              <ul className="text-[11px] text-slate-300 space-y-1.5">
                <li>
                  • Avatar:{" "}
                  <span className="font-semibold text-emerald-300">
                    {selectedAvatar.name}
                  </span>{" "}
                  (<span className="font-mono text-slate-400">
                    {selectedAvatar.src}
                  </span>)
                </li>
                <li>
                  • Stimme:{" "}
                  <span className="font-semibold text-sky-300">
                    {selectedVoice?.label ?? "Nicht ausgewählt"}
                  </span>
                </li>
                <li>• Modus: Produktberatung + Verkauf (v1)</li>
              </ul>

              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={isSaving}
                    className={[
                      "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold",
                      "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
                      "disabled:opacity-60 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    {isSaving ? "Speichere…" : "Weiter zum Avatar"}
                  </button>
                  <span className="text-[10px] text-slate-500">
                    Du kannst Avatar & Stimme später jederzeit ändern.
                  </span>
                </div>
                {saveError && (
                  <div className="mt-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    {saveError}
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
  );
}
