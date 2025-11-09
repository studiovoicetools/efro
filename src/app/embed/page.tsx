'use client';

import { useEffect, useState } from 'react';
import {
  MascotProvider,
  MascotRive,
  useMascotElevenlabs,
} from '@mascotbot-sdk/react';
import { useConversation } from '@elevenlabs/react';

export default function EmbedTestPage() {
  const [phase, setPhase] = useState<'intro' | 'select' | 'show'>('intro');
  const [category, setCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);

  // 🔊 Voice setup (uses your ElevenLabs API key from env)
  const { speak, stop } = useMascotElevenlabs({
    voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
    modelId: 'eleven_multilingual_v2',
    autoConnect: true,
  });

  // 🎙️ Basic chatbot conversation
  const { startSession } = useConversation({
    apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY!,
  });

  useEffect(() => {
    if (phase === 'intro') {
      const greeting =
        'Hey! Ich bin Efro – dein smarter Verkaufsavatar. Sag mir, in welcher Kategorie du Produkte verkaufst, und ich zeige dir ein Beispiel.';
      speak(greeting);
      setTimeout(() => setPhase('select'), 9000);
    }
  }, [phase]);

  const categories = [
    { name: 'Elektronik', emoji: '🔌' },
    { name: 'Haushalt', emoji: '🏠' },
    { name: 'Mode', emoji: '👗' },
    { name: 'Tiere', emoji: '🐾' },
    { name: 'Beauty', emoji: '💄' },
  ];

  const fetchProducts = async (cat: string) => {
    try {
      const res = await fetch(`/api/demo/products?category=${encodeURIComponent(cat)}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
        setPhase('show');
        speak(`Hier sind einige Produkte aus der Kategorie ${cat}.`);
      } else {
        speak('Ich konnte keine Produkte finden. Bitte versuche eine andere Kategorie.');
      }
    } catch {
      speak('Es gab ein Problem beim Abrufen der Daten.');
    }
  };

  return (
    <MascotProvider
      mascotApiKey={process.env.NEXT_PUBLIC_MASCOTBOT_API_KEY!}
      elevenlabsApiKey={process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY!}
    >
      <div
        style={{
          fontFamily: 'Poppins, sans-serif',
          textAlign: 'center',
          background: '#f8fafc',
          color: '#222',
          minHeight: '100vh',
          padding: '40px 20px',
        }}
      >
        <MascotRive
          src="/mascots/efro.riv"
          fit="contain"
          alignment="center"
          width={220}
          height={220}
          style={{ margin: '0 auto 20px' }}
        />

        <h1 style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🤖 EFRO Demo</h1>
        <p style={{ fontSize: '1.2rem', marginBottom: '30px' }}>
          Dein KI-Verkaufsassistent in Aktion
        </p>

        {phase === 'select' && (
          <div>
            <p style={{ fontSize: '1.1rem', marginBottom: '20px' }}>
              Wähle eine Kategorie, um zu sehen, wie Efro deine Produkte präsentiert:
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '15px',
              }}
            >
              {categories.map((c) => (
                <button
                  key={c.name}
                  onClick={() => fetchProducts(c.name)}
                  style={{
                    padding: '15px 25px',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#007bff',
                    color: '#fff',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: '0.3s',
                  }}
                >
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'show' && products.length > 0 && (
          <div style={{ marginTop: '40px' }}>
            <h2>🛍️ Kategorie: {category}</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '20px',
                marginTop: '20px',
              }}
            >
              {products.map((p, i) => (
                <div
                  key={i}
                  style={{
                    background: '#fff',
                    borderRadius: '14px',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.1)',
                    padding: '20px',
                  }}
                >
                  <img
                    src={p.featuredImage || p.featuredimage || ''}
                    alt={p.title}
                    style={{
                      width: '100%',
                      borderRadius: '10px',
                      marginBottom: '10px',
                      height: '180px',
                      objectFit: 'cover',
                    }}
                  />
                  <h3>{p.title}</h3>
                  <p style={{ fontWeight: 'bold' }}>{p.price} €</p>
                  <p style={{ fontSize: '0.9rem', color: '#666' }}>{p.vendor}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MascotProvider>
  );
}
