(function () {
  var storageKey = "portfolio-theme";
  var root = document.documentElement;
  var toggle = document.querySelector("[data-theme-toggle]");

  function applyTheme(theme) {
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }

  try {
    var saved = window.localStorage.getItem(storageKey);
    if (saved) {
      applyTheme(saved);
    }
  } catch (error) {
    // Ignore storage read errors in private mode or restricted contexts.
  }

  if (!toggle) {
    return;
  }

  toggle.addEventListener("click", function () {
    var current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    var next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch (error) {
      // Ignore storage write errors.
    }
  });
})();
