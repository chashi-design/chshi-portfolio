const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const contentPath = path.join(rootDir, 'content.json');
const templatesDir = path.join(rootDir, 'templates');
const outputDir = rootDir;

const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
const { site, projects } = content;

const indexTemplate = fs.readFileSync(path.join(templatesDir, 'index.template.html'), 'utf-8');
const projectTemplate = fs.readFileSync(path.join(templatesDir, 'project.template.html'), 'utf-8');

const slugPattern = /^[a-z0-9-]+$/;

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const withBaseUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  const base = site.canonicalBase.replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

const stripLeadingSlash = (url) => url.replace(/^\/+/, '');

const toRootRelative = (url) => {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return stripLeadingSlash(url);
};

const toProjectRelative = (url) => {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return `../../${stripLeadingSlash(url)}`;
};

const renderTemplate = (template, replacements) => {
  let output = template;
  Object.entries(replacements).forEach(([key, value]) => {
    output = output.replaceAll(`{{${key}}}`, value);
  });
  return output;
};

const sortedProjects = [...projects].sort((a, b) => a.order - b.order);

sortedProjects.forEach((project) => {
  if (!slugPattern.test(project.slug)) {
    throw new Error(`Invalid slug detected: ${project.slug}`);
  }
});

const buildProjectCards = () =>
  sortedProjects
    .map((project) => {
      const tags = project.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
      const colSpan = project.colSpan || 4;
      const rowSpan = project.rowSpan || 1;
      const colSpanTablet = Math.min(colSpan, 8);
      const colSpanMobile = Math.min(colSpan, 4);

      return `
        <a class="card bento-card" href="projects/${project.slug}/" style="--col-span:${colSpan}; --row-span:${rowSpan}; --col-span-tablet:${colSpanTablet}; --col-span-mobile:${colSpanMobile};">
          <div class="media-frame" style="--media-aspect: 4 / 3;">
            <img src="${toRootRelative(project.heroImage)}" alt="${escapeHtml(project.title)} preview" loading="lazy" />
          </div>
          <div class="tag-row">${tags}</div>
          <h3 class="card-title">${escapeHtml(project.title)}</h3>
          <p class="card-summary">${escapeHtml(project.summary)}</p>
          <span class="card-cta">View project →</span>
        </a>
      `;
    })
    .join('');

const buildIndexJsonLd = () => {
  const base = site.canonicalBase.replace(/\/$/, '');
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: site.title,
      url: base
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.title,
      url: base,
      description: site.description
    }
  ];

  return JSON.stringify(data, null, 2);
};

const indexHtml = renderTemplate(indexTemplate, {
  PAGE_TITLE: escapeHtml(site.title),
  META_DESCRIPTION: escapeHtml(site.description),
  CANONICAL: `${site.canonicalBase.replace(/\/$/, '')}/`,
  OG_TITLE: escapeHtml(site.title),
  OG_DESCRIPTION: escapeHtml(site.description),
  OG_IMAGE: withBaseUrl(site.ogImageDefault),
  OG_URL: `${site.canonicalBase.replace(/\/$/, '')}/`,
  SITE_TITLE: escapeHtml(site.title),
  SITE_DESCRIPTION: escapeHtml(site.description),
  PROJECT_CARDS: buildProjectCards(),
  JSON_LD: buildIndexJsonLd()
});

fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml);

const buildFacts = (facts) =>
  facts
    .map(
      (fact) => `
        <div class="card fact-card">
          <h3>${escapeHtml(fact.label)}</h3>
          <p>${escapeHtml(fact.value)}</p>
        </div>
      `
    )
    .join('');

const buildScreens = (screens, transformSrc = (src) => src) =>
  screens
    .map((screen, index) => {
      const isLarge = index === 0;
      const aspect = screen.aspect || '4/3';
      const fit = screen.fit || 'cover';
      return `
        <div class="card screen-card ${isLarge ? 'large' : ''}" style="--media-fit:${fit};">
          <div class="media-frame" style="--media-aspect: ${aspect};">
            <img src="${transformSrc(screen.src)}" alt="${escapeHtml(screen.alt)}" loading="lazy" />
          </div>
          ${screen.caption ? `<p class="caption">${escapeHtml(screen.caption)}</p>` : ''}
        </div>
      `;
    })
    .join('');

const buildContrib = (items) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

const buildDesignNotes = (notes) => {
  if (!notes || notes.length === 0) return '';
  const cards = notes
    .map(
      (note) => `
      <div class="card note-card">
        <h3>${escapeHtml(note.heading)}</h3>
        <p>${escapeHtml(note.body)}</p>
      </div>
    `
    )
    .join('');
  return `
    <section class="section">
      <h2>Design Notes</h2>
      <div class="screens-grid">${cards}</div>
    </section>
  `;
};

const buildLinks = (links) => {
  if (!links || links.length === 0) return '';
  const cards = links
    .map(
      (link) => `
      <a class="card link-card" href="${link.url}" target="_blank" rel="noreferrer">
        <strong>${escapeHtml(link.label)}</strong>
        ${link.note ? `<span>${escapeHtml(link.note)}</span>` : ''}
      </a>
    `
    )
    .join('');
  return `
    <section class="section">
      <h2>Links</h2>
      <div class="links-grid">${cards}</div>
    </section>
  `;
};

const buildProjectJsonLd = (project) => {
  const base = site.canonicalBase.replace(/\/$/, '');
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: site.title,
      url: base
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: project.title,
      description: project.summary,
      url: `${base}/projects/${project.slug}/`,
      image: withBaseUrl(project.heroImage)
    }
  ];
  return JSON.stringify(data, null, 2);
};

const buildPrevNext = (project) => {
  const currentIndex = sortedProjects.findIndex((item) => item.slug === project.slug);
  const prev = sortedProjects[currentIndex - 1];
  const next = sortedProjects[currentIndex + 1];
  return `
    <div class="nav-links">
      ${prev ? `<a href="../${prev.slug}/">← ${escapeHtml(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a href="../${next.slug}/">${escapeHtml(next.title)} →</a>` : '<span></span>'}
    </div>
  `;
};

const buildProjectPage = (project) => {
  const topbarCta = project.ctas && project.ctas.length > 0
    ? `<a href="${project.ctas[0].url}" target="_blank" rel="noreferrer">${escapeHtml(project.ctas[0].label)}</a>`
    : '';

  const heroCtas = (project.ctas || [])
    .slice(0, 2)
    .map(
      (cta) => `<a href="${cta.url}" target="_blank" rel="noreferrer">${escapeHtml(cta.label)}</a>`
    )
    .join('');

  const tags = project.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');

  const canonical = `${site.canonicalBase.replace(/\/$/, '')}/projects/${project.slug}/`;

  return renderTemplate(projectTemplate, {
    PAGE_TITLE: escapeHtml(`${project.title} | ${site.title}`),
    META_DESCRIPTION: escapeHtml(project.summary),
    CANONICAL: canonical,
    OG_TITLE: escapeHtml(project.title),
    OG_DESCRIPTION: escapeHtml(project.summary),
    OG_IMAGE: withBaseUrl(project.heroImage),
    OG_URL: canonical,
    SITE_TITLE: escapeHtml(site.title),
    TOPBAR_CTA: topbarCta,
    PROJECT_TITLE: escapeHtml(project.title),
    PROJECT_SUMMARY: escapeHtml(project.summary),
    HERO_IMAGE: toProjectRelative(project.heroImage),
    HERO_ASPECT: project.screens?.[0]?.aspect || '4/3',
    HERO_CTA: heroCtas,
    PROJECT_TAGS: tags,
    FACT_CARDS: buildFacts(project.facts),
    SCREEN_CARDS: buildScreens(project.screens, toProjectRelative),
    CONTRIB_LIST: buildContrib(project.contrib),
    DESIGN_NOTES_SECTION: buildDesignNotes(project.designNotes),
    LINKS_SECTION: buildLinks(project.links),
    PREV_NEXT: buildPrevNext(project),
    JSON_LD: buildProjectJsonLd(project)
  });
};

sortedProjects.forEach((project) => {
  const projectDir = path.join(outputDir, 'projects', project.slug);
  ensureDir(projectDir);
  const projectHtml = buildProjectPage(project);
  fs.writeFileSync(path.join(projectDir, 'index.html'), projectHtml);
});

console.log(`Generated ${sortedProjects.length} project pages and index.html`);
