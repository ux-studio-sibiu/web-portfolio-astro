import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// GSAP, with ScrollTrigger registered, from one place. Every module that
// animates imports it from here rather than from "gsap", so the plugin is
// registered exactly once and before anything uses it — the job
// `gsap.registerPlugin(useGSAP, ScrollTrigger)` did at the top of each Next
// component. (`useGSAP` itself has no equivalent: it was React's way of
// scoping and cleaning up; here the scope is the element passed in and the
// cleanup is mm.revert().)
//
// Imported by several scripts, it is bundled ONCE, into a shared chunk they
// all load.
gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
