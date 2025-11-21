document.addEventListener("DOMContentLoaded", function () {
  if (!window.EFRO_CONFIG) return;

  const container = document.getElementById("efro-avatar-container");
  if (!container) return;

  const iframe = document.createElement("iframe");
  iframe.src = window.EFRO_CONFIG.endpoint + "/?shop=" + window.EFRO_CONFIG.shop;
  iframe.style.position = "fixed";
  iframe.style.bottom = "20px";
  iframe.style.right = "20px";
  iframe.style.width = "420px";
  iframe.style.height = "600px";
  iframe.style.border = "none";
  iframe.style.zIndex = "999999";

  container.appendChild(iframe);
});
