(async () => {
  console.log("EFRO Shopify Avatar starting…");

  // ---------- 1. Avatar Platzieren ----------
  const avatarContainer = document.createElement("div");
  avatarContainer.id = "efro-avatar";
  avatarContainer.style.position = "fixed";
  avatarContainer.style.bottom = "20px";
  avatarContainer.style.right = "20px";
  avatarContainer.style.width = "270px";
  avatarContainer.style.height = "360px";
  avatarContainer.style.zIndex = "999999";
  document.body.appendChild(avatarContainer);

  // ---------- 2. MascotBot laden ----------
  const mascotScript = document.createElement("script");
  mascotScript.src = "https://cdn.jsdelivr.net/npm/@mascotbot-sdk/web";
  document.head.appendChild(mascotScript);

  mascotScript.onload = () => {
    new MascotBot.Avatar({
      element: "#efro-avatar",
      riveUrl: "https://efro-prod.onrender.com/avatars/bear.riv"
    });
  };

  // ---------- 3. Realtime Token von deinem Backend ----------
  const tokenRes = await fetch(
    "https://efro-prod.onrender.com/api/get-realtime-token"
  );
  const { token } = await tokenRes.json();

  // ---------- 4. WebRTC Verbindung aufbauen ----------
  const pc = new RTCPeerConnection();

  const audio = document.createElement("audio");
  audio.autoplay = true;
  document.body.appendChild(audio);

  pc.ontrack = (event) => {
    audio.srcObject = event.streams[0];
  };

  // Mikrofon
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const answerResponse = await fetch(
    "https://api.elevenlabs.io/v1/convai/conversation/offer",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp"
      },
      body: offer.sdp
    }
  );

  const answerSDP = await answerResponse.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

  console.log("🎉 EFRO Avatar Connected via Realtime Voice!");

  // ---------- 5. Shopify Basisdaten vorbereiten ----------

  // aktuelle Produktseite?
  let productTitle = document.querySelector("h1")?.innerText || null;

  // Multi-Produktdaten
  const productsJson = await fetch("/products.json").then(r => r.json());

  // Warenkorb
  const cart = await fetch("/cart.js").then(r => r.json());

  // Sende Daten an deinen Avatar Backend (optional)
  await fetch("https://efro-prod.onrender.com/api/shopify-sync", {
    method: "POST",
    body: JSON.stringify({
      productTitle,
      products: productsJson?.products || [],
      cart
    })
  });

  console.log("🛒 Shopify data ready for EFRO.");
})();
