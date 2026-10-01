// Builds the whole page from info.json. Text always goes in as text nodes, never as HTML.

function h(tag, props = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null || value === false || value === "") continue;
        element.setAttribute(key, value === true ? "" : value);
    }
    element.append(...children.flat().filter((child) => child !== undefined && child !== null && child !== false));
    return element;
}

// A video or image element for a path inside objects/, or null when there is none
function mediaElement({ video, image, alt = "" }) {
    if (video) return h("video", { src: video, autoplay: true, muted: true, loop: true, playsinline: true });
    if (image) return h("img", { src: image, alt, loading: "lazy" });
    return null;
}

function renderHeader({ site, nav }) {
    return h("header", { class: "site-header" },
        h("a", { href: "#hero", class: "logo" }, site.logo),
        h("nav", { "aria-label": "Principal" },
            nav.map((item) => h("a", { href: item.target }, item.label))));
}

function renderHero({ hero }) {
    const { media } = hero;
    const content = mediaElement({ video: media.type === "video" ? media.src : "", image: media.type === "image" ? media.src : "" });
    const nameLines = hero.name.flatMap((line, index) => (index === 0 ? [line] : [h("br"), line]));

    return h("section", { id: "hero", class: "hero" },
        h("div", { class: "hero__text" },
            h("p", { class: "label", "data-reveal": true }, hero.label),
            h("h1", { "data-reveal": true }, ...nameLines),
            h("p", { class: "hero__tagline", "data-reveal": true }, hero.tagline),
            h("a", { href: hero.cta.target, class: "button", "data-reveal": true, "data-cursor": hero.cta.cursor }, hero.cta.text)),
        h("div", {
            class: "hero__media",
            "data-reveal": true,
            "data-cursor": media.cursor,
            "aria-label": content ? "" : "Espacio reservado para un render o animación",
        }, content ?? h("span", { class: "label" }, media.placeholder)));
}

function renderAbout({ about }) {
    return h("section", { id: "about", class: "section" },
        h("p", { class: "label", "data-reveal": true }, about.label),
        h("div", { class: "about__grid" },
            h("h2", { "data-reveal": true }, about.title),
            h("div", { class: "about__body", "data-reveal": true },
                about.paragraphs.map((text) => h("p", {}, text)),
                about.note ? h("p", { class: "muted" }, about.note) : null)));
}

function renderProject(item) {
    const media = h("div", { class: "project-card__media" }, mediaElement({ video: item.video, image: item.image, alt: item.name }));
    const body = [
        media,
        h("h3", {}, item.name),
        item.description ? h("p", { class: "muted" }, item.description) : null,
        item.role ? h("p", { class: "muted" }, `Mi parte: ${item.role}`) : null,
    ];
    return item.link
        ? h("a", { class: "project-card", href: item.link, target: "_blank", rel: "noopener", "data-cursor": item.cursor }, ...body)
        : h("article", { class: "project-card", "data-cursor": item.cursor }, ...body);
}

// Pinned on every screen size: vertical scroll moves the track sideways
function renderProjects({ projects }) {
    return h("section", { id: "projects", class: "projects", "aria-label": "Proyectos" },
        h("div", { class: "projects__pin" },
            h("div", { class: "projects__track" },
                h("div", { class: "projects__intro" },
                    h("p", { class: "label" }, projects.label),
                    h("h2", {}, projects.title),
                    projects.hint ? h("p", { class: "muted" }, projects.hint) : null),
                projects.items.map(renderProject),
                projects.outro ? h("div", { class: "projects__outro" }, h("p", { class: "muted" }, projects.outro)) : null)));
}

function renderList(group, extraClass = "") {
    return h("div", {},
        h("h2", {}, group.title),
        h("ul", { class: `list ${extraClass}`.trim() }, group.items.map((text) => h("li", {}, text))));
}

// Pinned: the content starts small and blurred and zooms in as you scroll (see initZoomSections)
function renderSkills({ skills }) {
    return h("section", { id: "skills", class: "section section--soft zoom-section skills", "data-anchor": "0.85" },
        h("div", { class: "zoom-section__inner" },
            h("p", { class: "label" }, skills.label),
            h("div", { class: "skills__grid" },
                renderList(skills.skills),
                renderList(skills.tools, "list--mono"))));
}

function renderContact({ contact }) {
    const social = contact.social.filter((link) => link.url);
    return h("section", { id: "contact", class: "section section--soft zoom-section contact", "data-anchor": "0.85" },
        h("div", { class: "zoom-section__inner" },
            h("p", { class: "label" }, contact.label),
            h("h2", {}, contact.title),
            h("a", { class: "contact__mail", href: `mailto:${contact.email}`, "data-cursor": contact.emailCursor }, contact.email),
            social.length
                ? h("div", { class: "contact__social" },
                    social.map((link) => h("a", { href: link.url, target: "_blank", rel: "noopener" }, link.label)))
                : null));
}

function renderPage(info) {
    document.documentElement.lang = info.site.lang;
    document.title = info.site.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", info.site.description);

    document.querySelector("#site-header").replaceChildren(...renderHeader(info).childNodes);
    document.querySelector("#app").replaceChildren(
        renderHero(info),
        renderAbout(info),
        renderProjects(info),
        renderSkills(info),
        renderContact(info));
    document.querySelector("#site-footer").replaceChildren(h("p", { class: "label" }, info.site.footer));
}

function renderError(error) {
    document.querySelector("#app").replaceChildren(
        h("section", { class: "section" },
            h("p", { class: "label" }, "No se pudo cargar info.json"),
            h("p", {}, "Abre la página con un servidor local (por ejemplo Live Server) y revisa que info.json sea un JSON válido."),
            h("p", { class: "muted" }, String(error.message ?? error))));
}
