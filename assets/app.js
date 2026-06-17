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

  function setupGridOverlay() {
    var button = document.querySelector(".grid-toggle");

    if (!button) {
      return;
    }

    function setGridState(enabled) {
      document.body.classList.toggle("grid-on", enabled);
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    }

    button.addEventListener("click", function () {
      setGridState(!document.body.classList.contains("grid-on"));
    });

    document.addEventListener("keydown", function (event) {
      var target = event.target;
      var isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isTyping || event.key.toLowerCase() !== "g") {
        return;
      }

      setGridState(!document.body.classList.contains("grid-on"));
    });
  }

  function setupOpticalAlignment() {
    var elements = document.querySelectorAll(
      ".masthead-title, .bento-card__title, .project-section__title, .projects-index-intro h1, .profile-page-title, .profile-section__title, .detail-module__title, .description-subtitle"
    );

    if (!elements.length) {
      return;
    }

    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    function alignInk() {
      elements.forEach(function (element) {
        element.style.marginLeft = "0px";

        var computed = window.getComputedStyle(element);
        var firstCharacter = (element.textContent || "").trim().charAt(0);

        if (!firstCharacter) {
          return;
        }

        if (computed.textTransform === "uppercase") {
          firstCharacter = firstCharacter.toUpperCase();
        }

        context.font = [
          computed.fontStyle,
          computed.fontWeight,
          computed.fontSize,
          computed.fontFamily
        ].join(" ");

        var metrics = context.measureText(firstCharacter);
        var offset = metrics.actualBoundingBoxLeft;

        if (Number.isFinite(offset)) {
          element.style.marginLeft = offset.toFixed(2) + "px";
        }
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(alignInk);
    } else {
      window.setTimeout(alignInk, 0);
    }

    window.addEventListener("resize", alignInk);
  }

  setupCardPressFeedback();
  setupGridOverlay();
  setupOpticalAlignment();
})();
