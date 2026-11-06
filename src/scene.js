import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* Drink presets — a: liquid base, b: milk / crema, art: latte heart, skin: chai malai film */
export const DRINKS = {
  masala: { a: '#8b5a33', b: '#e6c7a0', art: 0, skin: 1 },
  cutting: { a: '#6a3d20', b: '#c99a6c', art: 0, skin: 0.75 },
  kesar: { a: '#b06a26', b: '#f4d08e', art: 0, skin: 0.8 },
  latte: { a: '#7a4a28', b: '#f4e6d0', art: 1, skin: 0 },
  mocha: { a: '#3b1c0e', b: '#a0603a', art: 0.35, skin: 0 },
  coldbrew: { a: '#150904', b: '#6e4126', art: 0, skin: 0 },
  espresso: { a: '#2a1509', b: '#b9763f', art: 0, skin: 0 },
  matcha: { a: '#56742a', b: '#eef3d6', art: 1, skin: 0 },
};

const NOISE = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
`;
const VERT_UV = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutBack = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const v2 = (pts, dy = 0) => pts.map(([x, y]) => new THREE.Vector2(x, y + dy));

export function createScene(canvas) {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile || window.devicePixelRatio < 2,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color('#f4ece1');
  scene.fog = new THREE.Fog(fogColor, 11, 18); // far beans melt into the background → text stays readable
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  const rim = new THREE.DirectionalLight(0xffb37a, 2.4);
  rim.position.set(5, 2.5, -4);
  scene.add(rim, new THREE.HemisphereLight(0xfff4e6, 0x3a2416, 0.35));

  /* ---------- Rig ---------- */
  const rig = new THREE.Group(); // position + scale
  const tilt = new THREE.Group(); // x rotation
  const spin = new THREE.Group(); // y rotation
  const body = new THREE.Group(); // centred model
  rig.add(tilt);
  tilt.add(spin);
  spin.add(body);
  body.position.y = -0.76;
  scene.add(rig);

  // Key light lives in the rig so its shadow camera follows the cup everywhere
  const key = new THREE.DirectionalLight(0xfff0dc, 2.3);
  key.position.set(-2.2, 4.5, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(isMobile ? 512 : 1024, isMobile ? 512 : 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 6;
  rig.add(key, key.target);

  const ceramic = new THREE.MeshPhysicalMaterial({
    color: 0xf7f2ea,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    ior: 1.5,
    sheen: 0.25,
    sheenColor: new THREE.Color('#ffe8cf'),
    side: THREE.DoubleSide,
  });
  const glaze = new THREE.MeshPhysicalMaterial({
    color: 0xb4602f,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    side: THREE.DoubleSide,
  });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a44c, metalness: 1, roughness: 0.22 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xe4e4e4, metalness: 1, roughness: 0.16, side: THREE.DoubleSide });
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  // Cup: outer wall with recessed foot ring + rounded lip + inner wall, one lathe
  const CUP_Y = 0.07;
  const innerPts = [[0, 0.12], [0.3, 0.13], [0.54, 0.2], [0.66, 0.5], [0.76, 0.95], [0.8, 1.3], [0.82, 1.4]];
  const cupProfile = v2([
    [0, 0.025], [0.4, 0.025], [0.43, 0.004], [0.47, 0], [0.51, 0], [0.535, 0.015], [0.55, 0.05], [0.57, 0.1],
    [0.62, 0.25], [0.68, 0.45], [0.74, 0.7], [0.79, 0.95], [0.83, 1.18], [0.86, 1.34], [0.87, 1.4],
    [0.867, 1.424], [0.856, 1.437], [0.84, 1.438], [0.828, 1.427],
    ...innerPts.slice().reverse(),
  ], CUP_Y);
  body.add(shadowy(new THREE.Mesh(new THREE.LatheGeometry(cupProfile, 128), ceramic)));

  // Terracotta glaze band at the base + thin gold lip
  body.add(new THREE.Mesh(
    new THREE.LatheGeometry(v2([[0.539, 0.02], [0.556, 0.05], [0.576, 0.1], [0.626, 0.25], [0.661, 0.37]], CUP_Y), 128),
    glaze,
  ));
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.848, 0.0075, 10, 160), gold);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 1.4385 + CUP_Y;
  body.add(lip);

  // Ear-shaped handle (tube along a spline, flattened)
  const handleCurve = new THREE.CatmullRomCurve3([
    [0.79, 1.2], [1.0, 1.27], [1.19, 1.14], [1.23, 0.88], [1.1, 0.66], [0.9, 0.58], [0.71, 0.56],
  ].map(([x, y]) => new THREE.Vector3(x, y + CUP_Y, 0)));
  const handle = shadowy(new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 80, 0.068, 18), ceramic));
  handle.scale.z = 0.72;
  body.add(handle);

  // Saucer with foot ring and raised rim
  body.add(shadowy(new THREE.Mesh(new THREE.LatheGeometry(v2([
    [0, 0.012], [0.62, 0.012], [0.66, 0], [0.72, 0], [0.76, 0.02], [0.95, 0.045], [1.3, 0.13], [1.46, 0.2],
    [1.485, 0.226], [1.47, 0.24], [1.445, 0.234], [1.28, 0.172], [0.92, 0.1], [0.72, 0.086], [0.6, 0.072], [0, 0.07],
  ]), 128), ceramic)));
  const saucerRim = new THREE.Mesh(new THREE.TorusGeometry(1.468, 0.009, 8, 180), gold);
  saucerRim.rotation.x = Math.PI / 2;
  saucerRim.position.y = 0.238;
  body.add(saucerRim);

  // Steel teaspoon resting on the saucer
  const spoon = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), steel);
  bowl.scale.set(0.72, 0.3, 1);
  const spoonHandle = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0.13), new THREE.Vector3(0, 0.025, 0.4), new THREE.Vector3(0, 0.06, 0.72), new THREE.Vector3(0, 0.07, 0.86),
    ]), 40, 0.02, 10),
    steel,
  );
  spoonHandle.scale.x = 1.7;
  spoon.add(bowl, spoonHandle);
  spoon.traverse((o) => (o.castShadow = true));
  spoon.position.set(-0.55, 0.17, 0.95);
  spoon.rotation.set(-0.1, -1.95, 0.06);
  body.add(spoon);

  // Soft contact shadow under saucer
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d');
  const grad = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(30,15,5,0.5)');
  grad.addColorStop(0.55, 'rgba(30,15,5,0.16)');
  grad.addColorStop(1, 'rgba(30,15,5,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 4.2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, fog: false }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -0.012;
  body.add(contact);

  /* ---------- Liquid ---------- */
  const innerR = (y) => {
    const yy = y - CUP_Y;
    for (let i = 1; i < innerPts.length; i++) {
      const [x0, y0] = innerPts[i - 1], [x1, y1] = innerPts[i];
      if (yy <= y1) return lerp(x0, x1, clamp01((yy - y0) / (y1 - y0)));
    }
    return innerPts[innerPts.length - 1][0];
  };
  const FULL = 1.25, EMPTY = 0.24;
  const start = DRINKS.masala;
  const liquidUniforms = {
    uA: { value: new THREE.Color(start.a) },
    uB: { value: new THREE.Color(start.b) },
    uArt: { value: start.art },
    uSkin: { value: start.skin },
    uTime: { value: 0 },
    uRipple: { value: 5 },
    uSpin: { value: 0 },
  };
  const liquid = new THREE.Mesh(
    new THREE.CircleGeometry(1, 128),
    new THREE.ShaderMaterial({
      uniforms: liquidUniforms,
      vertexShader: VERT_UV,
      fragmentShader: /* glsl */ `
        uniform vec3 uA; uniform vec3 uB; uniform float uArt; uniform float uSkin; uniform float uTime; uniform float uRipple; uniform float uSpin;
        varying vec2 vUv;
        ${NOISE}
        float dot2(vec2 v){ return dot(v, v); }
        float sdHeart(vec2 p){
          p.x = abs(p.x);
          if (p.y + p.x > 1.0) return sqrt(dot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
          return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
        }
        void main(){
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          float a = atan(p.y, p.x);
          float ring = exp(-pow((r - uRipple * 0.7) * 9.0, 2.0)) * exp(-uRipple * 1.4);
          vec2 pw = p * (1.0 + ring * 0.04);
          float n = fbm(pw * 7.0 + vec2(uTime * 0.04, -uTime * 0.03));
          float swirl = sin(a * 3.0 + r * 10.0 + n * 4.0 - uTime * 0.25) * 0.5 + 0.5;
          float crema = 1.0 - smoothstep(0.1, 1.0, r);
          vec3 col = mix(uA, uB, clamp(crema * 0.5 + swirl * 0.12 + n * 0.22, 0.0, 1.0));
          // chai malai skin
          float sk = fbm(pw * 16.0 + n * 2.5 + uTime * 0.015);
          col = mix(col, mix(uB, uA, 0.25), smoothstep(0.42, 0.72, sk) * uSkin * 0.5);
          col *= 1.0 - smoothstep(0.55, 0.62, fbm(pw * 30.0)) * uSkin * 0.08;
          // latte heart
          vec2 hp = vec2(p.x, -p.y) * 4.4 + vec2(0.0, 0.62);
          hp.x += sin(hp.y * 6.0 + uTime * 0.2) * 0.015;
          float h = sdHeart(hp);
          col = mix(col, uB, (1.0 - smoothstep(0.0, 0.25, h)) * uArt * 0.25);
          col = mix(col, uB * 1.03, (1.0 - smoothstep(-0.015, 0.02, h)) * uArt);
          // micro bubbles at the edge
          vec2 bp = p * 60.0; vec2 bi = floor(bp); vec2 bf = fract(bp) - 0.5;
          float bub = step(0.8, hash(bi)) * smoothstep(0.34, 0.2, length(bf)) * smoothstep(0.62, 0.9, r) * (1.0 - smoothstep(0.95, 0.99, r));
          col = mix(col, uB * 1.1, bub * 0.55);
          col += ring * 0.1;
          // occlusion against the wall + meniscus
          col *= mix(1.0, 0.6, smoothstep(0.72, 0.98, r));
          col += smoothstep(0.955, 0.99, r) * (1.0 - smoothstep(0.99, 1.0, r)) * 0.22;
          // view-locked window reflection
          float c = cos(uSpin), s = sin(uSpin);
          vec2 q = mat2(c, -s, s, c) * p;
          float win = (1.0 - smoothstep(0.0, 0.03, abs(q.x + 0.15) - 0.07)) * (1.0 - smoothstep(0.0, 0.03, abs(q.y - 0.17) - 0.045));
          win *= 0.7 + 0.3 * step(0.008, abs(q.x + 0.15));
          col += win * 0.2;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  liquid.rotation.x = -Math.PI / 2;
  body.add(liquid);
  let level = EMPTY;
  const setLevel = (y) => {
    level = y;
    liquid.position.y = y;
    liquid.scale.setScalar(innerR(y) + 0.006);
  };
  setLevel(EMPTY);

  // Pour stream (intro)
  const streamMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(start.b).lerp(new THREE.Color(start.a), 0.45), roughness: 0.08, clearcoat: 1 });
  const streamGeo = new THREE.CylinderGeometry(0.055, 0.045, 1, 20, 1, true);
  streamGeo.translate(0, 0.5, 0);
  const stream = new THREE.Mesh(streamGeo, streamMat);
  stream.visible = false;
  body.add(stream);

  // Steam
  const steamColor = new THREE.Color('#cdb9a4');
  const steamGeo = new THREE.PlaneGeometry(0.9, 2.2);
  steamGeo.translate(0, 1.1, 0);
  const steams = [-0.25, 0.05, 0.3].map((x, i) => {
    const m = new THREE.Mesh(
      steamGeo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uSeed: { value: i * 7.3 }, uColor: { value: steamColor } },
        vertexShader: VERT_UV,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uOpacity; uniform float uSeed; uniform vec3 uColor;
          varying vec2 vUv;
          ${NOISE}
          void main(){
            vec2 uv = vUv;
            float wob = sin(uv.y * 5.0 - uTime * 1.1 + uSeed) * 0.13 * uv.y;
            float x = uv.x - 0.5 + wob;
            float n = fbm(vec2(x * 3.0 + uSeed, uv.y * 2.4 - uTime * 0.38));
            float shape = smoothstep(0.34, 0.0, abs(x));
            float fade = smoothstep(0.0, 0.22, uv.y) * smoothstep(1.0, 0.4, uv.y);
            float alpha = smoothstep(0.38, 0.78, n) * shape * fade * uOpacity;
            gl_FragColor = vec4(uColor, alpha * 0.42);
            #include <colorspace_fragment>
          }
        `,
      }),
    );
    m.position.set(x, 0.62, -0.1 + i * 0.05);
    m.renderOrder = 2;
    rig.add(m);
    return m;
  });

  /* ---------- Chai ingredients (orbit / explode on scroll) ---------- */
  const ingredients = new THREE.Group();
  rig.add(ingredients);

  const beanGeo = (() => {
    const g = new THREE.SphereGeometry(0.12, 20, 14);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / 0.12, y = pos.getY(i) / 0.12;
      let z = pos.getZ(i) / 0.12;
      if (z > 0) z -= 0.32 * Math.exp(-(x * x) / 0.012) * (1 - y * y * 0.6);
      pos.setXYZ(i, x * 0.12 * 0.72, y * 0.12, z * 0.12 * 0.55);
    }
    g.computeVertexNormals();
    return g;
  })();
  const cardamomGeo = (() => {
    const g = new THREE.SphereGeometry(0.1, 24, 16);
    const pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const k = 1 + 0.07 * Math.cos(Math.atan2(v.z, v.x) * 3);
      v.x *= 0.58 * k; v.z *= 0.58 * k;
      v.y *= 1 + 0.15 * Math.max(0, v.y / 0.1) ** 4;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  })();
  const cinnamonGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.055, 0.055, 0.72, 24, 1, true, 0, Math.PI * 1.8),
    new THREE.CylinderGeometry(0.038, 0.038, 0.72, 20, 1, true, Math.PI, Math.PI * 1.6),
  ]);
  const starGeo = (() => {
    const parts = [];
    for (let i = 0; i < 8; i++) {
      const c = new THREE.ConeGeometry(0.045, 0.2, 8);
      c.scale(1, 1, 0.55);
      c.rotateZ(-Math.PI / 2);
      c.translate(0.1, 0, 0);
      c.rotateY((i / 8) * Math.PI * 2);
      parts.push(c.toNonIndexed());
    }
    const core = new THREE.SphereGeometry(0.04, 12, 8);
    core.scale(1, 0.6, 1);
    parts.push(core.toNonIndexed());
    return mergeGeometries(parts);
  })();
  const gingerGeo = (() => {
    let g = new THREE.IcosahedronGeometry(0.16, 4);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g);
    const pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const d = 1 + 0.2 * Math.sin(v.x * 28) * Math.sin(v.y * 22 + 1) * Math.sin(v.z * 25 + 2) + 0.06 * Math.sin(v.x * 70 + v.z * 40);
      v.multiplyScalar(d);
      v.x *= 1.7; v.y *= 0.75;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  })();
  const leafGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.22);
    s.quadraticCurveTo(0.15, -0.02, 0, 0.24);
    s.quadraticCurveTo(-0.15, -0.02, 0, -0.22);
    const g = new THREE.ShapeGeometry(s, 16);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, -x * x * 3.2 + Math.sin(y * 6) * 0.02);
    }
    g.computeVertexNormals();
    return g;
  })();
  const cloveGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.012, 0.02, 0.2, 8).toNonIndexed(),
    new THREE.SphereGeometry(0.035, 10, 8).translate(0, 0.11, 0).toNonIndexed(),
  ]);

  const M = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const INGREDIENTS = [
    [cardamomGeo, M(0x9aa75a, 0.55), 5],
    [cinnamonGeo, M(0x8b4a24, 0.85, { side: THREE.DoubleSide }), 3],
    [starGeo, M(0x6b2e17, 0.7), 3],
    [gingerGeo, M(0xd2a66b, 0.8), 2],
    [leafGeo, M(0x4d6b2a, 0.5, { side: THREE.DoubleSide }), 5],
    [cloveGeo, M(0x3e2212, 0.7), 4],
    [beanGeo, new THREE.MeshPhysicalMaterial({ color: 0x4a2a17, roughness: 0.38, clearcoat: 0.6 }), 4],
  ];
  const ingItems = [];
  let idx = 0;
  INGREDIENTS.forEach(([geo, mat, count]) => {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      ingredients.add(mesh);
      ingItems.push({
        mesh,
        a: idx * 2.399,
        R: 1.55 + ((idx * 37) % 11) / 11,
        h: -0.7 + (((idx * 53) % 17) / 17) * 2.0,
        s: 0.9 + ((idx * 29) % 7) / 10,
        orbit: 0.6 + ((idx * 13) % 5) / 5,
        delay: ((idx * 7) % 10) / 30,
        rx: Math.random() * 6,
        ry: Math.random() * 6,
      });
      idx++;
    }
  });

  /* ---------- Background beans (fogged) ---------- */
  const beanCount = isMobile ? 10 : 18;
  const beans = new THREE.InstancedMesh(beanGeo, new THREE.MeshPhysicalMaterial({ color: 0x4a2a17, roughness: 0.38, clearcoat: 0.6 }), beanCount);
  scene.add(beans);
  const beanData = Array.from({ length: beanCount }, (_, i) => ({
    side: i % 2 ? 1 : -1,
    x: 0.62 + Math.random() * 0.45,
    y: Math.random(),
    z: -5.5 + Math.random() * 4.5,
    s: 0.9 + Math.random() * 0.9,
    speed: 0.4 + Math.random() * 0.9,
    rx: Math.random() * 6,
    ry: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.8,
  }));
  const dummy = new THREE.Object3D();

  /* ---------- State ---------- */
  let halfH = 1, halfW = 1, aspect = 1;
  const target = { x: 0.4, y: 0, s: 1, tilt: 0.5 };
  const current = { x: 0.4, y: 0, s: 1, tilt: 0.5 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const colA = new THREE.Color(start.a), colB = new THREE.Color(start.b);
  let artTarget = start.art, skinTarget = start.skin;
  let scrollY = 0, scrollVel = 0, spinAngle = 0;
  let explodeTarget = 0, explode = 0;
  let introStart = -1, introT = 0;
  const steamTarget = new THREE.Color('#cdb9a4');
  const fogTarget = new THREE.Color('#f4ece1');
  let lastShadowScale = 0;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    halfW = halfH * aspect;
  }
  resize();
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let running = true;

  function render() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 3.2);

    // Intro: drop in → pour → steam
    if (introStart >= 0) introT = t - introStart;
    const it = introStart >= 0 ? introT : 0;
    const drop = introStart >= 0 ? easeOutBack(clamp01(it / 1.0)) : 0;
    const fill = easeInOut(smooth(0.8, 2.7, it));
    setLevel(lerp(EMPTY, FULL, fill));
    const streamTop = 7;
    let streamBottom;
    if (it < 0.75) streamBottom = streamTop;
    else if (it < 1.0) streamBottom = lerp(streamTop, level, smooth(0.75, 1.0, it));
    else if (it < 2.7) streamBottom = level;
    else streamBottom = lerp(level, streamTop, smooth(2.7, 3.05, it));
    stream.visible = streamTop - streamBottom > 0.01;
    stream.position.y = streamBottom;
    stream.scale.set(1 + Math.sin(t * 40) * 0.06, Math.max(0.001, streamTop - streamBottom), 1 + Math.cos(t * 37) * 0.06);
    if (it > 0.9 && it < 2.8) liquidUniforms.uRipple.value = (it * 1.6) % 1.2;
    else liquidUniforms.uRipple.value += dt;
    const steamIn = smooth(2.4, 3.6, it);

    current.x = lerp(current.x, target.x, k);
    current.y = lerp(current.y, target.y, k);
    current.s = lerp(current.s, target.s, k);
    current.tilt = lerp(current.tilt, target.tilt, k);
    pointer.sx = lerp(pointer.sx, pointer.x, 1 - Math.exp(-dt * 4));
    pointer.sy = lerp(pointer.sy, pointer.y, 1 - Math.exp(-dt * 4));
    explode = lerp(explode, explodeTarget, 1 - Math.exp(-dt * 5));

    const unit = aspect < 0.85 ? halfW * 0.6 : Math.min(halfH * 0.52, halfW * 0.4);
    const S = current.s * unit * (0.4 + 0.6 * drop);
    rig.position.set(current.x * halfW, current.y * halfH + Math.sin(t * 1.2) * 0.05 + (1 - drop) * halfH * 1.6, 0);
    rig.scale.setScalar(Math.max(S, 0.0001));
    tilt.rotation.x = current.tilt + pointer.sy * 0.1;
    tilt.rotation.z = -pointer.sx * 0.07 + THREE.MathUtils.clamp(scrollVel * 0.0005, -0.25, 0.25);
    spinAngle += dt * (0.2 + explode * 0.25) + Math.min(Math.abs(scrollVel) * 0.0001, 0.05);
    spin.rotation.y = spinAngle + pointer.sx * 0.35 - 0.6 + (1 - drop) * 3;
    liquidUniforms.uSpin.value = spin.rotation.y;

    // Shadow camera sized to the cup
    if (Math.abs(S - lastShadowScale) / (S || 1) > 0.02) {
      const sc = key.shadow.camera;
      sc.left = -2.2 * S; sc.right = 2.2 * S; sc.top = 2.2 * S; sc.bottom = -2.2 * S;
      sc.near = 0.1; sc.far = 14 * S;
      sc.updateProjectionMatrix();
      lastShadowScale = S;
    }

    // Drink colour morph
    liquidUniforms.uA.value.lerp(colA, k);
    liquidUniforms.uB.value.lerp(colB, k);
    liquidUniforms.uArt.value = lerp(liquidUniforms.uArt.value, artTarget, k);
    liquidUniforms.uSkin.value = lerp(liquidUniforms.uSkin.value, skinTarget, k);
    liquidUniforms.uTime.value = t;
    streamMat.color.copy(liquidUniforms.uB.value).lerp(liquidUniforms.uA.value, 0.45);

    steamColor.lerp(steamTarget, k);
    fogColor.lerp(fogTarget, k);
    const steamFade = (1 - THREE.MathUtils.smoothstep(current.tilt, 0.55, 0.95)) * steamIn * (1 - explode * 0.6);
    steams.forEach((m, i) => {
      m.material.uniforms.uTime.value = t;
      m.material.uniforms.uOpacity.value = steamFade;
      m.position.y = 0.62 - current.tilt * 0.25;
      m.position.z = 0.2 + current.tilt * 0.6 + i * 0.05;
    });

    // Ingredients orbit
    const rScale = aspect < 0.85 ? 0.72 : 1;
    for (const ing of ingItems) {
      const e = easeInOut(clamp01((explode - ing.delay) / (1 - ing.delay)));
      ing.mesh.visible = e > 0.002;
      if (!ing.mesh.visible) continue;
      const ang = ing.a + t * 0.22 * ing.orbit + (1 - e) * 2.4;
      const R = ing.R * e * rScale;
      ing.mesh.position.set(Math.cos(ang) * R, ing.h * e + Math.sin(t * ing.orbit + ing.a) * 0.08, Math.sin(ang) * R * 0.75);
      ing.mesh.rotation.set(ing.rx + t * 0.4 * ing.orbit, ing.ry + t * 0.3, t * 0.2);
      ing.mesh.scale.setScalar(ing.s * e);
    }

    // Background beans
    const range = halfH * 2.6 + 2;
    const scrollWorld = (scrollY / window.innerHeight) * halfH * 2;
    const appear = smooth(0.2, 1.4, it);
    for (let i = 0; i < beanCount; i++) {
      const b = beanData[i];
      const depthFactor = (b.z + 6) / 6;
      let y = b.y * range + t * 0.12 * b.speed + scrollWorld * (0.2 + depthFactor * 0.45);
      y = ((y % range) + range) % range - range / 2;
      const xEdge = aspect < 0.85 ? 0.8 + (b.x - 0.62) * 0.4 : b.x;
      dummy.position.set(b.side * xEdge * halfW * (1 + -b.z * 0.09) + pointer.sx * depthFactor * 0.25, y, b.z);
      dummy.rotation.set(b.rx + t * b.vr, b.ry + t * b.vr * 0.7, t * 0.1 * b.speed);
      dummy.scale.setScalar(b.s * (aspect < 0.85 ? 0.75 : 1) * appear);
      dummy.updateMatrix();
      beans.setMatrixAt(i, dummy.matrix);
    }
    beans.instanceMatrix.needsUpdate = true;

    scrollVel *= 0.9;
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  renderer.compile(scene, camera);
  requestAnimationFrame(render);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) running = false;
    else if (!running) { running = true; clock.getDelta(); requestAnimationFrame(render); }
  });

  return {
    playIntro() { introStart = clock.elapsedTime; },
    setTarget(t) { Object.assign(target, t); },
    setDrink(name) {
      const d = DRINKS[name];
      if (!d) return;
      colA.set(d.a); colB.set(d.b); artTarget = d.art; skinTarget = d.skin;
      if (introT > 3) liquidUniforms.uRipple.value = 0;
    },
    setExplode(v) { explodeTarget = v; },
    setTheme(dark) {
      steamTarget.set(dark ? '#f5ebe0' : '#cdb9a4');
      fogTarget.set(dark ? '#1b120c' : '#f4ece1');
    },
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    setScroll(y, vel) { scrollY = y; scrollVel = vel; },
    get isNarrow() { return aspect < 0.85; },
  };
}
