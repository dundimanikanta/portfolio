// Hairline under the nav once the page has scrolled
const globalNav = document.getElementById("globalnav");

function updateNav() {
    globalNav.classList.toggle("is-scrolled", window.scrollY > 4);
}

updateNav();
window.addEventListener("scroll", updateNav, { passive: true });


// Light / dark mode. The page starts in the theme picked by the script in
// <head> (saved choice, else the system setting); the toggle switches it
// and remembers the choice.
const root = document.documentElement;
const themeToggle = document.getElementById("theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function savedTheme() {
    try {
        return localStorage.getItem("theme");
    } catch (e) {
        return null;
    }
}

function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    themeColor.setAttribute("content", theme === "dark" ? "#121212" : "#ffffff");
}

applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");

themeToggle.addEventListener("click", function () {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try {
        localStorage.setItem("theme", next);
    } catch (e) {}

    if (!document.startViewTransition || reducedMotion.matches) {
        applyTheme(next);
        return;
    }

    // The new theme grows as a circle from opposite corners: dark comes in
    // from the top right, light from the bottom left
    const toDark = next === "dark";
    const x = toDark ? window.innerWidth : 0;
    const y = toDark ? 0 : window.innerHeight;
    const radius = Math.hypot(window.innerWidth, window.innerHeight);
    const transition = document.startViewTransition(function () {
        applyTheme(next);
    });

    transition.ready.then(function () {
        root.animate(
            {
                clipPath: [
                    "circle(0px at " + x + "px " + y + "px)",
                    "circle(" + radius + "px at " + x + "px " + y + "px)"
                ]
            },
            { duration: 700, easing: "cubic-bezier(0.25, 1, 0.5, 1)", pseudoElement: "::view-transition-new(root)" }
        );
    });
});

// Follow the system setting until the visitor picks a theme themselves
systemDark.addEventListener("change", function (e) {
    if (!savedTheme()) {
        applyTheme(e.matches ? "dark" : "light");
    }
});


// Close the mobile menu after a link is picked
const navLinks = document.getElementById("navlinks");

navLinks.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
        if (navLinks.classList.contains("show")) {
            bootstrap.Collapse.getOrCreateInstance(navLinks).hide();
        }
    });
});


// Wrap every word of a .split element in its own mask so the words can
// slide up one after another (span.w > span)
function splitWords(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    let index = 0;
    textNodes.forEach(function (node) {
        const fragment = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) {
                return;
            }
            if (/^\s+$/.test(part)) {
                fragment.appendChild(document.createTextNode(part));
                return;
            }
            const mask = document.createElement("span");
            const word = document.createElement("span");
            mask.className = "w";
            word.textContent = part;
            word.style.setProperty("--i", index++);
            mask.appendChild(word);
            fragment.appendChild(mask);
        });
        node.replaceWith(fragment);
    });
}

document.querySelectorAll(".split").forEach(splitWords);


// Keep the name on one line. CSS sizes it to its column; if a fallback
// font still draws it wider than the column, scale it down to fit.
const heroTitle = document.querySelector(".hero-title");

function fitHeroTitle() {
    heroTitle.style.fontSize = "";
    const available = heroTitle.clientWidth;
    const needed = heroTitle.scrollWidth;
    if (needed > available) {
        const size = parseFloat(getComputedStyle(heroTitle).fontSize);
        heroTitle.style.fontSize = Math.floor((size * available) / needed * 10) / 10 + "px";
    }
}

fitHeroTitle();
window.addEventListener("resize", fitHeroTitle);
if (document.fonts) {
    document.fonts.ready.then(fitHeroTitle);
}


// The hero animates on load rather than on scroll
requestAnimationFrame(function () {
    requestAnimationFrame(function () {
        document.querySelectorAll(".hero .split").forEach(function (el) {
            el.classList.add("is-visible");
        });
    });
});


// Stagger cards that sit in the same row
document.querySelectorAll(".row").forEach(function (row) {
    row.querySelectorAll(":scope > .reveal").forEach(function (item, i) {
        item.style.setProperty("--delay", i * 0.08 + "s");
    });
});


// Fade sections up (and reveal headlines) as they scroll into view
const revealItems = document.querySelectorAll(".reveal, .split:not(.hero .split)");

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: "0px 0px -10% 0px" });

    revealItems.forEach(function (item) {
        observer.observe(item);
    });
} else {
    revealItems.forEach(function (item) {
        item.classList.add("is-visible");
    });
}


// Section headings: each one starts centred and glides to the left as its
// section scrolls in. Once it reaches the header it pins there, shrinking
// into a compact bar, until its section ends and the next heading takes over.
const sectionHeads = Array.from(document.querySelectorAll(".section-head"));
const headsQuery = window.matchMedia("(prefers-reduced-motion: no-preference)");
const SHRINK_DISTANCE = 120; // px of scrolling over which a pinned heading shrinks
let headMetrics = [];
let headsTicking = false;

function measureHeads() {
    headMetrics = sectionHeads.map(function (head) {
        const section = head.parentElement;
        const title = head.querySelector(".headline");
        const container = head.querySelector(".container");
        const box = getComputedStyle(container);
        const contentWidth = container.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
        return {
            head: head,
            section: section,
            title: title,
            lead: head.nextElementSibling.querySelector(".section-lead"),
            paddingTop: parseFloat(getComputedStyle(section).paddingTop),
            centreOffset: Math.max(0, (contentWidth - title.offsetWidth) / 2),
            height: title.offsetHeight,
            fontSize: parseFloat(getComputedStyle(title).fontSize)
        };
    });
}

function setupHeads() {
    const on = headsQuery.matches;
    root.classList.toggle("pin-heads", on);
    globalNav.classList.remove("has-pinned-head");
    sectionHeads.forEach(function (head) {
        const lead = head.nextElementSibling.querySelector(".section-lead");
        head.querySelector(".headline").style.transform = "";
        head.style.removeProperty("--bar-h");
        head.style.removeProperty("--bar-o");
        if (lead) {
            lead.style.opacity = "";
            lead.style.transform = "";
        }
    });
    measureHeads();
    updateHeads();
}

function updateHeads() {
    headsTicking = false;
    if (!headsQuery.matches) {
        return;
    }

    const viewport = window.innerHeight;
    const pinTop = globalNav.offsetHeight;
    const small = window.innerWidth < 576;
    const barHeight = small ? 48 : 56;
    const compactFont = small ? 24 : 28;
    // The glide finishes a little before the heading reaches the header
    const glideEnd = pinTop + (viewport - pinTop) * 0.3;
    let pinnedUnderHeader = false;

    headMetrics.forEach(function (m) {
        // Where the heading would be if it were not pinned
        const naturalTop = m.section.getBoundingClientRect().top + m.paddingTop;
        const glide = easeInOut(clamp01((viewport - naturalTop) / (viewport - glideEnd)));
        const shrink = clamp01((pinTop - naturalTop) / SHRINK_DISTANCE);

        const scale = 1 - shrink * (1 - Math.min(1, compactFont / m.fontSize));
        const x = (1 - glide) * m.centreOffset;
        const y = (shrink * (barHeight - m.height * scale)) / 2;

        m.title.style.transform = "translate3d(" + x.toFixed(1) + "px, " + y.toFixed(1) + "px, 0) scale(" + scale.toFixed(4) + ")";
        const currentBar = m.height + shrink * (barHeight - m.height);
        m.head.style.setProperty("--bar-h", currentBar.toFixed(1) + "px");
        m.head.style.setProperty("--bar-o", shrink.toFixed(3));

        // Is this heading's bar sitting right under the header?
        const headTop = m.head.getBoundingClientRect().top;
        if (shrink > 0 && headTop <= pinTop + 0.5 && headTop + currentBar > pinTop) {
            pinnedUnderHeader = true;
        }

        // The supporting line fades up as the heading arrives on the left
        if (m.lead) {
            const arrive = clamp01((glide - 0.6) / 0.4);
            m.lead.style.opacity = arrive.toFixed(3);
            m.lead.style.transform = "translate3d(0, " + ((1 - arrive) * 16).toFixed(1) + "px, 0)";
        }
    });

    globalNav.classList.toggle("has-pinned-head", pinnedUnderHeader);
}

setupHeads();
window.addEventListener("scroll", function () {
    if (!headsTicking) {
        headsTicking = true;
        requestAnimationFrame(updateHeads);
    }
}, { passive: true });
window.addEventListener("resize", setupHeads);
headsQuery.addEventListener("change", setupHeads);
if (document.fonts) {
    document.fonts.ready.then(setupHeads);
}


// Project stack: the section pins while you scroll, and each card slides
// up and away to reveal the next one underneath it. Only on screens with
// room for it, and never when the visitor prefers reduced motion.
const stack = document.querySelector("[data-stack]");
const stackStage = stack.querySelector(".stack-stage");
const stackCards = Array.from(stack.querySelectorAll(".stack-card"));
const stackDots = Array.from(stack.querySelectorAll(".stack-dots span"));
const stackQuery = window.matchMedia(
    "(min-width: 992px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)"
);
let stackOn = false;
let stackTicking = false;

function clamp01(value) {
    return Math.min(Math.max(value, 0), 1);
}

function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function setupStack() {
    stackOn = stackQuery.matches;
    stack.classList.toggle("is-stacked", stackOn);
    stack.style.setProperty("--count", stackCards.length);

    stackCards.forEach(function (card, i) {
        card.style.zIndex = stackOn ? stackCards.length - i : "";
        card.style.transform = "";
        card.style.removeProperty("--enter");
        if (stackOn) {
            card.classList.add("is-visible");
        }
    });

    updateStack();
}

function updateStack() {
    stackTicking = false;
    if (!stackOn) {
        return;
    }

    // Where the stage pins: under the header, or under the "Projects." bar
    const stageTop = parseFloat(getComputedStyle(stackStage).top) || globalNav.offsetHeight;
    const travel = stack.offsetHeight - stackStage.offsetHeight;
    const progress = clamp01((stageTop - stack.getBoundingClientRect().top) / travel);
    const segments = stackCards.length - 1;
    // How far a card must move to leave the screen completely, measured
    // from where the cards sit while pinned (not where they are now)
    const cardsBox = stackCards[0].parentElement;
    const exitDistance = stageTop + cardsBox.offsetTop + cardsBox.offsetHeight + 40;

    stackCards.forEach(function (card, i) {
        // Each segment holds briefly, then moves the current card away
        const leave = i < segments ? easeInOut(clamp01((progress * segments - i - 0.15) / 0.7)) : 0;
        const enter = i === 0 ? 1 : easeInOut(clamp01((progress * segments - (i - 1) - 0.15) / 0.7));
        const scale = 0.92 + 0.08 * enter;

        card.style.transform = "translateY(" + (-leave * exitDistance).toFixed(1) + "px) scale(" + scale.toFixed(4) + ")";
        card.style.setProperty("--enter", enter.toFixed(4));
    });

    const active = Math.round(progress * segments);
    stackDots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === active);
    });
}

function requestStackUpdate() {
    if (stackOn && !stackTicking) {
        stackTicking = true;
        requestAnimationFrame(updateStack);
    }
}

setupStack();
window.addEventListener("scroll", requestStackUpdate, { passive: true });
window.addEventListener("resize", setupStack);
stackQuery.addEventListener("change", setupStack);
