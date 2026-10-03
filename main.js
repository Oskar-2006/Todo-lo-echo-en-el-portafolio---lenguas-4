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
            lenis.scrollTo(target, { duration: 1.1 });
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

// Projects, carousel mode. Wide screens: the section is pinned and every project gets the whole stage,
// one at a time; vertical scroll moves from one project to the next and the list of names on the left
// shows which one is up. Narrow screens: a row swiped by hand, centred by CSS scroll-snap.
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
        });
        const current = Math.round(position);
        section.querySelectorAll(".projects__index button").forEach((button, index) => button.setAttribute("aria-current", String(index === current)));
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

function initProjectIndex() {
    document.querySelectorAll("#projects .projects__index button").forEach((button) => {
        button.addEventListener("click", () => scrollToProject(Number(button.dataset.index), 0.9));
    });
}

function scrollToInstantly(top) {
    if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
    else window.scrollTo(0, top);
}

// The main images gather into a stack in the middle of the screen and then deal out to their new places.
// first / last: where each image was before the switch and where it sits after it.
function flyImages(section, images, first, last) {
    const stackWidth = Math.min(window.innerWidth * 0.24, 240);
    const middle = (images.length - 1) / 2;

    section.classList.add("is-switching");
    lenis?.stop();

    const timeline = gsap.timeline({
        onComplete: () => {
            gsap.set(images, { clearProps: "transform,zIndex,position" });
            section.classList.remove("is-switching");
            lenis?.start();
        },
    });

    images.forEach((image, index) => {
        const from = first[index];
        const to = last[index];
        const stackScale = stackWidth / to.width;
        const fan = index - middle;

        gsap.set(image, {
            position: "relative",
            zIndex: 20 + index,
            transformOrigin: "top left",
            x: from.left - to.left,
            y: from.top - to.top,
            scale: from.width / to.width,
        });
        timeline
            .to(image, {
                x: window.innerWidth / 2 - stackWidth / 2 - to.left + fan * 22,
                y: window.innerHeight / 2 - (to.height * stackScale) / 2 - to.top + Math.abs(fan) * 10,
                scale: stackScale,
                rotation: fan * 4,
                duration: 0.5,
                ease: "power3.inOut",
            }, index * 0.04)
            .to(image, { x: 0, y: 0, scale: 1, rotation: 0, duration: 0.7, ease: "power3.out" }, 0.62 + index * 0.06);
    });

    timeline.from(section.querySelectorAll(".project__body, .project__extra"), {
        opacity: 0,
        y: 18,
        duration: 0.45,
        stagger: 0.05,
        clearProps: "opacity,transform",
    }, 0.8);
}

// Works without the libraries too: then the mode just changes, with no flight
function initProjectsToggle(animated) {
    const section = document.querySelector("#projects");
    const button = section.querySelector(".projects__toggle");
    const images = [...section.querySelectorAll(".project__main")];
    const rects = () => images.map((image) => image.getBoundingClientRect());

    button.addEventListener("click", () => {
        const next = section.dataset.mode === "carousel" ? "detail" : "carousel";
        const first = rects();

        if (animated) destroyCarousel();
        section.dataset.mode = next;
        button.textContent = next === "carousel" ? button.dataset.labelDetail : button.dataset.labelCarousel;
        button.setAttribute("aria-pressed", String(next === "detail"));
        button.animate([{ opacity: 0.35, filter: "blur(2px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 220, easing: "ease" });
        section.querySelector(".projects__scroller").scrollLeft = 0;

        fitTrackPadding();
        if (animated) {
            buildCarousel();
            ScrollTrigger.refresh();
        }
        scrollToInstantly(section.getBoundingClientRect().top + window.scrollY);
        if (animated) flyImages(section, images, first, rects());
        else section.querySelector(".projects__track").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: "ease" });
    });

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
    initProjectIndex();
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
        const response = await fetch("info.json");
        if (!response.ok) throw new Error(`info.json respondió ${response.status}`);
        renderPage(await response.json());
    } catch (error) {
        renderError(error);
        return;
    }
    initMotion();
}

start();
