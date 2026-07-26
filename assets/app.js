(function () {
  function setupPressFeedback() {
    var pressTargets = document.querySelectorAll(
      [
        ".site-shell:not(.site-shell--project) .bento-card",
        ".site-shell:not(.site-shell--project) .sns-card",
        ".site-header__link",
        ".side-nav__link",
        ".project-detail-nav__link:not(.project-detail-nav__link--disabled)",
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
        ".page-home .home-selected-work .bento-card",
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

    var closeTargetSelector = [
      ".project-close",
      ".project-detail-nav__link:not(.project-detail-nav__link--disabled)",
      ".home-segmented-control__logo",
      ".home-segmented-control__button",
      ".page-home .project-sections .bento-card",
      ".page-home .home-speaking__item",
      ".description-link-card"
    ].join(", ");
    var textLinkSelector = [
      "a:not(.card)",
      ":not(.description-link-card)",
      ":not(.project-close)",
      ":not(.project-detail-nav__link)"
    ].join("");

    function radiusPartToPixels(value, basis) {
      var numericValue = parseFloat(value) || 0;
      return value.indexOf("%") >= 0 ? (numericValue / 100) * basis : numericValue;
    }

    function getCardRadius(card) {
      var previewFrame = card.querySelector(
        ".bento-card__media picture.media-skeleton, .home-speaking__media picture.media-skeleton"
      );
      var previewImage = card.querySelector(".bento-card__media img, .home-speaking__media img");
      var radiusTarget = previewFrame || previewImage || card;

      var targetRect = radiusTarget.getBoundingClientRect();
      var radiusParts = window
        .getComputedStyle(radiusTarget)
        .borderTopLeftRadius
        .split(/\s+/);

      return {
        x: radiusPartToPixels(radiusParts[0], targetRect.width),
        y: radiusPartToPixels(radiusParts[1] || radiusParts[0], targetRect.height)
      };
    }

    function snapCursorToCloseTarget(closeTarget) {
      var closeRect = closeTarget.getBoundingClientRect();
      var isWorkCardTarget = closeTarget.matches(
        ".page-home .project-sections .bento-card, .page-home .home-speaking__item"
      );
      var isFloatingNavTarget = closeTarget.matches(
        ".home-segmented-control__logo, .home-segmented-control__button, .project-detail-nav__link"
      );
      var isLinkCardTarget = closeTarget.matches(".description-link-card");
      var isCardTarget = isWorkCardTarget || isLinkCardTarget;
      var isExpanded = closeRect.width > 40.5;
      var cursorGap = isCardTarget ? 8 : 2;
      var cardRadius = isCardTarget ? getCardRadius(closeTarget) : null;
      var closeRadiusX = isCardTarget
        ? cardRadius.x
        : Math.min(closeRect.width, closeRect.height) / 2;
      var closeRadiusY = isCardTarget
        ? cardRadius.y
        : Math.min(closeRect.width, closeRect.height) / 2;
      var cursorWidth = closeRect.width + cursorGap * 2;
      var cursorHeight = closeRect.height + cursorGap * 2;

      cursor.classList.add("is-visible", "is-close-target");
      cursor.classList.remove("is-interactive");
      cursor.classList.toggle("is-close-target-expanded", isExpanded);
      cursor.classList.toggle("is-work-card-target", isCardTarget);
      cursor.classList.toggle("is-floating-nav-target", isFloatingNavTarget);
      cursor.style.width = cursorWidth + "px";
      cursor.style.height = cursorHeight + "px";
      cursor.style.margin = "0";
      cursor.style.borderRadius = isWorkCardTarget
        ? [
            "12px 12px ",
            closeRadiusX,
            "px ",
            closeRadiusX,
            "px / 12px 12px ",
            closeRadiusY,
            "px ",
            closeRadiusY,
            "px"
          ].join("")
        : [
            closeRadiusX + cursorGap,
            "px / ",
            closeRadiusY + cursorGap,
            "px"
          ].join("");
      cursor.style.transform = [
        "translate3d(",
        closeRect.left - cursorGap,
        "px, ",
        closeRect.top - cursorGap,
        "px, 0)"
      ].join("");

      var expandedWidth = closeTarget.matches(".project-detail-nav__link") ? 47.9 : 79.9;
      var shouldSyncWorkCard = isWorkCardTarget && closeTarget.matches(":hover");
      var shouldSyncExpandedTarget =
        closeTarget.matches(":hover") &&
        (closeRect.width < expandedWidth || closeRect.height < 47.9);

      if ((shouldSyncWorkCard || shouldSyncExpandedTarget) && !closeSyncFrame) {
        closeSyncFrame = window.requestAnimationFrame(function () {
          closeSyncFrame = 0;
          snapCursorToCloseTarget(closeTarget);
        });
      }
    }

    function snapCursorToTextLink(textLink, cursorX, cursorY) {
      var linkRects = Array.prototype.slice.call(textLink.getClientRects());
      var linkRect = linkRects.find(function (rect) {
        return cursorX >= rect.left && cursorX <= rect.right && cursorY >= rect.top && cursorY <= rect.bottom;
      }) || textLink.getBoundingClientRect();
      var cursorGap = 4;
      var cursorWidth = linkRect.width + cursorGap * 2;
      var cursorHeight = linkRect.height + cursorGap * 2;

      cursor.classList.add("is-visible", "is-text-link-target");
      cursor.classList.remove("is-interactive", "is-text-target");
      cursor.style.width = cursorWidth + "px";
      cursor.style.height = cursorHeight + "px";
      cursor.style.margin = "0";
      cursor.style.borderRadius = Math.min(8, cursorHeight / 2) + "px";
      cursor.style.transform = [
        "translate3d(",
        linkRect.left - cursorGap,
        "px, ",
        linkRect.top - cursorGap,
        "px, 0)"
      ].join("");
    }

    function clearCloseTargetState() {
      if (closeSyncFrame) {
        window.cancelAnimationFrame(closeSyncFrame);
        closeSyncFrame = 0;
      }

      cursor.classList.remove(
        "is-close-target",
        "is-close-target-expanded",
        "is-work-card-target",
        "is-floating-nav-target",
        "is-text-link-target"
      );
      cursor.style.removeProperty("width");
      cursor.style.removeProperty("height");
      cursor.style.removeProperty("margin");
      cursor.style.removeProperty("border-radius");
    }

    function moveCursor(event) {
      var closeTarget = event.target && event.target.closest && event.target.closest(closeTargetSelector);
      var textLink = event.target && event.target.closest && event.target.closest(textLinkSelector);
      var cursorX = event.clientX;
      var cursorY = event.clientY;

      if (closeTarget) {
        snapCursorToCloseTarget(closeTarget);
        return;
      }

      if (textLink) {
        clearCloseTargetState();
        snapCursorToTextLink(textLink, cursorX, cursorY);
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
      var textLink = target && target.closest && target.closest(textLinkSelector);
      var textTarget =
        !interactive &&
        target &&
        target.closest &&
        target.closest("p, h1, h2, h3, h4, li, dt, dd, figcaption, blockquote, time, address, small, label");
      cursor.classList.toggle("is-interactive", Boolean(interactive && !textLink));
      cursor.classList.toggle("is-text-target", Boolean(textTarget));
    }

    function enterKeyboardNavigation() {
      document.documentElement.classList.add("is-keyboard-navigation");
      clearCloseTargetState();
      cursor.classList.remove("is-visible", "is-interactive", "is-text-target", "is-pressed");
    }

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") {
        return;
      }

      enterKeyboardNavigation();
    });

    document.addEventListener("focusin", function (event) {
      if (event.target && event.target.matches && event.target.matches(":focus-visible")) {
        enterKeyboardNavigation();
      }
    });

    document.addEventListener("pointermove", function (event) {
      if (event.pointerType && event.pointerType !== "mouse") {
        return;
      }

      document.documentElement.classList.remove("is-keyboard-navigation");
      moveCursor(event);
      updateInteractiveState(event);
    });

    document.addEventListener("pointerdown", function (event) {
      if (event.pointerType && event.pointerType !== "mouse") {
        return;
      }

      document.documentElement.classList.remove("is-keyboard-navigation");

      if (
        cursor.classList.contains("is-text-target") ||
        cursor.classList.contains("is-text-link-target")
      ) {
        cursor.classList.remove("is-pressed");
        return;
      }

      cursor.classList.add("is-pressed");
    });

    document.addEventListener("pointerup", function () {
      cursor.classList.remove("is-pressed");
    });

    document.addEventListener("pointerleave", function () {
      clearCloseTargetState();
      cursor.classList.remove("is-visible", "is-interactive", "is-text-target", "is-pressed");
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

  function setupMediaSkeletons() {
    function markLoaded(frame) {
      frame.classList.add("is-loaded");
      frame.setAttribute("aria-busy", "false");
    }

    Array.prototype.forEach.call(document.querySelectorAll("picture.media-skeleton"), function (picture) {
      var image = picture.querySelector("img");

      if (!image) {
        markLoaded(picture);
        return;
      }

      if (image.complete) {
        markLoaded(picture);
        return;
      }

      image.addEventListener("load", function () {
        markLoaded(picture);
      }, { once: true });
      image.addEventListener("error", function () {
        markLoaded(picture);
      }, { once: true });
    });

    Array.prototype.forEach.call(document.querySelectorAll(".description-block--youtube.media-embed-skeleton"), function (frame) {
      var iframe = frame.querySelector("iframe");

      if (!iframe) {
        markLoaded(frame);
        return;
      }

      iframe.addEventListener("load", function () {
        markLoaded(frame);
      }, { once: true });
      window.setTimeout(function () {
        markLoaded(frame);
      }, 10000);
    });

    Array.prototype.forEach.call(document.querySelectorAll(".instagram-embed-frame.media-embed-skeleton"), function (frame) {
      var observer;

      function bindInstagramIframe() {
        var iframe = frame.querySelector("iframe");

        if (!iframe || iframe.dataset.skeletonLoadBound === "true") {
          return Boolean(iframe);
        }

        iframe.dataset.skeletonLoadBound = "true";
        iframe.addEventListener("load", function () {
          markLoaded(frame);
          observer.disconnect();
        }, { once: true });
        return true;
      }

      observer = new MutationObserver(function () {
        bindInstagramIframe();
      });

      observer.observe(frame, { childList: true, subtree: true });
      bindInstagramIframe();
      window.setTimeout(function () {
        markLoaded(frame);
        observer.disconnect();
      }, 10000);
    });
  }

  function setupHomeSegmentedControl() {
    var control = document.querySelector(".home-segmented-control");

    if (!control) {
      return;
    }

    var buttons = Array.prototype.slice.call(
      control.querySelectorAll("[data-home-segment-target]")
    );
    var itemGroup = control.querySelector(".home-segmented-control__items");
    if (!buttons.length) {
      return;
    }

    var sections = buttons
      .map(function (button) {
        var selector = button.getAttribute("data-home-segment-target");
        var section = selector ? document.querySelector(selector) : null;
        return section ? { button: button, section: section } : null;
      })
      .filter(Boolean);

    if (!sections.length) {
      return;
    }

    var ticking = false;
    var activeButton = null;

    function syncActiveIndicator(button) {
      if (!itemGroup || !button) {
        return;
      }

      itemGroup.style.setProperty("--active-segment-left", button.offsetLeft + "px");
      itemGroup.style.setProperty("--active-segment-width", button.offsetWidth + "px");
    }

    function setActive(button) {
      syncActiveIndicator(button);

      if (activeButton === button) {
        return;
      }

      activeButton = button;
      buttons.forEach(function (item) {
        var isActive = item === button;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function updateActiveSegment() {
      ticking = false;

      var referenceLine = window.innerHeight * 0.45;
      var active = sections[0];

      sections.forEach(function (item) {
        if (item.section.getBoundingClientRect().top <= referenceLine) {
          active = item;
        }
      });

      setActive(active.button);
    }

    function requestActiveUpdate() {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateActiveSegment);
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var selector = button.getAttribute("data-home-segment-target");
        var target = selector ? document.querySelector(selector) : null;

        if (!target) {
          return;
        }

        var prefersReducedMotion =
          window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        target.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start"
        });
      });
    });

    requestActiveUpdate();
    window.addEventListener("scroll", requestActiveUpdate, { passive: true });
    window.addEventListener("resize", requestActiveUpdate);
    window.setTimeout(requestActiveUpdate, 120);

  }

  function setupNameTransition() {
    var nameValue = document.querySelector(".about-teaser__name-value");

    if (!nameValue) {
      return;
    }

    var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      return;
    }

    var originalText = nameValue.textContent.trim();
    var finalText = "chashi.";
    var morphSourceText = "o";
    var remainingText = "hashi.";

    if (!originalText.endsWith(morphSourceText + remainingText)) {
      return;
    }

    var removedText = originalText.slice(0, -(morphSourceText + remainingText).length);
    var removed = document.createElement("span");
    var finalGroup = document.createElement("span");
    var morph = document.createElement("span");
    var morphSource = document.createElement("span");
    var morphReplacement = document.createElement("span");
    var remaining = document.createElement("span");

    removed.className = "about-teaser__name-removed";
    Array.from(removedText).forEach(function (character, index) {
      var characterSpan = document.createElement("span");

      characterSpan.className = "about-teaser__name-removed-character";
      characterSpan.textContent = character === " " ? "\u00a0" : character;
      characterSpan.style.setProperty("--name-character-index", index);
      removed.append(characterSpan);
    });
    finalGroup.className = "about-teaser__name-final";
    morph.className = "about-teaser__name-morph";
    morphSource.className = "about-teaser__name-morph-source";
    morphSource.textContent = morphSourceText;
    morphReplacement.className = "about-teaser__name-morph-replacement";
    morphReplacement.textContent = "c";
    remaining.className = "about-teaser__name-remaining";
    remaining.textContent = remainingText;
    morph.append(morphSource, morphReplacement);
    finalGroup.append(morph, remaining);

    nameValue.textContent = "";
    nameValue.setAttribute("aria-label", originalText);
    removed.setAttribute("aria-hidden", "true");
    finalGroup.setAttribute("aria-hidden", "true");
    nameValue.append(removed, finalGroup);

    function updateNameWidths() {
      var removedWidth = removed.scrollWidth;
      var morphWidth = Math.max(morphSource.scrollWidth, morphReplacement.scrollWidth);

      removed.style.setProperty("--name-removed-width", removedWidth + "px");
      morph.style.setProperty("--name-morph-source-width", morphWidth + "px");
      morph.style.setProperty("--name-morph-replacement-width", morphWidth + "px");
    }

    var nameResizeFrame = 0;
    var nameResizeReleaseFrame = 0;

    function scheduleNameWidthUpdate() {
      window.cancelAnimationFrame(nameResizeFrame);
      window.cancelAnimationFrame(nameResizeReleaseFrame);

      nameResizeFrame = window.requestAnimationFrame(function () {
        var isMovingLeft = nameValue.classList.contains("is-collapsing")
          && !nameValue.classList.contains("is-complete");
        var isMovingRight = nameValue.classList.contains("is-returning")
          && !nameValue.classList.contains("is-returned");
        var shouldUpdateWithoutTransition = !isMovingLeft && !isMovingRight;

        if (shouldUpdateWithoutTransition) {
          nameValue.classList.add("is-recalculating");
        }

        updateNameWidths();

        if (shouldUpdateWithoutTransition) {
          nameValue.offsetWidth;
          nameResizeReleaseFrame = window.requestAnimationFrame(function () {
            nameValue.classList.remove("is-recalculating");
          });
        }
      });
    }

    updateNameWidths();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleNameWidthUpdate);
    }

    if ("ResizeObserver" in window) {
      var nameResizeObserver = new ResizeObserver(scheduleNameWidthUpdate);
      nameResizeObserver.observe(nameValue.closest(".about-teaser__inner") || nameValue);
    }

    window.addEventListener("resize", scheduleNameWidthUpdate, { passive: true });
    window.addEventListener("orientationchange", scheduleNameWidthUpdate);

    var timings = {
      initialHold: 5000,
      strike: 2000,
      eraseAndPause: 1300,
      letterDrop: 900,
      beat: 500,
      horizontalMove: 1200,
      finalHold: 10000,
      strikeReset: 200,
      textRestore: 950
    };

    function runForwardTransition() {
      nameValue.classList.add("is-striking");

      window.setTimeout(function () {
        nameValue.classList.add("is-erasing");

        window.setTimeout(function () {
          nameValue.classList.add("is-morphing");

          window.setTimeout(function () {
            nameValue.setAttribute("aria-label", finalText);
            nameValue.classList.add("is-morphed");

            window.setTimeout(function () {
              nameValue.classList.add("is-collapsing");

              window.setTimeout(function () {
                nameValue.classList.add("is-complete");
                window.setTimeout(runReturnTransition, timings.finalHold);
              }, timings.horizontalMove);
            }, timings.beat);
          }, timings.letterDrop);
        }, timings.eraseAndPause);
      }, timings.strike);
    }

    function runReturnTransition() {
      nameValue.classList.add("is-returning");

      window.setTimeout(function () {
        nameValue.classList.add("is-returned");

        window.setTimeout(function () {
          nameValue.classList.add("is-reversing");

          window.setTimeout(function () {
            nameValue.classList.add("is-restoring");
            nameValue.classList.remove("is-striking");

            window.setTimeout(function () {
              nameValue.classList.add("is-revealing");
              nameValue.classList.remove("is-erasing");
              nameValue.setAttribute("aria-label", originalText);

              window.setTimeout(function () {
                nameValue.classList.remove(
                  "is-morphing",
                  "is-morphed",
                  "is-collapsing",
                  "is-complete",
                  "is-returning",
                  "is-returned",
                  "is-reversing",
                  "is-restoring",
                  "is-revealing"
                );
                updateNameWidths();
                window.setTimeout(runForwardTransition, timings.initialHold);
              }, timings.textRestore);
            }, timings.strikeReset);
          }, timings.letterDrop);
        }, timings.beat);
      }, timings.horizontalMove);
    }

    window.setTimeout(runForwardTransition, timings.initialHold);
  }

  setupPressFeedback();
  setupOpticalAlignment();
  setupScrollReveal();
  setupMediaSkeletons();
  setupScrollVideos();
  setupHomeSegmentedControl();
  setupNameTransition();
  setupInvertingCursor();
})();
