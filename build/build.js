#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_PATH = path.join(ROOT, "content.json");
const INDEX_TEMPLATE_PATH = path.join(ROOT, "templates", "index.template.html");
const PROJECT_TEMPLATE_PATH = path.join(ROOT, "templates", "project.template.html");
const PROFILE_TEMPLATE_PATH = path.join(ROOT, "templates", "profile.template.html");
const OUTPUT_INDEX_PATH = path.join(ROOT, "index.html");
const OUTPUT_PROJECTS_DIR = path.join(ROOT, "projects");
const OUTPUT_PROFILE_DIR = path.join(ROOT, "profile");
const OUTPUT_PROFILE_INDEX_PATH = path.join(OUTPUT_PROFILE_DIR, "index.html");
const BUILD_DIR = path.join(ROOT, "build");
const WATCH_TARGETS = [CONTENT_PATH, path.join(ROOT, "templates"), path.join(ROOT, "assets"), BUILD_DIR];
const GRID_TOGGLE_HTML = '<button class="grid-toggle" type="button" aria-pressed="false" aria-label="Toggle grid overlay">Grid</button>';
const GRID_COLUMNS_HTML = [
  '<span class="grid-guides__margin grid-guides__margin--left"></span>',
  '<span class="grid-guides__margin grid-guides__margin--right"></span>',
  ...Array.from({ length: 12 }, (_, index) => {
    const label = String(index + 1).padStart(2, "0");
    return `<span class="grid-guides__col">${label}</span>`;
  })
].join("\n        ");

const DETAIL_SECTION_CONFIG = [
  { key: "overview", title: "概要" },
  { key: "background", title: "背景" },
  { key: "experienceDesign", title: "体験設計" },
  { key: "designApproach", title: "デザインアプローチ" },
  { key: "impact", title: "効果" }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toText(value) {
  return String(value == null ? "" : value).trim();
}

function escapeHtml(value) {
  return toText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function readTemplate(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function buildAssetVersion() {
  const hash = crypto.createHash("sha1");
  [path.join(ROOT, "assets", "styles.css"), path.join(ROOT, "assets", "app.js")].forEach((filePath) => {
    hash.update(fs.readFileSync(filePath));
  });
  return hash.digest("hex").slice(0, 12);
}

function renderTemplate(template, replacements) {
  return Object.entries(replacements).reduce((html, [key, value]) => {
    const token = `{{${key}}}`;
    return html.split(token).join(String(value));
  }, template);
}

function normalizeBasePath(basePath) {
  const raw = toText(basePath);
  if (!raw || raw === "/") {
    return "";
  }
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function withBasePath(basePath, urlPath) {
  if (/^https?:\/\//i.test(urlPath)) {
    return urlPath;
  }
  const pathValue = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
  return `${basePath}${pathValue}`;
}

function toAbsoluteUrl(canonicalBase, urlPath) {
  if (/^https?:\/\//i.test(urlPath)) {
    return urlPath;
  }
  const normalizedBase = canonicalBase.replace(/\/+$/, "");
  return `${normalizedBase}${urlPath}`;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function normalizeAspect(aspect) {
  const raw = toText(aspect);
  if (/^\d+\s*\/\s*\d+$/.test(raw)) {
    return raw.replace(/\s+/g, " ");
  }
  return "16 / 10";
}

function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

function maybeExternalAttrs(url) {
  if (/^https?:\/\//i.test(url)) {
    return ' target="_blank" rel="noreferrer noopener"';
  }
  return "";
}

function buildCtaLink(cta, className) {
  const url = escapeAttr(toText(cta.url));
  const label = escapeHtml(toText(cta.label));
  return `<a class="${className}" href="${url}"${maybeExternalAttrs(url)}>${label}</a>`;
}

function truncate(text, limit) {
  const raw = toText(text);
  if (raw.length <= limit) {
    return raw;
  }
  return `${raw.slice(0, Math.max(0, limit - 1))}…`;
}

function toYearNumber(value) {
  const years = [...toText(value).trim().matchAll(/\d{4}/g)].map((match) => Number(match[0]));
  if (years.length === 0) {
    return 0;
  }
  return years[years.length - 1];
}

function sortByDateDescThenOrderAsc(projects) {
  return [...projects].sort((a, b) => {
    const dateDiff = toYearNumber(b.date) - toYearNumber(a.date);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return Number(a.order) - Number(b.order);
  });
}

function isSpeakingProject(project) {
  const category = toText(project.category).toLowerCase();
  return category === "talk" || toText(project.slug).startsWith("speaking-");
}

function validateContent(content) {
  assert(content && typeof content === "object", "content.json must contain an object.");
  assert(content.site && typeof content.site === "object", "site is required.");

  const site = content.site;
  ["title", "description", "canonicalBase", "ogImageDefault", "profileImage"].forEach((field) => {
    assert(toText(site[field]).length > 0, `site.${field} is required.`);
  });
  assert(site.profile && typeof site.profile === "object", "site.profile is required.");
  assert(toDescriptionLines(site.profile.description).length > 0, "site.profile.description is required.");
  if (site.profile.skills !== undefined) {
    assert(Array.isArray(site.profile.skills), "site.profile.skills must be an array.");
    site.profile.skills.forEach((item, index) => {
      assert(toText(item).length > 0, `site.profile.skills[${index}] must not be empty.`);
    });
  }
  if (site.profile.likes !== undefined) {
    assert(Array.isArray(site.profile.likes), "site.profile.likes must be an array.");
    site.profile.likes.forEach((item, index) => {
      assert(toText(item).length > 0, `site.profile.likes[${index}] must not be empty.`);
    });
  }
  assert(Array.isArray(site.profile.career), "site.profile.career must be an array.");
  assert(site.profile.career.length > 0, "site.profile.career must contain at least one item.");
  site.profile.career.forEach((item, index) => {
    assert(item && typeof item === "object", `site.profile.career[${index}] must be an object.`);
    assert(toText(item.period).length > 0, `site.profile.career[${index}].period is required.`);
    assert(toText(item.title).length > 0, `site.profile.career[${index}].title is required.`);
    if (item.url !== undefined) {
      assert(/^https?:\/\//i.test(toText(item.url)), `site.profile.career[${index}].url must be an http(s) URL.`);
    }
  });
  assert(Array.isArray(site.leadBullets), "site.leadBullets must be an array.");
  assert(site.leadBullets.length > 0, "site.leadBullets must contain at least one item.");
  site.leadBullets.forEach((item, index) => {
    assert(toText(item).length > 0, `site.leadBullets[${index}] must not be empty.`);
  });
  assert(Array.isArray(site.snsLinks), "site.snsLinks must be an array.");
  assert(site.snsLinks.length > 0, "site.snsLinks must contain at least one item.");
  site.snsLinks.forEach((item, index) => {
    assert(item && typeof item === "object", `site.snsLinks[${index}] must be an object.`);
    ["name", "accountName", "url", "icon", "bgColor"].forEach((field) => {
      assert(toText(item[field]).length > 0, `site.snsLinks[${index}].${field} is required.`);
    });
  });
  assert(/^https?:\/\//i.test(site.canonicalBase), "site.canonicalBase must start with http:// or https://.");

  assert(Array.isArray(content.projects), "projects must be an array.");
  assert(content.projects.length > 0, "projects must contain at least one item.");

  const slugSet = new Set();
  const orderSet = new Set();

  content.projects.forEach((project, index) => {
    const pointer = `projects[${index}]`;
    assert(project && typeof project === "object", `${pointer} must be an object.`);

    ["slug", "title", "date", "heroImage"].forEach((field) => {
      assert(toText(project[field]).length > 0, `${pointer}.${field} is required.`);
    });
    assert(
      /^\d{4}(?:(?:\s*[〜~-]\s*(?:\d{4}|present))|(?:\s*,\s*\d{4})*)?$/i.test(toText(project.date)),
      `${pointer}.date must use yyyy, yyyy, yyyy, yyyy〜yyyy, or yyyy - PRESENT format.`
    );

    assert(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug),
      `${pointer}.slug must use lowercase letters, numbers, and hyphens.`
    );

    assert(!slugSet.has(project.slug), `Duplicate slug found: ${project.slug}`);
    slugSet.add(project.slug);

    assert(Number.isFinite(Number(project.order)), `${pointer}.order must be a number.`);
    const order = Number(project.order);
    assert(!orderSet.has(order), `${pointer}.order must be unique.`);
    orderSet.add(order);

    assert(Array.isArray(project.tags), `${pointer}.tags must be an array.`);
    assert(project.tags.length > 0, `${pointer}.tags must have at least one item.`);

    assert(Array.isArray(project.ctas), `${pointer}.ctas must be an array.`);
    assert(project.ctas.length <= 2, `${pointer}.ctas supports up to 2 items.`);
    project.ctas.forEach((cta, ctaIndex) => {
      assert(toText(cta.label), `${pointer}.ctas[${ctaIndex}].label is required.`);
      assert(toText(cta.url), `${pointer}.ctas[${ctaIndex}].url is required.`);
    });

    assert(Array.isArray(project.facts), `${pointer}.facts must be an array.`);
    assert(project.facts.length >= 2 && project.facts.length <= 4, `${pointer}.facts must contain 2 to 4 items.`);

    const hasCustomDetailSections = project.detailSections !== undefined;

    assert(Array.isArray(project.screens), `${pointer}.screens must be an array.`);
    if (!hasCustomDetailSections) {
      assert(project.screens.length >= 1, `${pointer}.screens must contain at least one item.`);
    }

    assert(Array.isArray(project.contrib), `${pointer}.contrib must be an array.`);
    if (!hasCustomDetailSections) {
      assert(project.contrib.length >= 5 && project.contrib.length <= 8, `${pointer}.contrib should contain 5 to 8 items.`);
    }

    if (project.designNotes !== undefined) {
      assert(Array.isArray(project.designNotes), `${pointer}.designNotes must be an array when provided.`);
    }

    if (project.links !== undefined) {
      assert(Array.isArray(project.links), `${pointer}.links must be an array when provided.`);
    }

    if (project.descriptionBlocks !== undefined) {
      assert(Array.isArray(project.descriptionBlocks), `${pointer}.descriptionBlocks must be an array when provided.`);
      project.descriptionBlocks.forEach((block, blockIndex) => {
        const blockPointer = `${pointer}.descriptionBlocks[${blockIndex}]`;
        assert(block && typeof block === "object", `${blockPointer} must be an object.`);
        const type = toText(block.type).toLowerCase();
        assert(type === "image" || type === "text", `${blockPointer}.type must be "image" or "text".`);
        if (type === "image") {
          assert(toText(block.src).length > 0, `${blockPointer}.src is required for image blocks.`);
        }
        if (type === "text") {
          assert(toText(block.body).length > 0, `${blockPointer}.body is required for text blocks.`);
        }
      });
    }

    if (project.detailSections !== undefined) {
      if (Array.isArray(project.detailSections)) {
        project.detailSections.forEach((section, sectionIndex) => {
          const sectionPointer = `${pointer}.detailSections[${sectionIndex}]`;
          assert(section && typeof section === "object", `${sectionPointer} must be an object.`);

          if (section.blocks !== undefined) {
            validateDetailContentBlocks(section.blocks, sectionPointer);
          }

          const images = section.images !== undefined ? section.images : section.image !== undefined ? [section.image] : [];
          const hasBody = toDescriptionLines(section.body).length > 0;
          const hasBlocks = Array.isArray(section.blocks) && section.blocks.length > 0;
          assert(hasBlocks || hasBody || images.length > 0, `${sectionPointer} requires body, images, or blocks.`);

          if (section.images !== undefined) {
            assert(Array.isArray(section.images), `${sectionPointer}.images must be an array when provided.`);
          }

          images.forEach((image, imageIndex) => {
            const imagePointer = `${sectionPointer}.images[${imageIndex}]`;
            assert(image && typeof image === "object", `${imagePointer} must be an object.`);
            assert(toText(image.src).length > 0, `${imagePointer}.src is required.`);
          });
        });
      } else {
        assert(project.detailSections && typeof project.detailSections === "object", `${pointer}.detailSections must be an object when provided.`);
        DETAIL_SECTION_CONFIG.forEach((sectionConfig) => {
          const sectionValue = project.detailSections[sectionConfig.key];
          if (sectionValue === undefined) {
            return;
          }
          const sectionPointer = `${pointer}.detailSections.${sectionConfig.key}`;
          assert(sectionValue && typeof sectionValue === "object", `${sectionPointer} must be an object.`);
          if (sectionValue.blocks !== undefined) {
            validateDetailContentBlocks(sectionValue.blocks, sectionPointer);
          }
          const hasBody = toDescriptionLines(sectionValue.body).length > 0;
          const images = sectionValue.images !== undefined ? sectionValue.images : sectionValue.image !== undefined ? [sectionValue.image] : [];
          const hasBlocks = Array.isArray(sectionValue.blocks) && sectionValue.blocks.length > 0;
          assert(hasBlocks || hasBody || images.length > 0, `${sectionPointer} requires body, images, or blocks.`);
          if (sectionValue.image !== undefined) {
            assert(sectionValue.image && typeof sectionValue.image === "object", `${sectionPointer}.image must be an object.`);
            assert(toText(sectionValue.image.src).length > 0, `${sectionPointer}.image.src is required.`);
          }
          if (sectionValue.images !== undefined) {
            assert(Array.isArray(sectionValue.images), `${sectionPointer}.images must be an array when provided.`);
            sectionValue.images.forEach((image, imageIndex) => {
              const imagePointer = `${sectionPointer}.images[${imageIndex}]`;
              assert(image && typeof image === "object", `${imagePointer} must be an object.`);
              assert(toText(image.src).length > 0, `${imagePointer}.src is required.`);
            });
          }
        });
      }
    }
  });
}

function buildProjectCard(project, context, options = {}) {
  const showServiceBrand = options.showServiceBrand !== false;
  const showServiceTitle = showServiceBrand && options.showServiceTitle !== false;
  const showDate = options.showDate !== false;
  const showCategory = options.showCategory === true;
  const bento = project.bento || {};
  const colDesktop = clampInt(bento.colSpan, 1, 12, project.featured ? 6 : 4);
  const rowDesktop = clampInt(bento.rowSpan, 1, 6, project.featured ? 2 : 1);
  const colTablet = clampInt(bento.colSpanTablet, 1, 8, Math.min(colDesktop, 4));
  const rowTablet = clampInt(bento.rowSpanTablet, 1, 6, rowDesktop);
  const colMobile = clampInt(bento.colSpanMobile, 1, 4, 4);
  const rowMobile = clampInt(bento.rowSpanMobile, 1, 6, rowDesktop > 1 ? 2 : 1);

  const style = [
    `--col:${colDesktop}`,
    `--row:${rowDesktop}`,
    `--col-tablet:${colTablet}`,
    `--row-tablet:${rowTablet}`,
    `--col-mobile:${colMobile}`,
    `--row-mobile:${rowMobile}`
  ].join(";");

  const projectPath = withBasePath(context.basePath, `/projects/${project.slug}/`);
  const heroImage = withBasePath(context.basePath, toText(project.heroImage));
  const date = toText(project.date);
  const category = toText(project.category) || "UI Design";
  const linkLabel = [project.title, showCategory ? category : ""]
    .map((item) => toText(item))
    .filter(Boolean)
    .join(" / ");

  return [
    `<a class="card bento-card clothoid-corner" href="${escapeAttr(projectPath)}" style="${escapeAttr(style)}" aria-label="${escapeAttr(linkLabel)}">`,
    `  <div class="bento-card__body">`,
    showServiceTitle ? `    <h2 class="bento-card__title">${escapeHtml(project.title)}</h2>` : "",
    showDate ? `    <p class="bento-card__date">${escapeHtml(date)}</p>` : "",
    showCategory ? `    <p class="bento-card__category">${escapeHtml(category)}</p>` : "",
    `  </div>`,
    `  <figure class="bento-card__media">`,
    `    <img src="${escapeAttr(heroImage)}" alt="${escapeAttr(project.title)} preview" loading="lazy" decoding="async" />`,
    `  </figure>`,
    `</a>`
  ]
    .filter(Boolean)
    .join("\n");
}

function buildProjectSections(projects, context, options = {}) {
  if (options.flatten === true) {
    const orderedItems = [...projects];
    const cards = orderedItems.map((project) => buildProjectCard(project, context, options.cardOptions)).join("\n");
    const label = toText(options.ariaLabel) || "All projects";

    return [
      `<section class="project-section project-section--flat" aria-label="${escapeAttr(label)}">`,
      `  <div class="bento-grid" aria-label="${escapeAttr(label)}">`,
      cards,
      "  </div>",
      "</section>"
    ]
      .filter(Boolean)
      .join("\n");
  }

  const label = toText(options.ariaLabel) || "Projects";
  const orderedItems = sortByDateDescThenOrderAsc(projects);
  const cards = orderedItems.map((project) => buildProjectCard(project, context, options.cardOptions)).join("\n");

  return [
    `<section class="project-section" aria-label="${escapeAttr(label)}">`,
    `  <div class="bento-grid" aria-label="${escapeAttr(label)}">`,
    cards,
    "  </div>",
    "</section>"
  ].join("\n");
}

function buildIndexJsonLd(context, homeCanonical) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        name: context.personName,
        url: context.personUrl || homeCanonical
      },
      {
        "@type": "WebSite",
        name: context.siteTitle,
        description: context.siteDescription,
        url: homeCanonical
      }
    ]
  };
}

function buildProfileJsonLd(context, homeCanonical, profileCanonical, site, basePath) {
  const profileDescription = toDescriptionLines(site.profile.description).join(" ");
  const sameAs = Array.isArray(site.snsLinks)
    ? site.snsLinks
        .map((item) => toText(item.url))
        .filter((url) => /^https?:\/\//i.test(url))
    : [];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        name: context.personName,
        alternateName: context.personSubName || undefined,
        description: profileDescription,
        url: profileCanonical,
        image: toAbsoluteUrl(context.canonicalBase, withBasePath(basePath, site.profileImage)),
        sameAs
      },
      {
        "@type": "WebSite",
        name: context.siteTitle,
        description: context.siteDescription,
        url: homeCanonical
      },
      {
        "@type": "AboutPage",
        name: `${context.personName} Profile`,
        description: truncate(profileDescription, 160),
        url: profileCanonical,
        about: {
          "@type": "Person",
          name: context.personName
        }
      }
    ]
  };
}

function buildSnsCards(site, context) {
  return site.snsLinks
    .map((item) => {
      const name = toText(item.name);
      const accountName = toText(item.accountName);
      const url = toText(item.url);
      const icon = withBasePath(context.basePath, toText(item.icon));
      const bgColor = toText(item.bgColor);
      const textColor = toText(item.textColor) || "#ffffff";
      const style = `--sns-bg:${bgColor};--sns-fg:${textColor};`;

      return [
        `<a class="card sns-card clothoid-corner" href="${escapeAttr(url)}" style="${escapeAttr(style)}"${maybeExternalAttrs(url)}>`,
        `  <span class="sns-card__icon" aria-hidden="true">`,
        `    <img src="${escapeAttr(icon)}" alt="" loading="lazy" decoding="async" />`,
        `  </span>`,
        `  <span class="sns-card__meta">`,
        `    <span class="sns-card__name">${escapeHtml(name)}</span>`,
        `    <span class="sns-card__account">${escapeHtml(accountName)}</span>`,
        `  </span>`,
        `</a>`
      ].join("\n");
    })
    .join("\n");
}

function buildProfileSnsLinks(site) {
  return site.snsLinks
    .map((item) => {
      const name = toText(item.name);
      const url = toText(item.url);

      return `<a class="profile-sns-link" href="${escapeAttr(url)}"${maybeExternalAttrs(url)}>${escapeHtml(name)}</a>`;
    })
    .join('<span class="profile-sns-separator" aria-hidden="true">・</span>');
}

function buildFactCards(project) {
  return project.facts
    .map((fact) => {
      return [
        '<article class="card fact-card">',
        "  <dl>",
        `    <dt>${escapeHtml(fact.label)}</dt>`,
        `    <dd>${escapeHtml(fact.value)}</dd>`,
        "  </dl>",
        "</article>"
      ].join("\n");
    })
    .join("\n");
}

function buildScreen(screen, fallbackAlt) {
  const source = escapeAttr(toText(screen.src));
  const alt = escapeAttr(toText(screen.alt) || fallbackAlt);
  const aspect = escapeAttr(normalizeAspect(screen.aspect));
  const fit = "contain";
  const captionText = toText(screen.caption);
  const media = /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(toText(screen.src))
    ? `<video src="${source}" aria-label="${alt}" muted loop playsinline preload="metadata" data-scroll-video></video>`
    : `<img src="${source}" alt="${alt}" loading="lazy" decoding="async" />`;

  return [
    '<article class="card screen">',
    `  <figure class="screen-media" style="--aspect:${aspect};--fit:${fit};">`,
    `    ${media}`,
    "  </figure>",
    captionText ? `  <p class="screen-caption">${escapeHtml(captionText)}</p>` : "",
    "</article>"
  ]
    .filter(Boolean)
    .join("\n");
}

function resolvePlatformLabel(project) {
  const facts = Array.isArray(project.facts) ? project.facts : [];
  const platformFact = facts.find((fact) => {
    const label = toText(fact.label).toLowerCase();
    return label === "platform" || label === "プラットフォーム";
  });
  return platformFact ? platformFact.value : "-";
}

function resolveRoleLabel(project) {
  const facts = Array.isArray(project.facts) ? project.facts : [];
  const roleFact = facts.find((fact) => {
    const label = toText(fact.label).toLowerCase();
    return label === "role" || label === "担当";
  });
  return roleFact ? roleFact.value : "-";
}

function resolveServiceLabel(project) {
  const serviceValue = project && project.service !== undefined ? project.service : project.title;
  return serviceValue == null ? "-" : serviceValue;
}

function normalizeMetaItems(value) {
  if (Array.isArray(value)) {
    const items = value.map((item) => toText(item)).filter(Boolean);
    return items.length > 0 ? items : ["-"];
  }

  const raw = toText(value);
  if (!raw) {
    return ["-"];
  }

  const items = raw
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : ["-"];
}

function buildDetailMetaList(value) {
  const items = normalizeMetaItems(value);
  return escapeHtml(items.join(", "));
}

function pickScreen(project, index) {
  const screens = Array.isArray(project.screens) ? project.screens : [];
  return screens[index] || null;
}

function normalizeSectionImage(image) {
  return {
    src: toText(image.src),
    alt: toText(image.alt),
    caption: toText(image.caption),
    aspect: toText(image.aspect),
    fit: toText(image.fit)
  };
}

function normalizeSectionImages(value) {
  if (Array.isArray(value)) {
    return value
      .filter((image) => image && toText(image.src).length > 0)
      .map((image) => normalizeSectionImage(image));
  }

  if (value && typeof value === "object" && toText(value.src).length > 0) {
    return [normalizeSectionImage(value)];
  }

  return [];
}

function validateDetailContentBlocks(blocks, pointer) {
  assert(Array.isArray(blocks), `${pointer}.blocks must be an array when provided.`);

  blocks.forEach((block, blockIndex) => {
    const blockPointer = `${pointer}.blocks[${blockIndex}]`;
    assert(block && typeof block === "object", `${blockPointer} must be an object.`);

    const type = toText(block.type).toLowerCase();
    assert(type === "image" || type === "video" || type === "text" || type === "link" || type === "docswell" || type === "youtube", `${blockPointer}.type must be "image", "video", "text", "link", "docswell", or "youtube".`);

    if (type === "image" || type === "video") {
      assert(toText(block.src).length > 0, `${blockPointer}.src is required for ${type} blocks.`);
    }

    if (type === "text") {
      assert(
        toDescriptionLines(block.body).length > 0 || toText(block.heading).length > 0,
        `${blockPointer}.body or ${blockPointer}.heading is required for text blocks.`
      );
    }

    if (type === "link") {
      assert(toText(block.url).length > 0, `${blockPointer}.url is required for link blocks.`);
    }

    if (type === "docswell") {
      assert(toText(block.slideId).length > 0, `${blockPointer}.slideId is required for docswell blocks.`);
      assert(toText(block.url).length > 0, `${blockPointer}.url is required for docswell blocks.`);
    }

    if (type === "youtube") {
      assert(toText(block.src).length > 0, `${blockPointer}.src is required for youtube blocks.`);
    }
  });
}

function normalizeDetailBlock(block) {
  const type = toText(block.type).toLowerCase();

  if (type === "image") {
    return {
      type: "image",
      image: normalizeSectionImage(block)
    };
  }

  if (type === "video") {
    return {
      type: "video",
      video: normalizeSectionImage(block)
    };
  }

  if (type === "link") {
    return {
      type: "link",
      label: toText(block.label) || toText(block.url),
      url: toText(block.url),
      note: toText(block.note)
    };
  }

  if (type === "docswell") {
    return {
      type: "docswell",
      slideId: toText(block.slideId),
      label: toText(block.label) || toText(block.url),
      url: toText(block.url),
      aspect: toText(block.aspect) || "0.563"
    };
  }

  if (type === "youtube") {
    return {
      type: "youtube",
      src: toText(block.src),
      title: toText(block.title) || "YouTube video player"
    };
  }

  return {
    type: "text",
    title: toText(block.heading),
    body: block.body,
    list: block.list === true
  };
}

function toDescriptionLines(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean);
  }

  const raw = toText(value);
  if (!raw) {
    return [];
  }

  return raw
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDescriptionBodyMarkup(value, options = {}) {
  const lines = toDescriptionLines(value);
  if (lines.length === 0) {
    return '<div class="description-body-group"><p class="description-body">-</p></div>';
  }

  const renderInline = (line) =>
    escapeHtml(line).replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      (_match, label, url) => `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label)}</a>`
    );

  if (options.list === true) {
    return [
      '<ul class="description-body-group description-list">',
      lines.map((line) => `  <li class="description-body description-list__item">${renderInline(line)}</li>`).join("\n"),
      "</ul>"
    ].join("\n");
  }

  return [
    '<div class="description-body-group">',
    lines.map((line) => `  <p class="description-body">${renderInline(line)}</p>`).join("\n"),
    "</div>"
  ].join("\n");
}

function stripMarkdownLinks(value) {
  return toText(value).replace(/\[([^\]]+)\]\(https?:\/\/[^)\s]+\)/g, "$1");
}

function buildImpactFallback(project) {
  const linkItems = (Array.isArray(project.links) ? project.links : [])
    .map((link) => toText(link.note) || toText(link.label))
    .filter(Boolean);

  if (linkItems.length > 0) {
    return linkItems;
  }

  return (Array.isArray(project.contrib) ? project.contrib : []).slice(4);
}

function normalizeSectionBlocks(section) {
  if (Array.isArray(section.blocks) && section.blocks.length > 0) {
    return section.blocks.map((block) => normalizeDetailBlock(block));
  }

  const blocks = [];

  if (toDescriptionLines(section.body).length > 0) {
    blocks.push({
      type: "text",
      body: section.body
    });
  }

  normalizeSectionImages(section.images !== undefined ? section.images : section.image).forEach((image) => {
    blocks.push({
      type: "image",
      image
    });
  });

  return blocks;
}

function normalizeDetailSections(project) {
  if (Array.isArray(project.detailSections)) {
    return project.detailSections.map((section) => ({
      title: toText(section.heading),
      blocks: normalizeSectionBlocks(section)
    }));
  }

  const customSections = project.detailSections && typeof project.detailSections === "object" ? project.detailSections : null;
  if (customSections) {
    return DETAIL_SECTION_CONFIG.map((sectionConfig) => {
      const sectionValue = customSections[sectionConfig.key] || {};

      return {
        title: toText(sectionValue.heading),
        blocks: normalizeSectionBlocks(sectionValue)
      };
    });
  }

  const contrib = Array.isArray(project.contrib) ? project.contrib : [];
  const designNotes = Array.isArray(project.designNotes) ? project.designNotes : [];

  return [
    {
      title: "概要",
      blocks: normalizeSectionBlocks({
        body: project.title,
        image: pickScreen(project, 0)
      })
    },
    {
      title: "背景",
      blocks: normalizeSectionBlocks({
        body: contrib.slice(0, 2),
        image: pickScreen(project, 1)
      })
    },
    {
      title: "体験設計",
      blocks: normalizeSectionBlocks({
        body: contrib.slice(2, 4),
        image: pickScreen(project, 2)
      })
    },
    {
      title: "デザインアプローチ",
      blocks: normalizeSectionBlocks({
        body:
          designNotes.length > 0
            ? designNotes.map((note) => {
                const heading = toText(note.heading);
                const body = toText(note.body);
                return heading && body ? `${heading}: ${body}` : heading || body;
              }).filter(Boolean)
            : contrib.slice(1, 4),
        image: pickScreen(project, 3)
      })
    },
    {
      title: "効果",
      blocks: normalizeSectionBlocks({
        body: buildImpactFallback(project),
        image: pickScreen(project, 4)
      })
    }
  ];
}

function buildDescriptionBlockMarkup(block, project, sectionTitle, context, blockIndex) {
  if (block.type === "image" && block.image) {
    const image = block.image;
    const imageSrc = escapeAttr(withBasePath(context.basePath, image.src));
    const imageAlt = escapeAttr(toText(image.alt) || `${project.title} ${sectionTitle} ${blockIndex + 1}`);

    return [
      '<figure class="description-block description-block--image description-item__media">',
      `  <img src="${imageSrc}" alt="${imageAlt}" loading="lazy" decoding="async" style="--aspect:${escapeAttr(normalizeAspect(image.aspect))};--fit:contain;" />`,
      toText(image.caption).length > 0 ? `  <figcaption class="description-image__caption">${escapeHtml(image.caption)}</figcaption>` : "",
      "</figure>"
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (block.type === "video" && block.video) {
    const video = block.video;
    const videoSrc = escapeAttr(withBasePath(context.basePath, video.src));
    const videoAlt = escapeAttr(toText(video.alt) || `${project.title} ${sectionTitle} ${blockIndex + 1}`);

    return [
      '<figure class="description-block description-block--video description-item__media">',
      `  <video src="${videoSrc}" aria-label="${videoAlt}" muted loop playsinline preload="metadata" data-scroll-video style="--aspect:${escapeAttr(normalizeAspect(video.aspect))};--fit:contain;"></video>`,
      toText(video.caption).length > 0 ? `<figcaption class="description-image__caption">${escapeHtml(video.caption)}</figcaption>` : "",
      "</figure>"
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (block.type === "link") {
    const label = toText(block.label) || toText(block.url);
    const note = toText(block.note);

    return [
      '<section class="description-block description-block--link">',
      `  <a class="description-link-card" href="${escapeAttr(block.url)}" target="_blank" rel="noreferrer noopener">`,
      '    <span class="description-link-card__content">',
      `      <span class="description-link-card__label">${escapeHtml(label)}</span>`,
      note ? `      <span class="description-link-card__note">${escapeHtml(note)}</span>` : "",
      "    </span>",
      '    <span class="description-link-card__arrow" aria-hidden="true">↗</span>',
      "  </a>",
      "</section>"
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (block.type === "docswell") {
    return [
      '<section class="description-block description-block--embed">',
      `  <script async class="docswell-embed" src="https://www.docswell.com/assets/libs/docswell-embed/docswell-embed.min.js" data-src="https://www.docswell.com/slide/${escapeAttr(block.slideId)}/embed" data-aspect="${escapeAttr(block.aspect)}"></script>`,
      '  <div class="docswell-link">',
      `    <a href="${escapeAttr(block.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(block.label)}</a>`,
      "  </div>",
      "</section>"
    ].join("\n");
  }

  if (block.type === "youtube") {
    return [
      '<section class="description-block description-block--embed description-block--youtube">',
      `  <iframe src="${escapeAttr(block.src)}" title="${escapeAttr(block.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
      "</section>"
    ].join("\n");
  }

  const bodyLines = toDescriptionLines(block.body);

  return [
    '<section class="description-block description-block--text">',
    block.title ? `  <h3 class="description-block__title">${escapeHtml(block.title)}</h3>` : "",
    bodyLines.length > 0 ? `  ${buildDescriptionBodyMarkup(block.body, { list: block.list })}` : "",
    "</section>"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDescriptionSections(project, context) {
  return normalizeDetailSections(project)
    .filter((section) => Array.isArray(section.blocks) && section.blocks.length > 0)
    .map((section) => {
      const title = toText(section.title);
      const contentMarkup = [
        '<div class="description-item__content">',
        section.blocks.map((block, blockIndex) => `  ${buildDescriptionBlockMarkup(block, project, title, context, blockIndex)}`).join("\n"),
        "</div>"
      ].join("\n");
      const titleMarkup = title
        ? [
            '  <div class="description-item__copy">',
            `    <h2 class="description-subtitle">${escapeHtml(title)}</h2>`,
            "  </div>"
          ].join("\n")
        : "";
      const firstBlockType = toText(section.blocks[0]?.type) || "text";
      const articleClass = [
        "description-item",
        title ? "" : "description-item--untitled",
        firstBlockType === "image" ? "description-item--starts-image" : "description-item--starts-text"
      ]
        .filter(Boolean)
        .join(" ");

      return [
        `<article class="${articleClass}">`,
        titleMarkup,
        contentMarkup,
        "</article>"
      ].filter(Boolean).join("\n");
    })
    .join("\n");
}

function getProjectDescription(project, context) {
  const sectionText = normalizeDetailSections(project)
    .flatMap((section) => section.blocks || [])
    .filter((block) => block.type === "text")
    .flatMap((block) => toDescriptionLines(block.body))
    .find(Boolean);

  return stripMarkdownLinks(sectionText || context.siteDescription || project.title);
}

function buildProjectJsonLd(project, context) {
  const canonicalPath = withBasePath(context.basePath, `/projects/${project.slug}/`);
  const canonicalUrl = toAbsoluteUrl(context.canonicalBase, canonicalPath);
  const imageUrl = toAbsoluteUrl(context.canonicalBase, withBasePath(context.basePath, project.heroImage));
  const platform = (project.facts || []).find((item) => {
    const label = toText(item.label).toLowerCase();
    return label === "platform" || label === "プラットフォーム";
  });
  const projectType = /app/i.test(`${project.title} ${project.tags.join(" ")}`) ? "SoftwareApplication" : "CreativeWork";

  const work = {
    "@type": projectType,
    name: project.title,
    description: truncate(getProjectDescription(project, context), 180),
    image: imageUrl,
    url: canonicalUrl,
    keywords: project.tags.join(", "),
    creator: {
      "@type": "Person",
      name: context.personName
    }
  };

  if (projectType === "SoftwareApplication" && platform) {
    work.operatingSystem = toText(platform.value);
    work.applicationCategory = "Design Case Study";
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        name: context.personName,
        url: context.personUrl || toAbsoluteUrl(context.canonicalBase, withBasePath(context.basePath, "/"))
      },
      {
        "@type": "WebSite",
        name: context.siteTitle,
        description: context.siteDescription,
        url: toAbsoluteUrl(context.canonicalBase, withBasePath(context.basePath, "/"))
      },
      work
    ]
  };
}

function buildOptionalSections(project) {
  const designNotes = Array.isArray(project.designNotes) ? project.designNotes : [];
  const links = Array.isArray(project.links) ? project.links : [];

  const designNotesSection = designNotes.length
    ? [
        "<section>",
        '  <h2 class="section-title">Design Notes</h2>',
        '  <div class="note-grid">',
        designNotes
          .map((note) => {
            return [
              '    <article class="card note-card">',
              `      <h3>${escapeHtml(note.heading)}</h3>`,
              `      <p>${escapeHtml(note.body)}</p>`,
              "    </article>"
            ].join("\n");
          })
          .join("\n"),
        "  </div>",
        "</section>"
      ].join("\n")
    : "";

  const linksSection = links.length
    ? [
        "<section>",
        '  <h2 class="section-title">Links</h2>',
        '  <div class="links-grid">',
        links
          .map((link) => {
            const linkUrl = escapeAttr(toText(link.url));
            const note = toText(link.note);
            return [
              '    <article class="card link-card">',
              `      <a class="inline-link" href="${linkUrl}"${maybeExternalAttrs(linkUrl)}>${escapeHtml(link.label)}</a>`,
              note ? `      <p>${escapeHtml(note)}</p>` : "",
              "    </article>"
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n"),
        "  </div>",
        "</section>"
      ].join("\n")
    : "";

  return {
    designNotesSection,
    linksSection
  };
}

function buildPagination(projects, index, context) {
  const prevIcon = '<svg class="project-detail-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>';
  const nextIcon = '<svg class="project-detail-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M12 5l7 7-7 7" /></svg>';

  if (index < 0) {
    return [
      '<div class="project-detail-nav" role="navigation" aria-label="Project navigation">',
      `<span class="project-detail-nav__link project-detail-nav__link--prev project-detail-nav__link--disabled" aria-disabled="true" aria-label="Previous project">${prevIcon}</span>`,
      '<span class="project-detail-nav__count" aria-label="Project position">-/-</span>',
      `<span class="project-detail-nav__link project-detail-nav__link--next project-detail-nav__link--disabled" aria-disabled="true" aria-label="Next project">${nextIcon}</span>`,
      "</div>"
    ].join("\n");
  }

  const prev = projects[index - 1];
  const next = projects[index + 1];

  const prevMarkup = prev
    ? `<a class="project-detail-nav__link project-detail-nav__link--prev" href="${escapeAttr(withBasePath(context.basePath, `/projects/${prev.slug}/`))}" aria-label="${escapeAttr(`Previous: ${prev.title}`)}">${prevIcon}</a>`
    : `<span class="project-detail-nav__link project-detail-nav__link--prev project-detail-nav__link--disabled" aria-disabled="true" aria-label="Previous project">${prevIcon}</span>`;

  const nextMarkup = next
    ? `<a class="project-detail-nav__link project-detail-nav__link--next" href="${escapeAttr(withBasePath(context.basePath, `/projects/${next.slug}/`))}" aria-label="${escapeAttr(`Next: ${next.title}`)}">${nextIcon}</a>`
    : `<span class="project-detail-nav__link project-detail-nav__link--next project-detail-nav__link--disabled" aria-disabled="true" aria-label="Next project">${nextIcon}</span>`;
  const countMarkup = `<span class="project-detail-nav__count" aria-label="${escapeAttr(`Project ${index + 1} of ${projects.length}`)}">${index + 1}/${projects.length}</span>`;

  return [
    '<div class="project-detail-nav" role="navigation" aria-label="Project navigation">',
    prevMarkup,
    countMarkup,
    nextMarkup,
    "</div>"
  ].join("\n");
}

function buildProjectPage(project, index, projects, template, context) {
  const projectPath = withBasePath(context.basePath, `/projects/${project.slug}/`);
  const homePath = withBasePath(context.basePath, "/");
  const workPath = `${homePath}#works`;
  const profilePath = withBasePath(context.basePath, "/profile/");
  const canonicalUrl = toAbsoluteUrl(context.canonicalBase, projectPath);
  const ogImageUrl = toAbsoluteUrl(context.canonicalBase, withBasePath(context.basePath, project.heroImage));
  const serviceValue = resolveServiceLabel(project);
  const platformValue = resolvePlatformLabel(project);
  const roleValue = resolveRoleLabel(project);
  const descriptionSections = buildDescriptionSections(project, context);

  const pageTitle = `${project.title} | ${context.siteTitle}`;
  const metaDescription = truncate(getProjectDescription(project, context), 160);

  return renderTemplate(template, {
    PAGE_TITLE: escapeHtml(pageTitle),
    META_DESCRIPTION: escapeAttr(metaDescription),
    CANONICAL_URL: escapeAttr(canonicalUrl),
    OG_TITLE: escapeAttr(project.title),
    OG_DESCRIPTION: escapeAttr(metaDescription),
    OG_IMAGE: escapeAttr(ogImageUrl),
    OG_URL: escapeAttr(canonicalUrl),
    ASSET_PREFIX: context.basePath,
    ASSET_VERSION: escapeAttr(context.assetVersion),
    JSON_LD: safeJsonLd(buildProjectJsonLd(project, context)),
    GRID_TOGGLE: GRID_TOGGLE_HTML,
    GRID_COLUMNS: GRID_COLUMNS_HTML,
    HOME_URL: escapeAttr(homePath),
    WORK_URL: escapeAttr(workPath),
    PROFILE_URL: escapeAttr(profilePath),
    PROJECT_TITLE: escapeHtml(project.title),
    PROJECT_NAV: buildPagination(projects, index, context),
    PROJECT_SERVICE: buildDetailMetaList(serviceValue),
    PROJECT_DATE: buildDetailMetaList(project.date),
    PROJECT_PLATFORM: buildDetailMetaList(platformValue),
    PROJECT_ROLE: buildDetailMetaList(roleValue),
    HERO_IMAGE: escapeAttr(withBasePath(context.basePath, project.heroImage)),
    HERO_ALT: escapeAttr(`${project.title} hero image`),
    DESCRIPTION_SECTIONS: descriptionSections
  });
}

function buildProfileDescriptionMarkup(value, spanLines) {
  const paragraphs = toDescriptionLines(value);
  if (paragraphs.length === 0) {
    return '<p class="profile-description__body">-</p>';
  }

  return paragraphs
    .map((paragraph, index) => {
      const candidateSpans = Array.isArray(spanLines?.[index])
        ? spanLines[index].map((item) => toText(item)).filter(Boolean)
        : [];
      const spans = candidateSpans.join("") === paragraph ? candidateSpans : [paragraph];
      const body = spans.map((span) => `<span>${escapeHtml(span)}</span>`).join("");
      return `<p class="profile-description__body">${body}</p>`;
    })
    .join("\n");
}

function buildCareerItems(careerItems) {
  return careerItems
    .map((item) => {
      const titleText = toText(item.title);
      const linkText = toText(item.linkText);
      const titleSuffix = linkText && titleText.length > linkText.length
        ? ` ${escapeHtml(titleText.slice(linkText.length).trim())}`
        : "";
      const title = item.url
        ? `<a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(linkText || titleText)}</a>${titleSuffix}`
        : escapeHtml(titleText);
      return [
        '<article class="career-item">',
        `  <p class="career-item__period">${escapeHtml(item.period)}</p>`,
        `  <p class="career-item__title">${title}</p>`,
        "</article>"
      ].join("\n");
    })
    .join("\n");
}

function buildProfileInlineText(items) {
  const normalized = Array.isArray(items) ? items.map((item) => toText(item)).filter(Boolean) : [];
  const text = normalized.length > 0 ? normalized.join(" / ") : "-";
  return `<p class="profile-inline-text">${escapeHtml(text)}</p>`;
}

function buildSite(options = {}) {
  const logger = options.logger || console;
  const content = readJson(CONTENT_PATH);
  validateContent(content);

  const site = content.site;
  const basePath = normalizeBasePath(site.basePath || "");
  const canonicalBase = toText(site.canonicalBase).replace(/\/+$/, "");
  const assetVersion = buildAssetVersion();
  const context = {
    basePath,
    canonicalBase,
    assetVersion,
    siteTitle: toText(site.title),
    siteDescription: toText(site.description),
    personName: toText(site.personName) || toText(site.title),
    personSubName: toText(site.personSubName),
    personUrl: toText(site.personUrl)
  };

  const projects = [...content.projects].sort((a, b) => Number(a.order) - Number(b.order));

  const indexTemplate = readTemplate(INDEX_TEMPLATE_PATH);
  const projectTemplate = readTemplate(PROJECT_TEMPLATE_PATH);

  const workProjects = projects.filter((project) => !isSpeakingProject(project));
  const speakingProjects = projects.filter((project) => isSpeakingProject(project));
  const homeWorkProjects = sortByDateDescThenOrderAsc(workProjects);
  const navigationWorkProjects = homeWorkProjects;
  const navigationSpeakingProjects = sortByDateDescThenOrderAsc(speakingProjects);
  const projectSections = buildProjectSections(homeWorkProjects, context, {
    flatten: true,
    ariaLabel: "All works",
    showTitle: false,
    cardOptions: { showDate: true, showCategory: false }
  });
  const snsCards = buildSnsCards(site, context);
  const siteLeadBullets = site.leadBullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
  const homePath = withBasePath(basePath, "/");
  const workPath = `${homePath}#works`;
  const profilePath = withBasePath(basePath, "/profile/");
  const homeCanonical = toAbsoluteUrl(canonicalBase, homePath);
  const defaultOgImage = toAbsoluteUrl(canonicalBase, withBasePath(basePath, site.ogImageDefault));
  const homeMetaDescription = truncate(context.siteDescription, 160);

  const indexJsonLd = buildIndexJsonLd(context, homeCanonical);

  const personSubNameMarkup = context.personSubName
    ? `<p class="masthead-subname">${escapeHtml(context.personSubName)}</p>`
    : "";

  const indexHtml = renderTemplate(indexTemplate, {
    PAGE_TITLE: escapeHtml(context.siteTitle),
    META_DESCRIPTION: escapeAttr(homeMetaDescription),
    CANONICAL_URL: escapeAttr(homeCanonical),
    OG_TITLE: escapeAttr(context.siteTitle),
    OG_DESCRIPTION: escapeAttr(homeMetaDescription),
    OG_IMAGE: escapeAttr(defaultOgImage),
    OG_URL: escapeAttr(homeCanonical),
    ASSET_PREFIX: basePath,
    ASSET_VERSION: escapeAttr(assetVersion),
    JSON_LD: safeJsonLd(indexJsonLd),
    GRID_TOGGLE: GRID_TOGGLE_HTML,
    GRID_COLUMNS: GRID_COLUMNS_HTML,
    HOME_URL: escapeAttr(homePath),
    WORK_URL: escapeAttr(workPath),
    PROFILE_URL: escapeAttr(profilePath),
    SITE_TITLE: escapeHtml(context.siteTitle),
    PERSON_NAME: escapeHtml(context.personName),
    PERSON_SUBNAME: personSubNameMarkup,
    PROFILE_IMAGE: escapeAttr(withBasePath(basePath, site.profileImage)),
    PROFILE_DESCRIPTION: buildProfileDescriptionMarkup(site.profile.description, site.profile.descriptionSpans),
    CAREER_ITEMS: buildCareerItems(site.profile.career),
    SITE_DESCRIPTION: escapeHtml(context.siteDescription),
    SITE_LEAD_BULLETS: siteLeadBullets,
    SNS_CARDS: snsCards,
    PROJECT_SECTIONS: projectSections
  });

  fs.writeFileSync(OUTPUT_INDEX_PATH, indexHtml, "utf8");

  fs.rmSync(OUTPUT_PROJECTS_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_PROJECTS_DIR, { recursive: true });

  fs.rmSync(OUTPUT_PROFILE_DIR, { recursive: true, force: true });

  projects.forEach((project) => {
    const navigationProjects = isSpeakingProject(project) ? navigationSpeakingProjects : navigationWorkProjects;
    const navigationIndex = navigationProjects.findIndex((item) => item.slug === project.slug);
    const pageHtml = buildProjectPage(project, navigationIndex, navigationProjects, projectTemplate, context);
    const outputDir = path.join(OUTPUT_PROJECTS_DIR, project.slug);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "index.html"), pageHtml, "utf8");
  });

  logger.log(`Built ${projects.length} projects.`);
  logger.log(`- ${path.relative(ROOT, OUTPUT_INDEX_PATH)}`);
  projects.forEach((project) => {
    logger.log(`- projects/${project.slug}/index.html`);
  });

  return {
    projectCount: projects.length,
    outputs: [
      OUTPUT_INDEX_PATH,
      ...projects.map((project) => path.join(OUTPUT_PROJECTS_DIR, project.slug, "index.html"))
    ]
  };
}

if (require.main === module) {
  try {
    buildSite();
  } catch (error) {
    console.error("Build failed:", error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  ROOT,
  WATCH_TARGETS,
  buildSite
};
