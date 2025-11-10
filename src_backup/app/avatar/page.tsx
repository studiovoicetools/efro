'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function AvatarPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoading(false);

      // Beispiel: Sprachausgabe per Web Speech API (lokal ohne ElevenLabs)
      const msg = new SpeechSynthesisUtterance(
        'Hallo! Ich bin EFRO, dein smarter Verkaufsassistent. Frag mich, wie ich deinen Umsatz steigern kann!'
      );
      msg.lang = 'de-DE';
      speechSynthesis.speak(msg);
    };

    init();
  }, []);

  return (
    <div
      style={{
        backgroundColor: '#000',
        color: '#fff',
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {loading ? (
        <p>Lade EFRO...</p>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: '280px',
              height: '280px',
              borderRadius: '50%',
              objectFit: 'cover',
              boxShadow: '0 0 20px rgba(255,255,255,0.4)',
            }}
          >
            <source src="/videos/efro.mp4" type="video/mp4" />
          </video>

          <h2 style={{ marginTop: '20px', fontSize: '24px' }}>Ich bin EFRO ğŸ¼</h2>
          <p style={{ maxWidth: '500px', lineHeight: 1.5 }}>
            Dein virtueller Verkaufsprofi â€“ bereit, Produkte zu zeigen, Fragen zu beantworten
            und deine Conversion zu steigern!
          </p>
        </>
      )}
    </div>
  );
}
