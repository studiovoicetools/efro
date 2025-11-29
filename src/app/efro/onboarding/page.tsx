"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MascotProvider } from "@mascotbot-sdk/react";
import { AvatarPreview } from "@/components/efro/AvatarPreview";

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
  id: string;
  name: string;
  description: string;
};

// IDs sind Platzhalter – bitte später mit deinen echten ElevenLabs-Voice-IDs ersetzen.
const VOICES: VoiceOption[] = [
  {
    id: "de-female-1",
    name: "Deutsch – Weiblich 1",
    description: "Klar, freundlich, standard",
  },
  {
    id: "de-male-1",
    name: "Deutsch – Männlich 1",
    description: "Ruhig, seriös, neutral",
  },
  {
    id: "de-female-2",
    name: "Deutsch – Weiblich 2",
    description: "Etwas dynamischer, werblich",
  },
];

export default function EfroOnboardingPage() {
  const router = useRouter();

  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("bear");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(VOICES[0]?.id ?? "de-female-1");
  const [isSaving, setIsSaving] = useState(false);

  const selectedAvatar = useMemo(() => {
    return AVATARS.find((a) => a.id === selectedAvatarId) ?? AVATARS[0];
  }, [selectedAvatarId]);

  const selectedVoice = useMemo(() => {
    return VOICES.find((v) => v.id === selectedVoiceId) ?? VOICES[0];
  }, [selectedVoiceId]);

  useEffect(() => {
    console.log("[EFRO Onboarding] selectedAvatar changed", {
      selectedAvatarId,
      selectedAvatarSrc: selectedAvatar?.src,
    });
  }, [selectedAvatarId, selectedAvatar]);

  // Hier kannst du später z. B. in Supabase speichern oder in localStorage
  async function handleContinue() {
    try {
      setIsSaving(true);

      // Beispiel: Einstellungen in localStorage merken (einfacher Start)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "efro-avatar-settings",
          JSON.stringify({
            avatarId: selectedAvatarId,
            avatarSrc: selectedAvatar.src,
            voiceId: selectedVoiceId,
          })
        );
      }

      // Weiter zur Avatar-Seller-Seite
      router.push("/avatar-seller");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <MascotProvider>
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
                      onClick={() => setSelectedAvatarId(avatar.id)}
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
                <select
                  value={selectedVoiceId}
                  onChange={(e) => setSelectedVoiceId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-400"
                >
                  {VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
                {selectedVoice && (
                  <p className="text-[11px] text-slate-400">
                    {selectedVoice.description}
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
                    {selectedVoice?.name}
                  </span>
                </li>
                <li>• Modus: Produktberatung + Verkauf (v1)</li>
              </ul>

              <div className="flex items-center justify-between mt-2">
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
            </div>
          </section>
        </main>
      </div>
    </MascotProvider>
  );
}
