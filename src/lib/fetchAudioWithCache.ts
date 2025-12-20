import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generiert oder ruft gecachtes Audio & Viseme-JSON ab.
 * Spart ElevenLabs API-Aufrufe.
 */
export async function fetchAudioWithCache(
  shopDomain: string,
  text: string,
  generator: () => Promise<{ audioBuffer: Buffer; visemeJson?: any }>
): Promise<{ audioUrl: string; visemeJson?: any }> {

  const textHash = crypto.createHash("sha256").update(text).digest("hex");

  // 1ï¸âƒ£ PrÃ¼fen, ob Cache-Eintrag existiert
  const { data } = await supabase
    .from("cache_audio")
    .select("*")
    .eq("shop_domain", shopDomain)
    .eq("text_hash", textHash)
    .maybeSingle();

  if (data?.audio_url) {
    console.log("âš¡ Audio-Cache-Treffer:", text.slice(0, 40));
    return { audioUrl: data.audio_url, visemeJson: data.viseme_json ? JSON.parse(data.viseme_json) : undefined };
  }

  // 2ï¸âƒ£ Kein Treffer â†’ Generator ausfÃ¼hren (ElevenLabs-API)
  const { audioBuffer, visemeJson } = await generator();

  // 3ï¸âƒ£ Datei temporÃ¤r speichern
  const fileName = `audio-${textHash}.mp3`;
  const localPath = path.join("/tmp", fileName);
  fs.writeFileSync(localPath, audioBuffer);

  // 4ï¸âƒ£ Hochladen in Supabase Storage (Bucket: public/audio)
  const { data: upload, error: uploadErr } = await supabase.storage
    .from("public")
    .upload(`audio/${fileName}`, fs.createReadStream(localPath), {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadErr) throw uploadErr;

  const audioUrl = `${supabaseUrl}/storage/v1/object/public/${upload.path}`;

  // 5ï¸âƒ£ In Cache-Tabelle speichern
  await supabase.from("cache_audio").upsert({
    shop_domain: shopDomain,
    text_hash: textHash,
    audio_url: audioUrl,
    viseme_json: visemeJson ? JSON.stringify(visemeJson) : null,
  });

  console.log("ğŸ’¾ Audio gecacht:", text.slice(0, 40));
  return { audioUrl, visemeJson };
}
