(function () {
  const script = document.createElement("script");
  script.src = "https://dev.avatarsalespro.com/efro-sdk.js";
  script.defer = true;
  document.head.appendChild(script);

  script.onload = () => {
    console.log("EFRO SDK loaded.");

    // Avatar Container
    const root = document.getElementById("efro-avatar-root");
    if (!root) return;

    // Create iframe
    const iframe = document.createElement("iframe");
    iframe.src = "https://dev.avatarsalespro.com/embed";
    iframe.style.position = "fixed";
    iframe.style.bottom = "20px";
    iframe.style.right = "20px";
    iframe.style.width = "380px";
    iframe.style.height = "520px";
    iframe.style.border = "none";
    iframe.style.zIndex = "999999";

    document.body.appendChild(iframe);
  };
})();
