// 가상 설비 3D — 학교 검정 장비(CT-4200M 생산자동화 실습 장치) 모양
// 물리 동작은 simulator.html의 2D 모델(PL, PG)을 그대로 쓰고, 여기서는 그 상태를 입체로 그리기만 한다.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from './vendor/CSS2DRenderer.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const api = window.__plant;
const S = 0.01;            // 2D 그림 1px = 3D 0.01
const H0 = 0.62;           // 레일·컨베이어·받침 윗면 높이
const PR = 0.17, PH = 0.16; // 자재 반지름·높이
const P = (x, y) => ({ x: (x - 500) * S, z: (y - 192) * S });

function fail(err) {
  window.__plant3d = { ok: false, err: String(err && err.message || err) };
  window.dispatchEvent(new Event('plant3d-ready'));
}

try {
  if (!api) throw new Error('설비 상태를 찾을 수 없음');
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('이 브라우저는 WebGL(3D)을 지원하지 않아요');
  build();
} catch (e) { console.error(e); fail(e); }

function build() {
  const { PL, PG } = api;
  const host = document.getElementById('plant3d');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'p3canvas';
  renderer.domElement.addEventListener('webglcontextlost', (e) => {   // 그래픽 드라이버가 3D를 끊으면 2D로
    e.preventDefault(); stop();
    window.__plant3d.ok = false; window.__plant3d.err = '그래픽 연결이 끊김';
    window.dispatchEvent(new Event('plant3d-ready'));
  });
  host.appendChild(renderer.domElement);
  const labelR = new CSS2DRenderer();
  labelR.domElement.className = 'p3labels';
  host.appendChild(labelR.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdde3ea);
  // 금속이 은색으로 보이게 주변 반사 환경
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.12;
  controls.minDistance = 1.6; controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.screenSpacePanning = true;

  // ── 빛
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3ad, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 1.45);
  sun.position.set(-5, 11, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 7, bottom: -7, near: 1, far: 30 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(6, 5, -6);
  scene.add(fill);

  // ── 재질
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    alu: std({ color: 0xc6cdd5, metalness: 0.55, roughness: 0.36 }),
    aluD: std({ color: 0x9ea8b4, metalness: 0.5, roughness: 0.42 }),
    rod: std({ color: 0xeef1f4, metalness: 0.95, roughness: 0.18 }),
    black: std({ color: 0x22262c, metalness: 0.25, roughness: 0.55 }),
    black2: std({ color: 0x31363e, metalness: 0.2, roughness: 0.6 }),
    red: std({ color: 0xc9242b, metalness: 0.15, roughness: 0.42 }),
    redD: std({ color: 0x8e181d, roughness: 0.6 }),
    white: std({ color: 0xf2f3f5, roughness: 0.65 }),
    gray: std({ color: 0x7c8590, roughness: 0.5, metalness: 0.3 }),
    pcb: std({ color: 0x1f7a3d, roughness: 0.6 }),
    acrylic: std({ color: 0xdcefff, transparent: true, opacity: 0.26, roughness: 0.05, depthWrite: false }),
    blueFit: std({ color: 0x2f6fd6, roughness: 0.4 }),
    yellow: std({ color: 0xf2c230, roughness: 0.45 }),
    metalPc: std({ color: 0xd3d8de, metalness: 0.92, roughness: 0.22 }),
    whitePc: std({ color: 0xf6f6f2, roughness: 0.55 }),
    hole: std({ color: 0x23272c, roughness: 0.8 }),
    rubber: std({ color: 0x1a1c20, roughness: 0.9 }),
  };
  const shadowAll = (o) => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
  function box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    (parent || scene).add(m); return m;
  }
  function cyl(r, len, mat, axis, x, y, z, parent, seg) {
    const g = new THREE.CylinderGeometry(r, r, len, seg || 24);
    if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    (parent || scene).add(m); return m;
  }
  // 길이가 바뀌는 막대: 0~1 구간 원기둥 (scale로 길이 조절)
  function rodMesh(r, mat, axis) {
    const g = new THREE.CylinderGeometry(r, r, 1, 16);
    g.translate(0, 0.5, 0);
    if (axis === 'x') g.rotateZ(-Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === '-z') g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat); m.castShadow = true; scene.add(m); return m;
  }
  function ledMat() { return std({ color: 0x5a1612, emissive: 0xff2a1a, emissiveIntensity: 0, roughness: 0.3 }); }
  const leds = [];   // {mesh, k}
  function reed(x, y, z, k, along) {
    const g = new THREE.Group();
    box(along === 'z' ? 0.05 : 0.12, 0.04, along === 'z' ? 0.12 : 0.05, M.black, 0, 0, 0, g);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), ledMat());
    l.position.set(0, 0.03, 0); g.add(l);
    g.position.set(x, y, z); scene.add(g);
    leds.push({ mesh: l, k });
    return g;
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }

  // ── 작업대 (알루미늄 프로파일 판) + 다리
  const aluTex = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#c9d0d8'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { g.fillStyle = '#a5afba'; g.fillRect(0, y + 12, w, 8); g.fillStyle = '#8e98a4'; g.fillRect(0, y + 14, w, 3); }
  });
  aluTex.wrapS = aluTex.wrapT = THREE.RepeatWrapping; aluTex.repeat.set(10, 7);
  const table = box(10.8, 0.12, 6.9, std({ color: 0xffffff, map: aluTex, metalness: 0.45, roughness: 0.42 }), 0, -0.06, 1.15);
  table.castShadow = false;
  for (const [x, z] of [[-5.25, -2.1], [5.25, -2.1], [-5.25, 4.45], [5.25, 4.45]]) box(0.16, 3, 0.16, M.alu, x, -1.6, z);
  box(10.5, 0.12, 0.12, M.alu, 0, -2.6, -2.1); box(10.5, 0.12, 0.12, M.alu, 0, -2.6, 4.45);
  box(0.12, 0.12, 6.5, M.alu, -5.25, -2.6, 1.15); box(0.12, 0.12, 6.5, M.alu, 5.25, -2.6, 1.15);
  // 바닥
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), std({ color: 0xb7bfc8, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -3.1; scene.add(floor);

  // ── 하얀 배선 덕트 테두리 (구멍 뚫린 벽)
  const ductTex = canvasTex(128, 32, (g, w, h) => {
    g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c3c8cf'; for (let x = 4; x < w; x += 10) g.fillRect(x, 5, 4, h - 6);
  });
  ductTex.wrapS = THREE.RepeatWrapping;
  const ductMat = (len) => { const t = ductTex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(len * 4, 1); return std({ map: t, roughness: 0.6 }); };
  const DX0 = -5.1, DX1 = 5.1, DZ0 = -2.08, DZ1 = 2.08, DH = 0.4, DT = 0.13;
  box(DX1 - DX0, DH, DT, ductMat(DX1 - DX0), 0, DH / 2, DZ0);
  box(DX1 - DX0, DH, DT, ductMat(DX1 - DX0), 0, DH / 2, DZ1);
  box(DT, DH, DZ1 - DZ0, ductMat(DZ1 - DZ0), DX0, DH / 2, 0);
  box(DT, DH, DZ1 - DZ0, ductMat(DZ1 - DZ0), DX1, DH / 2, 0);

  // ── 공급 레일 + 분배 슈트 + 받침대
  const G = PG, R = G.R;
  { const a = P(G.mx - R - 12, G.ry - R - 8), b = P(G.px + R + 10, G.ry + R + 8);
    box(b.x - a.x, H0, b.z - a.z, M.aluD, (a.x + b.x) / 2, H0 / 2, (a.z + b.z) / 2);
    box(b.x - a.x, 0.06, 0.03, M.alu, (a.x + b.x) / 2, H0 + 0.03, a.z + 0.015);           // 뒤 가이드
    const fx = P(G.px - R - 8, 0).x;
    box(fx - a.x, 0.06, 0.03, M.alu, (a.x + fx) / 2, H0 + 0.03, b.z - 0.015); }            // 앞 가이드 (분배 자리는 열림)
  { const a = P(G.px - R - 8, G.ry + R + 4), b = P(G.px + R + 8, G.bt);
    box(b.x - a.x, H0 - 0.01, b.z - a.z, M.alu, (a.x + b.x) / 2, (H0 - 0.01) / 2, (a.z + b.z) / 2); }

  // ── 컨베이어
  const beltTex = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#1d2025'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#30353d'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(20, 0); g.lineTo(64, h / 2); g.lineTo(20, h); g.stroke();
  });
  beltTex.wrapS = THREE.RepeatWrapping;
  const bA = P(G.b0, G.bt), bB = P(G.b1, G.bb), beltLen = bB.x - bA.x, beltW = bB.z - bA.z;
  beltTex.repeat.set((G.b1 - G.b0) / 40, 1);
  const belt = box(beltLen, 0.05, beltW, std({ map: beltTex, roughness: 0.92 }), (bA.x + bB.x) / 2, H0 - 0.025, (bA.z + bB.z) / 2);
  box(beltLen + 0.24, 0.16, 0.08, M.alu, (bA.x + bB.x) / 2, H0 - 0.03, bA.z - 0.05);
  box(beltLen + 0.24, 0.16, 0.08, M.alu, (bA.x + bB.x) / 2, H0 - 0.03, bB.z + 0.05);
  cyl(0.07, beltW, M.alu, 'z', bA.x - 0.04, H0 - 0.08, (bA.z + bB.z) / 2);
  cyl(0.07, beltW, M.alu, 'z', bB.x + 0.04, H0 - 0.08, (bA.z + bB.z) / 2);
  for (const x of [bA.x + 0.2, (bA.x + bB.x) / 2, bB.x - 0.2]) box(0.08, H0 - 0.1, beltW + 0.2, M.aluD, x, (H0 - 0.1) / 2, (bA.z + bB.z) / 2);
  // 컨베이어 모터 (끝 쪽, 벨트 뒤)
  const motor = new THREE.Group();
  cyl(0.17, 0.42, M.gray, 'z', 0, 0, -0.3, motor);
  cyl(0.18, 0.05, M.black, 'z', 0, 0, -0.08, motor);
  cyl(0.05, 0.16, M.rod, 'z', 0, 0, 0.02, motor);
  const motorRot = new THREE.Group(); motor.add(motorRot);
  const motorStripe = box(0.03, 0.03, 0.3, std({ color: 0xffffff, emissive: 0x22c55e, emissiveIntensity: 0 }), 0, 0.17, -0.3, motorRot);
  motor.position.set(bB.x + 0.04, H0 - 0.08, bA.z - 0.12); scene.add(motor);

  // ── 자재
  const pcGeo = new THREE.CylinderGeometry(PR, PR, PH, 32);
  const holeGeo = new THREE.CircleGeometry(PR * 0.32, 20); holeGeo.rotateX(-Math.PI / 2);
  function makePiece() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(pcGeo, M.whitePc); body.castShadow = true; body.receiveShadow = true; g.add(body);
    const hole = new THREE.Mesh(holeGeo, M.hole); hole.position.y = PH / 2 + 0.002; g.add(hole);
    g.userData = { body, hole }; scene.add(g); return g;
  }
  function setPiece(g, kind, drilled) {
    g.userData.body.material = kind === 'metal' ? M.metalPc : M.whitePc;
    g.userData.hole.visible = !!drilled; g.visible = true;
  }
  const pool = new Map();   // id → mesh
  const extra = [];         // 매거진·상자·창고용
  let extraN = 0;
  const takeExtra = () => { if (!extra[extraN]) extra[extraN] = makePiece(); return extra[extraN++]; };

  // ── 매거진 (투명 튜브) + 공급센서
  const mg = P(G.mx, G.ry);
  { const tube = new THREE.Mesh(new THREE.CylinderGeometry(R * S + 0.06, R * S + 0.06, 1.35, 32, 1, true), M.acrylic);
    tube.position.set(mg.x, H0 + 0.2 + 0.675, mg.z); scene.add(tube);
    const ring = (y) => { const r = new THREE.Mesh(new THREE.TorusGeometry(R * S + 0.07, 0.02, 8, 32), M.alu); r.rotation.x = Math.PI / 2; r.position.set(mg.x, y, mg.z); scene.add(r); };
    ring(H0 + 0.22); ring(H0 + 1.55);
    box(0.08, 1.4, 0.08, M.alu, mg.x - 0.3, H0 + 0.7, mg.z - 0.18); box(0.36, 0.06, 0.06, M.alu, mg.x - 0.14, H0 + 1.35, mg.z - 0.18);
    // 바닥 출구 투명 가드
    box(0.5, 0.2, 0.5, M.acrylic, mg.x, H0 + 0.1, mg.z); }
  const fiberMag = fiberHead(P(G.mx - R - 14, G.ry + R + 6), P(G.mx, G.ry), 'mag');

  // ── 공급 실린더 (축 X)
  const sup = cylinderUnit({ axis: 'x', from: P(22, G.ry), len: 96 * S, y: H0 + PH / 2, back: 'supB', front: 'supF' });
  // ── 분배 실린더 (축 Z, 뒤 → 앞)
  const dis = cylinderUnit({ axis: 'z', from: P(G.px, 12), len: 50 * S, y: H0 + PH / 2, back: 'disB', front: 'disF', plateW: (2 * R + 12) * S });
  const fiberDis = fiberHead(P(G.px - R - 18, G.ry + R + 12), P(G.px, G.ry), 'dis');
  // ── 취출 실린더 (축 Z, 뒤 → 앞) + 가이드 봉
  const ej = cylinderUnit({ axis: 'z', from: P(G.xe, 90), len: 66 * S, y: H0 + PH / 2, back: 'ejB', front: 'ejF', plateW: (2 * R + 20) * S, guided: true });
  // ── 저장 실린더 (축 X)
  const sto = cylinderUnit({ axis: 'x', from: P(604, G.trayY), len: 90 * S, y: H0 + PH / 2, back: 'stoB', front: 'stoF' });

  function cylinderUnit(o) {
    const u = { o };
    const r = 0.11;
    const body = new THREE.Group();
    if (o.axis === 'x') {
      cyl(r, o.len, M.alu, 'x', o.len / 2, 0, 0, body);
      box(0.08, 0.26, 0.26, M.aluD, 0.04, 0, 0, body); box(0.08, 0.26, 0.26, M.aluD, o.len - 0.04, 0, 0, body);
      cyl(0.03, 0.08, M.blueFit, 'y', 0.12, 0.16, 0, body); cyl(0.03, 0.08, M.blueFit, 'y', o.len - 0.12, 0.16, 0, body);
      box(o.len - 0.1, 0.06, 0.2, M.aluD, o.len / 2, -o.y + 0.03, 0, body);   // 받침
      box(0.1, o.y - 0.12, 0.16, M.aluD, o.len / 2, -o.y / 2 + 0.03, 0, body);
      body.position.set(o.from.x, o.y, o.from.z);
      u.fits = [new THREE.Vector3(o.from.x + 0.12, o.y + 0.2, o.from.z), new THREE.Vector3(o.from.x + o.len - 0.12, o.y + 0.2, o.from.z)];
      reed(o.from.x + 0.18, o.y + r + 0.02, o.from.z, o.back, 'x');
      reed(o.from.x + o.len - 0.18, o.y + r + 0.02, o.from.z, o.front, 'x');
    } else {
      cyl(r, o.len, M.alu, 'z', 0, 0, o.len / 2, body);
      box(0.26, 0.26, 0.08, M.aluD, 0, 0, 0.04, body); box(0.26, 0.26, 0.08, M.aluD, 0, 0, o.len - 0.04, body);
      cyl(0.03, 0.08, M.blueFit, 'y', 0, 0.16, 0.12, body); cyl(0.03, 0.08, M.blueFit, 'y', 0, 0.16, o.len - 0.12, body);
      box(0.2, 0.06, o.len - 0.1, M.aluD, 0, -o.y + 0.03, o.len / 2, body);
      box(0.16, o.y - 0.12, 0.1, M.aluD, 0, -o.y / 2 + 0.03, o.len / 2, body);
      body.position.set(o.from.x, o.y, o.from.z);
      u.fits = [new THREE.Vector3(o.from.x, o.y + 0.2, o.from.z + 0.12), new THREE.Vector3(o.from.x, o.y + 0.2, o.from.z + o.len - 0.12)];
      reed(o.from.x + r + 0.02, o.y + 0.02, o.from.z + 0.18, o.back, 'z');
      reed(o.from.x + r + 0.02, o.y + 0.02, o.from.z + o.len - 0.18, o.front, 'z');
    }
    scene.add(shadowAll(body));
    u.rod = rodMesh(0.035, M.rod, o.axis);
    u.plate = o.axis === 'x' ? box(0.06, 0.2, (2 * R + 6) * S, M.gray, 0, 0, 0) : box(o.plateW || 0.4, 0.2, 0.06, M.gray, 0, 0, 0);
    if (o.guided) { u.g1 = rodMesh(0.02, M.rod, o.axis); u.g2 = rodMesh(0.02, M.rod, o.axis); }
    // tip: 2D 좌표의 푸셔 끝 (x 또는 y px)
    u.set = (tipPx) => {
      if (o.axis === 'x') {
        const x0 = o.from.x + o.len, x1 = (tipPx - 500) * S - 0.06;
        u.rod.position.set(x0, o.y, o.from.z); u.rod.scale.set(Math.max(0.001, x1 - x0), 1, 1);
        u.plate.position.set(x1 + 0.03, o.y, o.from.z);
      } else {
        const z0 = o.from.z + o.len, z1 = (tipPx - 192) * S - 0.06;
        u.rod.position.set(o.from.x, o.y, z0); u.rod.scale.set(1, 1, Math.max(0.001, z1 - z0));
        u.plate.position.set(o.from.x, o.y, z1 + 0.03);
        if (u.g1) for (const [gm, dx] of [[u.g1, -0.13], [u.g2, 0.13]]) { gm.position.set(o.from.x + dx, o.y + 0.05, o.from.z + 0.05); gm.scale.set(1, 1, Math.max(0.001, z1 - o.from.z - 0.05)); }
      }
    };
    return u;
  }
  function fiberHead(from, to, k) {
    const h = box(0.08, 0.05, 0.1, M.black, from.x, H0 + 0.05, from.z);
    const dx = to.x - from.x, dz = to.z - from.z, L = Math.hypot(dx, dz);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.18, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, L, 6), beamMat);
    beam.rotation.z = Math.PI / 2; beam.rotation.y = -Math.atan2(dz, dx);
    beam.position.set((from.x + to.x) / 2, H0 + 0.07, (from.z + to.z) / 2);
    scene.add(beam);
    cyl(0.012, 0.6, M.black, 'x', from.x - 0.3, 0.05, from.z, null, 6);   // 광화이버 케이블 느낌
    return { head: h, beam, k };
  }

  // ── 가공 (드릴): 기둥 + 위아래로 움직이는 헤드 + 모터
  const dp = P(G.px, G.ry), dcol = P(G.px + 62, G.ry - 22);
  box(0.24, 2.05, 0.24, M.alu, dcol.x, 1.02, dcol.z);
  box(0.3, 0.06, 0.3, M.aluD, dcol.x, 0.03, dcol.z);
  cyl(0.09, 0.5, M.alu, 'y', dcol.x, 1.8, dcol.z + 0.17);           // 가공 실린더 (세로)
  cyl(0.03, 0.08, M.blueFit, 'x', dcol.x + 0.11, 1.95, dcol.z + 0.17);
  reed(dcol.x - 0.14, 1.95, dcol.z + 0.17, 'drlU', 'z');
  reed(dcol.x - 0.14, 1.62, dcol.z + 0.17, 'drlD', 'z');
  const drill = new THREE.Group();
  box(0.18, 0.22, 0.2, M.red, dcol.x - dp.x, 0, dcol.z - dp.z + 0.02, drill);      // 슬라이드 블록 (빨강)
  box(Math.abs(dcol.x - dp.x), 0.1, 0.12, M.red, (dcol.x - dp.x) / 2, 0, 0, drill); // 팔
  const spin = new THREE.Group(); drill.add(spin);
  cyl(0.13, 0.36, M.black, 'y', 0, 0.2, 0, spin);                    // 드릴 모터 (검정 캡)
  cyl(0.135, 0.04, M.black2, 'y', 0, 0.4, 0, spin);
  cyl(0.05, 0.12, M.rod, 'y', 0, -0.08, 0, spin);                    // 척
  cyl(0.015, 0.2, M.rod, 'y', 0, -0.24, 0, spin, 8);                 // 드릴 날
  const spinMark = box(0.02, 0.3, 0.02, std({ color: 0x9fe0b4, emissive: 0x22c55e, emissiveIntensity: 0 }), 0.12, 0.2, 0, spin);
  scene.add(shadowAll(drill));
  const DRILL_UP = H0 + PH + 0.5, DRILL_TRAVEL = 0.36;

  // ── 금속감지(유도형)·워크감지(용량형): 빨간 ㄱ자 브래킷 + 원통형 센서
  function proxSensor(x, k, side, capColor) {
    const p = P(x, G.cy), zPost = side < 0 ? P(0, G.bt - 16).z : P(0, G.bb + 16).z;
    box(0.06, H0 + 0.55, 0.06, M.red, p.x, (H0 + 0.55) / 2, zPost);
    box(0.06, 0.06, Math.abs(zPost - p.z) + 0.06, M.red, p.x, H0 + 0.55, (zPost + p.z) / 2);
    cyl(0.055, 0.32, M.metalPc, 'y', p.x, H0 + 0.36, p.z);
    const cap = cyl(0.058, 0.05, std({ color: capColor, emissive: capColor, emissiveIntensity: 0 }), 'y', p.x, H0 + 0.54, p.z);
    const zone = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 32), new THREE.MeshBasicMaterial({ color: capColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    zone.rotation.x = -Math.PI / 2; zone.position.set(p.x, H0 + 0.004, p.z); scene.add(zone);
    return { cap, zone, k };
  }
  const prox = [proxSensor(G.xm, 'ind', -1, 0xffa31a), proxSensor(G.xe, 'cap', 1, 0x4a8dff)];

  // ── 스토퍼 (벨트 뒤 세로 실린더 + 벨트 위로 가로지르는 막대) + 스토퍼검출 광화이버
  const sp = P(G.pinX, G.bt - 22);
  cyl(0.08, 0.42, M.alu, 'y', sp.x, H0 - 0.25, sp.z);
  cyl(0.026, 0.07, M.blueFit, 'x', sp.x + 0.1, 0.25, sp.z);
  reed(sp.x - 0.1, H0 - 0.12, sp.z, 'stpU', 'z'); reed(sp.x - 0.1, H0 - 0.36, sp.z, 'stpD', 'z');
  const stopper = new THREE.Group();
  box(0.06, 0.08, beltW + 0.3, M.redD, 0, 0, P(0, G.cy).z - sp.z, stopper);
  box(0.06, 0.25, 0.06, M.rod, 0, -0.14, 0, stopper);
  stopper.position.set(sp.x, 0, sp.z); scene.add(shadowAll(stopper));
  const fiberStp = fiberHead(P(G.xs - 36, G.bb + 12), P(G.xs, G.cy), 'stpS');

  // ── 취출함 · 끝 상자 (빨간 상자)
  function redBin(x0, y0, x1, y1, h) {
    const a = P(x0, y0), b = P(x1, y1), w = b.x - a.x, d = b.z - a.z, t = 0.03;
    box(w, 0.03, d, M.redD, (a.x + b.x) / 2, 0.015, (a.z + b.z) / 2);
    box(w, h, t, M.red, (a.x + b.x) / 2, h / 2, a.z + t / 2); box(w, h, t, M.red, (a.x + b.x) / 2, h / 2, b.z - t / 2);
    box(t, h, d, M.red, a.x + t / 2, h / 2, (a.z + b.z) / 2); box(t, h, d, M.red, b.x - t / 2, h / 2, (a.z + b.z) / 2);
    return { a, b };
  }
  const ejBinBox = redBin(G.binX0, G.binY0, G.binX1, G.binY1, 0.34);
  const endBinBox = redBin(G.endX0, G.endY0, G.endX1, G.endY1, 0.3);

  // ── 흡착: 뒤쪽 기둥 + 앞뒤로 움직이는 실린더(축 Z) + 내려온 흡착컵
  const sc = P(G.xs, 10), SUC_Y = 1.5;
  box(0.16, SUC_Y + 0.12, 0.16, M.alu, sc.x + 0.32, (SUC_Y + 0.12) / 2, sc.z);
  box(0.5, 0.08, 0.16, M.alu, sc.x + 0.14, SUC_Y + 0.12, sc.z);
  const suc = { len: 64 * S };
  cyl(0.1, suc.len, M.alu, 'z', sc.x, SUC_Y, sc.z + suc.len / 2);
  box(0.24, 0.24, 0.08, M.aluD, sc.x, SUC_Y, sc.z + 0.04); box(0.24, 0.24, 0.08, M.aluD, sc.x, SUC_Y, sc.z + suc.len - 0.04);
  cyl(0.026, 0.07, M.blueFit, 'y', sc.x, SUC_Y + 0.13, sc.z + 0.12); cyl(0.026, 0.07, M.blueFit, 'y', sc.x, SUC_Y + 0.13, sc.z + suc.len - 0.12);
  reed(sc.x + 0.12, SUC_Y + 0.02, sc.z + 0.16, 'sucB', 'z'); reed(sc.x + 0.12, SUC_Y + 0.02, sc.z + suc.len - 0.16, 'sucF', 'z');
  const sucRod = rodMesh(0.035, M.rod, 'z');
  const cupG = new THREE.Group();
  box(0.12, 0.08, 0.12, M.aluD, 0, 0, 0, cupG);
  cyl(0.025, SUC_Y - (H0 + PH + 0.08), M.rod, 'y', 0, -(SUC_Y - (H0 + PH + 0.08)) / 2, 0, cupG);
  const cupMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.07, 20), M.rubber);
  cupMesh.position.y = -(SUC_Y - (H0 + PH + 0.04)); cupG.add(cupMesh);
  const vacGlow = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.015, 8, 24), new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0 }));
  vacGlow.rotation.x = Math.PI / 2; vacGlow.position.y = cupMesh.position.y; cupG.add(vacGlow);
  scene.add(shadowAll(cupG));
  // 진공 이젝터·압력 스위치 (흡착센서)
  const vacBox = P(660, 172);
  box(0.22, 0.1, 0.1, M.gray, vacBox.x, 0.05, vacBox.z);
  reed(vacBox.x, 0.13, vacBox.z, 'vac', 'x');

  // ── 저장 받침 + 창고 (3단 × 2칸 검정 선반)
  { const a = P(G.xs - R - 10, G.trayY - R - 8), b = P(G.rackX0, G.trayY + R + 8);
    box(b.x - a.x, H0, b.z - a.z, M.aluD, (a.x + b.x) / 2, H0 / 2, (a.z + b.z) / 2);
    box(b.x - a.x, 0.06, 0.03, M.alu, (a.x + b.x) / 2, H0 + 0.03, a.z + 0.015); box(b.x - a.x, 0.06, 0.03, M.alu, (a.x + b.x) / 2, H0 + 0.03, b.z - 0.015); }
  const rkA = P(G.rackX0, G.rackY0), rkB = P(G.rackX1, G.rackY1);
  const RACK_LV = [H0, H0 + 0.42, H0 + 0.84];
  for (const lv of RACK_LV) {
    box(rkB.x - rkA.x, 0.05, rkB.z - rkA.z, M.black, (rkA.x + rkB.x) / 2, lv - 0.025, (rkA.z + rkB.z) / 2);
    box(rkB.x - rkA.x, 0.12, 0.04, M.black, (rkA.x + rkB.x) / 2, lv + 0.06, rkB.z - 0.02);
    box(0.04, 0.12, rkB.z - rkA.z, M.black, (rkA.x + rkB.x) / 2, lv + 0.06, (rkA.z + rkB.z) / 2);
  }
  for (const [x, z] of [[rkA.x + 0.03, rkA.z + 0.03], [rkB.x - 0.03, rkA.z + 0.03], [rkA.x + 0.03, rkB.z - 0.03], [rkB.x - 0.03, rkB.z - 0.03]]) cyl(0.02, RACK_LV[2] + 0.2, M.rod, 'y', x, (RACK_LV[2] + 0.2) / 2, z, null, 10);
  const rackSlot = i => { const lv = Math.floor(i / 2), col = i % 2; return { x: rkA.x + (rkB.x - rkA.x) * (col ? 0.73 : 0.27), y: RACK_LV[lv] + PH / 2, z: (rkA.z + rkB.z) / 2 }; };

  // ── 서보 축 (세로 검정 기둥, 위에 서보 모터)
  const sv = P(814, 52);
  box(0.42, 3.0, 0.42, M.black, sv.x, 1.5, sv.z);
  box(0.3, 2.6, 0.04, M.black2, sv.x, 1.6, sv.z + 0.23);
  box(0.36, 0.36, 0.36, M.black2, sv.x, 3.18, sv.z);
  cyl(0.12, 0.3, M.black, 'z', sv.x, 3.18, sv.z - 0.3);
  box(0.4, 0.3, 0.1, M.aluD, sv.x, 2.3, sv.z + 0.29);                 // 캐리지 (원점)
  reed(sv.x + 0.25, 2.75, sv.z, 'limU', 'x'); reed(sv.x + 0.25, 2.35, sv.z, 'org', 'x'); reed(sv.x + 0.25, 0.5, sv.z, 'limL', 'x');

  // ── FRL (공압 조절기): 매거진 앞쪽 빨간 판 / 밸브 매니폴드: 덕트 뒤 벽, 매거진 쪽 (사진 위치)
  const fr = { x: -3.55, z: 1.42 };
  box(0.4, 0.62, 0.05, M.red, fr.x, 0.31, fr.z + 0.14);
  box(0.22, 0.4, 0.2, M.gray, fr.x, 0.42, fr.z); cyl(0.1, 0.16, M.black, 'y', fr.x, 0.7, fr.z);
  cyl(0.075, 0.04, std({ color: 0xffffff, roughness: 0.3 }), 'z', fr.x, 0.46, fr.z - 0.12); cyl(0.04, 0.1, M.blueFit, 'x', fr.x + 0.15, 0.3, fr.z);
  box(0.12, 0.2, 0.12, M.acrylic, fr.x, 0.13, fr.z);
  const VALVES = [['ySupF', 'ySupB', 'sup'], ['yDisF', 'yDisB', 'dis'], ['yDrl', null, 'drl'], ['yEjF', 'yEjB', 'ej'], ['yStp', null, 'stp'], ['ySucF', 'ySucB', 'suc'], ['yVac', null, 'vac'], ['yStoF', 'yStoB', 'sto']];
  const MVZ = -1.7, MVX = i => -4.72 + i * 0.25;
  box(VALVES.length * 0.25 + 0.1, 0.1, 0.38, M.alu, (MVX(0) + MVX(VALVES.length - 1)) / 2, 0.05, MVZ);
  const solLeds = [], valvePorts = [];
  VALVES.forEach(([kF, kB, name], i) => {
    const x = MVX(i), ks = kB ? [kF, kB] : [kF];
    box(0.19, 0.2, 0.32, M.black, x, 0.2, MVZ);
    ks.forEach((k, j) => {
      const z = MVZ + (ks.length === 1 ? 0 : (j ? 0.1 : -0.1));
      box(0.17, 0.08, 0.1, M.black2, x, 0.34, z);   // 솔레노이드
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.05), std({ color: 0x1a3a22, emissive: 0x22ff66, emissiveIntensity: 0 }));
      l.position.set(x, 0.39, z); scene.add(l);
      solLeds.push({ mesh: l, k });
    });
    ks.forEach((k, j) => {
      const px = x + (ks.length === 1 ? 0 : (j ? 0.05 : -0.05));
      cyl(0.022, 0.07, j ? M.white : M.blueFit, 'z', px, 0.16, MVZ + 0.19, null, 10);
      valvePorts.push({ name, j, at: new THREE.Vector3(px, 0.16, MVZ + 0.23), i });
    });
  });

  // ── 앞쪽: 초록 기판 2장 (스위치·입력 단자 / 램프·출력 단자) + 빨간 트레이너 박스 (CT-4200M)
  // 사진(트레이너 쪽에서 봄) 그대로: 왼쪽이 매거진·PLC 쪽, 오른쪽이 서보 쪽
  const ZB = 2.625;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const jackPos = {};      // 단자 이름 → 위치 (패치 코드 연결용)
  const jackList = [];     // {x, y, z, col}
  const JC = { g: 0x35b85a, b: 0x2f62d6, r: 0xc8283a, y: 0xe8c22c, k: 0x2a2e34 };
  function jack(name, x, y, z, col) { jackList.push({ x, y, z, col }); if (name) jackPos[name] = V3(x, y + 0.02, z); }
  const hx = n => n.toString(16).toUpperCase().padStart(2, '0');
  const FONT = '"IBM Plex Sans KR","Malgun Gothic",sans-serif';
  function plateTex(w, h, draw) { return canvasTex(w, h, (g, W, H) => { g.fillStyle = '#f7f8fa'; g.fillRect(0, 0, W, H); draw(g, W, H); }); }
  function topTexBox(w, h, d, map, side, x, y, z, parent) {   // 윗면에만 그림
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, std({ map, roughness: 0.55 }), side, side, side]);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || scene).add(m); return m;
  }
  const buttons = [];   // 누를 수 있는 버튼
  function pushBtn(k, color, x, z, mush) {
    const g = new THREE.Group();
    if (mush) cyl(0.2, 0.03, M.yellow, 'y', 0, 0.015, 0, g);
    cyl(mush ? 0.1 : 0.13, 0.07, M.black, 'y', 0, mush ? 0.06 : 0.035, 0, g);
    const capMat = std({ color, roughness: 0.32, emissive: color, emissiveIntensity: 0 });
    const cap = mush ? new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), capMat) : new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.07, 24), capMat);
    cap.position.y = mush ? 0.1 : 0.1; cap.castShadow = true; g.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(mush ? 0.24 : 0.17, 0.02, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; g.add(ring);
    g.position.set(x, 0.07, z); scene.add(g);
    cap.userData.btn = k; g.children.forEach(m => { m.userData.btn = k; });
    buttons.push({ k, g, cap, ring, y0: cap.position.y, mush });
  }
  const lamps = [];
  function lamp(k, col, x, z) {
    cyl(0.13, 0.07, M.black, 'y', x, 0.105, z);
    const mat = std({ color: col, emissive: col, emissiveIntensity: 0, transparent: true, opacity: 0.94, roughness: 0.22 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.position.set(x, 0.14, z); dome.castShadow = true; scene.add(dome);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false }));
    glow.position.set(x, 0.17, z); scene.add(glow);
    lamps.push({ k, mat, glow });
  }
  const boardLeds = [];    // {x, z, kind, n}
  function ioBoard(x0, kind) {
    const W = 4.4, cx = x0 + W / 2, isIn = kind === 'in';
    box(W, 0.04, 0.85, M.pcb, cx, 0.02, ZB);
    // 먼 쪽: 센서·밸브 배선이 꽂히는 흰 커넥터 줄, 가까운 쪽: 회색 나사 단자대
    box(3.2, 0.06, 0.08, M.white, x0 + 2.6, 0.07, ZB - 0.35);
    for (let i = 0; i < 16; i++) box(0.04, 0.025, 0.05, i % 2 ? M.redD : M.black2, x0 + 1.1 + i * 0.19, 0.11, ZB - 0.35);
    const tb = canvasTex(256, 16, (g, w, h) => { g.fillStyle = '#5d6670'; g.fillRect(0, 0, w, h); g.fillStyle = '#3b424b'; for (let x = 2; x < w; x += 8) g.fillRect(x, 3, 5, h - 6); });
    topTexBox(3.2, 0.07, 0.09, tb, M.gray, x0 + 2.6, 0.075, ZB + 0.35);
    // 2×2 버튼(램프) 판 + 이름
    const names = isIn ? ['START', 'STOP', 'RESET', 'EMG'] : ['RED', 'YEL', 'GRE', 'BLUE'];
    const cl = plateTex(256, 222, (g, w, h) => {
      g.fillStyle = '#4b5563'; g.font = `700 19px ${FONT}`; g.textAlign = 'center';
      names.forEach((t, i) => g.fillText(t, w / 2 + (i % 2 ? 57 : -57), i < 2 ? 98 : 212));
      g.strokeStyle = '#c5ccd5'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    });
    topTexBox(0.9, 0.03, 0.78, cl, M.white, x0 + 0.55, 0.055, ZB);
    // 단자 띠: 2줄 × 16 (X00~X1F / Y20~Y3F), 단자마다 상태 LED
    const n0 = isIn ? 0 : 0x20, L = isIn ? 'X' : 'Y';
    const st = plateTex(1024, 160, (g, w, h) => {
      g.fillStyle = '#4b5563'; g.font = `600 17px ${FONT}`; g.textAlign = 'center';
      for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) g.fillText(L + hx(n0 + r * 16 + c), (0.2 + c * 0.19) * 315, r ? 150 : 80);
    });
    topTexBox(3.25, 0.03, 0.5, st, M.white, x0 + 1.0 + 3.25 / 2, 0.055, ZB);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) {
      const x = x0 + 1.2 + c * 0.19, z = ZB - 0.135 + r * 0.22, n = n0 + r * 16 + c;
      jack('b' + L + hx(n), x, 0.075, z, isIn ? 'g' : 'b');
      boardLeds.push({ x: x + 0.07, z: z - 0.07, kind, n });
    }
    return { x0, cx };
  }
  const bdIn = ioBoard(-4.75, 'in'), bdOut = ioBoard(0, 'out');
  pushBtn('pbStart', 0x22b357, -4.4, ZB - 0.2); pushBtn('pbStop', 0xe5483b, -4.0, ZB - 0.2);
  pushBtn('pbReset', 0xf0c02c, -4.4, ZB + 0.2); pushBtn('pbEmg', 0xd42020, -4.0, ZB + 0.2, true);
  lamp('lR', 0xef4444, 0.35, ZB - 0.2); lamp('lY', 0xf2b705, 0.75, ZB - 0.2);
  lamp('lG', 0x22c55e, 0.35, ZB + 0.2); lamp('lB', 0x3b82f6, 0.75, ZB + 0.2);

  // 트레이너 박스: 빨간 상자 + 흰 패널
  const TZ0 = 3.2, TZ1 = 4.45, PW = 9.5, PD = TZ1 - TZ0 - 0.2, PZ0 = TZ0 + 0.1;
  box(9.8, 0.5, TZ1 - TZ0, M.red, 0, 0.25, (TZ0 + TZ1) / 2);
  const IN_X = c => -0.85 + c * 0.37, OUT_X = c => 0.77 + c * 0.37, IO_Z = r => 3.56 + r * 0.112;
  const TW = 2048, TH = Math.round(TW * PD / PW);
  const tx = v => (v + PW / 2) / PW * TW, tz = v => (v - PZ0) / PD * TH;
  const panelTex = canvasTex(TW, TH, (g) => {
    g.fillStyle = '#f5f6f8'; g.fillRect(0, 0, TW, TH);
    // 제목 (로고 + CT-4200M + 장치 이름)
    g.fillStyle = '#1d4ed8'; g.beginPath(); g.arc(tx(-4.55), tz(3.37), 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c62828'; g.font = `800 24px ${FONT}`; g.fillText('CT-4200M', tx(-4.45), tz(3.37) + 9);
    const tw = g.measureText('CT-4200M').width;
    g.fillStyle = '#1d2733'; g.font = `700 21px ${FONT}`; g.fillText('생산자동화 PLC 실습장치', tx(-4.45) + tw + 14, tz(3.37) + 8);
    // 구역 테두리
    const frame = (x0, x1, z0, z1, t) => {
      g.strokeStyle = '#9aa4b0'; g.lineWidth = 2; g.strokeRect(tx(x0), tz(z0), tx(x1) - tx(x0), tz(z1) - tz(z0));
      if (t) { g.font = `700 14px ${FONT}`; const m = g.measureText(t).width, cx = (tx(x0) + tx(x1)) / 2; g.fillStyle = '#f5f6f8'; g.fillRect(cx - m / 2 - 5, tz(z0) - 9, m + 10, 16); g.fillStyle = '#4c5a6b'; g.textAlign = 'center'; g.fillText(t, cx, tz(z0) + 5); g.textAlign = 'left'; }
    };
    g.font = `700 14px ${FONT}`;
    frame(-1.0, 0.56, 3.45, 4.4, 'INPUT'); frame(0.62, 2.18, 3.45, 4.4, 'OUTPUT');
    frame(2.24, 2.86, 3.45, 4.4, 'INTERFACE'); frame(2.92, 3.52, 3.45, 4.4, 'SIGNAL');
    frame(-3.98, -1.98, 4.17, 4.4, '');
    // 단자 번호
    g.fillStyle = '#3d4856'; g.font = `600 12px ${FONT}`;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 8; r++) {
      g.fillText('X' + hx(c * 8 + 7 - r), tx(IN_X(c) + 0.06), tz(IO_Z(r)) + 4);
      g.fillText('Y' + hx(0x20 + c * 8 + 7 - r), tx(OUT_X(c) + 0.06), tz(IO_Z(r)) + 4);
    }
    g.font = `700 12px ${FONT}`; g.fillStyle = '#b42323'; g.fillText('+24V', tx(-3.93), tz(4.24) + 4);
    g.fillStyle = '#1d4ed8'; g.fillText('COM', tx(-2.85), tz(4.24) + 4);
    g.fillStyle = '#4c5a6b'; g.fillText('IN', tx(2.3), tz(3.66)); g.fillText('OUT', tx(2.3), tz(4.06));
    g.fillText('POWER', tx(-4.7), tz(4.15)); g.fillText('ON', tx(3.31), tz(4.22)); g.fillText('OFF', tx(3.31), tz(4.36));
  });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.02, PD), [M.white, M.white, std({ map: panelTex, roughness: 0.55 }), M.white, M.white, M.white]);
  panel.position.set(0, 0.51, (TZ0 + TZ1) / 2); panel.receiveShadow = true; scene.add(panel);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 8; r++) {
    jack('X' + hx(c * 8 + 7 - r), IN_X(c), 0.54, IO_Z(r), 'g');
    jack('Y' + hx(0x20 + c * 8 + 7 - r), OUT_X(c), 0.54, IO_Z(r), 'b');
  }
  for (let i = 0; i < 6; i++) jack((i < 3 ? '24V' : 'COM') + (i % 3), -3.72 + i * 0.3 + (i >= 3 ? 0.12 : 0), 0.54, 4.32, i < 3 ? 'r' : 'b');
  ['r', 'r', 'y', 'y', 'g', 'g', 'k', 'k'].forEach((col, i) => jack(null, 3.07 + (i % 2) * 0.28, 0.54, 3.58 + Math.floor(i / 2) * 0.12, col));
  // 전원 스위치 · 서보 ON 스위치
  box(0.16, 0.06, 0.22, std({ color: 0xd32f2f, emissive: 0xff3b2f, emissiveIntensity: 0.35, roughness: 0.4 }), -4.55, 0.55, 4.3);
  box(0.16, 0.06, 0.22, std({ color: 0x2fae4f, emissive: 0x22c55e, emissiveIntensity: 0.25, roughness: 0.4 }), 3.2, 0.55, 4.27);
  // 인터페이스 커넥터 (T자 플러그)
  for (const z of [3.72, 4.12]) { box(0.34, 0.06, 0.2, M.black, 2.58, 0.55, z); box(0.18, 0.16, 0.12, M.black2, 2.58, 0.66, z); cyl(0.04, 0.34, M.black2, 'z', 2.58, 0.7, z + 0.2); }
  // 서보 앰프 (검정, 윗면에 표시창·커넥터)
  const ampTex = canvasTex(256, 240, (g, w, h) => {
    g.fillStyle = '#1b1e23'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0d1a12'; g.fillRect(28, 26, 120, 46); g.fillStyle = '#39ff7a'; g.font = '700 34px monospace'; g.fillText(' 0.0', 30, 62);
    g.fillStyle = '#9aa4b0'; g.font = `700 16px ${FONT}`; g.fillText('SERVO AMP', 28, 102);
    g.fillStyle = '#3b424b'; for (let i = 0; i < 3; i++) g.fillRect(28, 120 + i * 36, 200, 24);
    g.fillStyle = '#f2c230'; g.fillRect(196, 26, 32, 10);
  });
  topTexBox(0.95, 0.5, 0.95, ampTex, M.black, 4.12, 0.77, 3.84);
  // PLC: 베이스 + 전원 + CPU + 입출력 모듈 3장 — 앞면이 위를 봄
  box(2.55, 0.08, 0.66, M.red, -3.02, 0.56, 3.78);
  const modTop = (t, kind) => canvasTex(96, 128, (g, w, h) => {
    g.fillStyle = kind === 'pw' ? '#7f1d1d' : '#1f2329'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8edf2'; g.font = '700 12px sans-serif'; g.fillText(t, 7, 18);
    if (kind === 'cpu') { g.fillStyle = '#0f1216'; g.fillRect(8, 64, 34, 22); g.fillStyle = '#9aa4b0'; g.fillRect(52, 94, 30, 12); }
    if (kind === 'io') { g.fillStyle = '#f2f3f5'; g.fillRect(8, 26, 80, 18); g.fillStyle = '#4b5563'; g.font = '600 10px sans-serif'; g.fillText('X/Y', 12, 39); g.fillStyle = '#2f343b'; g.fillRect(14, 60, 68, 56); for (let i = 0; i < 6; i++) { g.fillStyle = '#c6ff3a'; g.fillRect(12 + i * 13, 50, 7, 5); } }
    if (kind === 'pw') { g.fillStyle = '#39ff7a'; g.fillRect(8, 30, 10, 6); }
  });
  const plcMods = [['POWER', 'pw', -4.0, 0.5], ['CPU', 'cpu', -3.47, 0.44], ['INPUT', 'io', -2.97, 0.44], ['OUTPUT', 'io', -2.5, 0.44], ['INPUT', 'io', -2.03, 0.44]];
  plcMods.forEach(([t, kind, x, w]) => topTexBox(w, 0.42, 0.6, modTop(t, kind), kind === 'pw' ? std({ color: 0x8e2222, roughness: 0.5 }) : M.black2, x, 0.81, 3.78));
  const cpuLed = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.04), std({ color: 0x1a3a22, emissive: 0x22ff66, emissiveIntensity: 0 }));
  cpuLed.position.set(-3.6, 1.03, 3.62); scene.add(cpuLed);
  const cpuErr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.04), std({ color: 0x3a1a1a, emissive: 0xff3b2f, emissiveIntensity: 0 }));
  cpuErr.position.set(-3.48, 1.03, 3.62); scene.add(cpuErr);

  // 단자 (인스턴스로 한 번에 그림)
  { const mtx = new THREE.Matrix4(), c = new THREE.Color();
    const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.042, 0.046, 0.04, 14), std({ color: 0xffffff, roughness: 0.45 }), jackList.length);
    const hole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.017, 0.017, 0.044, 8), std({ color: 0x14161a, roughness: 0.85 }), jackList.length);
    jackList.forEach((j, i) => { mtx.makeTranslation(j.x, j.y, j.z); body.setMatrixAt(i, mtx); hole.setMatrixAt(i, mtx); body.setColorAt(i, c.setHex(JC[j.col])); });
    body.receiveShadow = true; scene.add(body, hole); }
  const ledIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.036, 0.02, 0.036), new THREE.MeshBasicMaterial({ color: 0xffffff }), boardLeds.length);
  const LED_C = { in: [new THREE.Color(0x3d4a2e), new THREE.Color(0xd8ff3a)], out: [new THREE.Color(0x4a2e28), new THREE.Color(0xff5a2a)] };
  { const mtx = new THREE.Matrix4(); boardLeds.forEach((l, i) => { mtx.makeTranslation(l.x, 0.085, l.z); ledIM.setMatrixAt(i, mtx); ledIM.setColorAt(i, LED_C[l.kind][0]); l.on = false; }); scene.add(ledIM); }

  // 패치 코드 (바나나 플러그) · 회색 케이블
  const cordMat = { r: std({ color: 0x8f1f33, roughness: 0.5 }), b: std({ color: 0x2752c4, roughness: 0.5 }), gr: std({ color: 0xa3a9b0, roughness: 0.65 }), w: std({ color: 0xe9edf1, roughness: 0.4 }), bl: std({ color: 0x2b6fe0, roughness: 0.4 }) };
  function tube(pts, r, mat, seg) {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg || 48, r, 7, false), mat);
    m.castShadow = true; scene.add(m); return m;
  }
  function cord(a, b, col, via) {
    const A = jackPos[a], B = jackPos[b]; if (!A || !B) return;
    const mat = cordMat[col], up = V3(0, 0.09, 0);
    for (const p of [A, B]) { cyl(0.027, 0.09, mat, 'y', p.x, p.y + 0.045, p.z, null, 10); cyl(0.018, 0.02, M.rod, 'y', p.x, p.y + 0.1, p.z, null, 8); }
    const A1 = A.clone().add(up), B1 = B.clone().add(up);
    const pts = via ? [A1, ...via, B1] : [A1, A1.clone().add(V3(0, 0.16, 0)), V3((A.x + B.x) / 2, Math.max(A.y, B.y) + 0.42, (A.z + B.z) / 2), B1.clone().add(V3(0, 0.2, 0)), B1];
    tube(pts, 0.016, mat);
  }
  // 입력: 스위치·센서 단자 → PLC 입력 / 출력: PLC 출력 → 램프·밸브 단자
  for (const n of ['0F', '19', '1A', '1B', '1C']) cord('X' + n, 'bX' + n, 'r');
  for (const n of ['20', '21', '2E', '32', '34']) cord('Y' + n, 'bY' + n, 'b');
  // 앞으로 늘어진 전원 코드
  const hang = (a, b, col, drop) => { const A = jackPos[a], B = jackPos[b]; cord(a, b, col, [V3(A.x, 0.75, A.z + 0.05), V3(A.x + 0.05, 0.6, 4.55), V3((A.x + B.x) / 2, drop, 4.72), V3(B.x - 0.05, 0.6, 4.55), V3(B.x, 0.75, B.z + 0.05)]); };
  hang('24V0', '24V2', 'r', -0.75); hang('COM0', 'COM2', 'b', -0.55); hang('24V1', 'COM1', 'r', -0.95);
  // PLC I/O 모듈 → 기판 단자대 (회색 케이블)
  [[-2.97, -2.7], [-2.5, 1.5], [-2.03, -1.6]].forEach(([mx, bx]) => tube([V3(mx, 1.03, 3.78), V3(mx, 1.25, 3.6), V3((mx + bx) / 2, 0.95, 3.12), V3(bx, 0.42, 3.0), V3(bx, 0.12, ZB + 0.35)], 0.032, cordMat.gr));
  // 기판 → 설비 (덕트 넘어 들어가는 회색 케이블)
  for (const x of [-3.3, -1.9, 1.4, 2.9]) tube([V3(x, 0.1, ZB - 0.35), V3(x, 0.45, 2.2), V3(x + 0.08, 0.58, 2.06), V3(x + 0.16, 0.3, 1.94), V3(x + 0.3, 0.04, 1.86)], 0.03, cordMat.gr, 32);
  // 인터페이스 → 서보 쪽 케이블 (앞으로 늘어짐)
  for (const z of [3.92, 4.32]) tube([V3(2.58, 0.7, z), V3(2.62, 0.72, 4.5), V3(2.7, 0.3, 4.62), V3(2.85, -0.6, 4.66)], 0.035, cordMat.gr, 24);

  // 공압 배관: 밸브 → 각 실린더 (파랑 = 전진/동작 쪽, 흰색 = 후진 쪽)
  const fitOf = {
    sup: sup.fits, dis: dis.fits, ej: ej.fits, sto: sto.fits,
    drl: [V3(dcol.x + 0.11, 1.95, dcol.z + 0.17)], stp: [V3(sp.x + 0.14, 0.25, sp.z)],
    suc: [V3(sc.x, SUC_Y + 0.17, sc.z + 0.12), V3(sc.x, SUC_Y + 0.17, sc.z + suc.len - 0.12)], vac: [V3(vacBox.x - 0.11, 0.06, vacBox.z)],
  };
  for (const vp of valvePorts) {
    const b = fitOf[vp.name][vp.j]; if (!b) continue;
    const a = vp.at, lerp = (u, v, t) => u + (v - u) * t, k = vp.i * 0.035 + vp.j * 0.018;
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    tube([a, V3(a.x, 0.1, a.z + 0.18 + k), V3(lerp(a.x, b.x, 0.3), 0.03, lerp(a.z, b.z, 0.3) + k), V3(lerp(a.x, b.x, 0.8), 0.03, lerp(a.z, b.z, 0.8) + k),
      V3(b.x - dx / L * 0.18, Math.max(0.1, b.y * 0.55), b.z - dz / L * 0.18), b], 0.013, vp.j ? cordMat.w : cordMat.bl, 56);
  }
  tube([V3(fr.x + 0.2, 0.3, fr.z), V3(-4.75, 0.04, 1.1), V3(-4.85, 0.04, -0.6), V3(-4.95, 0.06, MVZ), V3(MVX(0) - 0.12, 0.07, MVZ)], 0.016, cordMat.bl, 40);
  tube([V3(vacBox.x + 0.11, 0.06, vacBox.z), V3(vacBox.x + 0.4, 0.05, vacBox.z - 0.6), V3(sc.x + 0.32, 0.3, sc.z + 0.12), V3(sc.x + 0.3, SUC_Y - 0.1, sc.z + 0.1), V3(sc.x + 0.1, SUC_Y + 0.25, sc.z + suc.len)], 0.012, cordMat.w, 48);

  // ── 이름표 (CSS2D)
  const labels = [];
  function tag(title, devs, pos) {
    const el = document.createElement('div');
    el.className = 'p3anchor';
    const bx = document.createElement('div');
    bx.className = 'p3tag'; bx.title = `${title} — 누르면 가까이 보기`;
    bx.innerHTML = `<b>${title}</b>` + devs.map(([k, txt]) => `<span class="c ${k.startsWith('y') || k.startsWith('l') ? 'out' : 'in'}" data-k="${k}"><i></i>${txt}</span>`).join('');
    el.appendChild(bx);
    const o = new CSS2DObject(el); o.position.set(pos.x, pos.y, pos.z); scene.add(o);
    const at = new THREE.Vector3(pos.x, pos.y, pos.z);
    bx.addEventListener('click', () => focusOn(new THREE.Vector3(pos.x, Math.max(0.3, pos.y - 0.45), pos.z), 3.4));
    labels.push({ el, box: bx, pos: at, w: 0, h: 0, dy: '0,0', dim: false, chips: [...bx.querySelectorAll('.c')].map(c => ({ el: c, k: c.dataset.k, on: null, hl: null })) });
  }
  // 이름표 겹침 정리: 가까운 이름표부터 자리를 잡고, 겹치면 위아래로 비켜 두고, 그래도 안 되면 흐리게
  const _v = new THREE.Vector3();
  let uiDirty = true, uiRects = [];
  function declutter() {
    const W = host.clientWidth, H = host.clientHeight; if (!W) return;
    const items = [];
    for (const l of labels) {
      if (!l.w) { l.w = l.box.offsetWidth; l.h = l.box.offsetHeight; if (!l.w) continue; }
      _v.copy(l.pos).project(camera);
      if (_v.z > 1 || Math.abs(_v.x) > 1.15 || Math.abs(_v.y) > 1.15) continue;
      items.push({ l, x: (_v.x + 1) / 2 * W, y: (1 - _v.y) / 2 * H, d: camera.position.distanceToSquared(l.pos) });
    }
    items.sort((a, b) => a.d - b.d);
    if (uiDirty) {
      uiDirty = false; const hr = host.getBoundingClientRect();
      uiRects = [...ui.querySelectorAll('.p3opts, .p3views, .p3help, .p3pad')].map(e => e.getBoundingClientRect()).filter(r => r.width)
        .map(r => ({ x: r.left - hr.left + r.width / 2, y: r.top - hr.top + r.height / 2, w: r.width, h: r.height }));
    }
    const placed = uiRects.slice();
    const hit = (x, y, w, h) => placed.some(p => Math.abs(p.x - x) * 2 < p.w + w + 6 && Math.abs(p.y - y) * 2 < p.h + h + 2);
    const TRY = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -3]];
    for (const it of items) {
      const l = it.l, sx = l.w * 0.55 + 4, sy = l.h * 0.62 + 3; let off = null;
      for (const [a, b] of TRY) { const dx = Math.round(a * sx), dy = Math.round(b * sy); if (!hit(it.x + dx, it.y + dy, l.w, l.h)) { off = [dx, dy]; break; } }
      const dim = !off;
      if (dim) off = [0, 0]; else placed.push({ x: it.x + off[0], y: it.y + off[1], w: l.w, h: l.h });
      const key = off[0] + ',' + off[1];
      if (l.dy !== key) { l.dy = key; l.box.style.transform = key === '0,0' ? '' : `translate(${off[0]}px,${off[1]}px)`; }
      if (l.dim !== dim) { l.dim = dim; l.box.classList.toggle('dim', dim); }
    }
  }
  const D = k => api.sheetDev(PL.dev[k]);
  function buildTags() {
    labels.forEach(l => l.el.remove()); labels.length = 0;
    scene.children.filter(o => o.isCSS2DObject).forEach(o => scene.remove(o));
    tag('매거진', [['mag', `${D('mag')} 공급센서`]], { x: mg.x, y: H0 + 1.75, z: mg.z });
    tag('공급 실린더', [['ySupF', `${D('ySupF')} 전진`], ['ySupB', `${D('ySupB')} 후진`], ['supB', `${D('supB')} 후진`], ['supF', `${D('supF')} 전진`]], { x: P(70, 0).x, y: H0 + 0.55, z: P(0, G.ry).z });
    tag('가공 (드릴)', [['yDrl', `${D('yDrl')} 하강`], ['yMot', `${D('yMot')} 모터`], ['drlD', `${D('drlD')} 하강`], ['drlU', `${D('drlU')} 상승`]], { x: dcol.x + 0.2, y: 2.35, z: dcol.z });
    tag('분배 실린더', [['yDisF', `${D('yDisF')} 전진`], ['yDisB', `${D('yDisB')} 후진`], ['disB', `${D('disB')} 후진`], ['disF', `${D('disF')} 전진`], ['dis', `${D('dis')} 분배센서`]], { x: P(G.px, 0).x, y: H0 + 0.5, z: P(0, 20).z });
    tag('금속감지 (유도형)', [['ind', D('ind')]], { x: P(G.xm, 0).x, y: H0 + 0.85, z: P(0, G.bt - 16).z });
    tag('워크감지 (용량형)', [['cap', D('cap')]], { x: P(G.xe, 0).x, y: H0 + 0.85, z: P(0, G.bb + 16).z });
    tag('컨베이어', [['yConv', `${D('yConv')} 모터`]], { x: motor.position.x, y: H0 + 0.35, z: motor.position.z - 0.3 });
    tag('취출 실린더', [['yEjF', `${D('yEjF')} 전진`], ['yEjB', `${D('yEjB')} 후진`], ['ejB', `${D('ejB')} 후진`], ['ejF', `${D('ejF')} 전진`]], { x: P(G.xe, 0).x, y: H0 + 0.45, z: P(0, 100).z });
    tag('스토퍼', [['yStp', `${D('yStp')} 하강`], ['stpU', `${D('stpU')} 상승`], ['stpD', `${D('stpD')} 하강`], ['stpS', `${D('stpS')} 검출`]], { x: sp.x + 0.15, y: H0 + 0.35, z: sp.z - 0.1 });
    tag('흡착', [['ySucF', `${D('ySucF')} 전진`], ['ySucB', `${D('ySucB')} 후진`], ['yVac', `${D('yVac')} 흡착컵`], ['sucB', `${D('sucB')} 후진`], ['sucF', `${D('sucF')} 전진`], ['vac', `${D('vac')} 흡착센서`]], { x: sc.x - 0.1, y: SUC_Y + 0.45, z: sc.z + 0.3 });
    tag('저장 실린더', [['yStoF', `${D('yStoF')} 전진`], ['yStoB', `${D('yStoB')} 후진`], ['stoB', `${D('stoB')} 후진`], ['stoF', `${D('stoF')} 전진`]], { x: P(649, 0).x, y: H0 + 0.45, z: P(0, G.trayY).z });
    tag('저장 창고', [], { x: (rkA.x + rkB.x) / 2, y: RACK_LV[2] + 0.45, z: (rkA.z + rkB.z) / 2 });
    tag('서보 축', [['limU', `${D('limU')} 상한`], ['limL', `${D('limL')} 하한`], ['org', `${D('org')} 원점`]], { x: sv.x, y: 3.6, z: sv.z });
    tag('스위치', [['pbStart', `${D('pbStart')} START`], ['pbStop', `${D('pbStop')} STOP`], ['pbReset', `${D('pbReset')} RESET`], ['pbEmg', `${D('pbEmg')} 비상`]], { x: -4.2, y: 0.6, z: ZB });
    tag('램프', [['lR', `${D('lR')} 적색`], ['lY', `${D('lY')} 황색`], ['lG', `${D('lG')} 녹색`], ['lB', `${D('lB')} 청색`]], { x: 0.55, y: 0.6, z: ZB });
    tag('PLC', [], { x: -3.0, y: 1.35, z: 3.78 });
    tag('전자밸브', [], { x: (MVX(0) + MVX(VALVES.length - 1)) / 2, y: 0.7, z: MVZ });
    tag('취출함', [], { x: (ejBinBox.a.x + ejBinBox.b.x) / 2, y: 0.55, z: ejBinBox.b.z - 0.1 });
    tag('끝 상자', [], { x: (endBinBox.a.x + endBinBox.b.x) / 2, y: 0.55, z: endBinBox.b.z });
  }
  buildTags();
  let lastDevKey = JSON.stringify(PL.dev);

  // ── 시점
  const TARGET = new THREE.Vector3(0.2, 0.35, 0.55);
  const VIEWS = {
    front: [0.2, 7.4, 12.6], back: [0.2, 7.0, -11.6], left: [-12.6, 6.8, 0.55], right: [12.6, 6.8, 0.55], top: [0.2, 15.5, 0.62],
    fl: [-7.9, 9.4, 10.6], fr: [8.1, 9.4, 10.6], bl: [-8.4, 8.6, -9.6], br: [8.6, 8.6, -9.6],
  };
  let tween = null, curView = 'fl', placed = false, follow = null;
  // 세로로 긴 화면(휴대폰)에서는 조금 더 멀리서 봐야 설비 전체가 들어옴
  const fitK = () => { const a = camera.aspect || 1.6; return a < 1.5 ? Math.min(2.1, Math.pow(1.5 / a, 0.85)) : 1; };
  function goView(v, instant) {
    const p = VIEWS[v]; if (!p) return;
    curView = v; setFollow(false);
    const to = new THREE.Vector3(...p).sub(TARGET).multiplyScalar(fitK()).add(TARGET), tt = TARGET.clone();
    if (instant) { tween = null; camera.position.copy(to); controls.target.copy(tt); controls.update(); return; }
    tween = { t0: performance.now(), dur: 650, p0: camera.position.clone(), p1: to, c0: controls.target.clone(), c1: tt };
  }
  function focusOn(pt, dist) {   // 그 자리로 다가가서 보기 (보는 방향은 그대로)
    const dir = camera.position.clone().sub(controls.target).normalize();
    const d = Math.min(dist || 3.6, camera.position.distanceTo(controls.target));
    tween = { t0: performance.now(), dur: 600, p0: camera.position.clone(), p1: pt.clone().add(dir.multiplyScalar(d)), c0: controls.target.clone(), c1: pt.clone() };
  }
  // 자재 따라가기: 공정이 가장 많이 진행된 자재를 카메라가 따라감
  const STAGE = { rail: 1, slide: 2, belt: 3, eject: 4, cup: 5, tray: 6 };
  function leadPiece() {
    let best = null, bs = -1;
    for (const p of PL.pieces) { const sc = (STAGE[p.st] || 0) * 2000 + p.x; if (sc > bs) { bs = sc; best = p; } }
    return best;
  }
  function setFollow(on) {
    follow = on ? { id: null } : null;
    const b = uiRef && uiRef.querySelector('[data-act=follow]'); if (b) b.classList.toggle('active', !!on);
  }
  let uiRef = null;

  // ── 화면 위 조작 (시점 버튼 · 이름표 · 조작 버튼)
  const ui = document.createElement('div');
  ui.className = 'p3ui';
  ui.innerHTML = `
    <div class="p3views" role="group" aria-label="보는 방향">
      <button data-v="bl" title="왼쪽 뒤 대각선 (설비 쪽)">↖</button><button data-v="back" title="뒤에서 (컨베이어·실린더 쪽)">뒤</button><button data-v="br" title="오른쪽 뒤 대각선 (설비 쪽)">↗</button>
      <button data-v="left" title="왼쪽에서 (매거진 쪽)">왼쪽</button><button data-v="top" title="위에서">위</button><button data-v="right" title="오른쪽에서 (서보 쪽)">오른쪽</button>
      <button data-v="fl" title="왼쪽 앞 대각선 (PLC 쪽)">↙</button><button data-v="front" title="앞에서 (PLC·스위치 쪽)">앞</button><button data-v="fr" title="오른쪽 앞 대각선 (PLC 쪽)">↘</button>
    </div>
    <div class="p3opts" role="group" aria-label="3D 보기 설정"><span class="lbl">이름표</span><button data-tg="full">번호까지</button><button data-tg="name" class="active">이름만</button><button data-tg="off">끄기</button>
      <span class="sep"></span><button data-act="follow" title="움직이는 자재를 카메라가 따라가요"><span class="ln">자재 </span>따라가기</button><button data-act="photo" title="지금 보이는 3D 화면을 그림 파일(PNG)로 저장">사진<span class="ln"> 저장</span></button><button data-act="views" class="vt" title="보는 방향 버튼 열기">시점</button><button data-act="help" title="조작 방법 보기">?</button></div>
    <div class="p3help">드래그: 돌리기 · 휠/두 손가락: 확대 · 오른쪽 드래그(Shift+드래그): 옮기기 · 더블클릭이나 이름표 누르기: 가까이 보기 · 버튼은 3D에서 눌러도 돼요</div>
    <div class="p3pad">
      <button data-pb="pbStart" class="g">START</button><button data-pb="pbStop" class="r">STOP</button><button data-pb="pbReset" class="y">RESET</button><button data-pb="pbEmg" class="e">비상</button>
      <span class="lp" data-l="lR"></span><span class="lp" data-l="lY"></span><span class="lp" data-l="lG"></span><span class="lp" data-l="lB"></span>
    </div>`;
  host.appendChild(ui); uiRef = ui;
  goView('fl', true);
  ui.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => { goView(b.dataset.v); ui.classList.remove('vopen'); }));
  ui.querySelector('[data-act=views]').addEventListener('click', () => ui.classList.toggle('vopen'));
  ui.querySelector('[data-act=follow]').addEventListener('click', () => {
    if (follow) { setFollow(false); return; }
    setFollow(true);
    const p = leadPiece();
    if (p) { const q = P(p.x, p.y); focusOn(new THREE.Vector3(q.x, H0 + PH / 2, q.z), 4.2); }
  });
  ui.querySelector('[data-act=photo]').addEventListener('click', savePhoto);
  // 조작 도움말: 처음에만 보이고, 한 번 돌려 보면 숨김 (? 버튼으로 다시 보기)
  let helpSeen = false;
  try { helpSeen = localStorage.getItem('ladderlab:p3help') === '1'; } catch (e) { /* 기본값 */ }
  const setHelp = on => { ui.classList.toggle('nohelp', !on); ui.querySelector('[data-act=help]').classList.toggle('active', on); uiDirty = true; };
  setHelp(!helpSeen);
  ui.querySelector('[data-act=help]').addEventListener('click', () => setHelp(ui.classList.contains('nohelp')));
  renderer.domElement.addEventListener('pointerdown', () => {
    if (helpSeen) return;
    helpSeen = true; try { localStorage.setItem('ladderlab:p3help', '1'); } catch (e) { /* 저장 안 됨 */ }
    setTimeout(() => setHelp(false), 1200);
  });
  ui.querySelector('[data-act=views]').addEventListener('click', () => { uiDirty = true; });
  let tagMode = 'name';
  try { tagMode = localStorage.getItem('ladderlab:p3tags') || 'name'; } catch (e) { /* 기본값 */ }
  function setTags(m) {
    tagMode = m;
    labels.forEach(l => { l.w = 0; });
    try { localStorage.setItem('ladderlab:p3tags', m); } catch (e) { /* 저장 안 됨 */ }
    labelR.domElement.style.display = m === 'off' ? 'none' : '';
    labelR.domElement.classList.toggle('nameonly', m === 'name');
    ui.querySelectorAll('[data-tg]').forEach(b => b.classList.toggle('active', b.dataset.tg === m));
  }
  ui.querySelectorAll('[data-tg]').forEach(b => b.addEventListener('click', () => setTags(b.dataset.tg)));
  setTags(tagMode);
  ui.querySelectorAll('[data-pb]').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); api.press(b.dataset.pb, e.pointerId); });
    b.addEventListener('pointerup', () => api.release());
    b.addEventListener('pointercancel', () => api.release());
    b.addEventListener('pointerleave', () => api.release());
  });

  // ── 3D 버튼 누르기
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const btnMeshes = () => buttons.flatMap(b => b.g.children);
  function hitBtn(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const h = ray.intersectObjects(btnMeshes(), false)[0];
    return h ? h.object.userData.btn : null;
  }
  let pressing = false;
  renderer.domElement.addEventListener('pointerdown', ev => {
    const k = hitBtn(ev);
    if (!k) return;
    pressing = true; controls.enabled = false;
    api.press(k, ev.pointerId);
  });
  const up = () => { if (pressing) { pressing = false; controls.enabled = true; api.release(); } };
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointercancel', up);
  renderer.domElement.addEventListener('pointermove', ev => { if (!pressing) renderer.domElement.style.cursor = hitBtn(ev) ? 'pointer' : 'grab'; });

  renderer.domElement.addEventListener('dblclick', ev => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const h = ray.intersectObjects(scene.children, true).find(o => o.object.visible && o.point.y > -0.5);
    if (h) { setFollow(false); focusOn(h.point, 3.0); }
  });

  // ── 사진 저장 (3D 화면 + 이름표)
  function savePhoto() {
    update(); renderer.render(scene, camera);
    const src = renderer.domElement, pr = src.width / host.clientWidth;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    if (tagMode !== 'off') {
      const hr = host.getBoundingClientRect();
      g.font = `700 ${Math.round(11 * pr)}px "IBM Plex Sans KR","Malgun Gothic",sans-serif`; g.textBaseline = 'middle';
      for (const l of labels) {
        if (l.dim || l.el.style.display === 'none') continue;
        const b = l.box.getBoundingClientRect(); if (!b.width) continue;
        const t = l.box.querySelector('b').textContent, w = g.measureText(t).width + 12 * pr, h = 18 * pr;
        const x = (b.left - hr.left + b.width / 2) * pr - w / 2, y = (b.top - hr.top) * pr;
        g.fillStyle = 'rgba(255,255,255,.92)'; g.strokeStyle = '#c5ced9'; g.lineWidth = pr;
        g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
        g.fillStyle = '#1d2733'; g.fillText(t, x + 6 * pr, y + h / 2 + pr * 0.5);
      }
    }
    g.font = `600 ${Math.round(11 * pr)}px "IBM Plex Sans KR",sans-serif`; g.fillStyle = 'rgba(29,39,51,.7)'; g.textBaseline = 'alphabetic';
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    g.fillText(`CT-4200M 가상 설비 · 래더랩 · ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`, 10 * pr, c.height - 10 * pr);
    const name = `CT4200M_3D_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
    c.toBlob(blob => {
      const a = document.createElement('a');
      a.download = name; a.href = URL.createObjectURL(blob);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
    return name;
  }

  // ── 크기
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); labelR.setSize(w, h);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
    ui.classList.toggle('narrow', w < 600); uiDirty = true;
    if (!placed) { placed = true; goView(curView, true); }
  }
  new ResizeObserver(resize).observe(host);

  // ── 매 프레임: 2D 모델 상태를 3D로
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function update() {
    const C = PL.cyl, Sx = PL.sens || {}, Y = k => api.plantY(k), X = k => !!(PL.ops[k] && api.XIN[PL.ops[k].n]);
    sup.set(G.supTip0 + G.supStroke * C.sup);
    dis.set(G.disTip0 + G.disStroke * C.dis);
    ej.set(G.ejTip0 + G.ejStroke * C.ej);
    sto.set(G.stoTip0 + G.stoStroke * C.sto);
    drill.position.set(dp.x, DRILL_UP - DRILL_TRAVEL * C.drl, dp.z);
    const mot = Y('yMot');
    if (mot) spin.rotation.y += 0.5;
    spinMark.material.emissiveIntensity = mot ? 0.8 : 0;
    stopper.position.y = H0 + 0.1 - 0.32 * C.stp;
    const cupZ = P(0, G.cy + (G.trayY - G.cy) * C.suc).z;
    sucRod.position.set(sc.x, SUC_Y, sc.z + suc.len); sucRod.scale.set(1, 1, Math.max(0.001, cupZ - sc.z - suc.len));
    const held = PL.pieces.find(p => p.st === 'cup');
    const lift = held ? (C.suc > 0.04 && C.suc < 0.96 ? 0.16 : 0.03) : 0;
    cupG.position.set(sc.x, SUC_Y + lift, cupZ);
    const vacOn = Y('yVac');
    vacGlow.material.opacity = vacOn ? 0.9 : 0;
    beltTex.offset.x = -((PL.belt / 40) % 1);
    if (Y('yConv')) motorRot.rotation.z -= 0.3;
    motorStripe.material.emissiveIntensity = Y('yConv') ? 1 : 0;
    for (const l of leds) l.mesh.material.emissiveIntensity = Sx[l.k] ? 2.2 : 0;
    for (const s of solLeds) s.mesh.material.emissiveIntensity = Y(s.k) ? 1.8 : 0;
    for (const f of [fiberMag, fiberDis, fiberStp]) { const on = !!Sx[f.k]; f.beam.material.opacity = on ? 0.95 : 0.15; }
    for (const p of prox) { const on = !!Sx[p.k]; p.cap.material.emissiveIntensity = on ? 1.6 : 0; p.zone.material.opacity = on ? 0.85 : 0.25; }
    for (const l of lamps) { const on = Y(l.k); l.mat.emissiveIntensity = on ? 1.4 : 0; l.glow.material.opacity = on ? 0.28 : 0; }
    let ledDirty = false;
    boardLeds.forEach((l, i) => { const on = l.kind === 'in' ? !!api.XIN[l.n] : api.outY(l.n); if (on !== l.on) { l.on = on; ledIM.setColorAt(i, LED_C[l.kind][on ? 1 : 0]); ledDirty = true; } });
    if (ledDirty) ledIM.instanceColor.needsUpdate = true;
    const simOn = api.simOn();
    cpuLed.material.emissiveIntensity = simOn ? 1.6 : 0;
    const blink = (performance.now() % 1000) < 600;
    const hl = api.hl();
    for (const b of buttons) {
      const on = b.k === 'pbEmg' ? PL.emg : X(b.k);
      b.cap.position.y = b.y0 - (on ? (b.mush ? 0.05 : 0.03) : 0);
      b.cap.material.emissiveIntensity = on ? 0.35 : 0;
      b.ring.material.opacity = hl.includes(PL.dev[b.k]) ? (blink ? 0.95 : 0.25) : 0;
    }
    // 자재
    const seen = new Set();
    for (const p of PL.pieces) {
      let m = pool.get(p.id);
      if (!m) { m = makePiece(); pool.set(p.id, m); }
      seen.add(p.id); setPiece(m, p.kind, p.drilled);
      const q = P(p.x, p.y);
      let y = H0 + PH / 2;
      if (p.st === 'cup') y += lift;
      if (p.st === 'eject' && p.y > G.bb) y -= Math.min(0.25, (p.y - G.bb) * S * 2);
      m.position.set(q.x, y, q.z);
    }
    for (const [id, m] of pool) if (!seen.has(id)) { scene.remove(m); pool.delete(id); }
    extraN = 0;
    const slot = PL.pieces.some(p => p.st === 'rail' && p.x < G.mx + R);
    PL.stack.slice(0, 9).forEach((k, i) => { const m = takeExtra(); setPiece(m, k, false); m.position.set(mg.x, H0 + PH / 2 + PH * (i + (slot ? 1 : 0)) + 0.002 * i, mg.z); });
    const binFill = (list, box2, r) => {
      const w = box2.b.x - box2.a.x, d = box2.b.z - box2.a.z, cols = Math.max(1, Math.floor((w - 0.1) / (2 * PR + 0.02))), rows = Math.max(1, Math.floor((d - 0.1) / (2 * PR + 0.02)));
      list.slice(-cols * rows * 2).forEach((k, i) => {
        const layer = Math.floor(i / (cols * rows)), j = i % (cols * rows);
        const m = takeExtra(); setPiece(m, k, false);
        m.position.set(box2.a.x + 0.05 + PR + (j % cols) * (2 * PR + 0.02), 0.03 + PH / 2 + layer * PH, box2.a.z + 0.05 + PR + Math.floor(j / cols) * (2 * PR + 0.02));
      });
    };
    binFill(PL.ejBin, ejBinBox); binFill(PL.endBin, endBinBox);
    PL.rack.forEach((r, i) => { const s = rackSlot(i); const m = takeExtra(); setPiece(m, r.kind, r.drilled); m.position.set(s.x, s.y, s.z); });
    for (let i = extraN; i < extra.length; i++) extra[i].visible = false;
    // 이름표 켜짐 표시
    const devKey = JSON.stringify(PL.dev);
    if (devKey !== lastDevKey) { lastDevKey = devKey; buildTags(); }
    if (labelR.domElement.style.display !== 'none') for (const l of labels) for (const c of l.chips) {
      const on = c.k.startsWith('y') || c.k.startsWith('l') ? Y(c.k) : (c.k === 'pbEmg' ? PL.emg : (c.k.startsWith('pb') ? X(c.k) : !!Sx[c.k]));
      const h = hl.includes(PL.dev[c.k]) && blink;
      if (c.on !== on) { c.el.classList.toggle('on', on); c.on = on; }
      if (c.hl !== h) { c.el.classList.toggle('hl', h); c.hl = h; }
    }
    ui.querySelectorAll('[data-l]').forEach(s => s.classList.toggle('on', Y(s.dataset.l)));
    ui.querySelectorAll('[data-pb]').forEach(b => b.classList.toggle('on', b.dataset.pb === 'pbEmg' ? PL.emg : X(b.dataset.pb)));
  }

  let running = false, raf = 0, qN = 0, qT = 0, qLast = 0, qLevel = 0;
  function lowerQuality() {
    qLevel++;
    if (qLevel === 1 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); resize(); }
    else {
      qLevel = 2; sun.castShadow = false; renderer.shadowMap.enabled = false;
      scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    }
    console.info('[3D] 화면이 느려서 화질을 낮췄어요 (단계 ' + qLevel + ')');
  }
  function frame() {
    raf = 0;
    if (!running) return;
    const now = performance.now();
    if (tween) {
      const t = Math.min(1, (now - tween.t0) / tween.dur), e = ease(t);
      camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.c0, tween.c1, e);
      if (t >= 1) tween = null;
    } else if (follow) {
      let p = follow.id != null && PL.pieces.find(o => o.id === follow.id);
      if (!p) { p = leadPiece(); follow.id = p ? p.id : null; }
      if (p) {
        const q = P(p.x, p.y), d = new THREE.Vector3(q.x, H0 + PH / 2, q.z).sub(controls.target).multiplyScalar(0.08);
        controls.target.add(d); camera.position.add(d);
      }
    }
    controls.update();
    update();
    renderer.render(scene, camera);
    if (labelR.domElement.style.display !== 'none') { labelR.render(scene, camera); declutter(); }
    // 느린 컴퓨터면 화질을 한 단계씩 낮춤 (해상도 → 그림자)
    if (qLast && now - qLast < 2000) { qT += now - qLast; qN++; }
    qLast = now;
    if (qN >= 90 || (qN >= 12 && qT > 3000)) { const avg = qT / qN; qN = qT = 0; if (avg > 34 && qLevel < 2 && !window.__p3HQ) lowerQuality(); }
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; resize(); if (!raf) raf = requestAnimationFrame(frame); }
  function stop() { running = false; qLast = 0; if (raf) cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (window.__plant3d.want) start(); });

  window.__plant3d = {
    ok: true, want: false,
    start() { this.want = true; start(); },
    stop() { this.want = false; stop(); },
    view: goView, focus: (x, y, z, d) => focusOn(new THREE.Vector3(x, y, z), d), follow: on => setFollow(on), savePhoto,
    get quality() { return qLevel; }, info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries }), labels: () => labels.map(l => ({ t: l.box.querySelector('b').textContent, dim: l.dim, dy: l.dy })),
    shot() { update(); renderer.render(scene, camera); labelR.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    camera, controls,
    btnXY(k) {   // 버튼의 화면 좌표 (테스트용)
      const b = buttons.find(o => o.k === k); if (!b) return null;
      const v = new THREE.Vector3(); b.cap.getWorldPosition(v); v.project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
  };
  window.dispatchEvent(new Event('plant3d-ready'));
}
