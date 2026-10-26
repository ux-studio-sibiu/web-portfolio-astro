// The one question every animated thing on the page asks first. Read at the
// moment of use rather than once at load, so a visitor who switches the OS
// setting while the page is open gets the answer they just chose.
export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// How a scripted scroll should move: instantly under reduced motion.
export const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? "auto" : "smooth");
