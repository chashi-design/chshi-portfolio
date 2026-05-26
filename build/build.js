#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_PATH = path.join(ROOT, "content.json");
const INDEX_TEMPLATE_PATH = path.join(ROOT, "templates", "index.template.html");
const PROJECT_TEMPLATE_PATH = path.join(ROOT, "templates", "project.template.html");
const PROJECTS_TEMPLATE_PATH = path.join(ROOT, "templates", "projects.template.html");
const PROFILE_TEMPLATE_PATH = path.join(ROOT, "templates", "profile.template.html");
const OUTPUT_INDEX_PATH = path.join(ROOT, "index.html");
const OUTPUT_PROJECTS_DIR = path.join(ROOT, "projects");
const OUTPUT_PROJECTS_INDEX_PATH = path.join(OUTPUT_PROJECTS_DIR, "index.html");
const OUTPUT_PROFILE_DIR = path.join(ROOT, "profile");
const OUTPUT_PROFILE_INDEX_PATH = path.join(OUTPUT_PROFILE_DIR, "index.html");

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

function toYearMonthNumber(value) {
  const matched = toText(value).match(/^(\d{4})\/(0[1-9]|1[0-2])$/);
  if (!matched) {
    return 0;
  }
  return Number(matched[1]) * 100 + Number(matched[2]);
}

function sortByDateDescThenOrderAsc(projects) {
  return [...projects].sort((a, b) => {
    const dateDiff = toYearMonthNumber(b.date) - toYearMonthNumber(a.date);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return Number(a.order) - Number(b.order);
  });
}

function getFeaturedProjects(projects, fallbackCount) {
  const featured = projects.filter((project) => project.featured === true);
  if (featured.length > 0) {
    return [...featured].sort((a, b) => Number(a.order) - Number(b.order));
  }
  return projects.slice(0, Math.max(1, fallbackCount));
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

    ["slug", "title", "date", "subtitle", "summary", "section", "serviceIcon", "heroImage"].forEach((field) => {
      assert(toText(project[field]).length > 0, `${pointer}.${field} is required.`);
    });
    assert(
      /^\d{4}\/(0[1-9]|1[0-2])$/.test(toText(project.date)),
      `${pointer}.date must use yyyy/mm format.`
    );
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
          assert(toText(block.subtitle).length > 0, `${blockPointer}.subtitle is required for text blocks.`);
          assert(toText(block.body).length > 0, `${blockPointer}.body is required for text blocks.`);
        }
      });
    }

    if (project.detailSections !== undefined) {
      if (Array.isArray(project.detailSections)) {
        project.detailSections.forEach((section, sectionIndex) => {
          const sectionPointer = `${pointer}.detailSections[${sectionIndex}]`;
          assert(section && typeof section === "object", `${sectionPointer} must be an object.`);
          assert(toText(section.heading).length > 0, `${sectionPointer}.heading is required.`);

          const images = section.images !== undefined ? section.images : section.image !== undefined ? [section.image] : [];
          const hasBody = section.body !== undefined && (Array.isArray(section.body) ? section.body.length > 0 : toText(section.body).length > 0);
          assert(hasBody || images.length > 0, `${sectionPointer} requires body or images.`);

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
          assert(sectionValue.body !== undefined, `${sectionPointer}.body is required.`);
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
  const date = toText(project.date);

  return [
    `<a class="card bento-card clothoid-corner" href="${escapeAttr(projectPath)}" style="${escapeAttr(style)}">`,
    `  <div class="bento-card__body">`,
    `    <span class="bento-card__service" aria-hidden="true">`,
    `      <img src="${escapeAttr(serviceIcon)}" alt="" loading="lazy" decoding="async" />`,
    `    </span>`,
    `    <h2 class="bento-card__title">${escapeHtml(project.title)}</h2>`,
    `    <p class="bento-card__date">${escapeHtml(date)}</p>`,
    `    <p class="bento-card__subtitle">${escapeHtml(project.subtitle)}</p>`,
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
      const orderedItems = sortByDateDescThenOrderAsc(items);
      const sectionId = `project-section-${sectionIndex + 1}-${toSectionId(sectionName)}`;
      const cards = orderedItems.map((project) => buildProjectCard(project, context)).join("\n");

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

function buildProjectsIndexJsonLd(context, homeCanonical, projectsCanonical, projects, basePath) {
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
      },
      {
        "@type": "CollectionPage",
        name: `${context.siteTitle} All Works`,
        description: `All portfolio works (${projects.length})`,
        url: projectsCanonical
      },
      {
        "@type": "ItemList",
        itemListElement: projects.map((project, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: toAbsoluteUrl(context.canonicalBase, withBasePath(basePath, `/projects/${project.slug}/`)),
          name: toText(project.title)
        }))
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
  return [
    '<ul class="detail-meta-list">',
    items.map((item) => `  <li>${escapeHtml(item)}</li>`).join("\n"),
    "</ul>"
  ].join("\n");
}

function pickScreen(project, index) {
  const screens = Array.isArray(project.screens) ? project.screens : [];
  return screens[index] || null;
}

function normalizeSectionImage(image) {
  return {
    src: toText(image.src),
    alt: toText(image.alt),
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

function buildDescriptionBodyMarkup(value) {
  const lines = toDescriptionLines(value);
  if (lines.length === 0) {
    return '<div class="description-body-group"><p class="description-body">-</p></div>';
  }

  return [
    '<div class="description-body-group">',
    lines.map((line) => `  <p class="description-body">${escapeHtml(line)}</p>`).join("\n"),
    "</div>"
  ].join("\n");
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

function normalizeDetailSections(project) {
  if (Array.isArray(project.detailSections)) {
    return project.detailSections.map((section, index) => ({
      title: toText(section.heading) || `Section ${index + 1}`,
      body: section.body,
      images: normalizeSectionImages(section.images !== undefined ? section.images : section.image)
    }));
  }

  const customSections = project.detailSections && typeof project.detailSections === "object" ? project.detailSections : null;
  if (customSections) {
    return DETAIL_SECTION_CONFIG.map((sectionConfig) => {
      const sectionValue = customSections[sectionConfig.key] || {};

      return {
        title: toText(sectionValue.heading) || sectionConfig.title,
        body: sectionValue.body,
        images: normalizeSectionImages(sectionValue.images !== undefined ? sectionValue.images : sectionValue.image)
      };
    });
  }

  const contrib = Array.isArray(project.contrib) ? project.contrib : [];
  const designNotes = Array.isArray(project.designNotes) ? project.designNotes : [];

  return [
    {
      title: "概要",
      body: project.summary,
      images: normalizeSectionImages(pickScreen(project, 0))
    },
    {
      title: "背景",
      body: contrib.slice(0, 2),
      images: normalizeSectionImages(pickScreen(project, 1))
    },
    {
      title: "体験設計",
      body: contrib.slice(2, 4),
      images: normalizeSectionImages(pickScreen(project, 2))
    },
    {
      title: "デザインアプローチ",
      body:
        designNotes.length > 0
          ? designNotes.map((note) => {
              const heading = toText(note.heading);
              const body = toText(note.body);
              return heading && body ? `${heading}: ${body}` : heading || body;
            }).filter(Boolean)
          : contrib.slice(1, 4),
      images: normalizeSectionImages(pickScreen(project, 3))
    },
    {
      title: "効果",
      body: buildImpactFallback(project),
      images: normalizeSectionImages(pickScreen(project, 4))
    }
  ];
}

function buildDescriptionSections(project, context) {
  return normalizeDetailSections(project)
    .filter((section) => toDescriptionLines(section.body).length > 0 || (Array.isArray(section.images) && section.images.length > 0))
    .map((section, index) => {
      const copyMarkup = [
        '<div class="description-item__copy">',
        `  <h2 class="description-subtitle">${escapeHtml(section.title)}</h2>`,
        `  ${buildDescriptionBodyMarkup(section.body)}`,
        "</div>"
      ].join("\n");

      const images = Array.isArray(section.images) ? section.images : [];
      const mediaMarkup = images.length
        ? [
            '<div class="description-item__media-group">',
            images
              .map((image, imageIndex) => {
                return [
                  '  <figure class="description-item__media">',
                  `    <img src="${escapeAttr(withBasePath(context.basePath, image.src))}" alt="${escapeAttr(toText(image.alt) || `${project.title} ${section.title} ${imageIndex + 1}`)}" loading="lazy" decoding="async" style="--aspect:${escapeAttr(normalizeAspect(image.aspect))};--fit:${escapeAttr(toText(image.fit) === "contain" ? "contain" : "cover")};" />`,
                  "  </figure>"
                ].join("\n");
              })
              .join("\n"),
            "</div>"
          ].join("\n")
        : "";

      return [
        '<article class="description-item">',
        [copyMarkup, mediaMarkup].filter(Boolean).join("\n"),
        "</article>"
      ].join("\n");
    })
    .join("\n");
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
  const projectPath = withBasePath(context.basePath, `/projects/${project.slug}/`);
  const homePath = withBasePath(context.basePath, "/");
  const projectsPath = withBasePath(context.basePath, "/projects/");
  const profilePath = withBasePath(context.basePath, "/profile/");
  const canonicalUrl = toAbsoluteUrl(context.canonicalBase, projectPath);
  const ogImageUrl = toAbsoluteUrl(context.canonicalBase, withBasePath(context.basePath, project.heroImage));
  const serviceValue = resolveServiceLabel(project);
  const platformValue = resolvePlatformLabel(project);
  const roleValue = resolveRoleLabel(project);
  const descriptionSections = buildDescriptionSections(project, context);

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
    WORK_URL: escapeAttr(projectsPath),
    PROFILE_URL: escapeAttr(profilePath),
    PROJECT_TITLE: escapeHtml(project.title),
    PROJECT_SUBTITLE: escapeHtml(project.subtitle),
    PROJECT_SERVICE: buildDetailMetaList(serviceValue),
    PROJECT_DATE: buildDetailMetaList(project.date),
    PROJECT_SUMMARY: escapeHtml(project.summary),
    PROJECT_PLATFORM: buildDetailMetaList(platformValue),
    PROJECT_ROLE: buildDetailMetaList(roleValue),
    HERO_IMAGE: escapeAttr(withBasePath(context.basePath, project.heroImage)),
    HERO_ALT: escapeAttr(`${project.title} hero image`),
    DESCRIPTION_SECTIONS: descriptionSections
  });
}

function buildProfileDescriptionMarkup(value) {
  const paragraphs = toDescriptionLines(value);
  if (paragraphs.length === 0) {
    return '<p class="profile-description__body">-</p>';
  }

  return paragraphs.map((paragraph) => `<p class="profile-description__body">${escapeHtml(paragraph)}</p>`).join("\n");
}

function buildCareerItems(careerItems) {
  return careerItems
    .map((item) => {
      return [
        '<article class="career-item">',
        `  <p class="career-item__period">${escapeHtml(item.period)}</p>`,
        `  <p class="career-item__title">${escapeHtml(item.title)}</p>`,
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

function buildProfileSpeakingItems(projects, context) {
  const items = sortByDateDescThenOrderAsc(
    projects.filter((project) => toText(project.section) === "Speaking")
  );

  if (items.length === 0) {
    return '<p class="profile-empty">-</p>';
  }

  return items
    .map((project) => {
      const href = withBasePath(context.basePath, `/projects/${project.slug}/`);
      return [
        '<article class="profile-link-item">',
        `  <p class="profile-link-item__label">${escapeHtml(project.date)}</p>`,
        '  <div class="profile-link-item__body">',
        `    <a class="inline-link" href="${escapeAttr(href)}">${escapeHtml(project.title)}</a>`,
        `    <p class="profile-link-item__note">${escapeHtml(project.subtitle)}</p>`,
        "  </div>",
        "</article>"
      ].join("\n");
    })
    .join("\n");
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
    personSubName: toText(site.personSubName),
    personUrl: toText(site.personUrl)
  };

  const projects = [...content.projects].sort((a, b) => Number(a.order) - Number(b.order));
  const featuredProjects = getFeaturedProjects(projects, 8);
  const sectionOrder = site.indexSections.map((sectionName) => toText(sectionName));

  const indexTemplate = readTemplate(INDEX_TEMPLATE_PATH);
  const projectTemplate = readTemplate(PROJECT_TEMPLATE_PATH);
  const projectsTemplate = readTemplate(PROJECTS_TEMPLATE_PATH);
  const profileTemplate = readTemplate(PROFILE_TEMPLATE_PATH);

  const featuredProjectSections = buildProjectSections(featuredProjects, context, sectionOrder);
  const allProjectSections = buildProjectSections(projects, context, sectionOrder);
  const snsCards = buildSnsCards(site, context);
  const siteLeadBullets = site.leadBullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
  const homePath = withBasePath(basePath, "/");
  const projectsPath = withBasePath(basePath, "/projects/");
  const profilePath = withBasePath(basePath, "/profile/");
  const homeCanonical = toAbsoluteUrl(canonicalBase, homePath);
  const projectsCanonical = toAbsoluteUrl(canonicalBase, projectsPath);
  const profileCanonical = toAbsoluteUrl(canonicalBase, profilePath);
  const profileDescription = toDescriptionLines(site.profile.description).join(" ");
  const defaultOgImage = toAbsoluteUrl(canonicalBase, withBasePath(basePath, site.ogImageDefault));
  const homeMetaDescription = truncate(context.siteDescription, 160);
  const projectsMetaDescription = truncate(`All works by ${context.personName}.`, 160);
  const profileMetaDescription = truncate(profileDescription, 160);
  const showMoreWorks = projects.length > featuredProjects.length;
  const moreWorksSection = showMoreWorks
    ? [
        '<section class="more-works" aria-label="Show all works">',
        `  <a class="button button--ghost more-works__button" href="${escapeAttr(projectsPath)}">もっと見る</a>`,
        "</section>"
      ].join("\n")
    : "";

  const indexJsonLd = buildIndexJsonLd(context, homeCanonical);
  const projectsJsonLd = buildProjectsIndexJsonLd(context, homeCanonical, projectsCanonical, projects, basePath);
  const profileJsonLd = buildProfileJsonLd(context, homeCanonical, profileCanonical, site, basePath);

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
    JSON_LD: safeJsonLd(indexJsonLd),
    HOME_URL: escapeAttr(homePath),
    WORK_URL: escapeAttr(projectsPath),
    PROFILE_URL: escapeAttr(profilePath),
    SITE_TITLE: escapeHtml(context.siteTitle),
    PERSON_NAME: escapeHtml(context.personName),
    PERSON_SUBNAME: personSubNameMarkup,
    PROFILE_IMAGE: escapeAttr(withBasePath(basePath, site.profileImage)),
    SITE_DESCRIPTION: escapeHtml(context.siteDescription),
    SITE_LEAD_BULLETS: siteLeadBullets,
    SNS_CARDS: snsCards,
    PROJECT_SECTIONS: featuredProjectSections,
    MORE_WORKS_SECTION: moreWorksSection
  });

  const projectsTitle = `All Works | ${context.siteTitle}`;
  const projectsHtml = renderTemplate(projectsTemplate, {
    PAGE_TITLE: escapeHtml(projectsTitle),
    META_DESCRIPTION: escapeAttr(projectsMetaDescription),
    CANONICAL_URL: escapeAttr(projectsCanonical),
    OG_TITLE: escapeAttr(projectsTitle),
    OG_DESCRIPTION: escapeAttr(projectsMetaDescription),
    OG_IMAGE: escapeAttr(defaultOgImage),
    OG_URL: escapeAttr(projectsCanonical),
    ASSET_PREFIX: basePath,
    JSON_LD: safeJsonLd(projectsJsonLd),
    HOME_URL: escapeAttr(homePath),
    WORK_URL: escapeAttr(projectsPath),
    PROFILE_URL: escapeAttr(profilePath),
    LIST_TITLE: escapeHtml("All Works"),
    LIST_DESCRIPTION: escapeHtml(`全${projects.length}件の作品を一覧で掲載しています。`),
    PROJECT_SECTIONS: allProjectSections
  });

  const profileTitle = `Profile | ${context.siteTitle}`;
  const profileSkills = buildProfileInlineText(site.profile.skills);
  const profileLikes = buildProfileInlineText(site.profile.likes);
  const profileSpeakingItems = buildProfileSpeakingItems(projects, context);
  const profileHtml = renderTemplate(profileTemplate, {
    PAGE_TITLE: escapeHtml(profileTitle),
    META_DESCRIPTION: escapeAttr(profileMetaDescription),
    CANONICAL_URL: escapeAttr(profileCanonical),
    OG_TITLE: escapeAttr(profileTitle),
    OG_DESCRIPTION: escapeAttr(profileMetaDescription),
    OG_IMAGE: escapeAttr(toAbsoluteUrl(canonicalBase, withBasePath(basePath, site.profileImage))),
    OG_URL: escapeAttr(profileCanonical),
    ASSET_PREFIX: basePath,
    JSON_LD: safeJsonLd(profileJsonLd),
    HOME_URL: escapeAttr(homePath),
    WORK_URL: escapeAttr(projectsPath),
    PROFILE_URL: escapeAttr(profilePath),
    PERSON_NAME: escapeHtml(context.personName),
    PERSON_SUBNAME: personSubNameMarkup,
    PROFILE_IMAGE: escapeAttr(withBasePath(basePath, site.profileImage)),
    PROFILE_DESCRIPTION: buildProfileDescriptionMarkup(site.profile.description),
    CAREER_ITEMS: buildCareerItems(site.profile.career),
    PROFILE_SKILLS: profileSkills,
    PROFILE_LIKES: profileLikes,
    SPEAKING_ITEMS: profileSpeakingItems,
    PROFILE_SNS_CARDS: snsCards
  });

  fs.writeFileSync(OUTPUT_INDEX_PATH, indexHtml, "utf8");

  fs.rmSync(OUTPUT_PROJECTS_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_PROJECTS_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PROJECTS_INDEX_PATH, projectsHtml, "utf8");

  fs.rmSync(OUTPUT_PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_PROFILE_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PROFILE_INDEX_PATH, profileHtml, "utf8");

  projects.forEach((project, index) => {
    const pageHtml = buildProjectPage(project, index, projects, projectTemplate, context);
    const outputDir = path.join(OUTPUT_PROJECTS_DIR, project.slug);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "index.html"), pageHtml, "utf8");
  });

  console.log(`Built ${projects.length} projects.`);
  console.log(`- ${path.relative(ROOT, OUTPUT_INDEX_PATH)}`);
  console.log(`- ${path.relative(ROOT, OUTPUT_PROFILE_INDEX_PATH)}`);
  console.log(`- ${path.relative(ROOT, OUTPUT_PROJECTS_INDEX_PATH)}`);
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
