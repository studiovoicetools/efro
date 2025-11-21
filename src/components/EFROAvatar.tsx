"use client";

import { useCallback, useEffect, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { useMascotElevenlabs } from "@mascotbot-sdk/react";

interface EFROAvatarProps {
  onSpeakingChange?: (value: boolean) => void;
  dynamicVariables?: Record<string, any>;
}

export default function EFROAvatar({
  onSpeakingChange,
  dynamicVariables = {},
}: EFROAvatarProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [productDetails, setProductDetails] = useState<any[]>([]);
  const [debugStatus, setDebugStatus] = useState("idle");

  const conversation = useConversation({
    onConnect() {
      setDebugStatus("connected");
    },
    onDisconnect() {
      setDebugStatus("disconnected");
    },
    onError(err) {
      console.error("ELEVEN error:", err);
      setDebugStatus("error");
    },
  });

  const { isIntercepting, isSpeaking } = useMascotElevenlabs({
    conversation,
    naturalLipSync: true,
    naturalLipSyncConfig: {
      minVisemeInterval: 40,
      mergeWindow: 60,
      keyVisemePreference: 0.6,
      preserveSilence: true,
      similarityThreshold: 0.4,
      preserveCriticalVisemes: true,
      criticalVisemeMinDuration: 80,
    },
    gesture: true,
  });

  useEffect(() => {
    onSpeakingChange?.(isSpeaking);
  }, [isSpeaking, onSpeakingChange]);

  async function loadDemoProducts() {
    try {
      const res = await fetch("/api/demo-products");
      const data = await res.json();

      setProducts(data.products || []);
      setProductDetails(data.product_details || []);

      return data;
    } catch (err) {
      console.error("Demo products error:", err);
      return { products: [], product_details: [] };
    }
  }

  async function getSignedUrl() {
    const res = await fetch("/api/get-signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dynamicVariables }),
    });

    if (!res.ok) {
      console.error("Signed URL error:", await res.text());
      return null;
    }

    const data = await res.json();
    return data.signedUrl;
  }

  const start = useCallback(async () => {
    try {
      setDebugStatus("connecting");
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const signedUrl = await getSignedUrl();
      const demo = await loadDemoProducts();

      if (!signedUrl) {
        console.error("No signedUrl returned");
        setDebugStatus("error");
        return;
      }

      await conversation.startSession({
        signedUrl,
        dynamicVariables: {
          language: "de",
          userName: dynamicVariables.userName || "Evren",
          products: demo.products || [],
          product_details: demo.product_details || [],
        },
        enableTalkingAnimations: true,
      });

      setDebugStatus("connected");
    } catch (err) {
      console.error("Start session error:", err);
      setDebugStatus("error");
    }
  }, [conversation, dynamicVariables]);

  const stop = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("End session error:", err);
    }
    setDebugStatus("disconnected");
  }, [conversation]);

  return (
    <>
      <div className="fixed top-4 left-4 bg-black/80 text-white p-4 rounded-xl text-sm font-mono z-50 space-y-1">
        <div>Status: {debugStatus}</div>
        <div>LipSync: {isIntercepting ? "yes" : "no"}</div>
        <div>Speaking: {isSpeaking ? "yes" : "no"}</div>
        <div>Products: {products.length}</div>
      </div>

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <button
          onClick={start}
          className="bg-orange-500 text-white px-6 py-3 rounded-lg shadow"
        >
          Mit EFRO sprechen
        </button>

        <button
          onClick={stop}
          className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg shadow"
        >
          Auflegen
        </button>
      </div>
    </>
  );
}
