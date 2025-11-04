// AIVA Avatar Embed Script für Shopify Stores
(function() {
  'use strict';
  
  // Konfiguration
  const config = {
    appUrl: 'https://deine-app-url.vercel.app',
    avatarName: 'Charlie',
    position: 'bottom-right',
    theme: 'default'
  };
  
  // Avatar Container erstellen
  function createAvatarContainer() {
    const existingContainer = document.getElementById('aiva-avatar-container');
    if (existingContainer) return existingContainer;
    
    const container = document.createElement('div');
    container.id = 'aiva-avatar-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      width: 320px;
      height: 320px;
      border: none;
      background: transparent;
      pointer-events: auto;
    `;
    
    const iframe = document.createElement('iframe');
    iframe.src = `${config.appUrl}?shop=${window.Shopify.shop}`;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      background: transparent;
    `;
    iframe.allow = 'microphone';
    
    container.appendChild(iframe);
    document.body.appendChild(container);
    
    return container;
  }
  
  // Avatar initialisieren
  function initAvatar() {
    // Warte bis Shopify geladen ist
    if (typeof window.Shopify === 'undefined') {
      setTimeout(initAvatar, 100);
      return;
    }
    
    const container = createAvatarContainer();
    
    // Responsive Anpassungen
    function handleResize() {
      if (window.innerWidth < 768) {
        container.style.width = '280px';
        container.style.height = '280px';
        container.style.bottom = '10px';
        container.style.right = '10px';
      } else {
        container.style.width = '320px';
        container.style.height = '320px';
        container.style.bottom = '20px';
        container.style.right = '20px';
      }
    }
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    console.log('🚀 AIVA Avatar erfolgreich geladen für:', window.Shopify.shop);
  }
  
  // Script starten wenn DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAvatar);
  } else {
    initAvatar();
  }
  
})();