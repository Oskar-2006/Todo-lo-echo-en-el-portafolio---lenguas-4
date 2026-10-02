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

// Projects, carousel mode on wide screens: the section is pinned and vertical scroll moves the row sideways.
// On narrow screens the row is swiped by hand and CSS scroll-snap centers the cards.
const wideScreen = window.matchMedia("(min-width: 761px)");
let carouselTween = null;

function buildCarousel() {
    const section = document.querySelector("#projects");
    if (carouselTween || section.dataset.mode !== "carousel" || !wideScreen.matches) return;

    const track = section.querySelector(".projects__track");
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    section.classList.add("is-pinned");
    carouselTween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
            anticipatePin: 1,
        },
    });
}

function destroyCarousel() {
    if (!carouselTween) return;
    const section = document.querySelector("#projects");
    carouselTween.scrollTrigger.kill(true);
    carouselTween.kill();
    carouselTween = null;
    gsap.set(section.querySelector(".projects__track"), { clearProps: "transform" });
    section.classList.remove("is-pinned");
}

// When scrolling stops between two cards for a moment, slide to the nearest one
function centerNearestCard() {
    const trigger = carouselTween?.scrollTrigger;
    if (!trigger || !trigger.isActive) return;

    const track = document.querySelector("#projects .projects__track");
    const trackLeft = track.getBoundingClientRect().left;
    const distance = Math.max(1, track.scrollWidth - window.innerWidth);
    const stops = [...track.children].map((card) => {
        const rect = card.getBoundingClientRect();
        const center = rect.left - trackLeft + rect.width / 2;
        return Math.min(1, Math.max(0, (center - window.innerWidth / 2) / distance));
    });
    const nearest = stops.reduce((best, stop) => (Math.abs(stop - trigger.progress) < Math.abs(best - trigger.progress) ? stop : best));
    const target = trigger.start + nearest * (trigger.end - trigger.start);

    if (Math.abs(target - window.scrollY) < 2) return;
    if (lenis) lenis.scrollTo(target, { duration: 0.8 });
    else window.scrollTo({ top: target, behavior: "smooth" });
}

function initCarouselSnap() {
    let idle = 0;
    window.addEventListener("scroll", () => {
        clearTimeout(idle);
        idle = setTimeout(centerNearestCard, 1500);
    }, { passive: true });
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
        section.querySelector(".projects__scroller").scrollLeft = 0;

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

// Cursor: a dot that follows the mouse and shows a label over [data-cursor] elements
function initCursor() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = '<span class="cursor__label"></span><span class="cursor__dot"></span>';
    document.body.append(cursor);
    root.classList.add("has-cursor");

    const label = cursor.querySelector(".cursor__label");
    const moveX = gsap.quickTo(cursor, "x", { duration: 0.18, ease: "power3" });
    const moveY = gsap.quickTo(cursor, "y", { duration: 0.18, ease: "power3" });
    let lastX = 0;
    let lastY = 0;
    let visible = false;

    const showLabelFor = (element) => {
        const target = element?.closest?.("[data-cursor]");
        if (target) label.textContent = target.dataset.cursor;
        cursor.classList.toggle("has-label", Boolean(target));
    };

    window.addEventListener("pointermove", (event) => {
        lastX = event.clientX;
        lastY = event.clientY;
        if (!visible) {
            gsap.set(cursor, { x: lastX, y: lastY });
            cursor.classList.add("is-visible");
            visible = true;
        }
        moveX(lastX);
        moveY(lastY);
    });

    document.addEventListener("pointerover", (event) => showLabelFor(event.target));
    root.addEventListener("pointerleave", () => {
        cursor.classList.remove("is-visible");
        visible = false;
    });

    // While scrolling, content moves under a still mouse and no pointer event fires
    let queued = false;
    window.addEventListener("scroll", () => {
        if (queued || !visible) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            showLabelFor(document.elementFromPoint(lastX, lastY));
        });
    }, { passive: true });
}

// Marks the nav link of the section on screen: the last one whose top has passed a line just below the header.
// A clicked link stays marked until the visitor scrolls by hand, because the last sections can never reach that line.
function initCurrentSection() {
    const links = new Map([...document.querySelectorAll('.site-header nav a[href^="#"]')].map((link) => [link.getAttribute("href").slice(1), link]));
    const sections = [...document.querySelectorAll("main > section[id]")].filter((section) => links.has(section.id));
    let chosen = null;
    let queued = false;

    const mark = (id) => links.forEach((link, key) => link.setAttribute("aria-current", String(key === id)));
    const update = () => {
        queued = false;
        if (chosen) return mark(chosen);
        const line = window.innerHeight * 0.18;
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        const passed = sections.filter((section) => section.getBoundingClientRect().top <= line);
        mark(atBottom ? sections.at(-1).id : passed.at(-1)?.id);
    };

    links.forEach((link, id) => link.addEventListener("click", () => {
        chosen = id;
        mark(id);
    }));
    ["wheel", "touchmove", "keydown"].forEach((type) => window.addEventListener(type, () => { chosen = null; }, { passive: true }));
    window.addEventListener("scroll", () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(update);
    }, { passive: true });
    update();
}

function initMotion() {
    // The motion runs for every visitor, including those whose system asks for reduced motion (owner's decision)
    const animated = hasLibs;
    initProjectsToggle(animated);
    initCurrentSection();
    if (!animated) return;

    root.classList.add("js");
    gsap.registerPlugin(ScrollTrigger);

    initScroll();
    // Pin first, so later triggers measure the right positions
    buildCarousel();
    initCarouselSnap();
    initReveal();
    initCursor();

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
