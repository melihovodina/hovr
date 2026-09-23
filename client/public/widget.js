/*
 * hovr widget loader. Paste on any site:
 *   <script src="https://YOUR-HOVR-ADDRESS/widget.js" data-bot="pub_..." defer></script>
 * It adds one iframe that holds the chat. The iframe stays hidden until the bot's settings have
 * loaded, then shows the launcher in the bot's colours and grows into the chat panel when opened.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || window.__hovrWidget) return;
  var key = script.getAttribute("data-bot");
  if (!key) {
    console.warn("hovr: the script tag needs data-bot=\"pub_...\".");
    return;
  }
  window.__hovrWidget = true;

  var origin = new URL(script.src, location.href).origin;
  var MARGIN = 4; // the launcher iframe has its own padding, so the button sits 20px from the edge
  var LAUNCHER = 92; // a 60px button with room for its shadow
  var PANEL_WIDTH = 396;
  var PANEL_HEIGHT = 700;
  var PHONE = 520; // narrower windows get the chat full screen

  var frame = document.createElement("iframe");
  frame.src = origin + "/widget?key=" + encodeURIComponent(key);
  frame.title = "Chat";
  frame.setAttribute("allowtransparency", "true");
  var style = frame.style;
  style.position = "fixed";
  style.zIndex = "2147483000";
  style.border = "0";
  style.background = "transparent";
  style.colorScheme = "normal";
  style.display = "none";

  var side = "right";
  var open = false;

  function layout() {
    var phone = window.innerWidth < PHONE;
    if (open && phone) {
      style.top = style.left = style.right = style.bottom = "0";
      style.width = "100%";
      style.height = "100%";
      return;
    }
    style.top = "auto";
    style.bottom = MARGIN + "px";
    style.left = side === "left" ? MARGIN + "px" : "auto";
    style.right = side === "right" ? MARGIN + "px" : "auto";
    if (open) {
      style.width = Math.min(PANEL_WIDTH, window.innerWidth - 2 * MARGIN) + "px";
      style.height = Math.min(PANEL_HEIGHT, window.innerHeight - 2 * MARGIN) + "px";
    } else {
      style.width = style.height = LAUNCHER + "px";
    }
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || event.source !== frame.contentWindow) return;
    var data = event.data || {};
    switch (data.type) {
      case "hovr:ready":
        side = data.position === "left" ? "left" : "right";
        layout();
        style.display = "block";
        break;
      case "hovr:open":
        open = true;
        layout();
        break;
      case "hovr:close":
        open = false;
        layout();
        break;
      case "hovr:hide":
        style.display = "none";
        break;
    }
  });
  window.addEventListener("resize", layout);

  function mount() {
    document.body.appendChild(frame);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
