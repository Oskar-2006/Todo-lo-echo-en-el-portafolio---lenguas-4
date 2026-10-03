const root = document.documentElement;
const hasLibs = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";

let lenis = null;

// Direct feel: little inertia (lerp), slightly more distance per wheel notch.
function initScroll() {
    if (typeof Lenis === "undefined") return;

    lenis = new Lenis({ lerp: 0.2, wheelMultiplier: 1.2, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            const target = document.querySelector(link.getAttribute("href"));
            if (!target) return;
            event.preventDefault();
            // Coming from below, the pinned projects section sits at the end of its pin: go to its first project instead
            lenis.scrollTo(target.id === "projects" && stage ? stage.start : target, { duration: 1.1 });
        });
    });
}

// Hero items enter on load; the rest enter as they scroll into view
function initReveal() {
    gsap.to("#hero [data-reveal]", {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.07,
    });

    document.querySelectorAll("[data-reveal]").forEach((item) => {
        if (item.closest("#hero")) return;
        gsap.to(item, {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: "power3.out",
            scrollTrigger: { trigger: item, start: "top 88%", once: true },
        });
    });
}

// Projects, carousel mode. Wide screens: the section is pinned and the projects pass sideways one at a time,
// driven by vertical scroll; the name of the one on stage appears as it arrives and leaves with it.
// Narrow screens: a row swiped by hand, centred by CSS scroll-snap.
const wideScreen = window.matchMedia("(min-width: 761px)");
let stage = null;
let settleTimer = 0;

// Narrow screens only: side room so the first and the last card can reach the middle of the screen
function fitTrackPadding() {
    const section = document.querySelector("#projects");
    const track = section.querySelector(".projects__track");
    if (section.dataset.mode !== "carousel" || stage) {
        track.style.paddingLeft = track.style.paddingRight = "";
    } else {
        const room = (card) => `${Math.max(20, (window.innerWidth - card.offsetWidth) / 2)}px`;
        track.style.paddingLeft = room(track.firstElementChild);
        track.style.paddingRight = room(track.lastElementChild);
    }
    updateFocus(stage?.progress);
}

// Tells every card how close it is to being the one presented:
// --focus from 0 (away) to 1 (on stage) and --offset from -1 (already gone) to 1 (still to come).
// The CSS turns those two numbers into opacity, scale and position.
function updateFocus(progress) {
    const section = document.querySelector("#projects");
    if (section.dataset.mode !== "carousel") return;

    const cards = [...section.querySelectorAll(".project")];
    let travelled = progress ?? 0;

    if (stage) {
        const position = travelled * (cards.length - 1);
        cards.forEach((card, index) => {
            const offset = Math.max(-1, Math.min(1, index - position));
            card.style.setProperty("--offset", offset.toFixed(3));
            card.style.setProperty("--focus", (1 - Math.abs(offset)).toFixed(3));
            // Only the project on stage can be clicked; the others are stacked under it
            card.classList.toggle("is-current", index === Math.round(position));
        });
    } else {
        const middle = window.innerWidth / 2;
        const reach = Math.max(320, window.innerWidth * 0.42);
        cards.forEach((card) => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty("--offset", "0");
            card.style.setProperty("--focus", Math.max(0, 1 - Math.abs(rect.left + rect.width / 2 - middle) / reach).toFixed(3));
        });
        const scroller = section.querySelector(".projects__scroller");
        if (progress === undefined && scroller.scrollWidth > scroller.clientWidth) travelled = scroller.scrollLeft / (scroller.scrollWidth - scroller.clientWidth);
    }

    section.querySelector(".projects__progress span").style.transform = `scaleX(${travelled.toFixed(4)})`;
}

// Narrow screens swipe the row by hand, so the focus follows that scroller
function initSwipeFocus() {
    const scroller = document.querySelector("#projects .projects__scroller");
    let queued = false;
    scroller.addEventListener("scroll", () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            if (!stage) updateFocus();
        });
    }, { passive: true });
}

function buildCarousel() {
    const section = document.querySelector("#projects");
    if (!stage && section.dataset.mode === "carousel" && wideScreen.matches) {
        const steps = section.querySelectorAll(".project").length - 1;

        section.classList.add("is-pinned");
        stage = ScrollTrigger.create({
            trigger: section,
            start: "top top",
            // Most of a screen of scroll per project
            end: () => `+=${Math.round(window.innerHeight * 0.85 * steps)}`,
            pin: true,
            invalidateOnRefresh: true,
            anticipatePin: 1,
            // Scroll moves between projects; when it stops in between, it settles on the nearest one
            onUpdate: (self) => {
                updateFocus(self.progress);
                clearTimeout(settleTimer);
                settleTimer = setTimeout(settleOnProject, 320);
            },
            onRefresh: (self) => updateFocus(self.progress),
        });
    }
    fitTrackPadding();
}

function destroyCarousel() {
    if (!stage) return;
    clearTimeout(settleTimer);
    stage.kill(true);
    stage = null;
    document.querySelector("#projects").classList.remove("is-pinned");
}

function scrollToProject(index, duration = 0.7) {
    if (!stage) return;
    const steps = document.querySelectorAll("#projects .project").length - 1;
    const target = stage.start + (index / steps) * (stage.end - stage.start);
    if (Math.abs(target - window.scrollY) < 2) return;
    if (lenis) lenis.scrollTo(target, { duration });
    else window.scrollTo({ top: target, behavior: "smooth" });
}

function settleOnProject() {
    if (!stage || !stage.isActive) return;
    const steps = document.querySelectorAll("#projects .project").length - 1;
    scrollToProject(Math.round(stage.progress * steps));
}

function scrollToInstantly(top) {
    if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
    else window.scrollTo(0, top);
}

// Which project the visitor is looking at right now, in either mode
function currentProjectIndex(section) {
    const cards = [...section.querySelectorAll(".project")];
    if (section.dataset.mode === "carousel") {
        if (stage) return Math.round(stage.progress * (cards.length - 1));
        const focus = cards.map((card) => Number(card.style.getPropertyValue("--focus")) || 0);
        return focus.indexOf(Math.max(...focus));
    }
    const middle = window.innerHeight / 2;
    const distance = cards.map((card) => { const rect = card.getBoundingClientRect(); return Math.abs(rect.top + rect.height / 2 - middle); });
    return distance.indexOf(Math.min(...distance));
}

// After the mode changed: put the same project back in front of the visitor
function showProject(section, index) {
    const cards = [...section.querySelectorAll(".project")];
    if (section.dataset.mode === "detail") {
        // Its row starts right under the site header and the sticky heading of the section
        const bars = document.querySelector(".site-header").offsetHeight + section.querySelector(".projects__head").offsetHeight;
        scrollToInstantly(cards[index].getBoundingClientRect().top + window.scrollY - bars);
    } else if (stage) {
        scrollToInstantly(stage.start + (index / (cards.length - 1)) * (stage.end - stage.start));
        updateFocus(index / (cards.length - 1));
    } else {
        const scroller = section.querySelector(".projects__scroller");
        scroller.scrollLeft = cards[index].offsetLeft + cards[index].offsetWidth / 2 - scroller.clientWidth / 2;
        scrollToInstantly(section.getBoundingClientRect().top + window.scrollY);
        updateFocus();
    }
}

// Each main image travels from where it was to where it now belongs.
// The project the visitor was looking at stays on top and leads; the others come out from behind it
// (towards the detail rows) or tuck in behind it (back to the carousel).
// first / last: the place of each image before and after the switch.
function flyImages(section, images, first, last, current, toDetail) {
    section.classList.add("is-switching");
    lenis?.stop();

    const timeline = gsap.timeline({
        onComplete: () => {
            gsap.set(images, { clearProps: "transform,zIndex,position,opacity" });
            section.classList.remove("is-switching");
            lenis?.start();
        },
    });

    images.forEach((image, index) => {
        const from = first[index];
        const to = last[index];
        const leading = index === current;
        const delay = Math.abs(index - current) * 0.07;

        gsap.set(image, {
            position: "relative",
            zIndex: leading ? 60 : 20 + index,
            transformOrigin: "top left",
            x: from.left - to.left,
            y: from.top - to.top,
            scale: from.width / to.width,
            // In the carousel only the project on stage is visible
            opacity: leading || !toDetail ? 1 : 0,
        });
        timeline.to(image, { x: 0, y: 0, scale: 1, duration: 0.85, ease: "power3.inOut" }, delay);
        if (!leading) timeline.to(image, { opacity: toDetail ? 1 : 0, duration: toDetail ? 0.3 : 0.4, ease: "power1.out" }, toDetail ? delay : delay + 0.45);
    });

    timeline.from(section.querySelectorAll(".project__body, .project__extra"), {
        opacity: 0,
        y: 18,
        duration: 0.45,
        stagger: 0.04,
        clearProps: "opacity,transform",
    }, 0.55);
}

// Works without the libraries too: then the mode just changes, with no flight
function initProjectsToggle(animated) {
    const section = document.querySelector("#projects");
    const button = section.querySelector(".projects__toggle");
    const images = [...section.querySelectorAll(".project__main")];
    const rects = () => images.map((image) => image.getBoundingClientRect());

    // In the carousel the images themselves are the way into the detail; there they are plain pictures again
    const syncImageButtons = () => {
        const clickable = section.dataset.mode === "carousel";
        images.forEach((image, index) => {
            if (clickable) {
                image.setAttribute("role", "button");
                image.setAttribute("tabindex", "0");
                image.setAttribute("aria-label", `Ver en detalle: ${image.closest(".project").querySelector("h3").textContent}`);
            } else {
                ["role", "tabindex", "aria-label"].forEach((name) => image.removeAttribute(name));
            }
        });
    };

    // index: the project to stay on; when missing, the one being looked at
    const switchMode = (index) => {
        const next = section.dataset.mode === "carousel" ? "detail" : "carousel";
        const current = index ?? currentProjectIndex(section);
        const first = rects();

        if (animated) destroyCarousel();
        section.dataset.mode = next;
        button.textContent = next === "carousel" ? button.dataset.labelDetail : button.dataset.labelCarousel;
        button.setAttribute("aria-pressed", String(next === "detail"));
        button.animate([{ opacity: 0.35, filter: "blur(2px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 220, easing: "ease" });
        section.querySelector(".projects__scroller").scrollLeft = 0;

        if (animated) {
            buildCarousel();
            ScrollTrigger.refresh();
        } else {
            fitTrackPadding();
        }
        // Stay on the project that was being looked at instead of going back to the first one
        showProject(section, current);
        if (animated) flyImages(section, images, first, rects(), current, next === "detail");
        else section.querySelector(".projects__track").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: "ease" });
        syncImageButtons();
    };

    button.addEventListener("click", () => switchMode());
    images.forEach((image, index) => {
        image.addEventListener("click", () => {
            if (section.dataset.mode === "carousel") switchMode(index);
        });
        image.addEventListener("keydown", (event) => {
            if (section.dataset.mode !== "carousel" || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault();
            switchMode(index);
        });
    });
    syncImageButtons();

    if (!animated) return;
    wideScreen.addEventListener("change", () => {
        destroyCarousel();
        buildCarousel();
        ScrollTrigger.refresh();
    });
}

// Marks the nav link of the section on screen: the last one whose top has passed a line just below the header.
// A clicked link stays marked until the visitor scrolls by hand, because the last sections can never reach that line.
function initCurrentSection() {
    const links = new Map([...document.querySelectorAll('.site-header nav a[href^="#"]')].map((link) => [link.getAttribute("href").slice(1), link]));
    // Not "main > section": the pinned carousel sits inside a wrapper that ScrollTrigger adds
    const sections = [...document.querySelectorAll("main section[id]")].filter((section) => links.has(section.id));
    let chosen = null;

    const mark = (id) => links.forEach((link, key) => link.setAttribute("aria-current", String(key === id)));
    const update = (page) => {
        if (chosen) return mark(chosen);
        const line = window.innerHeight * 0.18;
        const passed = sections.filter((section) => section.getBoundingClientRect().top <= line);
        mark(page.progress > 0.999 ? sections.at(-1).id : passed.at(-1)?.id);
    };

    links.forEach((link, id) => link.addEventListener("click", () => {
        chosen = id;
        mark(id);
    }));
    ["wheel", "touchmove", "keydown"].forEach((type) => window.addEventListener(type, () => { chosen = null; }, { passive: true }));
    ScrollTrigger.create({ start: 0, end: "max", onUpdate: update, onRefresh: update });
}

function initMotion() {
    // The motion runs for every visitor, including those whose system asks for reduced motion (owner's decision)
    const animated = hasLibs;
    initProjectsToggle(animated);
    fitTrackPadding();
    initSwipeFocus();
    window.addEventListener("resize", fitTrackPadding);
    if (!animated) return;

    root.classList.add("js");
    gsap.registerPlugin(ScrollTrigger);

    initScroll();
    // Pin first, so later triggers measure the right positions
    buildCarousel();
    initReveal();
    initCurrentSection();

    ScrollTrigger.refresh();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    // Images and videos from objects/ change heights once they load
    window.addEventListener("load", () => ScrollTrigger.refresh());
}

// The page is built from info.json first; motion starts once the content exists
async function start() {
    try {
        // no-cache: always ask the server whether the content changed
        const response = await fetch("info.json", { cache: "no-cache" });
        if (!response.ok) throw new Error(`info.json respondió ${response.status}`);
        renderPage(await response.json());
    } catch (error) {
        renderError(error);
        return;
    }
    initMotion();
}

start();
