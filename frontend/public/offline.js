// Shows the offline page in the visitor's language: the site's own language cookie first (what the visitor chose on PDA), then the
// browser's language list, then Turkish (the site's default). Without JavaScript the page keeps showing all three languages.
(function () {
  var supported = ["tr", "en", "de"];
  var chosen = null;
  var cookie = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([a-z]{2})/);
  if (cookie && supported.indexOf(cookie[1]) !== -1) chosen = cookie[1];
  if (!chosen) {
    var languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "tr"];
    for (var i = 0; i < languages.length && !chosen; i += 1) {
      var code = String(languages[i]).slice(0, 2).toLowerCase();
      if (supported.indexOf(code) !== -1) chosen = code;
    }
  }
  chosen = chosen || "tr";
  document.documentElement.setAttribute("data-lang", chosen);
  document.documentElement.setAttribute("lang", chosen);
  var titles = { tr: "PDA · Çevrimdışı", en: "PDA · Offline", de: "PDA · Offline" };
  document.title = titles[chosen];
})();
