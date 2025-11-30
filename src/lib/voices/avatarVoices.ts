/**
 * EFRO Avatar-Voice-Zuordnung
 * 
 * Definiert, welche Stimmen für welchen Avatar verfügbar sind.
 */

import type { VoiceKey } from "./voiceCatalog";
import { getVoiceByKey, getDefaultVoice } from "./voiceCatalog";
import type { EfroAvatarId } from "@/lib/efro/mascotConfig";

export interface AvatarVoiceSettings {
  avatarId: EfroAvatarId;
  defaultVoiceKey: VoiceKey;
  allowedVoiceKeys: VoiceKey[];
}

/**
 * Avatar-Voice-Mapping
 * 
 * Jeder Avatar hat:
 * - defaultVoiceKey: Standard-Stimme für diesen Avatar
 * - allowedVoiceKeys: Liste der erlaubten VoiceKeys für diesen Avatar
 */
export const AVATAR_VOICE_SETTINGS: AvatarVoiceSettings[] = [
  {
    avatarId: "bear",
    defaultVoiceKey: "de_male_confident_1",
    allowedVoiceKeys: ["de_male_confident_1", "de_female_soft_1"],
  },
  {
    avatarId: "cat",
    defaultVoiceKey: "de_female_soft_1",
    allowedVoiceKeys: ["de_female_soft_1", "de_male_confident_1"],
  },
  {
    avatarId: "cyberGirl",
    defaultVoiceKey: "de_female_soft_1",
    allowedVoiceKeys: ["de_female_soft_1", "de_male_confident_1"],
  },
  {
    avatarId: "mascotCat",
    defaultVoiceKey: "de_female_soft_1",
    allowedVoiceKeys: ["de_female_soft_1", "de_male_confident_1"],
  },
  {
    avatarId: "notionGuys",
    defaultVoiceKey: "de_male_confident_1",
    allowedVoiceKeys: ["de_male_confident_1", "de_female_soft_1"],
  },
  {
    avatarId: "realisticFemale",
    defaultVoiceKey: "de_female_soft_1",
    allowedVoiceKeys: ["de_female_soft_1", "de_male_confident_1"],
  },
  {
    avatarId: "retroBot",
    defaultVoiceKey: "de_male_confident_1",
    allowedVoiceKeys: ["de_male_confident_1", "de_female_soft_1", "en_male_default"],
  },
  // TODO: weitere Avatare ergänzen
];

/**
 * Holt die Voice-Settings für einen Avatar
 */
export function getAvatarVoiceSettings(avatarId: EfroAvatarId): AvatarVoiceSettings | null {
  return AVATAR_VOICE_SETTINGS.find((a) => a.avatarId === avatarId) ?? null;
}

/**
 * Resolver: Bestimmt die zu verwendende Voice für einen Avatar
 * 
 * Später:
 * - preferredVoiceKey kommt aus den Abo-Einstellungen (Shop-/User-Config).
 * - Im Moment kann es hart übergeben oder aus einem Default-State kommen.
 */

export interface VoiceResolveInput {
  avatarId: EfroAvatarId;
  preferredVoiceKey?: VoiceKey | null; // kommt später aus den Abo-Einstellungen
}

export interface VoiceResolveResult {
  agentId: string; // ElevenLabs Agent ID
  voiceKey: VoiceKey | null;
}

export function resolveVoiceForAvatar(input: VoiceResolveInput): VoiceResolveResult {
  const { avatarId, preferredVoiceKey } = input;

  console.log("[EFRO VoiceResolve] Input", {
    avatarId,
    preferredVoiceKey,
  });

  const avatarSettings = getAvatarVoiceSettings(avatarId);

  // 1) Versuche preferredVoiceKey, wenn erlaubt und gültig
  if (preferredVoiceKey && avatarSettings?.allowedVoiceKeys.includes(preferredVoiceKey)) {
    const v = getVoiceByKey(preferredVoiceKey);
    if (v) {
      console.log("[EFRO VoiceResolve] Using preferred voice", {
        avatarId,
        preferredVoiceKey,
        agentId: v?.agentId,
      });
      return { agentId: v.agentId, voiceKey: v.key };
    }
  }

  // 2) Fallback: Avatar-Default
  if (avatarSettings) {
    const v = getVoiceByKey(avatarSettings.defaultVoiceKey);
    if (v) {
      console.log("[EFRO VoiceResolve] Using avatar default voice", {
        avatarId,
        defaultVoiceKey: avatarSettings?.defaultVoiceKey,
        agentId: v?.agentId,
      });
      return { agentId: v.agentId, voiceKey: v.key };
    }
  }

  // 3) Fallback: globale Default-Voice
  const defaultVoice = getDefaultVoice();
  if (defaultVoice) {
    console.log("[EFRO VoiceResolve] Using global default voice", {
      avatarId,
      agentId: defaultVoice?.agentId,
      voiceKey: defaultVoice?.key,
    });
    return { agentId: defaultVoice.agentId, voiceKey: defaultVoice.key };
  }

  // 4) Ultimativer Fallback: Leerer Wert (sollte nicht passieren) – Caller muss reagieren
  console.warn("[EFRO VoiceResolve] No usable voice resolved", {
    avatarId,
    preferredVoiceKey,
  });
  return { agentId: "", voiceKey: null };
}

