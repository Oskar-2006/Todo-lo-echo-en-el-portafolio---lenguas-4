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
function mediaElement({ video, image, alt = "", eager = false }) {
    if (video) return h("video", { src: video, autoplay: true, muted: true, loop: true, playsinline: true });
    if (image) return h("img", { src: image, alt, loading: eager ? "eager" : "lazy" });
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
    const content = mediaElement({ video: media.type === "video" ? media.src : "", image: media.type === "image" ? media.src : "", alt: media.alt, eager: true });
    const nameLines = hero.name.flatMap((line, index) => (index === 0 ? [line] : [h("br"), line]));

    return h("section", { id: "hero", class: "hero" },
        h("div", { class: "hero__text" },
            h("p", { class: "label", "data-reveal": true }, hero.label),
            h("h1", { "data-reveal": true }, ...nameLines),
            h("p", { class: "hero__tagline", "data-reveal": true }, hero.tagline),
            h("a", { href: hero.cta.target, class: "button", "data-reveal": true, "data-cursor": hero.cta.cursor }, hero.cta.text)),
        h("div", {
            class: content ? "hero__media hero__media--filled" : "hero__media",
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

function renderFigure(className, { src, alt }, extra = {}) {
    return h("figure", { class: className, ...extra }, h("img", { src, alt, loading: "lazy" }));
}

// One project. The carousel shows the main image, the name and the tagline;
// the detail mode adds the extra images, the description and the facts.
function renderProject(item, index, labels) {
    const facts = ["role", "team", "kind"].filter((key) => item[key]);
    return h("article", { class: `project project--${item.layout}` },
        h("div", { class: "project__media" },
            renderFigure("project__main", { src: item.image, alt: item.alt }, { "data-cursor": item.cursor }),
            (item.extras ?? []).map((extra) => renderFigure("project__extra", extra))),
        h("div", { class: "project__body" },
            h("p", { class: "project__num" }, String(index + 1).padStart(2, "0")),
            h("h3", {}, item.name),
            h("p", { class: "project__type" }, item.type),
            h("p", { class: "project__tagline muted" }, item.tagline),
            h("div", { class: "project__detail" },
                h("p", {}, item.description),
                h("dl", { class: "facts" },
                    facts.map((key) => h("div", {}, h("dt", {}, labels[key]), h("dd", {}, item[key])))))));
}

// Two modes on the same markup (data-mode): "carousel" by default, "detail" on demand.
// main.js moves the main images from one layout to the other when the button is pressed.
function renderProjects({ projects }) {
    return h("section", { id: "projects", class: "projects", "aria-label": "Proyectos", "data-mode": "carousel" },
        h("div", { class: "projects__pin" },
            h("div", { class: "projects__head" },
                h("div", {},
                    h("p", { class: "label" }, projects.label),
                    h("h2", {}, projects.title)),
                h("button", {
                    type: "button",
                    class: "button projects__toggle",
                    "aria-pressed": "false",
                    "data-label-detail": projects.toggle.detail,
                    "data-label-carousel": projects.toggle.carousel,
                }, projects.toggle.detail)),
            h("div", { class: "projects__scroller" },
                h("div", { class: "projects__track" },
                    projects.items.map((item, index) => renderProject(item, index, projects.facts))))));
}

function renderList(group, extraClass = "") {
    return h("div", {},
        h("h2", {}, group.title),
        h("ul", { class: `list ${extraClass}`.trim() }, group.items.map((text) => h("li", {}, text))));
}

function renderSkills({ skills }) {
    return h("section", { id: "skills", class: "section section--soft skills" },
        h("p", { class: "label", "data-reveal": true }, skills.label),
        h("div", { class: "skills__grid", "data-reveal": true },
            renderList(skills.skills),
            renderList(skills.tools, "list--mono")));
}

function renderContact({ contact }) {
    const social = contact.social.filter((link) => link.url);
    return h("section", { id: "contact", class: "section section--soft contact" },
        h("div", { "data-reveal": true },
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
