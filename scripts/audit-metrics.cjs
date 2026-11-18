// Measures the numbers in the audit's Measurements table.
// Needs: `npm run build && npx vite preview --port 4173` running, and Playwright with Chromium.
// Usage: node scripts/audit-metrics.cjs [url]
const { chromium, devices } = require('playwright');

const url = process.argv[2] || 'http://localhost:4173/first-captain/?debug';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  const closeDialogs = async () => {
    for (let i = 0; i < 25 && (await page.isVisible('.dialogue')); i++) {
      if (await page.isVisible('.dialogue .choices button')) await page.click('.dialogue .choices button');
      else await page.click('.dialogue');
      await page.waitForTimeout(120);
    }
  };
  await page.goto(url);
  await page.waitForTimeout(1200);
  await page.click('.title-screen .new');
  await page.fill('input[name=last]', 'Audit');
  for (const s of ['strength', 'cunning', 'cunning', 'charisma', 'charisma']) await page.click(`[data-skill=${s}] .plus`);
  await page.click('.creator .begin');
  await page.waitForTimeout(2000);
  await closeDialogs();
  // Monday 10:00 on Quay Street, when most residents are out.
  await page.evaluate(() => {
    const G = window.game;
    G.clock.minutes = 1620;
    G.state.minutes = G.clock.minutes;
    G.goTo('saltwharf', 'hester');
  });
  await page.waitForTimeout(3000);
  const m = await page.evaluate(() => {
    const G = window.game;
    const V = G.player.rig.root.position.constructor;
    const info = G.renderer.info;
    let meshes = 0;
    let lights = 0;
    G.location.scene.traverse((o) => {
      if (o.isMesh) meshes++;
      if (o.isPointLight) lights++;
    });
    const vw = innerWidth;
    const vh = innerHeight;
    const area = (sel) => [...document.querySelectorAll(sel)].reduce((a, e) => {
      const r = e.getBoundingClientRect();
      return a + r.width * r.height;
    }, 0);
    // Top bar, goals pill and the four dock tokens (the dock's fade strip is see-through).
    const hud = ['.topbar', '.goals', '.dock .tok'].reduce((a, s) => a + area(s), 0);
    const n = G.npcs.find((x) => x.visible);
    const p = n.walker.rig.root.position;
    const cam = G.rig.camera;
    const feet = new V(p.x, 0, p.z).project(cam);
    const head = new V(p.x, 1.45, p.z).project(cam);
    const fontSizes = [...document.querySelectorAll('.hud *')]
      .filter((e) => e.offsetParent && e.childNodes.length && [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()))
      .map((e) => parseFloat(getComputedStyle(e).fontSize));
    const buttons = [...document.querySelectorAll('.hud button')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().height);
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      meshes,
      pointLights: lights,
      hudCoverage: `${Math.round((hud / (vw * vh)) * 100)}%`,
      residentHeightPx: Math.round((Math.abs(head.y - feet.y) * vh) / 2),
      smallestButtonPx: Math.round(Math.min(...buttons)),
      smallestTextPx: Math.min(...fontSizes),
      viewport: `${vw}x${vh}`,
    };
  });
  console.log(JSON.stringify(m, null, 2));
  await browser.close();
})();
