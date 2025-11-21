"use client";

import { useEffect, useState } from "react";
import {
  MascotProvider,
  MascotClient,
  MascotRive,
  Fit,
  Alignment,
} from "@mascotbot-sdk/react";

/** ----------------------------------------
 *  Konfiguration
 * -------------------------------------- */

type AvatarOption = {
  id: string;
  name: string;
  src: string;      // Pfad in /public
  tagline: string;  // Kurztext unter dem Namen
};

type VoiceOption = {
  id: string;
  name: string;
  description: string;
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
    tagline: "Sympathischer Brand-Charakter",
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
    tagline: "Serios, nahbar, professionell",
  },
  {
    id: "retroBot",
    name: "Retro Bot",
    src: "/retroBot.riv",
    tagline: "Technoid, attention-grabber",
  },
];

const VOICES: VoiceOption[] = [
  {
    id: "voice_de_male_1", // TODO: echte ElevenLabs Voice-ID eintragen
    name: "Deutsch – Maennlich, klar",
    description: "Klar, ruhig, seriös. Ideal fuer Tech- und B2B-Shops.",
  },
  {
    id: "voice_de_female_1", // TODO: echte ElevenLabs Voice-ID eintragen
    name: "Deutsch – Weiblich, warm",
    description: "Freundlich, warm, perfekt fuer Lifestyle & Fashion.",
  },
  {
    id: "voice_de_energy_1", // TODO: echte ElevenLabs Voice-ID eintragen
    name: "Deutsch – High Energy",
    description: "Energiegeladen, ideal fuer Aktionen & Sales-Push.",
  },
];

type Step = 1 | 2 | 3;

type SavedConfig = {
  avatarId: string;
  avatarSrc: string;
  voiceId: string | null;
  voiceName: string | null;
};

/** ----------------------------------------
 *  Helper
 * -------------------------------------- */

const STORAGE_KEY = "efroAvatarConfig";

function loadConfig(): SavedConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedConfig;
  } catch {
    return null;
  }
}

function saveConfig(cfg: SavedConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

/** ----------------------------------------
 *  Onboarding Page
 * -------------------------------------- */

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption | null>(
    AVATARS[0] ?? null
  );
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);

  // geladenes config uebernehmen
  useEffect(() => {
    const cfg = loadConfig();
    if (!cfg) return;

    const avatar = AVATARS.find((a) => a.id === cfg.avatarId);
    const voice = VOICES.find((v) => v.id === cfg.voiceId);

    if (avatar) setSelectedAvatar(avatar);
    if (voice) setSelectedVoice(voice);
  }, []);

  const goNext = () => {
    setStep((s) => (s === 3 ? 3 : ((s + 1) as Step)));
  };

  const goBack = () => {
    setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));
  };

  const handlePreviewVoice = async (voice: VoiceOption) => {
    try {
      setPreviewPlaying(voice.id);
      const audio = new Audio(`/api/voice-preview?voiceId=${voice.id}`);
      audio.onended = () => setPreviewPlaying(null);
      audio.onerror = () => setPreviewPlaying(null);
      await audio.play();
    } catch {
      setPreviewPlaying(null);
      alert("Stimmvorschau konnte nicht abgespielt werden.");
    }
  };

  const handleFinish = async () => {
    if (!selectedAvatar) {
      alert("Bitte einen Avatar waehlen.");
      return;
    }
    setIsSaving(true);
    try {
      saveConfig({
        avatarId: selectedAvatar.id,
        avatarSrc: selectedAvatar.src,
        voiceId: selectedVoice?.id ?? null,
        voiceName: selectedVoice?.name ?? null,
      });
      setStep(3);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MascotProvider>
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-6xl rounded-3xl bg-slate-900/80 border border-slate-700/70 shadow-[0_0_40px_rgba(0,0,0,0.7)] backdrop-blur-xl overflow-hidden flex flex-col md:flex-row">
          {/* Left: Big Avatar Preview */}
          <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-slate-800 relative flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_theme(colors.cyan.500/20),_transparent_60%),radial-gradient(circle_at_bottom,_theme(colors.violet.500/20),_transparent_60%)]" />
            <div className="relative z-10 flex flex-col items-center gap-4 py-10 px-4">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300/80 mb-1">
                Step {step} / 3
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 text-center">
                Baue deinen EFRO Sales Avatar
              </h1>
              <p className="text-sm text-slate-300/80 text-center max-w-md">
                Waehle zuerst eine Figur, dann eine Stimme.  
                EFRO fuehrt danach vollautomatisch Verkaufsgespraeche in deinem Shopify Shop.
              </p>

              <div className="mt-4 w-64 h-64 md:w-80 md:h-80 rounded-3xl bg-slate-950/80 border border-cyan-500/40 shadow-[0_0_60px_rgba(34,211,238,0.25)] overflow-hidden flex items-center justify-center">
                {selectedAvatar && (
                  <MascotClient
                    src={selectedAvatar.src}
                    artboard="Character"
                    layout={{
                      fit: Fit.Contain,
                      alignment: Alignment.Center,
                    }}
                  >
                    <MascotRive />
                  </MascotClient>
                )}
              </div>

              {selectedAvatar && (
                <div className="mt-4 text-center">
                  <div className="text-lg font-semibold text-cyan-200">
                    {selectedAvatar.name}
                  </div>
                  <div className="text-xs text-slate-300/80">
                    {selectedAvatar.tagline}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Steps */}
          <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col gap-6">
            {/* Step indicator */}
            <div className="flex items-center gap-3 text-xs">
              {["Avatar", "Stimme", "Fertig"].map((label, index) => {
                const stepIndex = (index + 1) as Step;
                const active = step === stepIndex;
                const done = step > stepIndex;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div
                      className={[
                        "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border",
                        active
                          ? "bg-cyan-500 text-slate-900 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.7)]"
                          : done
                          ? "bg-emerald-500 text-slate-900 border-emerald-400"
                          : "bg-slate-800 text-slate-300 border-slate-600",
                      ].join(" ")}
                    >
                      {index + 1}
                    </div>
                    <span
                      className={
                        active
                          ? "text-cyan-200"
                          : done
                          ? "text-emerald-200"
                          : "text-slate-400"
                      }
                    >
                      {label}
                    </span>
                    {index < 2 && (
                      <div className="w-6 h-px bg-gradient-to-r from-slate-600 to-slate-700" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Content per step */}
            <div className="flex-1 overflow-y-auto pr-1">
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-50">
                    Waehle deine Figur
                  </h2>
                  <p className="text-sm text-slate-300/80">
                    Diese Figur wird in deinem Shop unten rechts sichtbar sein
                    und Kunden aktiv ansprechen.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {AVATARS.map((avatar) => {
                      const active =
                        selectedAvatar && selectedAvatar.id === avatar.id;
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setSelectedAvatar(avatar)}
                          className={[
                            "relative rounded-2xl border px-3 py-3 text-left transition-all duration-150",
                            "bg-slate-900/80 hover:bg-slate-800/80",
                            active
                              ? "border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.6)]"
                              : "border-slate-700",
                          ].join(" ")}
                        >
                          <div className="text-sm font-semibold text-slate-50 mb-1">
                            {avatar.name}
                          </div>
                          <div className="text-xs text-slate-300/80">
                            {avatar.tagline}
                          </div>
                          {active && (
                            <div className="absolute right-3 top-3 text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/90 text-slate-900 font-semibold">
                              Aktiv
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-50">
                    Stimme fuer deinen Avatar
                  </h2>
                  <p className="text-sm text-slate-300/80">
                    Diese Auswahl betrifft aktuell die <b>Vorschau</b>.  
                    Die produktive Verkaufsstimme stellst du spaeter im EFRO Backend
                    bzw. direkt im ElevenLabs Agent ein.
                  </p>

                  <div className="space-y-3 mt-3">
                    {VOICES.map((voice) => {
                      const active =
                        selectedVoice && selectedVoice.id === voice.id;
                      return (
                        <div
                          key={voice.id}
                          className={[
                            "rounded-2xl border px-3 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between",
                            "bg-slate-900/80",
                            active
                              ? "border-violet-400 shadow-[0_0_25px_rgba(139,92,246,0.6)]"
                              : "border-slate-700",
                          ].join(" ")}
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-50">
                              {voice.name}
                            </div>
                            <div className="text-xs text-slate-300/80">
                              {voice.description}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2 md:mt-0">
                            <button
                              type="button"
                              onClick={() => setSelectedVoice(voice)}
                              className={[
                                "px-3 py-1 rounded-xl text-xs font-semibold border",
                                active
                                  ? "bg-violet-500 text-slate-50 border-violet-300"
                                  : "bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700",
                              ].join(" ")}
                            >
                              {active ? "Ausgewaehlt" : "Waehlen"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePreviewVoice(voice)}
                              className="px-3 py-1 rounded-xl text-xs font-semibold border border-cyan-400 text-cyan-200 hover:bg-cyan-500/10"
                              disabled={previewPlaying === voice.id}
                            >
                              {previewPlaying === voice.id
                                ? "Spielt..."
                                : "Vorschau"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-50">
                    Setup gespeichert
                  </h2>
                  <p className="text-sm text-slate-300/80">
                    Deine Auswahl wurde lokal gespeichert.  
                    Die Hauptseite deines EFRO Avatars laedt nun die
                    gewaehlte Figur automatisch.
                  </p>

                  <div className="mt-3 rounded-2xl border border-emerald-400/70 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    <div className="font-semibold mb-1">
                      Aktuelle Konfiguration
                    </div>
                    <ul className="text-xs space-y-1">
                      <li>
                        <span className="text-slate-300/80">
                          Avatar:&nbsp;
                        </span>
                        {selectedAvatar?.name ?? "–"}
                      </li>
                      <li>
                        <span className="text-slate-300/80">
                          Stimme (Preview):&nbsp;
                        </span>
                        {selectedVoice?.name ?? "Standard-Agent"}
                      </li>
                    </ul>
                  </div>

                  <p className="text-xs text-slate-400/80">
                    Naechster Schritt: Teste deinen Avatar auf{" "}
                    <code className="px-1 py-0.5 rounded bg-slate-800/80 border border-slate-700">
                      /
                    </code>{" "}
                    (Startseite).  
                    EFRO nutzt dort automatisch den gewaehlten Avatar.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-600 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
              >
                Zurueck
              </button>

              {step < 3 && (
                <div className="flex gap-2">
                  {step === 1 && (
                    <button
                      type="button"
                      onClick={goNext}
                      className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.6)] hover:bg-cyan-400"
                    >
                      Weiter zu Stimme
                    </button>
                  )}
                  {step === 2 && (
                    <button
                      type="button"
                      onClick={handleFinish}
                      disabled={isSaving}
                      className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.6)] hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {isSaving ? "Speichere..." : "Konfiguration speichern"}
                    </button>
                  )}
                </div>
              )}

              {step === 3 && (
                <button
                  type="button"
                  onClick={() => (window.location.href = "/")}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-violet-500 text-slate-50 shadow-[0_0_20px_rgba(139,92,246,0.6)] hover:bg-violet-400"
                >
                  Avatar jetzt im Shop testen
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </MascotProvider>
  );
}
