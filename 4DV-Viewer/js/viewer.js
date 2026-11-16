// 4DV WebGL2 Interactive Player
const gl = document.getElementById('c').getContext('webgl2', { antialias: false, premultipliedAlpha: false });
if (!gl) {
  document.body.innerHTML = '<p style="padding:20px">WebGL2 is required.</p>';
}

// ---------- half-float decode ----------
function halfToFloat(h) {
  const s = (h & 0x8000) >> 15, e = (h & 0x7C00) >> 10, f = h & 0x03FF;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 31) return f ? NaN : ((s ? -1 : 1) * Infinity);
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

// ---------- mat/vec helpers (column-major 4x4) ----------
const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  len: a => Math.hypot(a[0], a[1], a[2])
};

function lookAt(eye, center, up) { // OpenGL view (camera looks -z)
  const f = V3.norm(V3.sub(center, eye)), s = V3.norm(V3.cross(f, up)), u = V3.cross(s, f);
  return [
    s[0], u[0], -f[0], 0,
    s[1], u[1], -f[1], 0,
    s[2], u[2], -f[2], 0,
    -V3.dot(s, eye), -V3.dot(u, eye), V3.dot(f, eye), 1
  ];
}

function perspective(fovy, asp, n, fr) {
  const t = 1 / Math.tan(fovy / 2);
  return [
    t / asp, 0, 0, 0,
    0, t, 0, 0,
    0, 0, (fr + n) / (n - fr), -1,
    0, 0, (2 * fr * n) / (n - fr), 0
  ];
}

// ---------- GL program ----------
const vs = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aVel;
layout(location=2) in vec2 aTT;   // covt, t
layout(location=3) in float aRad;
layout(location=4) in float aOp;
layout(location=5) in vec3 aCol;
uniform mat4 uView, uProj;
uniform float uTime, uPSize, uViewportH, uFocalY;
out vec3 vCol; out float vOp;
void main(){
  float dt = uTime - aTT.y;
  float ot = aOp * exp(-0.5*dt*dt/max(aTT.x,1e-6));
  vec3 p = aPos + aVel*dt;
  vec4 pv = uView*vec4(p,1.0);
  gl_Position = uProj*pv;
  float depth = max(-pv.z, 0.02);
  gl_PointSize = clamp(uPSize * aRad / depth, 1.0, 20.0);
  vCol = aCol; vOp = ot;
  if(ot < 0.08) gl_Position = vec4(2.0,2.0,2.0,1.0);
}`;

const fs = `#version 300 es
precision highp float;
in vec3 vCol; in float vOp; out vec4 o;
void main(){
  vec2 d = gl_PointCoord*2.0-1.0;
  float r2 = dot(d,d);
  if(r2>1.0) discard;
  float a = vOp*exp(-2.5*r2);
  if(a<0.02) discard;
  o = vec4(vCol, a);
}`;

function sh(t, s) {
  const o = gl.createShader(t);
  gl.shaderSource(o, s);
  gl.compileShader(o);
  if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o);
  return o;
}

const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw gl.getProgramInfoLog(prog);
gl.useProgram(prog);

const U = {};
['uView', 'uProj', 'uTime', 'uPSize', 'uViewportH', 'uFocalY'].forEach(n => U[n] = gl.getUniformLocation(prog, n));

let vao, N = 0, header = null, bufs = [];
function makeAttr(loc, arr, size) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  bufs.push(b);
}

function loadBuffer(ab) {
  const dv = new DataView(ab);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== '4DV1') {
    alert('Not a 4DV1 file');
    return;
  }
  const ver = dv.getUint32(4, true), hlen = dv.getUint32(8, true);
  header = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 12, hlen)));
  const base = 12 + hlen, rec = header.record_bytes || 32;
  N = header.num_gaussians;
  document.getElementById('ver').textContent = 'v' + ver;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), tt = new Float32Array(N * 2),
        rad = new Float32Array(N), op = new Float32Array(N), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const o = base + i * rec;
    const h = k => halfToFloat(dv.getUint16(o + k * 2, true));
    pos[i * 3] = h(0); pos[i * 3 + 1] = h(1); pos[i * 3 + 2] = h(2);
    const cxx = h(3), cyy = h(6), czz = h(8);
    rad[i] = Math.sqrt(Math.max(cxx, cyy, czz, 1e-8)) * 3.0;
    vel[i * 3] = h(9); vel[i * 3 + 1] = h(10); vel[i * 3 + 2] = h(11);
    tt[i * 2] = Math.max(h(12), 1e-6); tt[i * 2 + 1] = h(13);
    op[i] = dv.getUint8(o + 28) / 255;
    col[i * 3] = dv.getUint8(o + 29) / 255;
    col[i * 3 + 1] = dv.getUint8(o + 30) / 255;
    col[i * 3 + 2] = dv.getUint8(o + 31) / 255;
  }
  bufs.forEach(b => gl.deleteBuffer(b));
  bufs = [];
  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  makeAttr(0, pos, 3);
  makeAttr(1, vel, 3);
  makeAttr(2, tt, 2);
  makeAttr(3, rad, 1);
  makeAttr(4, op, 1);
  makeAttr(5, col, 3);
  gl.bindVertexArray(null);
  document.getElementById('count').textContent = N.toLocaleString();
  tStart = header.time_start || 0;
  tEnd = header.time_end || 2;
  setTime(tStart);
  const cd = document.getElementById('cams');
  cd.innerHTML = '';
  (header.cameras || []).forEach((cam, i) => {
    const b = document.createElement('button');
    b.className = 'pill';
    b.textContent = cam.name || ('cam' + i);
    b.onclick = () => gotoCam(i);
    cd.appendChild(b);
  });
  const bmin = header.bbox_min, bmax = header.bbox_max;
  target = [(bmin[0] + bmax[0]) / 2, (bmin[1] + bmax[1]) / 2, (bmin[2] + bmax[2]) / 2];
  if (header.cameras && header.cameras.length) {
    gotoCam(0);
  } else {
    dist = V3.len(V3.sub(bmax, bmin));
    az = 0;
    el = 0.2;
  }
  fovY = header.intrinsics ? 2 * Math.atan((header.intrinsics.h / 2) / header.intrinsics.fl_y) : 1.0;
}

// ---------- orbit camera ----------
let target = [0, 0, 0], dist = 6, az = 0, el = 0, fovY = 1.0, tStart = 0, tEnd = 2, curT = 0;
function gotoCam(i) {
  const cam = header.cameras[i];
  const m = cam.c2w;
  const R = (r, c) => m[r * 4 + c];
  const eye = [R(0, 3), R(1, 3), R(2, 3)];
  const fwd = V3.norm([R(0, 2), R(1, 2), R(2, 2)]);
  const sc = target;
  let d = V3.dot(V3.sub(sc, eye), fwd);
  if (d < 0.5) d = Math.max(0.5, V3.len(V3.sub(sc, eye)));
  target = V3.add(eye, V3.scale(fwd, d));
  const rel = V3.sub(eye, target);
  dist = V3.len(rel) || 4;
  az = Math.atan2(rel[0], rel[2]);
  el = Math.asin(Math.max(-0.999, Math.min(0.999, rel[1] / dist)));
}

function eyeFromOrbit() {
  const ce = Math.cos(el), se = Math.sin(el), ca = Math.cos(az), sa = Math.sin(az);
  return V3.add(target, [dist * ce * sa, dist * se, dist * ce * ca]);
}

// ---------- interaction ----------
const cv = document.getElementById('c');
let drag = null, lx, ly, downX, downY, moved;
cv.addEventListener('pointerdown', e => {
  drag = e.button;
  lx = e.clientX;
  ly = e.clientY;
  downX = e.clientX;
  downY = e.clientY;
  moved = false;
  cv.setPointerCapture(e.pointerId);
});

cv.addEventListener('pointerup', e => {
  if (drag === 0 && !moved && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) togglePlay();
  drag = null;
});

cv.addEventListener('pointermove', e => {
  if (drag === null) return;
  const dx = e.clientX - lx, dy = e.clientY - ly;
  lx = e.clientX;
  ly = e.clientY;
  if (Math.hypot(dx, dy) > 1) moved = true;
  if (drag === 0) {
    az -= dx * 0.005;
    el = Math.max(-1.5, Math.min(1.5, el + dy * 0.005));
  } else if (drag === 2) {
    const r = 0.002 * dist;
    const right = [Math.cos(az), 0, -Math.sin(az)];
    const up = [0, 1, 0];
    target = V3.add(target, V3.add(V3.scale(right, -dx * r), V3.scale(up, dy * r)));
  }
});

cv.addEventListener('wheel', e => {
  e.preventDefault();
  dist *= Math.exp(e.deltaY * 0.001);
  dist = Math.max(0.1, dist);
}, { passive: false });

cv.addEventListener('contextmenu', e => e.preventDefault());

// ---------- time / transport ----------
const tEl = document.getElementById('time'), tvEl = document.getElementById('tval');
let playing = false;
function setTime(t) {
  curT = t;
  const f = (t - tStart) / ((tEnd - tStart) || 1);
  tEl.value = Math.round(f * 1000);
  tvEl.textContent = t.toFixed(2) + 's / ' + tEnd.toFixed(2) + 's';
}

function togglePlay() {
  playing = !playing;
  const b = document.getElementById('play');
  b.textContent = playing ? '⏸' : '▶';
  b.classList.toggle('ghost', !playing);
  activity();
}

tEl.oninput = () => {
  setTime(tStart + (tEnd - tStart) * tEl.value / 1000);
};

document.getElementById('play').onclick = togglePlay;
document.getElementById('psize').oninput = () => {};
document.getElementById('fs').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
};

// ---------- file loading ----------
const fileIn = document.getElementById('file');
document.getElementById('load').onclick = () => fileIn.click();
fileIn.onchange = e => {
  const f = e.target.files[0];
  if (f) readFile(f);
};

function readFile(f) {
  document.getElementById('fname').textContent = f.name;
  f.arrayBuffer().then(loadBuffer);
}

const dropEl = document.getElementById('drop');
window.addEventListener('dragover', e => {
  e.preventDefault();
  dropEl.classList.add('show');
});

window.addEventListener('dragleave', e => {
  if (e.target === dropEl) dropEl.classList.remove('show');
});

window.addEventListener('drop', e => {
  e.preventDefault();
  dropEl.classList.remove('show');
  const f = e.dataTransfer.files[0];
  if (f) readFile(f);
});

const qf = new URLSearchParams(location.search).get('file');
if (qf) {
  document.getElementById('fname').textContent = qf;
  fetch(qf).then(r => r.arrayBuffer()).then(loadBuffer).catch(e => {
    console.error('load failed', e);
    alert('load failed: ' + e);
  });
}

// ---------- auto-hide UI (video-player feel) ----------
let hideT = null;
function activity() {
  document.body.classList.remove('hide');
  clearTimeout(hideT);
  hideT = setTimeout(() => {
    if (playing) document.body.classList.add('hide');
  }, 2600);
}

['pointermove', 'pointerdown', 'wheel', 'keydown'].forEach(ev => window.addEventListener(ev, activity, { passive: true }));
activity();

// ---------- render loop ----------
gl.clearColor(0.04, 0.045, 0.05, 1);
gl.enable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
let last = performance.now(), fcount = 0, facc = 0;

function resize() {
  const d = Math.min(devicePixelRatio, 2);
  cv.width = innerWidth * d;
  cv.height = innerHeight * d;
}

addEventListener('resize', resize);
resize();

function frame(now) {
  const dtms = now - last;
  last = now;
  facc += dtms;
  fcount++;
  if (facc > 400) {
    document.getElementById('fps').textContent = Math.round(1000 * fcount / facc);
    facc = 0;
    fcount = 0;
  }
  if (playing && header) {
    let t = curT + dtms / 1000;
    if (t > tEnd) t = tStart;
    setTime(t);
  }
  gl.viewport(0, 0, cv.width, cv.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (vao && N) {
    const eye = eyeFromOrbit();
    const view = lookAt(eye, target, [0, 1, 0]);
    const proj = perspective(fovY || 1.0, cv.width / cv.height, 0.05, 500);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.uniformMatrix4fv(U.uView, false, view);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniform1f(U.uTime, curT);
    gl.uniform1f(U.uPSize, +document.getElementById('psize').value);
    gl.uniform1f(U.uViewportH, cv.height);
    gl.uniform1f(U.uFocalY, 1000.0);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.bindVertexArray(null);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
