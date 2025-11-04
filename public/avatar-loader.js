// ERSTELLE DIESE DATEI: public/avatar-loader.js
(function() {
  'use strict';
  
  console.log('🛍️ Avatar Sales Pro wird geladen...');
  
  // Warten bis die Seite vollständig geladen ist
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAvatar);
  } else {
    initAvatar();
  }
  
  function initAvatar() {
    // Avatar Container erstellen
    const avatarContainer = document.createElement('div');
    avatarContainer.id = 'avatar-sales-pro-container';
    avatarContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      width: 320px;
      height: 400px;
    `;
    
    // Iframe für den Avatar erstellen (sicherere Integration)
    const iframe = document.createElement('iframe');
    iframe.src = `${window.avatarConfig?.baseUrl || 'https://your-domain.com'}/avatar-embed`;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;
    
    avatarContainer.appendChild(iframe);
    document.body.appendChild(avatarContainer);
    
    console.log('✅ Avatar Sales Pro erfolgreich geladen');
    
    // Kommunikation mit der Hauptseite
    window.addEventListener('message', function(event) {
      if (event.data.type === 'AVATAR_ACTION') {
        handleAvatarAction(event.data);
      }
    });
    
    function handleAvatarAction(data) {
      switch(data.action) {
        case 'ADD_TO_CART':
          // Warenkorb API aufrufen
          fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: data.items })
          }).then(response => response.json())
            .then(result => {
              // Erfolgsmeldung zurück an Avatar
              iframe.contentWindow.postMessage({
                type: 'CART_RESPONSE',
                success: true,
                data: result
              }, '*');
            });
          break;
          
        case 'GO_TO_CHECKOUT':
          window.location.href = '/checkout';
          break;
      }
    }
  }
})();