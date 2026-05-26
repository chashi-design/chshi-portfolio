(function () {
  var storageKey = "portfolio-theme";
  var root = document.documentElement;
  var toggle = document.querySelector("[data-theme-toggle]");
  var icon = toggle ? toggle.querySelector("[data-theme-icon]") : null;

  function setupCardPressFeedback() {
    var cards = document.querySelectorAll(
      ".site-shell:not(.site-shell--project) .bento-card, .site-shell:not(.site-shell--project) .sns-card"
    );

    if (!cards.length) {
      return;
    }

    cards.forEach(function (card) {
      var pressStartedAt = 0;
      var releaseTimerId = 0;

      function clearReleaseTimer() {
        if (releaseTimerId) {
          window.clearTimeout(releaseTimerId);
          releaseTimerId = 0;
        }
      }

      function setPressed() {
        card.classList.add("is-pressed");
      }

      function clearPressed() {
        card.classList.remove("is-pressed");
      }

      function scheduleRelease(minimumPressMs) {
        var now = window.performance && performance.now ? performance.now() : Date.now();
        var elapsed = pressStartedAt ? Math.max(0, now - pressStartedAt) : minimumPressMs;
        var delay = Math.max(0, minimumPressMs - elapsed);

        clearReleaseTimer();
        releaseTimerId = window.setTimeout(function () {
          clearPressed();
          releaseTimerId = 0;
        }, delay);
      }

      card.addEventListener("pointerdown", function (event) {
        if (event.pointerType === "mouse" && event.button !== 0) {
          return;
        }
        pressStartedAt = window.performance && performance.now ? performance.now() : Date.now();
        setPressed();
      });

      card.addEventListener("pointerup", function (event) {
        if (event.pointerType === "mouse" && event.button !== 0) {
          return;
        }
        scheduleRelease(320);
      });

      card.addEventListener("pointercancel", function () {
        clearReleaseTimer();
        clearPressed();
      });

      card.addEventListener("pointerleave", function (event) {
        if (event.pointerType === "mouse") {
          clearReleaseTimer();
          clearPressed();
        }
      });

      card.addEventListener("blur", function () {
        clearReleaseTimer();
        clearPressed();
      });
    });
  }

  function updateToggleUI(theme) {
    if (!toggle) {
      return;
    }
    if (icon) {
      icon.textContent = theme === "dark" ? "☀" : "☾";
    }
    toggle.setAttribute("aria-label", theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え");
  }

  function applyTheme(theme) {
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
    updateToggleUI(theme === "dark" ? "dark" : "light");
  }

  try {
    var saved = window.localStorage.getItem(storageKey);
    if (saved) {
      applyTheme(saved);
    }
  } catch (error) {
    // Ignore storage read errors in private mode or restricted contexts.
  }

  if (toggle) {
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
  }

  setupCardPressFeedback();
})();
