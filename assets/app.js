(function () {
  function setupPressFeedback() {
    var pressTargets = document.querySelectorAll(
      [
        ".site-shell:not(.site-shell--project) .bento-card",
        ".site-shell:not(.site-shell--project) .sns-card",
        ".site-header__link",
        ".side-nav__link",
        ".project-detail-nav__link:not(.project-detail-nav__link--disabled)",
        ".theme-switcher",
        ".about-teaser__link"
      ].join(", ")
    );

    if (!pressTargets.length) {
      return;
    }

    pressTargets.forEach(function (target) {
      var pressStartedAt = 0;
      var releaseTimerId = 0;

      function clearReleaseTimer() {
        if (releaseTimerId) {
          window.clearTimeout(releaseTimerId);
          releaseTimerId = 0;
        }
      }

      function setPressed() {
        target.classList.add("is-pressed");
      }

      function clearPressed() {
        target.classList.remove("is-pressed");
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

      target.addEventListener("pointerdown", function (event) {
        if (event.pointerType === "mouse" && event.button !== 0) {
          return;
        }
        pressStartedAt = window.performance && performance.now ? performance.now() : Date.now();
        setPressed();
      });

      target.addEventListener("pointerup", function (event) {
        if (event.pointerType === "mouse" && event.button !== 0) {
          return;
        }
        scheduleRelease(320);
      });

      target.addEventListener("pointercancel", function () {
        clearReleaseTimer();
        clearPressed();
      });

      target.addEventListener("pointerleave", function (event) {
        if (event.pointerType === "mouse") {
          clearReleaseTimer();
          clearPressed();
        }
      });

      target.addEventListener("blur", function () {
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

  function setupThemeSwitcher() {
    var selects = document.querySelectorAll("[data-theme-select]");

    if (!selects.length) {
      document.documentElement.dataset.theme = "dark";
      return;
    }

    var visibleSelects = Array.prototype.filter.call(selects, function (select) {
      var switcher = select.closest(".theme-switcher");
      return switcher && window.getComputedStyle(switcher).display !== "none";
    });

    if (!visibleSelects.length) {
      document.documentElement.dataset.theme = "dark";
      return;
    }

    var storageKey = "color-theme";
    var validThemes = {
      system: true,
      light: true,
      dark: true
    };

    function readStoredTheme() {
      try {
        var storedTheme = window.localStorage.getItem(storageKey);
        return validThemes[storedTheme] ? storedTheme : "system";
      } catch (error) {
        return "system";
      }
    }

    function writeStoredTheme(theme) {
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch (error) {
        return;
      }
    }

    function applyTheme(theme) {
      var nextTheme = validThemes[theme] ? theme : "system";

      document.documentElement.dataset.theme = nextTheme;
      writeStoredTheme(nextTheme);

      selects.forEach(function (select) {
        select.value = nextTheme;
        var switcher = select.closest(".theme-switcher");

        if (switcher) {
          switcher.dataset.themeState = nextTheme;
        }
      });
    }

    selects.forEach(function (select) {
      select.addEventListener("change", function () {
        applyTheme(select.value);
      });
    });

    applyTheme(readStoredTheme());
  }

  function setupOpticalAlignment() {
    var elements = document.querySelectorAll(
      ".masthead-title, .bento-card__title, .project-section__title, .home-speaking__heading, .profile-page-title, .profile-section__title, .detail-module__title, .description-subtitle"
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

  function setupHomeScrollTheme() {
    var body = document.body;
    var works = document.querySelector("#works");

    if (!body || !body.classList.contains("page-home") || !works) {
      return;
    }

    var ticking = false;

    function updateTheme() {
      ticking = false;
      var triggerY = window.innerHeight * 0.45;
      var workTop = works.getBoundingClientRect().top;
      body.classList.toggle("is-work-theme", workTop <= triggerY);
    }

    function requestUpdate() {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateTheme);
    }

    updateTheme();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("hashchange", requestUpdate);
    window.setTimeout(requestUpdate, 0);
  }

  function setupGreetingScramble() {
    var greeting = document.querySelector(".about-teaser__greeting");

    if (!greeting) {
      return;
    }

    var source = greeting.getAttribute("data-greetings") || "";
    var greetings = source
      .split("|")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);

    if (greetings.length < 2) {
      return;
    }

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var scrambleCharacters = "abcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=?";
    var index = 0;
    var frame = 0;
    var frameCount = reduceMotion ? 6 : 12;
    var frameDelay = reduceMotion ? 70 : 42;
    var holdDelay = reduceMotion ? 2800 : 2200;
    var timerId = 0;

    function randomCharacter() {
      return scrambleCharacters.charAt(Math.floor(Math.random() * scrambleCharacters.length));
    }

    function scrambleToward(target) {
      var targetCharacters = Array.from(target);
      var revealCount = Math.floor((frame / frameCount) * targetCharacters.length);

      greeting.textContent = targetCharacters
        .map(function (character, characterIndex) {
          if (characterIndex < revealCount || character === " " || character === ".") {
            return character;
          }

          return randomCharacter();
        })
        .join("");

      greeting.classList.add("is-scrambling");
      frame += 1;

      if (frame <= frameCount) {
        timerId = window.setTimeout(function () {
          scrambleToward(target);
        }, frameDelay);
        return;
      }

      greeting.textContent = target;
      greeting.classList.remove("is-scrambling");
      frame = 0;
      timerId = window.setTimeout(nextGreeting, holdDelay);
    }

    function nextGreeting() {
      index = (index + 1) % greetings.length;
      scrambleToward(greetings[index]);
    }

    timerId = window.setTimeout(nextGreeting, holdDelay);

    window.addEventListener("pagehide", function () {
      if (timerId) {
        window.clearTimeout(timerId);
      }
    });
  }

  setupPressFeedback();
  setupGridOverlay();
  setupThemeSwitcher();
  setupOpticalAlignment();
  setupHomeScrollTheme();
  setupGreetingScramble();
})();
