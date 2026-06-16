(function () {
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

  setupCardPressFeedback();
})();
