#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_PATH = path.join(ROOT, "content.json");
const INDEX_TEMPLATE_PATH = path.join(ROOT, "templates", "index.template.html");
const PROJECT_TEMPLATE_PATH = path.join(ROOT, "templates", "project.template.html");
const OUTPUT_INDEX_PATH = path.join(ROOT, "index.html");
const OUTPUT_PROJECTS_DIR = path.join(ROOT, "projects");

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

function validateContent(content) {
  assert(content && typeof content === "object", "content.json must contain an object.");
  assert(content.site && typeof content.site === "object", "site is required.");

  const site = content.site;
  ["title", "description", "canonicalBase", "ogImageDefault", "profileImage"].forEach((field) => {
    assert(toText(site[field]).length > 0, `site.${field} is required.`);
  });
  assert(Array.isArray(site.indexSections), "site.indexSections must be an array.");
  assert(site.indexSections.length > 0, "site.indexSections must contain at least one section.");
  site.indexSections.forEach((sectionName, sectionIndex) => {
    assert(toText(sectionName).length > 0, `site.indexSections[${sectionIndex}] must not be empty.`);
  });

  assert(/^https?:\/\//i.test(site.canonicalBase), "site.canonicalBase must start with http:// or https://.");

  assert(Array.isArray(content.projects), "projects must be an array.");
  assert(content.projects.length > 0, "projects must contain at least one item.");

  const slugSet = new Set();
  const orderSet = new Set();

  content.projects.forEach((project, index) => {
    const pointer = `projects[${index}]`;
    assert(project && typeof project === "object", `${pointer} must be an object.`);

    ["slug", "title", "summary", "section", "serviceIcon", "heroImage"].forEach((field) => {
      assert(toText(project[field]).length > 0, `${pointer}.${field} is required.`);
    });
    assert(
      site.indexSections.includes(project.section),
      `${pointer}.section must be one of site.indexSections.`
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

    assert(Array.isArray(project.screens), `${pointer}.screens must be an array.`);
    assert(project.screens.length >= 1, `${pointer}.screens must contain at least one item.`);

    assert(Array.isArray(project.contrib), `${pointer}.contrib must be an array.`);
    assert(project.contrib.length >= 5 && project.contrib.length <= 8, `${pointer}.contrib should contain 5 to 8 items.`);

    if (project.designNotes !== undefined) {
      assert(Array.isArray(project.designNotes), `${pointer}.designNotes must be an array when provided.`);
    }

    if (project.links !== undefined) {
      assert(Array.isArray(project.links), `${pointer}.links must be an array when provided.`);
    }
  });
}

function buildProjectCard(project, context) {
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
  const serviceIcon = withBasePath(context.basePath, toText(project.serviceIcon));
  const heroImage = withBasePath(context.basePath, toText(project.heroImage));

  return [
    `<a class="card bento-card" href="${escapeAttr(projectPath)}" style="${escapeAttr(style)}">`,
    `  <div class="bento-card__body">`,
    `    <span class="bento-card__service" aria-hidden="true">`,
    `      <img src="${escapeAttr(serviceIcon)}" alt="" loading="lazy" decoding="async" />`,
    `    </span>`,
    `    <h2 class="bento-card__title">${escapeHtml(project.title)}</h2>`,
    `    <p class="bento-card__summary">${escapeHtml(project.summary)}</p>`,
    `  </div>`,
    `  <figure class="bento-card__media">`,
    `    <img src="${escapeAttr(heroImage)}" alt="${escapeAttr(project.title)} preview" loading="lazy" decoding="async" />`,
    `  </figure>`,
    `</a>`
  ].join("\n");
}

function toSectionId(value) {
  return (
    toText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

function buildProjectSections(projects, context, sectionOrder) {
  const sectionMap = new Map(sectionOrder.map((sectionName) => [sectionName, []]));

  projects.forEach((project) => {
    const sectionName = toText(project.section);
    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, []);
    }
    sectionMap.get(sectionName).push(project);
  });

  return [...sectionMap.entries()]
    .map(([sectionName, items], sectionIndex) => {
      if (!items.length) {
        return "";
      }
      const sectionId = `project-section-${sectionIndex + 1}-${toSectionId(sectionName)}`;
      const cards = items.map((project) => buildProjectCard(project, context)).join("\n");

      return [
        `<section class="project-section" aria-labelledby="${escapeAttr(sectionId)}">`,
        `  <h2 class="project-section__title" id="${escapeAttr(sectionId)}">${escapeHtml(sectionName)}</h2>`,
        `  <div class="bento-grid" aria-label="${escapeAttr(`${sectionName} projects`)}">`,
        cards,
        "  </div>",
        "</section>"
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n");
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
  const fit = toText(screen.fit) === "contain" ? "contain" : "cover";
  const captionText = toText(screen.caption);

  return [
    '<article class="card screen">',
    `  <figure class="screen-media" style="--aspect:${aspect};--fit:${fit};">`,
    `    <img src="${source}" alt="${alt}" loading="lazy" decoding="async" />`,
    "  </figure>",
    captionText ? `  <p class="screen-caption">${escapeHtml(captionText)}</p>` : "",
    "</article>"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildProjectJsonLd(project, context) {
  const canonicalPath = withBasePath(context.basePath, `/projects/${project.slug}/`);
  const canonicalUrl = toAbsoluteUrl(context.canonicalBase, canonicalPath);
  const imageUrl = toAbsoluteUrl(context.canonicalBase, withBasePath(context.basePath, project.heroImage));
  const platform = (project.facts || []).find((item) => toText(item.label).toLowerCase() === "platform");
  const projectType = /app/i.test(`${project.title} ${project.tags.join(" ")}`) ? "SoftwareApplication" : "CreativeWork";

  const work = {
    "@type": projectType,
    name: project.title,
    description: truncate(project.summary, 180),
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
  const prev = projects[index - 1];
  const next = projects[index + 1];
  const homePath = withBasePath(context.basePath, "/");

  const prevMarkup = prev
    ? `<a href="${escapeAttr(withBasePath(context.basePath, `/projects/${prev.slug}/`))}">← ${escapeHtml(prev.title)}</a>`
    : '<span aria-hidden="true"></span>';

  const nextMarkup = next
    ? `<a href="${escapeAttr(withBasePath(context.basePath, `/projects/${next.slug}/`))}">${escapeHtml(next.title)} →</a>`
    : '<span aria-hidden="true"></span>';

  const backMarkup = `<a href="${escapeAttr(homePath)}">Back</a>`;

  return [
    `<span class="project-nav__slot">${prevMarkup}</span>`,
    `<span class="project-nav__slot">${backMarkup}</span>`,
    `<span class="project-nav__slot">${nextMarkup}</span>`
  ].join("\n");
}

function buildProjectPage(project, index, projects, template, context) {
  const homePath = withBasePath(context.basePath, "/");
  const projectPath = withBasePath(context.basePath, `/projects/${project.slug}/`);
  const canonicalUrl = toAbsoluteUrl(context.canonicalBase, projectPath);
  const ogImageUrl = toAbsoluteUrl(context.canonicalBase, withBasePath(context.basePath, project.heroImage));

  const primaryCta = project.ctas[0] ? buildCtaLink(project.ctas[0], "button button--ghost") : "";
  const heroCtas = project.ctas
    .map((cta, ctaIndex) => buildCtaLink(cta, ctaIndex === 0 ? "button" : "button button--ghost"))
    .join("\n");

  const tags = project.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("");
  const facts = buildFactCards(project);

  const screensWithBasePath = project.screens.map((screen) => ({
    ...screen,
    src: withBasePath(context.basePath, screen.src)
  }));

  const [firstScreen, ...otherScreens] = screensWithBasePath;
  const primaryScreen = buildScreen(firstScreen, `${project.title} screen`);
  const secondaryScreens = otherScreens
    .map((screen) => buildScreen(screen, `${project.title} screen`))
    .join("\n");

  const contribList = project.contrib.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
  const optionalSections = buildOptionalSections(project);
  const pagination = buildPagination(projects, index, context);

  const pageTitle = `${project.title} | ${context.siteTitle}`;
  const metaDescription = truncate(project.summary, 160);

  return renderTemplate(template, {
    PAGE_TITLE: escapeHtml(pageTitle),
    META_DESCRIPTION: escapeAttr(metaDescription),
    CANONICAL_URL: escapeAttr(canonicalUrl),
    OG_TITLE: escapeAttr(project.title),
    OG_DESCRIPTION: escapeAttr(metaDescription),
    OG_IMAGE: escapeAttr(ogImageUrl),
    OG_URL: escapeAttr(canonicalUrl),
    ASSET_PREFIX: context.basePath,
    JSON_LD: safeJsonLd(buildProjectJsonLd(project, context)),
    HOME_URL: escapeAttr(homePath),
    TOPBAR_CTA: primaryCta,
    PROJECT_TITLE: escapeHtml(project.title),
    PROJECT_SUMMARY: escapeHtml(project.summary),
    PROJECT_TAGS: tags,
    HERO_CTAS: heroCtas,
    HERO_IMAGE: escapeAttr(withBasePath(context.basePath, project.heroImage)),
    HERO_ALT: escapeAttr(`${project.title} hero image`),
    FACT_CARDS: facts,
    PRIMARY_SCREEN: primaryScreen,
    SECONDARY_SCREENS: secondaryScreens,
    CONTRIB_LIST: contribList,
    DESIGN_NOTES_SECTION: optionalSections.designNotesSection,
    LINKS_SECTION: optionalSections.linksSection,
    PAGINATION: pagination
  });
}

function buildSite() {
  const content = readJson(CONTENT_PATH);
  validateContent(content);

  const site = content.site;
  const basePath = normalizeBasePath(site.basePath || "");
  const canonicalBase = toText(site.canonicalBase).replace(/\/+$/, "");
  const context = {
    basePath,
    canonicalBase,
    siteTitle: toText(site.title),
    siteDescription: toText(site.description),
    personName: toText(site.personName) || toText(site.title),
    personUrl: toText(site.personUrl)
  };

  const projects = [...content.projects].sort((a, b) => Number(a.order) - Number(b.order));
  const sectionOrder = site.indexSections.map((sectionName) => toText(sectionName));

  const indexTemplate = readTemplate(INDEX_TEMPLATE_PATH);
  const projectTemplate = readTemplate(PROJECT_TEMPLATE_PATH);

  const projectSections = buildProjectSections(projects, context, sectionOrder);
  const homePath = withBasePath(basePath, "/");
  const homeCanonical = toAbsoluteUrl(canonicalBase, homePath);
  const defaultOgImage = toAbsoluteUrl(canonicalBase, withBasePath(basePath, site.ogImageDefault));

  const indexJsonLd = {
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

  const indexHtml = renderTemplate(indexTemplate, {
    PAGE_TITLE: escapeHtml(context.siteTitle),
    META_DESCRIPTION: escapeAttr(truncate(context.siteDescription, 160)),
    CANONICAL_URL: escapeAttr(homeCanonical),
    OG_TITLE: escapeAttr(context.siteTitle),
    OG_DESCRIPTION: escapeAttr(truncate(context.siteDescription, 160)),
    OG_IMAGE: escapeAttr(defaultOgImage),
    OG_URL: escapeAttr(homeCanonical),
    ASSET_PREFIX: basePath,
    JSON_LD: safeJsonLd(indexJsonLd),
    SITE_TITLE: escapeHtml(context.siteTitle),
    PERSON_NAME: escapeHtml(context.personName),
    PROFILE_IMAGE: escapeAttr(withBasePath(basePath, site.profileImage)),
    SITE_DESCRIPTION: escapeHtml(context.siteDescription),
    PROJECT_SECTIONS: projectSections
  });

  fs.writeFileSync(OUTPUT_INDEX_PATH, indexHtml, "utf8");

  fs.rmSync(OUTPUT_PROJECTS_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_PROJECTS_DIR, { recursive: true });

  projects.forEach((project, index) => {
    const pageHtml = buildProjectPage(project, index, projects, projectTemplate, context);
    const outputDir = path.join(OUTPUT_PROJECTS_DIR, project.slug);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "index.html"), pageHtml, "utf8");
  });

  console.log(`Built ${projects.length} projects.`);
  console.log(`- ${path.relative(ROOT, OUTPUT_INDEX_PATH)}`);
  projects.forEach((project) => {
    console.log(`- projects/${project.slug}/index.html`);
  });
}

try {
  buildSite();
} catch (error) {
  console.error("Build failed:", error.message);
  process.exitCode = 1;
}
