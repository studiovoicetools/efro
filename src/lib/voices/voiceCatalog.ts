/**
 * EFRO Voice Catalog
 * 
 * NOTE:
 * - Voice-IDs werden über Env-Variablen gesetzt (ElevenLabs Agent IDs).
 * - Später kann der Abonnent im UI eine VoiceKey-Auswahl treffen.
 * - ElevenLabs verwendet agent_id (nicht voice_id direkt).
 */

export type VoiceKey =
  | "de_female_soft_1"
  | "de_female_soft_2"
  | "de_male_confident_1"
  | "de_male_confident_2"
  | "en_male_default"
  | "en_female_default";

export interface VoiceDefinition {
  key: VoiceKey;
  language: "de" | "en";
  agentId: string; // ElevenLabs Agent ID (entspricht der Voice-ID)
  label: string; // für UI-Anzeige später, z. B. "Deutsch – weiblich – soft"
}

/**
 * Voice-Katalog: VoiceKey -> ElevenLabs Agent ID
 * 
 * Env-Variablen:
 * - NEXT_PUBLIC_EFRO_VOICE_DE_FEMALE_SOFT_1: Agent ID für deutsche weibliche weiche Stimme 1
 * - NEXT_PUBLIC_EFRO_VOICE_DE_FEMALE_SOFT_2: Agent ID für deutsche weibliche weiche Stimme 2
 * - NEXT_PUBLIC_EFRO_VOICE_DE_MALE_CONFIDENT_1: Agent ID für deutsche männliche klare Stimme 1
 * - NEXT_PUBLIC_EFRO_VOICE_DE_MALE_CONFIDENT_2: Agent ID für deutsche männliche klare Stimme 2
 * - NEXT_PUBLIC_EFRO_VOICE_EN_MALE_DEFAULT: Agent ID für englische männliche Standard-Stimme
 * - NEXT_PUBLIC_EFRO_VOICE_EN_FEMALE_DEFAULT: Agent ID für englische weibliche Standard-Stimme
 */
export const VOICES: VoiceDefinition[] = [
  {
    key: "de_female_soft_1",
    language: "de",
    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_FEMALE_SOFT_1 ?? process.env.ELEVENLABS_AGENT_ID ?? "",
    label: "Deutsch – weiblich – soft 1",
  },
  {
    key: "de_female_soft_2",
    language: "de",
    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_FEMALE_SOFT_2 ?? process.env.ELEVENLABS_AGENT_ID ?? "",
    label: "Deutsch – weiblich – soft 2",
  },
  {
    key: "de_male_confident_1",
    language: "de",
    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_MALE_CONFIDENT_1 ?? process.env.ELEVENLABS_AGENT_ID ?? "",
    label: "Deutsch – männlich – klar 1",
  },
  {
    key: "de_male_confident_2",
    language: "de",
    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_MALE_CONFIDENT_2 ?? process.env.ELEVENLABS_AGENT_ID ?? "",
    label: "Deutsch – männlich – klar 2",
  },
  {
    key: "en_male_default",
    language: "en",
    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_EN_MALE_DEFAULT ?? process.env.ELEVENLABS_AGENT_ID ?? "",
    label: "English – male – default",
  },
  {
    key: "en_female_default",
    language: "en",
    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_EN_FEMALE_DEFAULT ?? process.env.ELEVENLABS_AGENT_ID ?? "",
    label: "English – female – default",
  },
];

/**
 * Holt eine Voice-Definition anhand des VoiceKeys
 */
export function getVoiceByKey(key: VoiceKey): VoiceDefinition | null {
  const v = VOICES.find((voice) => voice.key === key);
  if (!v || !v.agentId) return null;
  return v;
}

/**
 * Holt die erste gültige Voice als Default
 */
export function getDefaultVoice(): VoiceDefinition | null {
  const v = VOICES.find((voice) => !!voice.agentId);
  return v ?? null;
}

/**
 * Findet einen VoiceKey anhand einer ElevenLabs Agent ID (voiceId)
 * Wird verwendet, um aus shopSettings.voice_id (Agent ID) den VoiceKey zu bestimmen
 */
export function getVoiceKeyByAgentId(agentId: string | null | undefined): VoiceKey | null {
  if (!agentId || agentId.trim().length === 0) {
    return null;
  }
  const voice = VOICES.find((v) => v.agentId === agentId || v.agentId.trim() === agentId.trim());
  return voice?.key ?? null;
}

