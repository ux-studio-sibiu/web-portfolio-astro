// FluidThumb's canvas, ported from its useEffect in the Next component. The
// body below is that effect verbatim; what changed is only the wrapper: a plain
// function given the <canvas>, returning the cleanup the effect returned (or
// nothing, where the effect bailed out early — no context, no WebGL).
//
// Loaded on demand: FluidThumb.astro imports this module only once the frame
// is about to come on screen (see src/scripts/when-visible.ts).

// Fluid hover's thumbnail: the effect itself, running on the thing it is
// labelling. The other two frames in this stack show what their tool makes;
// this one had a live page in an iframe to do the same job, and the effect is
// twenty lines of shader — so it renders here instead.
//
// What it displaces is generated rather than loaded: a white field with the
// title set on it, in the same mono the other two frames caption themselves
// with. So there is no image to fetch, the text is always crisp at whatever
// size the frame ends up, and the thing being smeared is legible enough that
// the smearing reads.
//
// The shader is the experiment's own, ported from three.js to plain WebGL —
// see effects-collection/effect/fluid-hover.js. Three uniforms carry the whole
// effect: where the pointer is, how fast it is moving, and a radius around it.
// Displacement is the velocity scaled by a falloff, with a slight pull toward
// the pointer on top, and the red and blue channels are sampled a hair either
// side along the direction of travel — which is the chromatic fringe.
//
// It runs ONLY while the frame is hovered or focused, like the grain beside it.
// At rest it paints one clean frame and stops, so an untouched page is doing no
// work at all.
const TITLE = ["FLUID", "HOVER"];
// How hard the velocity pushes, how far its influence reaches, and how far the
// colour channels part. The experiment's own defaults, with the strength up a
// little because a thumbnail is small and a subtle smear would not read.
const STRENGTH = 0.32;
const RADIUS = 0.45;
const CHROMA = 0.012;
// How much of the previous frame's velocity survives into the next. Lower is a
// snappier, twitchier smear; this is slow enough that the trail lingers after
// the pointer stops.
const DECAY = 0.92;

const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec2 uMouseVel;
uniform float uStrength;
uniform float uRadius;
uniform float uChroma;

// Distance with the aspect put back in, so the falloff is a circle on screen
// rather than an ellipse stretched by the frame's proportion.
float aspectDist(vec2 a, vec2 b, vec2 res) {
  vec2 d = (a - b) * vec2(res.x / res.y, 1.0);
  return length(d);
}

void main() {
  vec2 uv = vUv;
  float dist = aspectDist(uv, uMouse, uResolution);
  float falloff = smoothstep(uRadius, 0.0, dist);

  vec2 disp = uMouseVel * uStrength * falloff;
  vec2 pull = (uMouse - uv) * 0.15 * falloff;
  vec2 base = uv + disp + pull;

  // Along the direction of travel, so the fringe trails the motion instead of
  // sitting on a fixed axis.
  float ca = uChroma * falloff * min(length(uMouseVel) * 8.0, 1.0);
  vec2 dir = normalize(uMouseVel + vec2(1e-6));
  vec2 shift = dir * ca;

  float r = texture2D(uTex, base + shift).r;
  float g = texture2D(uTex, base).g;
  float b = texture2D(uTex, base - shift).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function fluidThumb(el: HTMLCanvasElement): (() => void) | undefined {
  // No alpha and no depth: it is an opaque rectangle with a picture on it.
  //
  // preserveDrawingBuffer is the one that matters, and it is not the default.
  // Without it the buffer is thrown away after every composite, and this
  // canvas only draws on the frames it asks for — so ANY repaint it did not
  // cause showed an empty buffer. Which with alpha off is opaque black, and
  // the repaint that did it was the hover: .entry-thumb takes
  // background-color: var(--color-ink) on hover, so pointing at the frame
  // turned it black. It costs a copy per frame and this draws one triangle.
  const gl = el.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  if (!prog) return;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  // Two triangles covering clip space. The vertex shader turns them into uvs,
  // so there is no geometry here beyond "the whole frame".
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = {
    tex: gl.getUniformLocation(prog, "uTex"),
    res: gl.getUniformLocation(prog, "uResolution"),
    mouse: gl.getUniformLocation(prog, "uMouse"),
    vel: gl.getUniformLocation(prog, "uMouseVel"),
    strength: gl.getUniformLocation(prog, "uStrength"),
    radius: gl.getUniformLocation(prog, "uRadius"),
    chroma: gl.getUniformLocation(prog, "uChroma"),
  };
  gl.uniform1i(u.tex, 0);
  gl.uniform1f(u.strength, STRENGTH);
  gl.uniform1f(u.radius, RADIUS);
  gl.uniform1f(u.chroma, CHROMA);

  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // CLAMP so a displaced sample past the edge smears the edge pixel rather
  // than wrapping the title back in on the other side.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // The picture being displaced, drawn rather than fetched. Redrawn whenever
  // the frame changes size so the type never scales up blurry.
  const paint = (w: number, h: number) => {
    const src = document.createElement("canvas");
    src.width = w;
    src.height = h;
    const c = src.getContext("2d");
    if (!c) return;
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, w, h);

    const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim()
      || "ui-monospace, monospace";
    const size = Math.max(9, Math.round(w * 0.12));
    c.fillStyle = "#0b0b0b";
    c.textAlign = "center";
    c.textBaseline = "middle";
    // Tracking to match the captions on the other two frames. Not every
    // engine has it; where it is missing the type is merely tighter.
    try { (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${size * 0.1}px`; } catch {}
    // A weight ahead of the captions on the other two frames. It is drawn on
    // white and then smeared, and thin strokes come apart under the
    // displacement before they have travelled far enough to read as one.
    // JetBrains Mono is loaded as a variable font with no weight pinned, so
    // 700 is a drawn instance rather than a synthesised one.
    c.font = `700 ${size}px ${mono}`;
    const line = size * 1.2;
    TITLE.forEach((word, i) => {
      c.fillText(word, w / 2, h / 2 + (i - (TITLE.length - 1) / 2) * line);
    });

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  };

  let mouse = [0.5, 0.5];
  let vel = [0, 0];

  const render = () => {
    gl.uniform2f(u.mouse, mouse[0], mouse[1]);
    gl.uniform2f(u.vel, vel[0], vel[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // `ready` in the test, not just the size. A canvas element survives a
  // remount with its width and height attributes still on it, so on the next
  // mount the size matches and a size-only guard skips everything — including
  // the viewport, the uResolution uniform and the texture. uResolution then
  // sits at its default 0,0, aspectDist divides by that zero, and every sample
  // comes out NaN, which draws BLACK. It looked like a hover bug because the
  // first frame anyone asked for was the one on pointerenter; up to then the
  // frame was showing the previous mount's buffer, kept by
  // preserveDrawingBuffer.
  let ready = false;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(el.clientWidth * dpr));
    const h = Math.max(1, Math.round(el.clientHeight * dpr));
    if (ready && el.width === w && el.height === h) return;
    el.width = w;
    el.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
    paint(w, h);
    ready = true;
    render();
  };

  resize();

  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame: number | null = null;
  const stop = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  // The loop only bleeds the velocity away and redraws; it is the pointer that
  // feeds it. It stops itself once the trail has died and the pointer is gone,
  // rather than spinning on a still picture.
  let hovering = false;
  const tick = () => {
    vel = [vel[0] * DECAY, vel[1] * DECAY];
    render();
    const moving = Math.abs(vel[0]) + Math.abs(vel[1]) > 0.0005;
    if (!hovering && !moving) {
      vel = [0, 0];
      render();
      frame = null;
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  const run = () => {
    if (frame !== null || still.matches) return;
    frame = requestAnimationFrame(tick);
  };

  // The button around the canvas is the target, the same as every other frame
  // in this row.
  const host = el.closest<HTMLElement>(".entry-thumb") ?? el;

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    // Flipped, because uv runs up the frame and clientY runs down it.
    const y = 1 - (e.clientY - r.top) / r.height;
    vel = [vel[0] + (x - mouse[0]) * 0.8, vel[1] + (y - mouse[1]) * 0.8];
    mouse = [x, y];
    run();
  };
  const onEnter = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    hovering = true;
    const r = el.getBoundingClientRect();
    // Seeded where the pointer actually came in, so the first move does not
    // read as a jump from the middle of the frame.
    mouse = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    // Straight away rather than on the next animation frame: the hover starts
    // a background transition underneath, and a frame of daylight between the
    // two is a flash of it.
    render();
    run();
  };
  // Not stopped outright — the trail is left to die out on its own, which is
  // what tick() is watching for.
  const onLeave = () => { hovering = false; run(); };
  const onFocus = () => { hovering = true; mouse = [0.5, 0.5]; vel = [0.12, 0.05]; run(); };

  host.addEventListener("pointerenter", onEnter);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);
  host.addEventListener("focusin", onFocus);
  host.addEventListener("focusout", onLeave);

  const ro = new ResizeObserver(resize);
  ro.observe(el);

  return () => {
    stop();
    ro.disconnect();
    host.removeEventListener("pointerenter", onEnter);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerleave", onLeave);
    host.removeEventListener("focusin", onFocus);
    host.removeEventListener("focusout", onLeave);
  };
}
