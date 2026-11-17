import * as THREE from 'three';
import { Npc } from '../actors/Npc';
import { Player } from '../actors/Player';
import { createCharacter, type Rig } from '../actors/characterModel';
import { GRADE_INFO, JOBS, dayIndex, gradeFor, type Grade } from '../game/jobs';
import { addNeed, simulateNeeds } from '../game/needs';
import { RESIDENTS, stopAt } from '../game/residents';
import {
  DAILY_LIMIT, INTERACTIONS, interact, knownTraits, newRelation, relationLabel, type Interaction, type Relation,
} from '../game/social';
import { ITEMS, SHOPS, buy, canCarry, removeItem, sell, sellPrice, slots, usedSlots, useItem } from '../game/items';
import {
  canStartShift, checkAttendance, completeShift, dayStart, employment, gainXp, hire, hireBlocker, leave, nextShiftText,
  promotionText, title,
} from '../game/work';
import { playBar } from '../minigames/bar';
import { ENEMIES, runFight, type Enemy } from '../minigames/fight';
import { playCargo } from '../minigames/cargo';
import { loadGame, newGame, saveGame, type Character, type GameState, type LocationId, type NeedId } from '../game/state';
import { Creator } from '../ui/Creator';
import { Dialogue, type Line } from '../ui/Dialogue';
import { Hud, type Action, type ListRow } from '../ui/Hud';
import { Title } from '../ui/Title';
import { buildHesterRoom } from '../world/hesterRoom';
import type { Location, Place } from '../world/location';
import { buildSaltwharf } from '../world/saltwharf';
import { CameraRig } from './CameraRig';
import { Clock } from './Clock';
import { Input } from './Input';

type Mode = 'title' | 'create' | 'play';

const P = 'Mr. Pembleton';
const DAY = 24 * 60;
const HOSPITAL_BILL = 0.15;

/** Months since October 1871, so October 1871 is 0. */
const monthIndex = (d: Date) => (d.getFullYear() - 1871) * 12 + d.getMonth() - 9;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly rig: CameraRig;
  private readonly clock = new Clock();
  private readonly locations: Record<LocationId, Location>;
  private location: Location;
  private readonly hud: Hud;
  private readonly dialogue: Dialogue;
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly marker: THREE.Mesh;
  private readonly faded = new Set<THREE.Object3D>();
  private readonly fadedMats = new Map<THREE.Material, THREE.Material>();

  private mode: Mode = 'title';
  private state: GameState | null = null;
  private player: Player | null = null;
  private title: Title | null = null;
  private creator: Creator | null = null;
  private busy = false;
  private readonly npcs: Npc[] = [];

  private readonly preview = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(30, 1, 0.1, 50), rig: null as Rig | null };

  private markerLife = 0;
  private occlusionTimer = 0;
  private lastSaveMinute = 0;
  private last = performance.now();
  private elapsed = 0;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.locations = { saltwharf: buildSaltwharf(), hesterRoom: buildHesterRoom() };
    this.location = this.locations.saltwharf;
    for (const r of RESIDENTS) {
      const npc = new Npc(r, this.locations.saltwharf.grid);
      this.locations.saltwharf.scene.add(npc.walker.rig.root);
      this.npcs.push(npc);
    }
    this.rig = new CameraRig(this.location.camera.bounds);
    this.rig.configure(this.location.camera);
    this.rig.snap(14, 12);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.4, 20),
      new THREE.MeshBasicMaterial({ color: 0xf0d890, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.03;

    this.buildPreviewScene();

    this.hud = new Hud(container, () => this.clock.cycleSpeed(), () => this.save(true), () => this.quitToTitle());
    this.hud.renderJournal = () => this.renderJournal();
    this.hud.onBag = () => this.openBag();
    this.hud.onPeople = () => this.openContacts();
    this.dialogue = new Dialogue(container);
    new Input(this.renderer.domElement, (x, y) => this.tap(x, y), (f) => this.rig.zoomBy(f));

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
    this.resize();
    // Testing aid: ?debug exposes the game object to the console.
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { game: Game }).game = this;
    this.showTitle();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // --- Modes ----------------------------------------------------------------

  private showTitle(): void {
    this.mode = 'title';
    this.hud.visible = false;
    this.title = new Title(
      this.container,
      loadGame() !== null,
      () => {
        const s = loadGame();
        if (s) void this.startGame(s);
      },
      () => this.showCreator(),
    );
  }

  private showCreator(): void {
    this.title?.remove();
    this.title = null;
    this.mode = 'create';
    this.resize();
    this.creator = new Creator(
      this.container,
      (c) => this.updatePreview(c),
      (c) => void this.beginNewLife(c),
      () => {
        this.creator?.remove();
        this.creator = null;
        this.showTitle();
      },
    );
  }

  private async beginNewLife(c: Character): Promise<void> {
    const s = newGame(c);
    saveGame(s);
    await this.hud.fade(true);
    this.creator?.remove();
    this.creator = null;
    await this.startGame(s);
  }

  private async startGame(s: GameState): Promise<void> {
    await this.hud.fade(true);
    this.title?.remove();
    this.title = null;
    this.state = s;
    this.clock.minutes = s.minutes;
    this.lastSaveMinute = s.minutes;
    this.player?.rig.root.removeFromParent();
    this.player = new Player(this.locations[s.location].grid, s.character.look, s.pos.x, s.pos.z);
    this.enterLocation(s.location, s.pos.x, s.pos.z, s.pos.x + 1, s.pos.z - 1);
    this.mode = 'play';
    this.hud.visible = true;
    this.resize();
    this.refreshObjectives();
    await this.hud.fade(false);
    if (s.tutorial.step === 'intro') await this.introScene();
  }

  private quitToTitle(): void {
    this.save(true);
    location.reload();
  }

  // --- Locations ------------------------------------------------------------

  private enterLocation(id: LocationId, x: number, z: number, faceX: number, faceZ: number): void {
    for (const o of [...this.faded]) this.setFaded(o, false);
    this.location = this.locations[id];
    const player = this.player!;
    player.teleport(this.location.grid, x, z);
    player.faceToward({ x: faceX, z: faceZ }, true);
    this.location.scene.add(player.rig.root, this.marker);
    this.rig.configure(this.location.camera);
    this.rig.snap(x, z + this.location.camera.offsetZ);
    if (this.state) this.state.location = id;
  }

  private async goTo(id: LocationId, entry: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.hud.hidePlace();
    await this.hud.fade(true);
    const e = this.locations[id].entries[entry];
    this.enterLocation(id, e.x, e.z, e.faceX, e.faceZ);
    await this.hud.fade(false);
    this.busy = false;
    this.save();
  }

  // --- Input ----------------------------------------------------------------

  private tap(clientX: number, clientY: number): void {
    if (this.mode !== 'play' || this.busy || this.dialogue.open || this.hud.blocking || !this.player) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.rig.camera);

    for (const n of this.npcs) n.held = false;
    if (this.location.id === 'saltwharf') {
      const roots = this.npcs.filter((n) => n.visible).map((n) => n.walker.rig.root);
      const nh = this.raycaster.intersectObjects(roots, true)[0];
      if (nh) {
        let o: THREE.Object3D | null = nh.object;
        while (o && !o.userData.npcId) o = o.parent;
        const npc = o && this.npcs.find((n) => n.res.id === o!.userData.npcId);
        if (npc) {
          this.approach(npc);
          return;
        }
      }
    }
    const solid = this.location.tappables.filter((o) => !this.faded.has(o));
    const hit = this.raycaster.intersectObjects(solid, true)[0];
    if (hit) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.placeId) o = o.parent;
      const place = o && this.location.places.find((p) => p.id === o!.userData.placeId);
      if (place) {
        this.goToPlace(place);
        return;
      }
    }
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return;
    const cell = this.location.grid.nearestWalkable(Math.floor(p.x), Math.floor(p.z), 3);
    if (!cell) return;
    this.hud.hidePlace();
    if (this.player.walkTo(cell)) this.showMarker(cell.x + 0.5, cell.z + 0.5);
  }

  private goToPlace(place: Place): void {
    const player = this.player!;
    this.hud.hidePlace();
    const ok = player.walkTo(place.door, () => {
      player.faceToward(place.faceTo);
      this.hud.showPlace(place, this.actionsFor(place));
    });
    if (ok) this.showMarker(place.door.x + 0.5, place.door.z + 0.5);
    else this.hud.toast("You can't find a way there.");
  }

  private showMarker(x: number, z: number): void {
    this.marker.position.x = x;
    this.marker.position.z = z;
    this.markerLife = 1;
  }

  // --- Places and actions ---------------------------------------------------

  private actionsFor(place: Place): Action[] {
    const s = this.state!;
    const act = (label: string, fn: () => void | Promise<void>, opts: Partial<Action> = {}): Action => ({
      label,
      onClick: () => {
        this.hud.hidePlace();
        void fn();
      },
      ...opts,
    });

    if (this.location.id === 'saltwharf') {
      switch (place.id) {
        case 'hester':
          return [
            act('Go up to your room', () => this.goTo('hesterRoom', 'door'), { primary: true }),
            act("Browse Pell's Chandlery", () => this.openShop('hester')),
          ];
        case 'dockoffice':
          return this.jobActions('docks', act);
        case 'coppercup':
          return [
            ...this.jobActions('coppercup', act),
            act('Buy a drink · £0.02', () => this.tavernDrink(), { disabled: s.money < 0.02 }),
          ];
        case 'market':
          return [act('Browse the stalls', () => this.openShop('market'), { primary: true })];
        case 'pawnbroker':
          return [act('Sell to Moss', () => this.openShop('pawnbroker'), { primary: true })];
        default:
          return [];
      }
    }

    switch (place.id) {
      case 'bed':
        return [
          act('Sleep until morning', () => this.sleep('morning'), { primary: true }),
          act('Nap for 2 hours', () => this.sleep('nap')),
        ];
      case 'larder':
        return [act(`Eat stale bread (${s.larderBread} left)`, () => this.eatBread(), { disabled: s.larderBread <= 0 })];
      case 'basin':
        return [act('Wash your face', () => this.hud.toast('Cold water and carbolic. You feel almost respectable.'))];
      case 'trunk':
        return [act('Try the lid', () => this.dialogue.say(
          { speaker: 'You', text: 'The lid will not move. The lock is old, but well made.' },
          { speaker: P, text: 'Leave that be. Not yet.' },
        ))];
      case 'door':
        return [act('Go down to Quay Street', () => this.goTo('saltwharf', 'hester'), { primary: true })];
      case 'pembleton':
        return [act('Talk', () => this.chatPembleton(), { primary: true })];
      default:
        return [];
    }
  }

  private eatBread(): void {
    const s = this.state!;
    if (s.larderBread <= 0) return;
    s.larderBread--;
    addNeed(s.needs, 'hunger', 30);
    this.hud.toast(s.larderBread > 0 ? 'Stale, but bread.' : "That was the last of Hester's bread.");
  }

  private tavernDrink(): void {
    const s = this.state!;
    if (s.money < 0.02) return;
    s.money = Math.round((s.money - 0.02) * 100) / 100;
    addNeed(s.needs, 'social', 15);
    addNeed(s.needs, 'rest', -3);
    this.hud.toast('A pint of thin ale and somebody else\'s story. Social +15.');
  }

  // --- Shops and the bag ----------------------------------------------------

  private openShop(id: string): void {
    const shop = SHOPS[id];
    const s = this.state!;
    const render = () => {
      const rows: ListRow[] = [];
      for (const itemId of shop.stock) {
        const def = ITEMS[itemId];
        rows.push({
          label: `${def.name} · £${def.price.toFixed(2)}`,
          sub: def.blurb,
          actions: [
            ...(def.use && def.verb === 'Eat' ? [{
              label: 'Buy & eat',
              disabled: s.money + 1e-9 < def.price,
              onClick: () => {
                s.money = Math.round((s.money - def.price) * 100) / 100;
                for (const [k, v] of Object.entries(def.use!)) addNeed(s.needs, k as NeedId, v);
                this.hud.toast(`You eat the ${def.name.toLowerCase()} standing up, like everyone else here.`);
                render();
              },
            }] : []),
            {
              label: 'Buy',
              disabled: s.money + 1e-9 < def.price || !canCarry(s, itemId),
              onClick: () => {
                const r = buy(s, itemId);
                if (r === 'full') this.hud.toast('Your bag is full.');
                render();
              },
            },
          ],
        });
      }
      if (shop.buys > 0) {
        for (const it of s.inventory) {
          const def = ITEMS[it.id];
          rows.push({
            label: `${def.name} ×${it.qty}`,
            sub: `Moss offers £${sellPrice(shop, it.id).toFixed(2)}`,
            actions: [{ label: 'Sell', onClick: () => { sell(s, shop, it.id); render(); } }],
          });
        }
        if (s.inventory.length === 0) rows.push({ label: 'You have nothing Moss wants.', sub: '', actions: [] });
      }
      this.hud.showList(shop.name, `£${s.money.toFixed(2)} · bag ${usedSlots(s)} / ${slots(s)}`, rows);
    };
    render();
  }

  private openBag(): void {
    const s = this.state!;
    const render = () => {
      const rows: ListRow[] = s.inventory.map((it) => {
        const def = ITEMS[it.id];
        const actions: Action[] = [];
        if (def.use) actions.push({ label: def.verb ?? 'Use', onClick: () => { const m = useItem(s, it.id); if (m) this.hud.toast(m); render(); } });
        actions.push({ label: 'Drop', onClick: () => { removeItem(s, it.id); render(); } });
        return { label: `${def.name} ×${it.qty}`, sub: def.blurb, actions };
      });
      if (rows.length === 0) rows.push({ label: 'Your bag is empty.', sub: 'Buy food at the market, supplies at the chandlery.', actions: [] });
      this.hud.showList('Bag', `${usedSlots(s)} / ${slots(s)} slots · Strength adds room`, rows);
    };
    render();
  }

  // --- Work -----------------------------------------------------------------

  private jobActions(jobId: string, act: (label: string, fn: () => void | Promise<void>, opts?: Partial<Action>) => Action): Action[] {
    const s = this.state!;
    const e = employment(s, jobId);
    if (!e) return [act('Ask about work', () => this.askForWork(jobId), { primary: true })];
    const open = canStartShift(s, jobId);
    return [
      act(`Work your shift as ${title(s, e)}`, () => this.workShift(jobId, true), { primary: true, disabled: !open }),
      act(e.lastGrade ? `Autopilot (${GRADE_INFO[e.lastGrade].name} pay, no points)` : 'Autopilot (play one shift first)',
        () => this.workShift(jobId, false), { disabled: !open || !e.lastGrade }),
      act('Quit the job', () => this.quitJob(jobId)),
    ];
  }

  private async askForWork(jobId: string): Promise<void> {
    const s = this.state!;
    const job = JOBS[jobId];
    const B = job.boss;
    if (jobId === 'docks') s.tutorial.askedDocks = true;
    if (jobId === 'coppercup') s.tutorial.askedCup = true;
    this.refreshObjectives();
    const blocker = hireBlocker(s, jobId);
    if (blocker === 'banned') return this.dialogue.say({ speaker: B, text: job.lines.banned });
    if (blocker === 'full') return this.dialogue.say({ speaker: B, text: 'You\'ve two masters already. Nobody has the hours for three.' });
    if (blocker === 'clash') return this.dialogue.say({ speaker: B, text: 'Those hours clash with your other work. Choose one.' });
    if (blocker) return;
    const yes = await this.dialogue.ask({ speaker: B, text: job.lines.offer }, ["I'll take it.", 'Not now.']);
    if (yes !== 0) return;
    hire(s, jobId);
    await this.dialogue.say(...job.lines.hired.map((text) => ({ speaker: B, text })));
    if (s.jobs.length === 2) this.hud.toast('Two jobs: mind your Rest. Sleep is the first thing you will run short of.', 4000);
    this.save();
  }

  private async quitJob(jobId: string): Promise<void> {
    const s = this.state!;
    const job = JOBS[jobId];
    const yes = await this.dialogue.ask({ speaker: 'You', text: `Quit ${job.career === 'Docks' ? 'the docks' : job.career}? You will lose your rank and points.` }, ['Quit', 'Stay']);
    if (yes !== 0) return;
    leave(s, jobId, false);
    await this.dialogue.say({ speaker: job.boss, text: job.lines.quit });
    this.save();
  }

  /** Plays (or skips) a shift, then jumps the clock to the end of the shift and reports. */
  private async workShift(jobId: string, play: boolean): Promise<void> {
    const s = this.state!;
    const job = JOBS[jobId];
    const e = employment(s, jobId);
    if (!e || !canStartShift(s, jobId) || this.busy) return;
    this.busy = true;
    this.player!.stop();
    const rankBefore = title(s, e);
    let grade: Grade;
    let lines: string[] = [];
    if (play) {
      const params = {
        rank: e.rank,
        title: `${job.career} · ${rankBefore}`,
        main: s.character.skills[job.main],
        second: s.character.skills[job.second],
        // Testing aid: ?mgseconds=8 shortens minigames.
        seconds: Number(new URLSearchParams(location.search).get('mgseconds')) || undefined,
      };
      const r = await (job.minigame === 'bar' ? playBar : playCargo)(this.container, params);
      grade = gradeFor(r.percent);
      lines = r.lines;
    } else {
      grade = e.lastGrade!;
    }
    await this.hud.fade(true);
    const shiftDay = dayIndex(s.minutes);
    const end = dayStart(shiftDay) + job.end;
    const hours = Math.max(0, (end - this.clock.minutes) / 60);
    simulateNeeds(s.needs, hours, 'awake');
    addNeed(s.needs, 'hunger', job.strain.hunger);
    addNeed(s.needs, 'rest', job.strain.rest);
    addNeed(s.needs, 'social', job.strain.social);
    this.clock.minutes = Math.max(this.clock.minutes, end);
    s.minutes = this.clock.minutes;
    const rep = completeShift(s, jobId, grade, play, shiftDay);
    await this.hud.fade(false);
    const report = [
      ...(play ? lines : ['You kept your head down and did the same as last time.']),
      `Grade: ${GRADE_INFO[grade].name}`,
      `Pay: £${rep.pay.toFixed(2)}`,
      `Promotion points: ${rep.points >= 0 ? '+' : ''}${rep.points}`,
      ...rep.levelUps,
    ];
    await this.hud.modal(`Shift over · ${rankBefore}`, report);
    if (rep.promotedTo) await this.dialogue.say({ speaker: job.boss, text: job.lines.promoted.replace('{rank}', rep.promotedTo) });
    if (rep.fired) await this.dialogue.say({ speaker: job.boss, text: job.lines.fired });
    this.busy = false;
    this.save();
  }

  /** Penalises missed shifts; called every frame and after sleeping. */
  private async attendance(): Promise<void> {
    for (const r of checkAttendance(this.state!)) {
      if (r.fired) await this.dialogue.say({ speaker: r.job.boss, text: r.job.lines.absentFired });
      else this.hud.toast(`You missed ${r.missed === 1 ? 'a shift' : `${r.missed} shifts`} at ${r.job.career === 'Docks' ? 'the docks' : r.job.career}. Promotion points −${r.missed * 3}.`, 4000);
    }
  }

  // --- People ---------------------------------------------------------------

  private rel(id: string): Relation {
    const s = this.state!;
    s.relations ??= {};
    return (s.relations[id] ??= newRelation());
  }

  private updateNpcs(dt: number): void {
    const hour = Math.floor(this.clock.hour);
    const outside = this.location.id === 'saltwharf';
    for (const n of this.npcs) {
      n.follow(stopAt(n.res, hour), outside);
      n.update(dt, this.elapsed);
    }
  }

  /** Walk up to a resident; they wait for you. */
  private approach(npc: Npc): void {
    const player = this.player!;
    this.hud.hidePlace();
    npc.held = true;
    npc.walker.stop();
    const c = npc.walker.cell;
    const spot = [[0, -1], [1, 0], [-1, 0], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]]
      .map(([dx, dz]) => ({ x: c.x + dx, z: c.z + dz }))
      .filter((p) => this.location.grid.isWalkable(p.x, p.z))
      .sort((a, b) => Math.hypot(a.x - player.position.x, a.z - player.position.y) - Math.hypot(b.x - player.position.x, b.z - player.position.y))[0];
    const talk = () => {
      player.faceToward({ x: npc.walker.position.x, z: npc.walker.position.y });
      npc.walker.faceToward({ x: player.position.x, z: player.position.y });
      this.showPerson(npc);
    };
    if (!spot || !player.walkTo(spot, talk)) talk();
    else this.showMarker(spot.x + 0.5, spot.z + 0.5);
  }

  private showPerson(npc: Npc): void {
    const s = this.state!;
    const p = npc.res;
    const r = this.rel(p.id);
    const today = dayIndex(s.minutes);
    if (r.day !== today) {
      r.day = today;
      r.today = 0;
    }
    if (!r.met) {
      r.met = true;
      this.hud.toast(`You meet ${p.name}: ${p.role.charAt(0).toLowerCase()}${p.role.slice(1)}.`, 3500);
    }
    const traits = knownTraits(p, r);
    const description = `${p.role}. ${relationLabel(r)}.${traits.length ? ` ${traits.join(', ')}.` : ' You don\'t know them well yet.'}`;
    const tired = r.today >= DAILY_LIMIT;
    const actions: Action[] = INTERACTIONS.map((i) => ({
      label: i.label,
      disabled: tired || (i.id === 'gift' && s.inventory.length === 0),
      onClick: () => {
        this.hud.hidePlace();
        if (i.id === 'gift') this.chooseGift(npc);
        else void this.socialise(npc, i);
      },
    }));
    const place: Place = { id: `npc:${p.id}`, name: p.name, description: tired ? `${description} They've had enough of you for today.` : description, door: { x: 0, z: 0 }, faceTo: { x: 0, z: 0 } };
    this.hud.showPlace(place, actions);
  }

  private chooseGift(npc: Npc): void {
    const s = this.state!;
    const rows: ListRow[] = s.inventory.map((it) => ({
      label: `${ITEMS[it.id].name} ×${it.qty}`,
      sub: `Worth £${ITEMS[it.id].price.toFixed(2)}`,
      actions: [{
        label: 'Give',
        onClick: () => {
          removeItem(s, it.id);
          this.hud.closeList();
          const gift = INTERACTIONS.find((i) => i.id === 'gift')!;
          void this.socialise(npc, { ...gift, gain: Math.round(gift.gain * (1 + ITEMS[it.id].price * 10)) });
        },
      }],
    }));
    this.hud.showList(`A gift for ${npc.res.name}`, 'Choose something from your bag', rows);
  }

  private async socialise(npc: Npc, i: Interaction): Promise<void> {
    const s = this.state!;
    const r = this.rel(npc.res.id);
    r.today++;
    // Mood varies by person and day.
    const seed = Math.sin((dayIndex(s.minutes) + 1) * 12.9898 + npc.res.id.length * 78.233) * 43758.5453;
    const mood = ((seed - Math.floor(seed)) - 0.5) * 0.2;
    const out = interact(s, npc.res, r, i, mood);
    addNeed(s.needs, 'social', out.success ? 6 : 3);
    const xp = [...gainXp(s, i.skill, out.success ? 6 : 3)];
    const names: Record<string, string> = { friendship: 'Friendship', romance: 'Romance', rivalry: 'Rivalry', business: 'Business' };
    const delta = Object.entries(out.changes).filter(([, v]) => v).map(([k, v]) => `${names[k]} ${v! > 0 ? '+' : ''}${Math.round(v!)}`).join(' · ');
    const hint = out.liked ? (out.success ? 'They liked that.' : 'They usually like that, just not today.') : out.disliked ? 'They did not like that.' : '';
    await this.dialogue.say({ speaker: npc.res.name, text: [out.text, hint, delta, ...xp].filter(Boolean).join('\n') });
    if (npc.held) this.showPerson(npc);
  }

  private openContacts(): void {
    const s = this.state!;
    s.relations ??= {};
    const rows: ListRow[] = RESIDENTS.filter((p) => s.relations[p.id]?.met).map((p) => {
      const r = s.relations[p.id];
      const traits = knownTraits(p, r);
      return {
        label: `${p.name} · ${relationLabel(r)}`,
        sub: `${p.role}${traits.length ? ` · ${traits.join(', ')}` : ''}\nFriendship ${Math.round(r.friendship)} · Romance ${Math.round(r.romance)} · Rivalry ${Math.round(r.rivalry)} · Business ${Math.round(r.business)}`,
        actions: [],
      };
    });
    if (rows.length === 0) rows.push({ label: 'You know nobody yet.', sub: 'Tap people in the street to talk to them.', actions: [] });
    this.hud.showList('People', `${rows.length} known in Saltwharf`, rows);
  }

  // --- Night: robberies, street violence and the hospital -------------------

  private night(gameMinutes: number): void {
    const s = this.state!;
    if (this.location.id !== 'saltwharf' || this.busy || this.dialogue.open || gameMinutes <= 0) return;
    const hour = this.clock.hour;
    const day = dayIndex(s.minutes);
    const dark = hour >= 21 || hour < 5;
    // Robbery: once a night at most; more likely with a fat purse, less if you are known to fight back.
    if (dark && s.lastRobberyDay !== day) {
      const rate = 0.003 * (1 + s.money * 0.6) * (s.notoriety >= 3 ? 0.5 : 1);
      if (Math.random() < rate * gameMinutes) {
        s.lastRobberyDay = day;
        void this.robbery();
        return;
      }
    }
    // Someone else in trouble, evenings.
    if (hour >= 19 && hour < 23.5 && s.lastWitnessDay !== day && Math.random() < 0.0025 * gameMinutes) {
      const victims = this.npcs.filter((n) => n.visible && ['tom', 'lizzie', 'jem', 'hannah', 'ruby', 'pell', 'hale'].includes(n.res.id));
      if (victims.length) {
        s.lastWitnessDay = day;
        void this.witness(victims[Math.floor(Math.random() * victims.length)]);
      }
    }
  }

  /** How frightening you are: your dock rank and the fights you've won. */
  private menace(): number {
    const s = this.state!;
    const docks = employment(s, 'docks');
    return (docks ? docks.rank * 0.08 : 0) + Math.min(5, s.notoriety) * 0.05;
  }

  private pickEnemy(): Enemy {
    const keys = Object.keys(ENEMIES);
    return ENEMIES[keys[Math.floor(Math.random() * keys.length)]];
  }

  private async robbery(): Promise<void> {
    const s = this.state!;
    this.busy = true;
    this.player!.stop();
    this.hud.hidePlace();
    const enemy = this.pickEnemy();
    const take = Math.round(s.money * 0.5 * 100) / 100;
    const opts = [s.money > 0 ? `Hand over £${take.toFixed(2)}` : "I've got nothing", 'Fight', 'Talk your way out', 'Run'];
    const choice = await this.dialogue.ask({ speaker: enemy.name, text: 'A shape steps out of the fog with its hand held out. "Your purse. Now. Quiet-like."' }, opts);
    let fight = false;
    let firstStrike = false;
    if (choice === 0) {
      if (s.money > 0) {
        s.money = Math.round((s.money - take) * 100) / 100;
        await this.dialogue.say({ speaker: enemy.name, text: 'Good. Sleep tight.' });
      } else if (s.inventory.length) {
        const it = s.inventory[Math.floor(Math.random() * s.inventory.length)];
        removeItem(s, it.id);
        await this.dialogue.say({ speaker: enemy.name, text: `Nothing? Then I'll have this. They take your ${ITEMS[it.id].name.toLowerCase()}.` });
      } else {
        await this.dialogue.say({ speaker: enemy.name, text: 'Nothing at all? God help you, then.' });
      }
    } else if (choice === 1) {
      fight = true;
    } else if (choice === 2) {
      const how = await this.dialogue.ask({ speaker: 'You', text: 'How do you talk your way out?' }, [
        `Intimidate (Strength${employment(s, 'docks') ? ', and they know you from the docks' : ''})`,
        'Persuade (Charisma)',
        'Bluff (Cunning)',
      ]);
      const skill = (['strength', 'charisma', 'cunning'] as const)[how];
      const chance = 0.25 + s.character.skills[skill] * 0.05 + (how === 0 ? this.menace() : 0);
      gainXp(s, skill, 8);
      if (Math.random() < chance) {
        const lines = [
          'You square up and say nothing at all. They decide you are not worth it.',
          'You talk about the gallows, and their mother, and the cold. They go.',
          'You whistle, as if to a mate behind them. They bolt.',
        ];
        await this.dialogue.say({ speaker: '', text: lines[how] });
      } else {
        await this.dialogue.say({ speaker: enemy.name, text: 'Nice try.' });
        fight = true;
        firstStrike = true;
      }
    } else {
      if (Math.random() < 0.35 + s.character.skills.cunning * 0.05) {
        this.hud.toast('You duck into an alley and lose them in the fog.');
      } else {
        await this.dialogue.say({ speaker: enemy.name, text: 'Not so fast.' });
        fight = true;
        firstStrike = true;
      }
    }
    if (fight) await this.fight(enemy, 'They come at you.', firstStrike, true);
    this.busy = false;
    this.save();
  }

  private async witness(npc: Npc): Promise<void> {
    this.busy = true;
    this.player!.stop();
    this.hud.hidePlace();
    const r = this.rel(npc.res.id);
    r.met = true;
    const choice = await this.dialogue.ask(
      { speaker: '', text: `A cry from the fog: someone has ${npc.res.name} up against a wall, going through their pockets.` },
      ['Step in', 'Shout for a constable', 'Walk away'],
    );
    if (choice === 0) {
      const won = await this.fight(this.pickEnemy(), `You shove between them. "Leave ${npc.res.name.split(' ')[0]} be."`, false, false);
      if (won) {
        r.friendship = Math.min(100, r.friendship + 20);
        r.rivalry = Math.max(0, r.rivalry - 10);
        await this.dialogue.say({ speaker: npc.res.name, text: 'I won\'t forget that. Not ever.' });
      }
    } else if (choice === 1) {
      if (Math.random() < 0.5) {
        r.friendship = Math.min(100, r.friendship + 6);
        await this.dialogue.say({ speaker: '', text: 'A whistle answers from Quay Street. The attacker runs.' }, { speaker: npc.res.name, text: 'Thank you. I thought that was me finished.' });
      } else {
        r.friendship = Math.min(100, r.friendship + 2);
        await this.dialogue.say({ speaker: '', text: 'No constable comes. The attacker takes what they want and slips away.' });
      }
    } else {
      r.friendship = Math.max(0, r.friendship - 8);
      r.rivalry = Math.min(100, r.rivalry + 4);
      this.hud.toast(`You walk on. ${npc.res.name.split(' ')[0]} saw you go.`, 3500);
    }
    this.busy = false;
    this.save();
  }

  /** Runs a fight; handles winning, losing and the hospital. Returns true if you won or talked them down. */
  private async fight(enemy: Enemy, intro: string, firstStrike: boolean, robbery: boolean): Promise<boolean> {
    const s = this.state!;
    const { outcome, xp } = await runFight(this.container, s, enemy, intro, firstStrike);
    const ups = [...gainXp(s, 'strength', xp.strength), ...gainXp(s, 'cunning', xp.cunning), ...gainXp(s, 'charisma', xp.charisma)];
    if (outcome === 'won' || outcome === 'talked') {
      s.notoriety++;
      const loot = outcome === 'won' ? Math.round((0.02 + Math.random() * 0.06) * 100) / 100 : 0;
      s.money = Math.round((s.money + loot) * 100) / 100;
      this.hud.toast(`${loot ? `You find £${loot.toFixed(2)} where they fell. ` : ''}Word gets round: you fight back.${ups.length ? ` ${ups.join(' ')}` : ''}`, 4000);
      return true;
    }
    if (outcome === 'lost') await this.hospital(robbery);
    else if (ups.length) this.hud.toast(ups.join(' '));
    return false;
  }

  /** Wake in the London Hospital with a bill. If you were robbed, they took more on the way down. */
  private async hospital(robbed: boolean): Promise<void> {
    const s = this.state!;
    const wasBusy = this.busy;
    this.busy = true;
    await this.hud.fade(true);
    const lost: string[] = [];
    if (robbed) {
      const take = Math.round(s.money * 0.6 * 100) / 100;
      s.money = Math.round((s.money - take) * 100) / 100;
      if (take > 0) lost.push(`£${take.toFixed(2)}`);
      if (s.inventory.length) {
        const it = s.inventory[Math.floor(Math.random() * s.inventory.length)];
        removeItem(s, it.id);
        lost.push(`your ${ITEMS[it.id].name.toLowerCase()}`);
      }
    }
    // Twelve hours on a ward.
    for (let m = 0; m < 12 * 60; m += 10) {
      simulateNeeds(s.needs, 10 / 60, 'asleep');
      this.clock.minutes += 10;
    }
    s.minutes = this.clock.minutes;
    s.needs.health = Math.max(s.needs.health, 40);
    s.needs.hunger = Math.max(s.needs.hunger, 25);
    const paid = Math.min(s.money, HOSPITAL_BILL);
    s.money = Math.round((s.money - paid) * 100) / 100;
    s.debt = Math.round((s.debt + HOSPITAL_BILL - paid) * 100) / 100;
    const e = this.locations.saltwharf.entries.hester;
    this.enterLocation('saltwharf', e.x, e.z, e.faceX, e.faceZ);
    await this.hud.fade(false);
    await this.dialogue.say(
      { speaker: 'Ward Sister', text: `You were brought in off the street. ${robbed && lost.length ? `Whoever did it took ${lost.join(' and ')}. ` : ''}The London Hospital charges £${HOSPITAL_BILL.toFixed(2)} for the bed and the stitching.` },
      { speaker: 'Ward Sister', text: s.debt > 0 ? `You paid £${paid.toFixed(2)}. The rest, £${s.debt.toFixed(2)}, comes out of your next wages.` : 'Paid in full. Try to stay upright.' },
    );
    this.busy = wasBusy;
    this.save();
  }

  private async chatPembleton(): Promise<void> {
    const s = this.state!;
    const lines = [
      'In my day a gentleman did not live above a chandler. In my day a gentleman did not die on the stairs, either. Times change.',
      'The fog was never this thick before those white lamps came. I notice these things. I have nothing else to do.',
      'Your aunt talked to me every evening. I find I miss being interrupted.',
      'Mr. Grubb, the landlord, has the soul of a damp ledger. Pay him on time and he will forget you exist. That is the best one can hope for.',
      'Do not trust anyone in Hollow Lane who offers you a bargain. Or anyone anywhere, really.',
      'I tried to haunt the Copper Cup once. Nobody noticed. It was humbling.',
    ];
    await this.dialogue.say({ speaker: P, text: lines[Math.floor(Math.random() * lines.length)] });
    if (s.minutes - s.lastChatMinute >= 120) {
      addNeed(s.needs, 'social', 12);
      s.lastChatMinute = s.minutes;
      this.hud.toast('Social +12: even dead company is company.');
    }
  }

  // --- Sleep, rent and collapse -------------------------------------------

  private async sleep(kind: 'morning' | 'nap' | 'collapse' | 'faint'): Promise<void> {
    const s = this.state!;
    if (this.busy) return;
    if (kind === 'morning' && s.needs.rest > 90) {
      this.hud.toast("You're not tired enough to sleep.");
      return;
    }
    this.busy = true;
    this.player!.stop();
    this.hud.hidePlace();
    await this.hud.fade(true);

    let minutes: number;
    if (kind === 'morning') {
      const d = this.clock.date;
      const nowMin = d.getHours() * 60 + d.getMinutes();
      const wake = 6 * 60;
      minutes = nowMin < wake ? wake - nowMin : DAY - nowMin + wake;
    } else if (kind === 'nap') minutes = 120;
    else if (kind === 'collapse') minutes = 6 * 60;
    else minutes = 10 * 60;

    const outdoors = this.location.id === 'saltwharf';
    if (kind === 'faint') {
      const e = this.locations.hesterRoom.entries.bed;
      this.enterLocation('hesterRoom', e.x, e.z, e.faceX, e.faceZ);
    }
    const mode = kind === 'collapse' && outdoors ? 'roughSleep' : 'asleep';
    for (let m = 0; m < minutes; m += 10) {
      simulateNeeds(s.needs, 10 / 60, mode);
      this.clock.minutes += 10;
    }
    s.minutes = this.clock.minutes;
    if (kind === 'faint') {
      s.needs.health = Math.max(s.needs.health, 25);
      s.needs.hunger = Math.max(s.needs.hunger, 15);
    }
    if (kind === 'collapse') addNeed(s.needs, 'health', -10);
    const rentNews = this.checkRent();
    await this.hud.fade(false);
    this.busy = false;

    if (kind === 'morning') this.hud.toast(`You wake at ${this.clock.formatTime()}, ${this.clock.formatDate()}.`);
    if (kind === 'nap') this.hud.toast('You doze for two hours.');
    if (kind === 'collapse') this.hud.toast('You collapse from exhaustion and wake hours later, aching.', 4000);
    if (kind === 'faint') {
      await this.dialogue.say({ speaker: P, text: 'A neighbour carried you up the stairs. You were grey as a winding sheet. Eat. Sleep. I would rather not have company in my condition.' });
    }
    if (rentNews) await this.dialogue.say({ speaker: 'Mr. Grubb', text: rentNews });
    await this.attendance();

    if (kind === 'morning' && s.tutorial.step === 'explore') {
      s.tutorial.slept = true;
      this.refreshObjectives();
      if (s.tutorial.askedDocks && s.tutorial.askedCup) await this.firstMorningScene();
    }
    this.save();
  }

  /** Collects rent at the turn of the month; returns a message for the player, if any. */
  private checkRent(): string | null {
    const s = this.state!;
    const now = monthIndex(this.clock.date);
    const r = s.rent;
    const pay = () => {
      s.money = Math.round((s.money - r.amount) * 100) / 100;
      r.dueMonth++;
    };
    if (r.graceUntil === null && now > r.dueMonth) {
      if (s.money >= r.amount) {
        pay();
        return `Rent, £${r.amount.toFixed(2)}. Paid. Pleasure, I'm sure. Same again at the end of the month.`;
      }
      r.graceUntil = this.clock.minutes + 7 * DAY;
      return `£${r.amount.toFixed(2)}, and you haven't got it. Seven days. After that you and your things go in the gutter.`;
    }
    if (r.graceUntil !== null) {
      if (s.money >= r.amount) {
        pay();
        r.graceUntil = null;
        return "Paid at last. Don't make me climb those stairs again.";
      }
      if (this.clock.minutes > r.graceUntil) {
        // Eviction arrives with milestone M7; until then Grubb keeps threatening.
        r.graceUntil = this.clock.minutes + 3 * DAY;
        return "I'm out of patience. Three more days, and I'm bringing my brother-in-law.";
      }
    }
    return null;
  }

  private checkCollapse(): void {
    const s = this.state!;
    if (this.busy || this.dialogue.open) return;
    if (s.needs.health <= 0) void this.hospital(false);
    else if (s.needs.rest <= 0) void this.sleep('collapse');
  }

  // --- Tutorial -------------------------------------------------------------

  private refreshObjectives(): void {
    const s = this.state;
    if (!s || s.tutorial.step !== 'explore') {
      this.hud.setObjectives([]);
      return;
    }
    const t = s.tutorial;
    this.hud.setObjectives([
      { text: 'Ask for work at the Dock Hiring Office', done: t.askedDocks },
      { text: 'Ask for work at the Copper Cup', done: t.askedCup },
      { text: 'Sleep in your bed tonight', done: t.slept },
    ]);
  }

  private async introScene(): Promise<void> {
    const s = this.state!;
    const kin = s.character.gender === 'man' ? 'nephew' : 'niece';
    this.busy = true;
    await this.dialogue.say(
      { speaker: '', text: "Hester's room. One window, one bed, one cold stove. Dust on everything except a single chair by the table." },
      { speaker: P, text: `Ah. You must be the ${kin}. Hester's. You have her chin. Unfortunate.` },
    );
    const choice = await this.dialogue.ask(
      { speaker: P, text: 'Mr. Augustus Pembleton, late of this parish. Very late. Seventeen-ninety, to be precise.' },
      ["You're a ghost?", 'Get out of my room.', 'Did you know my aunt?'],
    );
    const replies: Line[] = [
      { speaker: P, text: 'An astute observation. I would shake your hand, but it ends badly for everyone.' },
      { speaker: P, text: 'I have been trying to get out since the Regency. The building disagrees.' },
      { speaker: P, text: 'Thirty years under the same roof. She talked to me more than to the living. A wise woman. Mostly.' },
    ];
    await this.dialogue.say(
      replies[choice],
      { speaker: P, text: 'Now. Business. Your aunt left you this room, that bed, and her debts. Mr. Grubb, the landlord, wants £0.60 by the last day of the month.' },
      { speaker: P, text: 'You have £1.00. In Saltwharf that lasts about as long as a candle in a gale.' },
      { speaker: P, text: 'Mind yourself. Hunger, Rest, Social, Health. Neglect them and the city will finish what poverty starts.' },
      { speaker: P, text: 'Hester kept bread in the larder. Stale, but bread. After that, the market sells hot potatoes for a couple of pennies.' },
      { speaker: P, text: 'You need work. The Dock Hiring Office wants strong backs, and Bessa at the Copper Cup is always short of hands. Go and ask.' },
      { speaker: P, text: 'And come home before the lamps are lit. Saltwharf after dark is no place for the inexperienced.' },
    );
    s.tutorial.step = 'explore';
    this.busy = false;
    this.refreshObjectives();
    this.hud.toast('Tap the floor to walk. Tap things to use them.', 3500);
    this.save();
  }

  private async firstMorningScene(): Promise<void> {
    const s = this.state!;
    await this.dialogue.say(
      { speaker: P, text: 'You survived your first night. Most do. It is the thirtieth that gets them.' },
      { speaker: P, text: 'Keep asking for work. Keep your belly full and your rent paid. The rest of this city you will learn the hard way, as everyone does.' },
    );
    s.tutorial.step = 'done';
    this.refreshObjectives();
  }

  // --- Saving and journal ---------------------------------------------------

  private save(announce = false): void {
    const s = this.state;
    const p = this.player;
    if (!s || !p || this.mode !== 'play') return;
    s.minutes = this.clock.minutes;
    s.pos = { x: p.position.x, z: p.position.y };
    s.location = this.location.id;
    this.lastSaveMinute = s.minutes;
    const ok = saveGame(s);
    if (announce) this.hud.toast(ok ? 'Saved.' : 'Could not save on this device.');
  }

  private renderJournal(): void {
    const s = this.state;
    if (!s) return;
    const due = this.clock.formatShortDate(this.clock.rentDue);
    const rentLine = s.rent.graceUntil !== null
      ? `Rent of £${s.rent.amount.toFixed(2)} is overdue.`
      : `Rent of £${s.rent.amount.toFixed(2)} is due ${due}.`;
    const debtLine = s.debt > 0 ? ` You owe the hospital £${s.debt.toFixed(2)}.` : '';
    const work = s.jobs
      .map((e) => `${title(s, e)} at the ${JOBS[e.jobId].employer}: ${nextShiftText(s, e.jobId)}. ${promotionText(s, e.jobId)}`)
      .join('\n');
    this.hud.setJournal(Hud.titleFor(s), this.hud.journalHtml(s, rentLine + debtLine, work));
  }

  // --- Creator preview ------------------------------------------------------

  private buildPreviewScene(): void {
    const { scene, camera } = this.preview;
    scene.background = new THREE.Color(0x14181e);
    scene.fog = new THREE.Fog(0x14181e, 6, 14);
    scene.add(new THREE.HemisphereLight(0xc8d0e0, 0x2a2018, 1.4));
    const key = new THREE.DirectionalLight(0xffe0b0, 2.2);
    key.position.set(2, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fa0d0, 1.4);
    rim.position.set(-3, 2, -3);
    scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x3a342c, flatShading: true }));
    floor.position.y = -0.06;
    scene.add(floor);
    camera.position.set(0, 1.6, 9);
    camera.lookAt(0, 0.75, 0);
  }

  private updatePreview(c: Character): void {
    const old = this.preview.rig;
    const angle = old ? old.root.rotation.y : 0.4;
    if (old) {
      old.root.removeFromParent();
      old.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    const rig = createCharacter(c.look);
    rig.root.rotation.y = angle;
    this.preview.scene.add(rig.root);
    this.preview.rig = rig;
  }

  // --- Frame ----------------------------------------------------------------

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.rig.resize(w, h);
    const cam = this.preview.camera;
    cam.aspect = w / h;
    // Keep the figure in the part of the screen the creator sheet leaves free.
    if (w < h) cam.setViewOffset(w, h, 0, h * 0.32, w, h);
    else cam.setViewOffset(w, h, w * 0.24, 0, w, h);
    cam.updateProjectionMatrix();
  }

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.elapsed += dt;

    if (this.mode === 'create') {
      if (this.preview.rig) this.preview.rig.root.rotation.y += dt * 0.5;
      this.renderer.render(this.preview.scene, this.preview.camera);
      return;
    }

    if (this.mode === 'title') {
      this.location.update(20.8, this.elapsed);
      this.rig.update(dt, 16 + Math.sin(this.elapsed * 0.08) * 9, 12);
      this.renderer.render(this.location.scene, this.rig.camera);
      return;
    }

    const s = this.state!;
    const player = this.player!;
    const paused = this.busy || this.dialogue.open || this.hud.blocking;
    if (!paused) {
      const before = this.clock.minutes;
      this.clock.tick(dt);
      simulateNeeds(s.needs, (this.clock.minutes - before) / 60, 'awake');
      s.minutes = this.clock.minutes;
      const news = this.checkRent();
      if (news) void this.dialogue.say({ speaker: 'Mr. Grubb', text: news });
      this.checkCollapse();
      this.night(this.clock.minutes - before);
      // Wages pay off hospital debt first.
      if (s.debt > 0 && s.money > 0) {
        const pay = Math.min(s.debt, s.money);
        s.money = Math.round((s.money - pay) * 100) / 100;
        s.debt = Math.round((s.debt - pay) * 100) / 100;
        if (s.debt === 0) this.hud.toast('Your hospital bill is paid off.');
      }
      void this.attendance();
      if (s.minutes - this.lastSaveMinute >= 60) this.save();
    }

    player.update(dt, this.elapsed);
    this.updateNpcs(dt);
    this.location.update(this.clock.hour, this.elapsed);
    this.rig.update(dt, player.position.x, player.position.y + this.location.camera.offsetZ);

    if (this.location.fadeOccluders) {
      this.occlusionTimer -= dt;
      if (this.occlusionTimer <= 0) {
        this.occlusionTimer = 0.1;
        this.updateOcclusion();
      }
    }

    if (this.markerLife > 0) {
      this.markerLife = Math.max(0, this.markerLife - dt * 1.2);
      (this.marker.material as THREE.MeshBasicMaterial).opacity = this.markerLife * 0.9;
      this.marker.scale.setScalar(1 + (1 - this.markerLife) * 0.5);
    }

    const jobLine = s.jobs.map((e) => `${title(s, e)} · ${nextShiftText(s, e.jobId)}`).join('\n');
    this.hud.update(s, this.location.name, this.clock.formatDate(), this.clock.formatTime(), this.clock.formatShortDate(this.clock.rentDue), jobLine);
    this.renderer.render(this.location.scene, this.rig.camera);
  }

  /** Fades buildings standing between the camera and the player so you never lose sight of yourself. */
  private updateOcclusion(): void {
    const player = this.player!;
    const cam = this.rig.camera.position;
    const occluders = new Set<THREE.Object3D>();
    for (const h of [0.4, 1.0, 1.5]) {
      const target = new THREE.Vector3(player.position.x, h, player.position.y);
      const dir = target.clone().sub(cam);
      const far = dir.length() - 0.4;
      this.raycaster.set(cam, dir.normalize());
      this.raycaster.far = far;
      for (const hit of this.raycaster.intersectObjects(this.location.tappables, true)) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.placeId) o = o.parent;
        if (o) occluders.add(o);
      }
    }
    this.raycaster.far = Infinity;
    for (const o of [...this.faded]) if (!occluders.has(o)) this.setFaded(o, false);
    for (const o of occluders) if (!this.faded.has(o)) this.setFaded(o, true);
  }

  private setFaded(group: THREE.Object3D, fade: boolean): void {
    if (fade) this.faded.add(group);
    else this.faded.delete(group);
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (fade) {
        const orig = mesh.material as THREE.Material;
        mesh.userData.orig = orig;
        let f = this.fadedMats.get(orig);
        if (!f) {
          f = orig.clone();
          f.transparent = true;
          f.opacity = 0.18;
          f.depthWrite = false;
          this.fadedMats.set(orig, f);
        }
        mesh.material = f;
        mesh.castShadow = false;
      } else if (mesh.userData.orig) {
        mesh.material = mesh.userData.orig;
        mesh.castShadow = true;
      }
    });
  }
}
