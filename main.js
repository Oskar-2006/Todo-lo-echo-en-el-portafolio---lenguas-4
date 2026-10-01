const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
            // Pinned sections (data-anchor) land near the end of their pin, once the zoom has finished
            const pin = ScrollTrigger.getAll().find((trigger) => trigger.trigger === target && trigger.pin);
            const destination = pin && target.dataset.anchor
                ? pin.start + (pin.end - pin.start) * Number(target.dataset.anchor)
                : target;
            lenis.scrollTo(destination, { duration: 1.1 });
        });
    });
}

// Hero items enter on load; the rest enter as they scroll into view
function initReveal() {
    gsap.to("#hero [data-reveal]", {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.12,
    });

    document.querySelectorAll("[data-reveal]").forEach((item) => {
        if (item.closest("#hero")) return;
        gsap.to(item, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: item, start: "top 88%", once: true },
        });
    });
}

// Projects: the section is pinned and vertical scroll moves the track sideways
function initProjects() {
    const section = document.querySelector("#projects");
    const track = section.querySelector(".projects__track");
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    gsap.to(track, {
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

// Skills and contact: pinned, start small and blurred, zoom in while the blur clears, then hold
function initZoomSections() {
    document.querySelectorAll(".zoom-section").forEach((section) => {
        const inner = section.querySelector(".zoom-section__inner");

        gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
                trigger: section,
                start: "top top",
                end: "+=120%",
                pin: true,
                scrub: true,
                invalidateOnRefresh: true,
                anticipatePin: 1,
            },
        })
            .fromTo(inner,
                { scale: 0.45, filter: "blur(14px)", opacity: 0.5 },
                { scale: 1, filter: "blur(0px)", opacity: 1, duration: 0.8 })
            .to(inner, { duration: 0.2 });
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

function initMotion() {
    if (!hasLibs || reducedMotion) return;

    root.classList.add("js");
    gsap.registerPlugin(ScrollTrigger);

    initScroll();
    // Pins first, in page order, so later triggers measure the right positions
    initProjects();
    initZoomSections();
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
