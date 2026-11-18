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
  controls.minDistance = 2.2; controls.maxDistance = 24;
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
      reed(o.from.x + 0.18, o.y + r + 0.02, o.from.z, o.back, 'x');
      reed(o.from.x + o.len - 0.18, o.y + r + 0.02, o.from.z, o.front, 'x');
    } else {
      cyl(r, o.len, M.alu, 'z', 0, 0, o.len / 2, body);
      box(0.26, 0.26, 0.08, M.aluD, 0, 0, 0.04, body); box(0.26, 0.26, 0.08, M.aluD, 0, 0, o.len - 0.04, body);
      cyl(0.03, 0.08, M.blueFit, 'y', 0, 0.16, 0.12, body); cyl(0.03, 0.08, M.blueFit, 'y', 0, 0.16, o.len - 0.12, body);
      box(0.2, 0.06, o.len - 0.1, M.aluD, 0, -o.y + 0.03, o.len / 2, body);
      box(0.16, o.y - 0.12, 0.1, M.aluD, 0, -o.y / 2 + 0.03, o.len / 2, body);
      body.position.set(o.from.x, o.y, o.from.z);
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

  // ── FRL (공압 조절기) · 밸브 매니폴드
  const fr = P(40, 40);
  box(0.22, 0.42, 0.2, M.gray, fr.x, 0.45, fr.z); cyl(0.09, 0.14, M.black, 'y', fr.x, 0.73, fr.z);
  cyl(0.07, 0.04, std({ color: 0xffffff }), 'z', fr.x, 0.5, fr.z + 0.12); cyl(0.04, 0.12, M.blueFit, 'x', fr.x + 0.16, 0.3, fr.z);
  box(0.06, 0.25, 0.06, M.alu, fr.x, 0.12, fr.z);
  const VALVES = [['ySupF', 'ySupB'], ['yDisF', 'yDisB'], ['yDrl'], ['yEjF', 'yEjB'], ['yStp'], ['ySucF', 'ySucB'], ['yVac'], ['yStoF', 'yStoB']];
  const mv0 = P(70, 318);
  box(VALVES.length * 0.28 + 0.12, 0.1, 0.36, M.alu, mv0.x + VALVES.length * 0.14, 0.05, mv0.z);
  const solLeds = [];
  VALVES.forEach((ks, i) => {
    const x = mv0.x + 0.2 + i * 0.28;
    box(0.2, 0.22, 0.32, M.black, x, 0.21, mv0.z);
    ks.forEach((k, j) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.05), std({ color: 0x1a3a22, emissive: 0x22ff66, emissiveIntensity: 0 }));
      l.position.set(x, 0.33, mv0.z + (ks.length === 1 ? 0 : (j ? 0.08 : -0.08))); scene.add(l);
      solLeds.push({ mesh: l, k });
    });
  });

  // ── 앞쪽: 스위치 보드 · 램프 보드 · 빨간 트레이너 박스 (CT-4200M)
  const ZB = 2.62;
  box(4.0, 0.04, 0.72, M.pcb, -2.95, 0.02, ZB); box(4.0, 0.04, 0.72, M.pcb, 2.0, 0.02, ZB);
  box(2.9, 0.03, 0.42, M.white, -2.95, 0.055, ZB); box(2.9, 0.03, 0.42, M.white, 2.0, 0.055, ZB);
  for (let i = 0; i < 12; i++) { cyl(0.025, 0.04, M.pcb, 'y', -4.3 + i * 0.24, 0.08, ZB + 0.27); cyl(0.025, 0.04, M.blueFit, 'y', 0.6 + i * 0.24, 0.08, ZB + 0.27); }
  const buttons = [];   // 누를 수 있는 버튼
  function pushBtn(k, color, x, mush) {
    const g = new THREE.Group();
    if (mush) { cyl(0.2, 0.04, M.yellow, 'y', 0, 0.02, 0, g); }
    cyl(mush ? 0.1 : 0.12, 0.08, M.black, 'y', 0, mush ? 0.07 : 0.04, 0, g);
    const capMat = std({ color, roughness: 0.35, emissive: color, emissiveIntensity: 0 });
    const cap = mush ? new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), capMat) : new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 24), capMat);
    cap.position.y = mush ? 0.11 : 0.115; cap.castShadow = true; g.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(mush ? 0.24 : 0.17, 0.02, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.09; g.add(ring);
    g.position.set(x, 0.07, ZB); scene.add(g);
    cap.userData.btn = k; g.children.forEach(m => { m.userData.btn = k; });
    buttons.push({ k, g, cap, ring, y0: cap.position.y, mush });
  }
  pushBtn('pbStart', 0x22b357, -4.2); pushBtn('pbStop', 0xe5483b, -3.55); pushBtn('pbReset', 0xf0c02c, -2.9); pushBtn('pbEmg', 0xd42020, -2.1, true);
  const lamps = [];
  [['lR', 0xef4444, 0.9], ['lY', 0xf2b705, 1.55], ['lG', 0x22c55e, 2.2], ['lB', 0x3b82f6, 2.85]].forEach(([k, col, x]) => {
    cyl(0.13, 0.08, M.black, 'y', x, 0.11, ZB);
    const mat = std({ color: col, emissive: col, emissiveIntensity: 0, transparent: true, opacity: 0.92, roughness: 0.25 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.position.set(x, 0.15, ZB); scene.add(dome);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false }));
    glow.position.set(x, 0.18, ZB); scene.add(glow);
    lamps.push({ k, mat, glow });
  });
  // 트레이너 박스
  const TZ0 = 3.2, TZ1 = 4.45;
  box(9.8, 0.5, TZ1 - TZ0, M.red, 0, 0.25, (TZ0 + TZ1) / 2);
  const panelTex = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#f5f6f8'; g.fillRect(0, 0, w, h);
    const X = v => (v + 4.75) / 9.5 * w;   // 3D x → 그림 x
    g.fillStyle = '#c62828'; g.font = '700 26px "Malgun Gothic", sans-serif'; g.fillText('CT-4200M', X(-2.2), 30);
    const tw = g.measureText('CT-4200M').width;
    g.fillStyle = '#1d2733'; g.font = '600 22px "Malgun Gothic", sans-serif'; g.fillText('생산자동화 PLC 실습장치', X(-2.2) + tw + 16, 30);
    g.fillStyle = '#4c5a6b'; g.font = '600 16px "Malgun Gothic", sans-serif'; g.textAlign = 'center';
    g.fillText('SERVO', X(-4.35), 62); g.fillText('INTERFACE', X(-3.3), 62); g.fillText('OUTPUT  Y20~Y3F', X(-1.75), 62); g.fillText('INPUT  X00~X1F', X(0.45), 62); g.fillText('PLC  Q03UDV', X(2.85), 62);
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.02, TZ1 - TZ0 - 0.2), [M.white, M.white, std({ map: panelTex, roughness: 0.6 }), M.white, M.white, M.white]);
  top.position.set(0, 0.51, (TZ0 + TZ1) / 2); top.receiveShadow = true; scene.add(top);
  // 서보 앰프 · 인터페이스 커넥터
  box(0.45, 0.85, 0.62, M.black, -4.35, 0.94, 3.98); box(0.3, 0.3, 0.05, M.black2, -4.35, 1.15, 3.65);
  box(0.6, 0.12, 0.22, M.black, -3.3, 0.58, 3.98); box(0.6, 0.12, 0.22, M.black, -3.3, 0.58, 4.25);
  // 출력(파랑)·입력(초록) 단자
  const jackG = std({ color: 0x35b85a });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    cyl(0.034, 0.04, M.blueFit, 'y', -2.45 + c * 0.2, 0.54, 3.98 + r * 0.11, null, 10);
    cyl(0.034, 0.04, jackG, 'y', -0.25 + c * 0.2, 0.54, 3.98 + r * 0.11, null, 10);
  }
  // PLC (Q03UDV 베이스 + 전원 + CPU + I/O 모듈)
  box(2.5, 0.06, 0.6, M.black2, 2.85, 0.55, 4.02);
  const modTex = (t) => canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#1f2329'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8edf2'; g.font = '700 13px sans-serif'; g.fillText(t, 6, 22); g.fillStyle = '#22c55e'; g.fillRect(8, 34, 10, 6); g.fillRect(24, 34, 10, 6); });
  [['POWER', 0xb33030], ['Q03UDV', 0x1f2329], ['QX42', 0x1f2329], ['QY42P', 0x1f2329], ['QX41', 0x1f2329]].forEach(([t, col], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.62), [std({ color: col }), std({ color: col }), std({ color: col }), std({ color: col }), std({ map: modTex(t) }), std({ color: col })]);
    m.position.set(1.85 + i * 0.47, 0.93, 4.02); m.castShadow = true; scene.add(m);
  });
  box(0.16, 0.1, 0.1, M.red, 4.5, 0.57, 3.5);   // 전원 스위치

  // ── 이름표 (CSS2D)
  const labels = [];
  function tag(title, devs, pos) {
    const el = document.createElement('div');
    el.className = 'p3tag';
    el.innerHTML = `<b>${title}</b>` + devs.map(([k, txt]) => `<span class="c ${k.startsWith('y') || k.startsWith('l') ? 'out' : 'in'}" data-k="${k}"><i></i>${txt}</span>`).join('');
    const o = new CSS2DObject(el); o.position.set(pos.x, pos.y, pos.z); scene.add(o);
    labels.push({ el, chips: [...el.querySelectorAll('.c')].map(c => ({ el: c, k: c.dataset.k, on: null, hl: null })) });
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
    tag('스위치', [['pbStart', `${D('pbStart')} START`], ['pbStop', `${D('pbStop')} STOP`], ['pbReset', `${D('pbReset')} RESET`], ['pbEmg', `${D('pbEmg')} 비상`]], { x: -3.15, y: 0.55, z: ZB });
    tag('램프', [['lR', `${D('lR')} 적색`], ['lY', `${D('lY')} 황색`], ['lG', `${D('lG')} 녹색`], ['lB', `${D('lB')} 청색`]], { x: 1.85, y: 0.55, z: ZB });
    tag('취출함', [], { x: (ejBinBox.a.x + ejBinBox.b.x) / 2, y: 0.55, z: ejBinBox.b.z - 0.1 });
    tag('끝 상자', [], { x: (endBinBox.a.x + endBinBox.b.x) / 2, y: 0.55, z: endBinBox.b.z });
  }
  buildTags();
  let lastDevKey = JSON.stringify(PL.dev);

  // ── 시점
  const TARGET = new THREE.Vector3(0.2, 0.35, 0.55);
  const VIEWS = {
    front: [0.2, 6.2, 12.8], back: [0.2, 6.2, -11.6], left: [-12.6, 6.2, 0.55], right: [12.6, 6.2, 0.55], top: [0.2, 15.5, 0.62],
    fl: [-8.6, 8.4, 11.2], fr: [8.8, 8.4, 11.2], bl: [-8.6, 8.4, -9.8], br: [8.8, 8.4, -9.8],
  };
  let tween = null;
  function goView(v, instant) {
    const p = VIEWS[v]; if (!p) return;
    const to = new THREE.Vector3(...p), tt = TARGET.clone();
    if (instant) { camera.position.copy(to); controls.target.copy(tt); controls.update(); return; }
    tween = { t0: performance.now(), dur: 650, p0: camera.position.clone(), p1: to, c0: controls.target.clone(), c1: tt };
  }
  goView('fl', true);

  // ── 화면 위 조작 (시점 버튼 · 이름표 · 조작 버튼)
  const ui = document.createElement('div');
  ui.className = 'p3ui';
  ui.innerHTML = `
    <div class="p3views" role="group" aria-label="보는 방향">
      <button data-v="bl" title="왼쪽 뒤 대각선">↖</button><button data-v="back" title="뒤에서">뒤</button><button data-v="br" title="오른쪽 뒤 대각선">↗</button>
      <button data-v="left" title="왼쪽에서">왼쪽</button><button data-v="top" title="위에서">위</button><button data-v="right" title="오른쪽에서">오른쪽</button>
      <button data-v="fl" title="왼쪽 앞 대각선">↙</button><button data-v="front" title="앞에서">앞</button><button data-v="fr" title="오른쪽 앞 대각선">↘</button>
    </div>
    <div class="p3opts" role="group" aria-label="이름표">이름표 <button data-tg="full">번호까지</button><button data-tg="name" class="active">이름만</button><button data-tg="off">끄기</button></div>
    <div class="p3help">드래그: 돌리기 · 휠/두 손가락: 확대 · 오른쪽 드래그(Shift+드래그): 옮기기 · 버튼은 3D에서 눌러도 돼요</div>
    <div class="p3pad">
      <button data-pb="pbStart" class="g">START</button><button data-pb="pbStop" class="r">STOP</button><button data-pb="pbReset" class="y">RESET</button><button data-pb="pbEmg" class="e">비상</button>
      <span class="lp" data-l="lR"></span><span class="lp" data-l="lY"></span><span class="lp" data-l="lG"></span><span class="lp" data-l="lB"></span>
    </div>`;
  host.appendChild(ui);
  ui.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => goView(b.dataset.v)));
  let tagMode = 'name';
  try { tagMode = localStorage.getItem('q03udv-ladder:p3tags') || 'name'; } catch (e) { /* 기본값 */ }
  function setTags(m) {
    tagMode = m;
    try { localStorage.setItem('q03udv-ladder:p3tags', m); } catch (e) { /* 저장 안 됨 */ }
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

  // ── 크기
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); labelR.setSize(w, h);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
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

  let running = false, raf = 0;
  function frame() {
    raf = 0;
    if (!running) return;
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.t0) / tween.dur), e = ease(t);
      camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.c0, tween.c1, e);
      if (t >= 1) tween = null;
    }
    controls.update();
    update();
    renderer.render(scene, camera);
    if (labelR.domElement.style.display !== 'none') labelR.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; resize(); if (!raf) raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (window.__plant3d.want) start(); });

  window.__plant3d = {
    ok: true, want: false,
    start() { this.want = true; start(); },
    stop() { this.want = false; stop(); },
    view: goView,
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
