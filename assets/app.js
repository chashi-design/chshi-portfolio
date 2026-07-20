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

  function setupScrollReveal() {
    var body = document.body;

    if (
      !body ||
      (!body.classList.contains("page-home") &&
        !body.classList.contains("page-profile") &&
        !body.classList.contains("page-detail"))
    ) {
      return;
    }

    var selectors = [];

    if (body.classList.contains("page-home")) {
      selectors = [
        ".about-teaser__title",
        ".about-teaser__name",
        ".about-teaser__description",
        ".about-teaser__career-title",
        ".about-teaser .career-item",
        ".page-home .bento-card__body",
        ".page-home .bento-card__media",
        ".home-speaking__heading",
        ".home-speaking__item"
      ];
    } else if (body.classList.contains("page-profile")) {
      selectors = [
        ".profile-page-title",
        ".profile-avatar",
        ".profile-section__title",
        ".profile-description",
        ".career-item",
        ".profile-inline-text",
        ".profile-sns-links"
      ];
    } else {
      selectors = [
        ".detail-module__title",
        ".detail-module__list",
        ".project-main-media",
        ".description-block--text",
        ".description-block--image",
        ".description-block--video"
      ];
    }

    var elements = Array.prototype.slice.call(document.querySelectorAll(selectors.join(", ")));

    if (!elements.length) {
      return;
    }

    elements.forEach(function (element, index) {
      element.classList.add("scroll-reveal");
      element.style.setProperty("--reveal-delay", Math.min(index % 6, 5) * 45 + "ms");
    });

    var pendingElements = elements.slice();
    var ticking = false;

    function updateVisibility() {
      ticking = false;

      if (!pendingElements.length) {
        window.removeEventListener("scroll", requestUpdate);
        window.removeEventListener("resize", requestUpdate);
        return;
      }

      var revealLine = window.innerHeight * 0.9;

      pendingElements = pendingElements.filter(function (element) {
        var rect = element.getBoundingClientRect();
        var shouldReveal = rect.top <= revealLine && rect.bottom >= 0;

        if (shouldReveal) {
          element.classList.add("is-visible");
        }

        return !shouldReveal;
      });
    }

    function requestUpdate() {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateVisibility);
    }

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.setTimeout(requestUpdate, 120);
  }

  function setupInvertingCursor() {
    var supportsFinePointer =
      window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!supportsFinePointer) {
      return;
    }

    var cursor = document.createElement("div");
    var cursorSize = 48;
    var cursorHalf = cursorSize / 2;
    var closeSyncFrame = 0;

    cursor.className = "inverting-cursor";
    cursor.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursor);
    document.documentElement.classList.add("has-inverting-cursor");

    var closeTargetSelector = ".project-close, .project-detail-nav__link:not(.project-detail-nav__link--disabled)";

    function snapCursorToCloseTarget(closeTarget) {
      var closeRect = closeTarget.getBoundingClientRect();
      var isExpanded = closeRect.width > 40.5;
      var cursorGap = 2;
      var closeRadius = Math.min(closeRect.width, closeRect.height) / 2;
      var cursorWidth = closeRect.width + cursorGap * 2;
      var cursorHeight = closeRect.height + cursorGap * 2;

      cursor.classList.add("is-visible", "is-close-target");
      cursor.classList.remove("is-interactive");
      cursor.classList.toggle("is-close-target-expanded", isExpanded);
      cursor.style.width = cursorWidth + "px";
      cursor.style.height = cursorHeight + "px";
      cursor.style.margin = "0";
      cursor.style.borderRadius = closeRadius + cursorGap + "px";
      cursor.style.transform = [
        "translate3d(",
        closeRect.left - cursorGap,
        "px, ",
        closeRect.top - cursorGap,
        "px, 0)"
      ].join("");

      var expandedWidth = closeTarget.matches(".project-detail-nav__link") ? 47.9 : 79.9;
      if (
        closeTarget.matches(":hover") &&
        (closeRect.width < expandedWidth || closeRect.height < 47.9)
      ) {
        closeSyncFrame = window.requestAnimationFrame(function () {
          closeSyncFrame = 0;
          snapCursorToCloseTarget(closeTarget);
        });
      }
    }

    function clearCloseTargetState() {
      if (closeSyncFrame) {
        window.cancelAnimationFrame(closeSyncFrame);
        closeSyncFrame = 0;
      }

      cursor.classList.remove("is-close-target", "is-close-target-expanded");
      cursor.style.removeProperty("width");
      cursor.style.removeProperty("height");
      cursor.style.removeProperty("margin");
      cursor.style.removeProperty("border-radius");
    }

    function moveCursor(event) {
      var closeTarget = event.target && event.target.closest && event.target.closest(closeTargetSelector);
      var cursorX = event.clientX;
      var cursorY = event.clientY;

      if (closeTarget) {
        snapCursorToCloseTarget(closeTarget);
        return;
      }

      clearCloseTargetState();
      cursor.style.transform = [
        "translate3d(",
        cursorX - cursorHalf,
        "px, ",
        cursorY - cursorHalf,
        "px, 0)"
      ].join("");
      cursor.classList.add("is-visible");
    }

    function updateInteractiveState(event) {
      var target = event.target;
      var interactive = target && target.closest && target.closest("a, button, select, summary, [role='button']");
      cursor.classList.toggle("is-interactive", Boolean(interactive));
    }

    document.addEventListener("focusin", function (event) {
      var closeTarget = event.target && event.target.closest && event.target.closest(closeTargetSelector);

      if (!closeTarget) {
        return;
      }

      snapCursorToCloseTarget(closeTarget);
      window.requestAnimationFrame(function () {
        snapCursorToCloseTarget(closeTarget);
      });
    });

    document.addEventListener("pointermove", function (event) {
      if (event.pointerType && event.pointerType !== "mouse") {
        return;
      }

      moveCursor(event);
      updateInteractiveState(event);
    });

    document.addEventListener("pointerdown", function (event) {
      if (event.pointerType && event.pointerType !== "mouse") {
        return;
      }

      cursor.classList.add("is-pressed");
    });

    document.addEventListener("pointerup", function () {
      cursor.classList.remove("is-pressed");
    });

    document.addEventListener("pointerleave", function () {
      clearCloseTargetState();
      cursor.classList.remove("is-visible", "is-interactive", "is-pressed");
    });
  }

  function setupScrollVideos() {
    var videos = Array.prototype.slice.call(document.querySelectorAll("video[data-scroll-video]"));

    if (!videos.length) {
      return;
    }

    function resetVideo(video) {
      video.pause();

      try {
        video.currentTime = 0;
      } catch (_error) {
        // Metadata may not be available yet. The video is already paused.
      }
    }

    videos.forEach(function (video) {
      video.defaultMuted = true;
      video.muted = true;
      video.volume = 0;
      resetVideo(video);
    });

    if (!("IntersectionObserver" in window)) {
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var video = entry.target;
          var isFullyVisible = entry.isIntersecting && entry.intersectionRatio >= 0.999;

          if (isFullyVisible && document.visibilityState === "visible") {
            var playPromise = video.play();

            if (playPromise && typeof playPromise.catch === "function") {
              playPromise.catch(function () {});
            }
            return;
          }

          resetVideo(video);
        });
      },
      { threshold: [0, 0.999, 1] }
    );

    videos.forEach(function (video) {
      observer.observe(video);
    });

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") {
        videos.forEach(resetVideo);
      }
    });
  }

  setupPressFeedback();
  setupGridOverlay();
  setupThemeSwitcher();
  setupOpticalAlignment();
  setupScrollReveal();
  setupScrollVideos();
  setupInvertingCursor();
})();
