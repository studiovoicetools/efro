/**
 * EFRO Voice Demo Helper
 * 
 * Nutzt den Golden-Conversation-Flow für Voice-Previews im Onboarding.
 * Diese Funktion startet eine temporäre Conversation-Session, spricht einen Demo-Text
 * mit Lipsync, und beendet die Session wieder.
 * 
 * WICHTIG: Diese Funktion nutzt exakt dieselbe Pipeline wie die normale Avatar-Seller-Konversation.
 */

import { getRandomDemoPhrase } from "@/lib/voices/demoPhrases";
import type { VoiceKey } from "@/lib/voices/voiceCatalog";
import type { EfroAvatarId } from "@/lib/efro/mascotConfig";

/**
 * Typ für Conversation-Instanz (von @elevenlabs/react)
 */
export type ConversationInstance = {
  startSession: (config: any) => Promise<void>;
  endSession: () => Promise<void>;
  sendUserMessage?: (text: string) => void | Promise<void>;
};

/**
 * Spielt eine Demo-Phrase für einen Avatar mit der gewählten Stimme ab.
 * Nutzt den Golden-Conversation-Flow (inkl. Lipsync).
 * 
 * @param conversation - Die Conversation-Instanz (von useConversation Hook)
 * @param options - Avatar-ID und gewählte Voice
 * @returns Promise, das resolved, wenn die Demo abgespielt wurde
 */
export async function playDemoPhraseForAvatar(
  conversation: ConversationInstance,
  options: {
    avatarId: EfroAvatarId;
    preferredVoiceKey?: VoiceKey | null;
  }
): Promise<void> {
  const text = getRandomDemoPhrase("intro");
  
  console.log("[EFRO Demo] playDemoPhraseForAvatar", {
    avatarId: options.avatarId,
    preferredVoiceKey: options.preferredVoiceKey,
    text: text.substring(0, 50),
  });

  try {
    // 1) Signed URL mit korrekter Voice holen
    const response = await fetch("/api/get-signed-url-seller", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dynamicVariables: {
          avatarId: options.avatarId,
          preferredVoiceKey: options.preferredVoiceKey ?? null,
          source: "onboarding-demo",
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[EFRO Demo] Failed to get signed URL", {
        status: response.status,
        error: errorData,
      });
      throw new Error("Failed to get signed URL for demo");
    }

    const { signedUrl } = await response.json();
    if (!signedUrl) {
      throw new Error("No signedUrl returned");
    }

    console.log("[EFRO Demo] Starting session with signed URL");

    // 2) Session starten (wie im Golden-Flow)
    await conversation.startSession({
      signedUrl,
      dynamicVariables: {
        avatarId: options.avatarId,
        preferredVoiceKey: options.preferredVoiceKey ?? null,
        language: "de",
        source: "onboarding-demo",
      },
    });

    // 3) Kurz warten, damit die Session stabil ist
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 4) Demo-Text sprechen (exakt wie im Golden-Flow)
    const phrase = `Bitte sprich genau folgenden Satz und füge nichts hinzu: "${text}"`;
    
    const sendUserMessage = (conversation as any)?.sendUserMessage;
    if (typeof sendUserMessage === "function") {
      console.log("[EFRO Demo] Sending demo text to ElevenLabs", {
        text: phrase.substring(0, 50),
      });
      
      const maybePromise = sendUserMessage(phrase);
      if (maybePromise && typeof (maybePromise as any).then === "function") {
        // Warte, bis die Nachricht gesendet wurde
        await maybePromise;
      }
      
      // Warte zusätzlich, damit Audio abgespielt werden kann
      // (Demo-Phrase ist ca. 3-5 Sekunden lang)
      await new Promise((resolve) => setTimeout(resolve, 6000));
    } else {
      console.warn("[EFRO Demo] sendUserMessage nicht verfügbar");
    }

    // 5) Session beenden (optional - kann auch offen bleiben)
    // await conversation.endSession();
    
    console.log("[EFRO Demo] Demo phrase completed");
  } catch (error: any) {
    console.error("[EFRO Demo] playDemoPhraseForAvatar error", error);
    throw error;
  }
}

