/* MinPair project page v15: page.js. The theme switches and the BibTeX copy are the frame's (frame/frame.js); this file only
   passes a change of html[data-theme] on to the canvases of the story and the grid (the event mp:theme of core.js). */
(function () {
  "use strict";
  const MP = window.MP;
  new MutationObserver(() => MP.fireTheme()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
