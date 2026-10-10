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
    themeColor.setAttribute("content", theme === "dark" ? "#000000" : "#ffffff");
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

    const travel = stack.offsetHeight - stackStage.offsetHeight;
    const progress = clamp01((globalNav.offsetHeight - stack.getBoundingClientRect().top) / travel);
    const segments = stackCards.length - 1;
    // How far a card must move to leave the screen completely, measured
    // from where the cards sit while pinned (not where they are now)
    const cardsBox = stackCards[0].parentElement;
    const exitDistance = globalNav.offsetHeight + cardsBox.offsetTop + cardsBox.offsetHeight + 40;

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
