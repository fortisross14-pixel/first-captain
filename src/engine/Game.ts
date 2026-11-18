import * as THREE from 'three';
import { Npc } from '../actors/Npc';
import { Player } from '../actors/Player';
import { createCharacter, type Look, type Rig } from '../actors/characterModel';
import { GRADE_INFO, JOBS, autopilotGrade, dayIndex, gradeFor, minuteOfDay, weekday, type Grade } from '../game/jobs';
import { addNeed, simulateNeeds } from '../game/needs';
import { RESIDENTS, stopAt, type Resident, type Stop } from '../game/residents';
import { RECIPES, cookMult, ingredients, missing as recipeMissing } from '../game/food';
import { LESSON_XP, MENTORS, PERKS, hasPerk, nextPerk, perkAt } from '../game/skills';

const PERKS_OWNED = (s: GameState) => PERKS.filter((p) => s.character.skills[p.skill] >= p.level);
import { HOLIDAYS, MOOD_PAY, MOOD_TEXT, WEATHER_TEXT, bossMood, holidayOn, isSunday, rollWeather, strikeStarts } from '../game/calendar';
import { FUTURE_OFFICES, OFFICES, count as countVotes, officeTitle, pledgeChance, voters } from '../game/parish';
import { ASKS, LOST_ZONES, PLACE_NAMES, READ_LETTERS, type Quest } from '../game/quests';
import { ACTIVITY_TEXT, AMBIENT, CONFUSED_LINES, SICK_LINES, conversation } from '../game/talk';
import { EVICTION_DAY, FUNERAL_DAY, Life, VANE_DONE, VANE_START } from './Life';
import {
  DAILY_LIMIT, INTERACTIONS, interact, knownTraits, newRelation, relationLabel, type Interaction, type Relation,
} from '../game/social';
import { HOT_ZONES, NOTORIOUS, ZONES, dangerAt, zoneAt } from '../game/danger';
import { CHAMPION_TITLE, FIGHT_NIGHT, LADDER, type Bout } from '../game/fightnight';
import { CONGRATS, HESTER_LETTERS, gazette, sendLetter } from '../game/letters';
import { CIRCLES, addFact, knowledgeOf, reactions, spreadGossip, type FactKind, type Pending } from '../game/world';
import { OUTFIT_NAMES, SLOT_NAMES, gear, isFood, type Outfit, type Slot, ITEMS, SHOPS, addItem, buy, canCarry, owns, removeItem, sell, sellPrice, slots, usedSlots, useItem } from '../game/items';
import { SHOP_KEEPERS, VOICES } from '../game/voices';
import {
  canStartShift, checkAttendance, completeShift, dayStart, employment, gainXp, hire, hireBlocker, leave, nextShiftText,
  promotionText, title,
} from '../game/work';
import { xpToNext } from '../game/jobs';
import { playBar } from '../minigames/bar';
import { ENEMIES, runFight, type Enemy } from '../minigames/fight';
import { playCargo } from '../minigames/cargo';
import { NEED_NAMES, SKILLS, SKILL_INFO, loadGame, newGame, saveGame, type Character, type GameState, type LocationId, type NeedId } from '../game/state';
import { Creator } from '../ui/Creator';
import { Dialogue, type Line } from '../ui/Dialogue';
import { Hud, type Action, type ListRow, type PieItem } from '../ui/Hud';
import { Title } from '../ui/Title';
import { buildHesterRoom } from '../world/hesterRoom';
import type { Location, Place } from '../world/location';
import { buildSaltwharf } from '../world/saltwharf';
import { makeDoorIcon } from '../world/doorIcon';
import { Portraits } from '../ui/Portraits';
import { CameraRig } from './CameraRig';
import { Clock } from './Clock';
import { Input } from './Input';
import { Sound } from './Sound';
import { sfx } from './sfx';

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
  private stalker: { walker: Player; t: number; retarget: number } | null = null;
  private readonly tully: Player;
  private dangerTimer = 0;
  private readonly life: Life;
  private readonly portraits: Portraits;
  private readonly doorIcons: { sprite: THREE.Sprite; y: number }[] = [];
  private ambientTimer = 4;
  private chatTimer = 12;
  private chat: { a: Npc; b: Npc; lines: [string, string][]; i: number; t: number; spread: import('../game/world').Fact | null } | null = null;
  private askTimer = 20;
  private headline: string | null = null;
  private headlineDay = -1;
  private asking: { npc: Npc; t: number; retarget: number } | null = null;
  private readonly sound = new Sound();
  private readonly quality: 'high' | 'low';

  private readonly preview = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(30, 1, 0.1, 50), rig: null as Rig | null };

  private markerLife = 0;
  private rentPaid = false;
  private prevSkills: Record<string, number> | null = null;
  private goalsTimer = 0;
  private occlusionTimer = 0;
  private lastSaveMinute = 0;
  private last = performance.now();
  private elapsed = 0;

  constructor(private readonly container: HTMLElement) {
    // Graphics quality: saved choice, otherwise low on modest phones.
    let savedQuality: string | null = null;
    try {
      savedQuality = localStorage.getItem('pale-lamps-quality');
    } catch {
      /* storage unavailable */
    }
    const nav = navigator as Navigator & { deviceMemory?: number };
    const modest = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 3;
    this.quality = savedQuality === 'high' || savedQuality === 'low' ? savedQuality : modest ? 'low' : 'high';
    const low = this.quality === 'low';
    this.renderer = new THREE.WebGLRenderer({ antialias: !low && window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1 : 2));
    this.renderer.shadowMap.enabled = !low;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    // Drifting fog and a vignette over the world: cheap, compositor-only layers.
    container.insertAdjacentHTML('beforeend', '<div class="atmo" aria-hidden="true"><i class="fog f1"></i><i class="fog f2"></i><div class="vignette"></div></div>');

    this.locations = { saltwharf: buildSaltwharf(), hesterRoom: buildHesterRoom() };
    this.location = this.locations.saltwharf;
    for (const r of RESIDENTS) {
      const npc = new Npc(r, this.locations.saltwharf.grid);
      this.locations.saltwharf.scene.add(npc.walker.rig.root);
      this.npcs.push(npc);
    }
    this.life = new Life(this.locations.saltwharf.scene, this.locations.saltwharf.grid, {
      bubble: (x, z, name, text) => this.bubbleAt(x, z, name, text),
      bell: (n) => {
        if (this.location.id !== 'saltwharf' || this.mode !== 'play') return;
        for (let i = 0; i < Math.min(n, 12); i++) setTimeout(() => sfx('bell'), i * 1600);
      },
    }, this.locations.saltwharf.lamps ?? []);
    this.tully = new Player(this.locations.saltwharf.grid, { skin: 0xb08a6a, hair: 0x15110e, coat: 0x1e1a18, trousers: 0x1a1614, shirt: 0x5a2a22, boots: 0x0e0c0a, hat: 'cap', hatColor: 0x121010, build: 1.25 }, NOTORIOUS.where.x + 0.5, NOTORIOUS.where.z + 0.5);
    this.tully.rig.root.visible = false;
    this.tully.rig.root.userData.tully = true;
    this.locations.saltwharf.scene.add(this.tully.rig.root);
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
    const soundLabel = () => `Sound: ${this.sound.enabled ? 'on' : 'off'}`;
    const qualityLabel = (q: string) => `Graphics: ${q}`;
    this.hud.setSettingLabels(soundLabel(), qualityLabel(this.quality));
    this.hud.onSound = () => {
      this.sound.toggle();
      return soundLabel();
    };
    this.hud.onQuality = () => {
      const next = this.quality === 'high' ? 'low' : 'high';
      try {
        localStorage.setItem('pale-lamps-quality', next);
      } catch {
        /* storage unavailable */
      }
      this.hud.toast('Graphics change applies after you reload the page.');
      return `${qualityLabel(next)} (after reload)`;
    };
    this.dialogue = new Dialogue(container);
    this.portraits = new Portraits(this.renderer);
    this.dialogue.portraitFor = (name) => this.portraitOf(name);
    // Ways in and out are marked: the stairs down from Hester's room, and her door from the street.
    const icon = (loc: Location, kind: 'exit' | 'home', x: number, y: number, z: number) => {
      const sp = makeDoorIcon(kind);
      sp.position.set(x, y, z);
      loc.scene.add(sp);
      this.doorIcons.push({ sprite: sp, y });
    };
    icon(this.locations.hesterRoom, 'exit', 0.45, 1.55, 1.5);
    icon(this.locations.saltwharf, 'home', 11.5, 2.7, 8.95);
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
    this.prevSkills = null;
    this.clock.minutes = s.minutes;
    this.lastSaveMinute = s.minutes;
    this.player?.rig.root.removeFromParent();
    this.player = new Player(this.locations[s.location].grid, s.character.look, s.pos.x, s.pos.z);
    this.enterLocation(s.location, s.pos.x, s.pos.z, s.pos.x + 1, s.pos.z - 1);
    this.mode = 'play';
    this.applyUpgrades();
    this.applyFurniture();
    this.locations.saltwharf.setWeather?.(s.weather);
    this.refreshLook();
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
    if (id === 'hesterRoom') await this.pembletonOnFurniture();
    this.save();
  }

  // --- Input ----------------------------------------------------------------

  private tap(clientX: number, clientY: number): void {
    if (this.mode !== 'play' || this.busy || this.dialogue.open || this.hud.blocking || !this.player) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.rig.camera);

    for (const n of this.npcs) n.held = false;
    if (this.location.id === 'saltwharf' && this.tully.rig.root.visible && this.raycaster.intersectObject(this.tully.rig.root, true).length) {
      this.player.walkTo(this.tully.cell);
      return;
    }
    if (this.location.id === 'saltwharf') {
      const tag = this.life.pick(this.raycaster);
      if (tag) {
        this.hud.hidePlace();
        void this.lifeTapped(tag);
        return;
      }
    }
    if (this.location.id === 'saltwharf') {
      // People are small on a phone: a tap within about a tile of someone picks them.
      const ground = new THREE.Vector3();
      const visible = this.npcs.filter((n) => n.visible);
      let npc: Npc | undefined;
      const nh = this.raycaster.intersectObjects(visible.map((n) => n.walker.rig.root), true)[0];
      if (nh) {
        let o: THREE.Object3D | null = nh.object;
        while (o && !o.userData.npcId) o = o.parent;
        npc = visible.find((n) => n.res.id === o?.userData.npcId);
      }
      if (!npc && this.raycaster.ray.intersectPlane(this.groundPlane, ground)) {
        let best = 1.0;
        for (const n of visible) {
          const d = Math.hypot(n.walker.position.x - ground.x, n.walker.position.y - (ground.z - 0.4));
          if (d < best) {
            best = d;
            npc = n;
          }
        }
      }
      if (npc) {
        this.approach(npc);
        return;
      }
      // Lost things are tiny: a tap near the glint picks it up.
      if (this.raycaster.ray.intersectPlane(this.groundPlane, ground)) {
        const q = this.state!.quests.find((x) => x.kind === 'lost' && !x.found && x.at && Math.hypot(x.at.x + 0.5 - ground.x, x.at.z + 0.5 - ground.z) < 1.0);
        if (q) {
          this.pickUpLost(q.id);
          return;
        }
      }
    }
    const solid = this.location.tappables.filter((o) => !this.faded.has(o) && o.visible);
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
    this.hud.hidePlace();
    if (!cell) {
      this.hud.toast("You can't get there.", 1400);
      return;
    }
    if (this.player.walkTo(cell)) this.showMarker(cell.x + 0.5, cell.z + 0.5);
    else this.hud.toast("You can't find a way there.", 1400);
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
            s.housed
              ? act('Go up to your room', () => this.goTo('hesterRoom', 'door'), { primary: true })
              : act(`Locked out. Pay Grubb £${s.rent.arrears.toFixed(2)}`, () => this.reclaimRoom(), { primary: true, disabled: s.money < s.rent.arrears }),
            act("Browse Pell's Chandlery", () => this.openShop('hester')),
          ];
        case 'tenements':
          return [act('Sleep rough in the archway', () => this.sleep('rough'), { primary: !s.housed })];
        case 'dockoffice': {
          const day = dayIndex(s.minutes);
          const st = s.strike;
          if (st && day >= st.day && day <= st.until) {
            const e = employment(s, 'docks');
            return [
              act(st.side === 'picket' && this.usedToday('picket') ? 'On the picket line (tomorrow again)' : 'Join the picket (2 hours)', () => this.picket(), { primary: true, disabled: this.usedToday('picket') }),
              ...(e ? [act('Cross the picket and work (double pay)', () => this.workShift('docks', true), { disabled: !canStartShift(s, 'docks') })] : []),
            ];
          }
          return this.jobActions('docks', act);
        }
        case 'coppercup': {
          const free = this.friend('bessa') && !this.usedToday('bessa');
          return [
            ...this.jobActions('coppercup', act),
            act(free ? 'Free pint from Bessa' : 'Buy a drink · £0.02', () => this.tavernDrink(), { disabled: !free && s.money < 0.02 }),
            act(holidayOn(dayIndex(s.minutes))?.id === 'martinmas' && !this.usedToday('goose') ? 'Martinmas goose, on the house' : 'Supper at a crowded table · £0.05', () => this.tavernSupper(), { disabled: s.money < 0.05 && !(holidayOn(dayIndex(s.minutes))?.id === 'martinmas' && !this.usedToday('goose')) }),
          ];
        }
        case 'clothier': {
          const fee = this.friend('lizzie') ? 0 : 0.05;
          return [
            act('Browse the rails', () => this.openShop('clothier'), { primary: true }),
            act(s.wear[s.outfit] >= 100 ? 'Your clothes are in good repair' : `Have Lizzie mend what you're wearing (${this.condition()}) · ${fee ? `£${fee.toFixed(2)}` : 'free'}`, () => this.mend(true), { disabled: s.wear[s.outfit] >= 100 || s.money + 1e-9 < fee }),
          ];
        }
        case 'boxing': {
          const open = this.fightNightOpen();
          const b = this.nextBout();
          return [
            act(open ? `Fight Night: ${b.enemy.name} · purse £${b.purse.toFixed(2)}` : 'Fight Night: Saturdays 20:00–23:00', () => this.fightNight(), { primary: open, disabled: !open || s.money < FIGHT_NIGHT.entry }),
            act('Train on the bag (1 hour)', () => this.train(), { primary: !open }),
          ];
        }
        case 'warehouse':
          return [act('Sit on the loading step (rest 1 hour)', () => this.restOnStep())];
        case 'market':
          return [
            act('Browse the stalls', () => this.openShop('market'), { primary: true }),
            act('The Gazette · £0.01', () => this.readGazette(), { disabled: s.money < 0.01 }),
            ...(s.parish.standing !== null ? [act(this.usedToday('speech') ? 'You spoke today; speak again tomorrow' : 'Climb on a crate and speak to the crowd (1 hour)', () => this.speech(), { disabled: this.usedToday('speech') })] : []),
          ];
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
      case 'stove': {
        const ready = RECIPES.filter((r) => !recipeMissing(s, r)).length;
        return [act(ready ? `Cook (${ready} recipe${ready === 1 ? '' : 's'} you can make)` : 'Cook (see recipes)', () => this.cook(), { primary: true })];
      }
      case 'table': {
        const night = this.clock.hour >= 18 || this.clock.hour < 7;
        const candle = s.inventory.some((i) => i.id === 'candle' || i.id === 'candle2');
        return [act(night ? (candle ? 'Read by candlelight (1 hour)' : 'Read (needs a candle after dark)') : 'Read by the window (1 hour)', () => this.read(), { primary: true, disabled: night && !candle })];
      }
      case 'bookshelf':
        return [act('Read from the shelf (1 hour)', () => this.read(true), { primary: true, disabled: (this.clock.hour >= 18 || this.clock.hour < 7) && !s.inventory.some((i) => i.id === 'candle' || i.id === 'candle2') })];
      case 'mirror':
        return [act(this.usedToday('mirror') ? 'Tidied for today' : 'Tidy yourself in the glass', () => { this.markUsed('mirror'); this.hud.toast('Hair flattened, collar straightened. You look like someone people might trust.'); }, { primary: true, disabled: this.usedToday('mirror') })];
      case 'workbench':
        return [act('Carve a trinket (1 hour)', () => this.carve(), { primary: true, disabled: s.needs.rest < 10 })];
      case 'cat':
        return [act(this.usedToday('cat') ? 'She has had enough of you today' : 'Stroke the cat', () => { this.markUsed('cat'); addNeed(s.needs, 'social', 6); this.hud.toast('She purrs like a kettle, then bites you, gently. Social +6.'); }, { primary: true, disabled: this.usedToday('cat') })];
      case 'basin':
        return [
          act('Wash your face', () => this.hud.toast('Cold water and carbolic. You feel almost respectable.')),
          act('Change clothes', () => this.chooseOutfit(), { primary: true }),
          ...(hasPerk(s, 'arts', 6) && s.wear[s.outfit] < 100 ? [act(`Mend your clothes (${this.condition()}, 1 hour)`, () => this.mend(false))] : []),
        ];
      case 'trunk':
        return [act('Try the lid', () => this.dialogue.say(
          { speaker: 'You', text: 'The lid will not move. The lock is old, but well made.' },
          { speaker: P, text: 'Leave that be. Not yet.' },
        ))];
      case 'door': {
        const unread = s.letters.filter((l) => !l.read).length;
        return [
          act('Go down to Quay Street', () => this.goTo('saltwharf', 'hester'), { primary: true }),
          act(unread ? `Read letters (${unread} new)` : 'Letters', () => this.openLetters(), { primary: unread > 0 }),
        ];
      }
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
    const free = this.friend('bessa') && !this.usedToday('bessa');
    if (!free && s.money < 0.02) return;
    if (free) this.markUsed('bessa');
    else s.money = Math.round((s.money - 0.02) * 100) / 100;
    addNeed(s.needs, 'social', 15);
    addNeed(s.needs, 'rest', -3);
    this.hud.toast(free ? 'Bessa slides a pint across: "On the house, love." Social +15.' : 'A pint of thin ale and somebody else\'s story. Social +15.');
  }

  private tavernSupper(): void {
    const s = this.state!;
    if (holidayOn(dayIndex(s.minutes))?.id === 'martinmas' && !this.usedToday('goose')) {
      this.markUsed('goose');
      addNeed(s.needs, 'hunger', 60);
      addNeed(s.needs, 'social', 18);
      this.hud.toast('Bessa carves the Martinmas goose with a cleaver and a speech. Hunger +60, Social +18.', 4000);
      return;
    }
    if (s.money < 0.05) return;
    s.money = Math.round((s.money - 0.05) * 100) / 100;
    addNeed(s.needs, 'hunger', 35);
    addNeed(s.needs, 'social', 10);
    sfx('coin');
    this.hud.toast('Pease pudding at a crowded table. Hunger +35, Social +10.');
  }

  // --- Relationship perks ---------------------------------------------------

  private friend(id: string): boolean {
    return (this.state!.relations?.[id]?.friendship ?? 0) >= 30;
  }

  private rival(id: string): boolean {
    return (this.state!.relations?.[id]?.rivalry ?? 0) >= 25;
  }

  private usedToday(key: string): boolean {
    return this.state!.used[key] === dayIndex(this.state!.minutes);
  }

  private markUsed(key: string): void {
    this.state!.used[key] = dayIndex(this.state!.minutes);
  }

  /** Shop price after the shopkeeper's friendship (−20%) or rivalry (+30%). */
  private priceAt(shopId: string, itemId: string): number {
    const keeper = SHOP_KEEPERS[shopId];
    let p = ITEMS[itemId].price;
    if (keeper && this.friend(keeper)) p *= 0.8;
    if (keeper && this.rival(keeper)) p *= 1.3;
    if (hasPerk(this.state!, 'charisma', 3)) p *= 0.95;
    return Math.max(0.01, Math.round(p * 100) / 100);
  }

  // --- Shops and the bag ----------------------------------------------------

  private openShop(id: string): void {
    const shop = SHOPS[id];
    const s = this.state!;
    const keeper = SHOP_KEEPERS[id];
    const render = () => {
      const rows: ListRow[] = [];
      for (const itemId of shop.stock) {
        const def = ITEMS[itemId];
        const price = this.priceAt(id, itemId);
        const owned = def.upgrade && owns(s, itemId);
        rows.push({
          label: `${def.name} · ${owned ? 'owned' : `£${price.toFixed(2)}`}`,
          sub: def.blurb,
          actions: owned ? [] : [
            ...(def.use && def.verb === 'Eat' ? [{
              label: 'Buy & eat',
              disabled: s.money + 1e-9 < price,
              onClick: () => {
                s.money = Math.round((s.money - price) * 100) / 100;
                for (const [k, v] of Object.entries(def.use!)) addNeed(s.needs, k as NeedId, v);
                sfx('coin');
                this.hud.toast(`You eat the ${def.name.toLowerCase()} standing up, like everyone else here.`);
                render();
              },
            }] : []),
            {
              label: 'Buy',
              disabled: s.money + 1e-9 < price || (!def.upgrade && !canCarry(s, itemId)),
              onClick: () => {
                const r = buy(s, itemId, price);
                if (r === 'ok') {
                  sfx('coin');
                  if (def.upgrade) this.applyUpgrades();
                  if (def.upgrade) {
                    this.applyFurniture();
                    if (def.outfit) this.dress(def.outfit);
                    else if (def.slot) {
                      s.equip[def.slot as Exclude<Slot, 'clothes'>] = itemId;
                      this.refreshLook();
                    }
                    this.hud.closeList();
                    void this.hud.celebrate('goal', 'Yours now', def.name, def.blurb);
                  }
                }
                if (r === 'full') this.hud.toast('Your bag is full.');
                this.refreshObjectives();
                render();
              },
            },
          ],
        });
      }
      if (shop.buys > 0) {
        const rate = this.friend('moss') ? 0.6 : this.rival('moss') ? 0.3 : shop.buys;
        for (const it of s.inventory) {
          const def = ITEMS[it.id];
          rows.push({
            label: `${def.name} ×${it.qty}`,
            sub: `Moss offers £${sellPrice(shop, it.id, rate * (it.id === 'trinket' && hasPerk(s, 'arts', 10) ? 2 : 1)).toFixed(2)}`,
            actions: [{ label: 'Sell', onClick: () => { sell(s, shop, it.id, rate * (it.id === 'trinket' && hasPerk(s, 'arts', 10) ? 2 : 1)); sfx('coin'); render(); } }],
          });
        }
        if (s.inventory.length === 0) rows.push({ label: 'You have nothing Moss wants.', sub: '', actions: [] });
      }
      const note = keeper && this.friend(keeper) ? ' · friend\'s prices' : keeper && this.rival(keeper) ? ' · rival\'s prices' : '';
      this.hud.showList(shop.name, `£${s.money.toFixed(2)} · bag ${usedSlots(s)} / ${slots(s)}${note}`, rows);
    };
    render();
  }

  /** Effects of upgrades that live outside the rules: walking speed. */
  private applyUpgrades(): void {
    if (this.player && this.state) this.player.speedMult = owns(this.state, 'boots') ? 1.25 : 1;
  }

  /** Cook at the stove: recipes from what's in your bag, better with Arts & Crafts. */
  private cook(): void {
    const s = this.state!;
    const render = () => {
      const rows: ListRow[] = RECIPES.map((r) => {
        const why = recipeMissing(s, r);
        const fx = Object.entries(r.effects).map(([k, v]) => `${NEED_NAMES[k as NeedId]} +${Math.round(v! * cookMult(s))}`).join(', ');
        return {
          label: r.name,
          sub: `${r.blurb}\n${r.needs.map((n) => n.replace('|', ' or ')).join(' + ')} + coal${r.arts ? ` · Arts ${r.arts}` : ''}${fx ? ` · ${fx}` : ''}`,
          actions: [{
            label: why ? why[0].toUpperCase() + why.slice(1) : 'Cook',
            disabled: !!why || (!!r.dish && !canCarry(s, r.dish)),
            onClick: () => {
              for (const id of ingredients(s, r)) removeItem(s, id);
              for (const [k, v] of Object.entries(r.effects)) addNeed(s.needs, k as NeedId, Math.round(v! * cookMult(s)));
              if (r.dish) addItem(s, r.dish);
              this.clock.minutes += 30;
              const ups = gainXp(s, 'arts', 8);
              sfx('pour');
              this.hud.closeList();
              this.hud.toast([r.eat, fx, ...ups].filter(Boolean).join(' '), 4000);
            },
          }],
        };
      });
      this.hud.showList('Hester\'s stove', `Recipes · Arts & Crafts ${s.character.skills.arts}: food goes ${Math.round((cookMult(s) - 1) * 100)}% further · onions, eels and mutton at the market`, rows);
    };
    render();
  }

  /** Read at the table: Study practice. By the window in daylight, by candle at night. */
  private carve(): void {
    const s = this.state!;
    simulateNeeds(s.needs, 1, 'awake');
    addNeed(s.needs, 'rest', -4);
    this.clock.minutes += 60;
    s.minutes = this.clock.minutes;
    const ups = gainXp(s, 'arts', 16);
    if (canCarry(s, 'trinket')) addItem(s, 'trinket');
    this.hud.toast(`An hour with the gouge: a little ship from river driftwood. Arts & Crafts practice.${ups.length ? ` ${ups.join(' ')}` : ''}`, 3500);
  }

  private read(shelf = false): void {
    const s = this.state!;
    const hour = this.clock.hour;
    const night = hour >= 18 || hour < 7;
    if (night) {
      const c = s.inventory.find((i) => i.id === 'candle') ?? s.inventory.find((i) => i.id === 'candle2');
      if (!c) return;
      if (c.id === 'candle2' && !this.usedToday('wax-half')) this.markUsed('wax-half');
      else removeItem(s, c.id);
    }
    simulateNeeds(s.needs, 1, 'awake');
    addNeed(s.needs, 'rest', -3);
    this.clock.minutes += 60;
    s.minutes = this.clock.minutes;
    const ups = gainXp(s, 'study', Math.round((night ? 18 : 12) * (shelf || owns(s, 'bookshelf') ? 1.5 : 1) * (hasPerk(s, 'study', 6) ? 1.25 : 1)));
    this.hud.toast(`An hour with Hester's books. Study practice.${ups.length ? ` ${ups.join(' ')}` : ''}`, 3500);
  }

  private restOnStep(): void {
    const s = this.state!;
    simulateNeeds(s.needs, 1, 'roughSleep');
    this.clock.minutes += 60;
    s.minutes = this.clock.minutes;
    this.hud.toast('You sit on Bellamy\'s step and watch the river go by for an hour.');
  }

  /** The boxing yard: an hour on the bag. */
  private train(): void {
    const s = this.state!;
    if (s.needs.rest < 15) {
      this.hud.toast('You are too tired to train.');
      return;
    }
    simulateNeeds(s.needs, 1, 'awake');
    addNeed(s.needs, 'rest', hasPerk(s, 'strength', 3) ? -6 : -10);
    addNeed(s.needs, 'hunger', -5);
    this.clock.minutes += 60;
    s.minutes = this.clock.minutes;
    const ups = gainXp(s, 'strength', 15);
    sfx('hit');
    this.hud.toast(`An hour on the bag. Strength practice.${ups.length ? ` ${ups.join(' ')}` : ''}`, 3500);
  }

  private bagTab = 0;

  /** The bag: what you wear, what you eat, and everything else. */
  private openBag(tab = this.bagTab): void {
    const s = this.state!;
    this.bagTab = tab;
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    const again = () => this.openBag(this.bagTab);
    const tabs = { labels: ['Equipment', 'Food', 'Other'], active: tab, onTab: (i: number) => this.openBag(i) };
    const sub = `${usedSlots(s)} / ${slots(s)} slots · Strength adds room`;
    const itemRow = (it: { id: string; qty: number }): ListRow => {
      const def = ITEMS[it.id];
      const actions: Action[] = [];
      if (def.use) actions.push({ label: def.verb ?? 'Use', onClick: () => { const m = useItem(s, it.id); if (m) this.hud.toast(m); again(); } });
      actions.push({ label: 'Drop', onClick: () => { removeItem(s, it.id); again(); } });
      const fx = def.use ? Object.entries(def.use).map(([k, v]) => `${NEED_NAMES[k as NeedId]} +${v}`).join(', ') : '';
      return { label: `${def.name} ×${it.qty}`, sub: [def.blurb, fx].filter(Boolean).join(' · '), actions };
    };
    if (tab === 0) {
      const worn = (sl: Slot) => (sl === 'clothes' ? OUTFIT_NAMES[s.outfit] : s.equip[sl as Exclude<Slot, 'clothes'>] ? ITEMS[s.equip[sl as Exclude<Slot, 'clothes'>]!].name : '');
      const cell = (sl: Slot) => `<div class="slot${worn(sl) ? '' : ' empty'}"><span>${SLOT_NAMES[sl]}</span><b>${esc(worn(sl) || 'empty')}</b></div>`;
      const top = `<div class="doll"><div class="col">${cell('hat')}${cell('cloak')}${cell('clothes')}</div>
        <div class="fig" aria-hidden="true"><svg viewBox="0 0 60 140"><circle cx="30" cy="20" r="11"/><path d="M12 40 Q30 32 48 40 L52 96 H8 Z"/><path d="M8 44 L2 84 M52 44 L58 84" stroke-width="6" stroke-linecap="round"/><path d="M18 96 L16 136 M42 96 L44 136" stroke-width="8" stroke-linecap="round"/></svg></div>
        <div class="col">${cell('neck')}${cell('wrist')}${cell('weapon')}</div></div>`;
      const rows: ListRow[] = [];
      const outfits: Outfit[] = ['plain', ...(['work', 'sunday', 'coat'] as Outfit[]).filter((o) => owns(s, o))];
      for (const o of outfits) {
        rows.push({
          label: `${OUTFIT_NAMES[o]}${s.outfit === o ? ' · wearing' : ''}`,
          sub: `Clothes · ${this.condition(o)}${o === 'plain' ? ' · what you arrived in' : ` · ${ITEMS[o].blurb}`}`,
          actions: s.outfit === o ? [] : [{ label: 'Wear', onClick: () => { this.dress(o); again(); } }],
        });
      }
      for (const id of s.owned.filter((x) => ITEMS[x]?.slot && ITEMS[x].slot !== 'clothes')) {
        const def = ITEMS[id];
        const sl = def.slot as Exclude<Slot, 'clothes'>;
        const on = s.equip[sl] === id;
        rows.push({
          label: `${def.name}${on ? ' · wearing' : ''}`,
          sub: `${SLOT_NAMES[sl]} · ${def.blurb}`,
          actions: [{ label: on ? 'Take off' : 'Wear', onClick: () => { if (on) delete s.equip[sl]; else s.equip[sl] = id; this.refreshLook(); sfx('flip'); again(); } }],
        });
      }
      if (rows.length <= 1) rows.push({ label: 'Nothing else to wear yet.', sub: 'Hats and cloaks at Rag & Bone; weapons, lockets and medals at Moss the Pawnbroker.', actions: [] });
      this.hud.showList('Bag', sub, rows, tabs, top);
      return;
    }
    if (tab === 1) {
      const rows = s.inventory.filter((i) => isFood(i.id)).map(itemRow);
      if (!rows.length) rows.push({ label: 'No food.', sub: 'The market sells bread, potatoes, pies, and onions, eels and mutton for the stove.', actions: [] });
      this.hud.showList('Bag', sub, rows, tabs);
      return;
    }
    const rows = s.inventory.filter((i) => !isFood(i.id)).map(itemRow);
    for (const q of s.quests.filter((x) => x.kind === 'lost' && x.found)) {
      rows.unshift({ label: q.thing!.replace(/^(his|her|my|the) /, (m) => (m === 'the ' ? 'The ' : `${this.short(q.who)}'s `)), sub: `Mission · return it to ${this.short(q.who)}`, actions: [] });
    }
    if (!rows.length) rows.push({ label: 'Nothing else.', sub: 'Bandages and tonics at Pell\'s Chandlery; penny dreadfuls at the market.', actions: [] });
    this.hud.showList('Bag', sub, rows, tabs);
  }

  // --- Work -----------------------------------------------------------------

  private jobActions(jobId: string, act: (label: string, fn: () => void | Promise<void>, opts?: Partial<Action>) => Action): Action[] {
    const s = this.state!;
    const e = employment(s, jobId);
    if (!e) return [act('Ask about work', () => this.askForWork(jobId), { primary: true })];
    const open = canStartShift(s, jobId);
    return [
      act(`Work your shift as ${title(s, e)}`, () => this.workShift(jobId, true), { primary: true, disabled: !open }),
      act(e.lastGrade ? `Autopilot (${GRADE_INFO[autopilotGrade(e.lastGrade)].name} pay, no points)` : 'Autopilot (play one shift first)',
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
        // Dock gloves and the barman's apron count as three extra skill points in their minigame.
        main: s.character.skills[job.main] + ((job.id === 'docks' && owns(s, 'gloves')) || (job.id === 'coppercup' && owns(s, 'apron')) ? 3 : 0) + (job.id === 'docks' && s.outfit === 'work' ? 1 : 0),
        second: s.character.skills[job.second],
        // Testing aid: ?mgseconds=8 shortens minigames.
        seconds: Number(new URLSearchParams(location.search).get('mgseconds')) || undefined,
      };
      const r = await (job.minigame === 'bar' ? playBar : playCargo)(this.container, params);
      grade = gradeFor(r.percent);
      lines = r.lines;
    } else {
      grade = autopilotGrade(e.lastGrade!);
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
    sfx('coin');
    const extras: string[] = [];
    // The boss's temper, a strike, a raise won, the weather, and wear on your clothes.
    const st = s.strike;
    const scab = jobId === 'docks' && !!st && shiftDay >= st.day && shiftDay <= st.until;
    const mood = bossMood(jobId, shiftDay, s);
    let bonus = rep.pay * (MOOD_PAY[mood] - 1) + (jobId === 'docks' ? rep.pay * s.dockRaise : 0) + (scab ? rep.pay : 0);
    bonus = Math.round(bonus * 100) / 100;
    if (bonus !== 0 && !rep.fired) {
      s.money = Math.round((s.money + bonus) * 100) / 100;
      if (scab) extras.push(`Strike-breaker's rate: +£${rep.pay.toFixed(2)}`);
      if (mood !== 'fair') extras.push(`${JOBS[jobId].boss.split(' ').pop()}'s ${mood === 'good' ? 'good humour' : 'foul temper'}: ${mood === 'good' ? '+' : '−'}£${Math.abs(Math.round(rep.pay * (MOOD_PAY[mood] - 1) * 100) / 100).toFixed(2)}`);
      if (jobId === 'docks' && s.dockRaise) extras.push(`The raise the strike won: +£${(Math.round(rep.pay * s.dockRaise * 100) / 100).toFixed(2)}`);
    }
    if (scab && st) {
      st.side = 'scab';
      addFact(s, 'scab', ['nell', 'tom', 'hannah', 'rudd']);
      for (const id of ['nell', 'tom', 'hannah']) {
        const r = this.rel(id);
        r.friendship = Math.max(0, r.friendship - 10);
        r.rivalry = Math.min(100, r.rivalry + 12);
      }
      extras.push('The pickets spat as you passed. Nell, Tom and Hannah will not forget it.');
    }
    this.wearOut(jobId === 'docks' ? 7 : 4);
    if (s.weather === 'rain' && jobId === 'docks' && !hasPerk(s, 'strength', 10)) {
      addNeed(s.needs, 'health', -4);
      extras.push('Soaked to the skin on the quay: Health −4');
    }
    if (jobId === 'docks' && !rep.fired && this.friend('rudd')) {
      s.money = Math.round((s.money + 0.02) * 100) / 100;
      extras.push('Rudd slips you a tip: £0.02');
    }
    if (jobId === 'docks' && play && !rep.fired && !rep.promotedTo && this.friend('tom')) {
      const e2 = employment(s, 'docks');
      if (e2) {
        e2.points += 1;
        extras.push('Tom showed you a trick: +1 point');
      }
    }
    await this.hud.fade(false);
    const report = [
      ...(play ? lines : ['You kept your head down and did the same as last time.']),
      `Grade: ${GRADE_INFO[grade].name}`,
      `Pay: £${rep.pay.toFixed(2)}`,
      `Promotion points: ${rep.points >= 0 ? '+' : ''}${rep.points}`,
      ...extras,
      ...rep.levelUps,
    ];
    await this.hud.modal(`Shift over · ${rankBefore}`, report.filter((l) => !l.startsWith('Grade:')), GRADE_INFO[grade].name);
    if (rep.promotedTo) {
      addFact(s, 'promoted', jobId === 'docks' ? ['rudd', 'tom', 'nell'] : ['bessa', 'jem'], undefined, rep.promotedTo);
      const e2 = employment(s, jobId);
      await this.hud.celebrate('promotion', 'Promoted', rep.promotedTo, `${job.career}: £${e2 ? job.ranks[e2.rank].pay.toFixed(2) : '?'} a shift`);
      await this.dialogue.say({ speaker: job.boss, text: job.lines.promoted.replace('{rank}', rep.promotedTo) });
    }
    if (rep.fired) await this.dialogue.say({ speaker: job.boss, text: job.lines.fired });
    this.busy = false;
    this.save();
  }

  /** The dock strike: stand with the dockers. */
  private picket(): void {
    const s = this.state!;
    const st = s.strike;
    if (!st || this.usedToday('picket')) return;
    this.markUsed('picket');
    if (st.side !== 'scab') st.side = 'picket';
    simulateNeeds(s.needs, 2, 'awake');
    addNeed(s.needs, 'social', 14);
    this.clock.minutes += 120;
    s.minutes = this.clock.minutes;
    for (const id of ['nell', 'tom', 'hannah']) this.rel(id).friendship = Math.min(100, this.rel(id).friendship + 5);
    this.rel('rudd').rivalry = Math.min(100, this.rel('rudd').rivalry + 3);
    addFact(s, 'helped', ['nell', 'tom', 'hannah', 'jem'], 'nell');
    this.hud.toast('Two hours at the gate in the cold, shouting at carts. Nell shares her tea. Dockers\' friendship +5, Social +14. Rudd is writing names down.', 4500);
  }

  /** A nudge half an hour before each shift. */
  private remindShifts(): void {
    const s = this.state!;
    const day = dayIndex(s.minutes);
    const m = minuteOfDay(s.minutes);
    for (const e of s.jobs) {
      const job = JOBS[e.jobId];
      const key = `remind:${e.jobId}`;
      if (!job.days.includes(weekday(day)) || e.lastWorkedDay === day || s.used[key] === day) continue;
      if (m >= job.start - 30 && m < job.start + 30) {
        s.used[key] = day;
        sfx('coin');
        this.hud.toast(`${job.career === 'Docks' ? 'The docks' : job.career}: your shift starts at ${String(Math.floor(job.start / 60)).padStart(2, '0')}:00. Be there by ${String(Math.floor((job.start + 60) / 60) % 24).padStart(2, '0')}:00.`, 5000);
      }
    }
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
      n.follow(this.stopFor(n.res, hour), outside);
      n.update(dt, this.elapsed);
    }
    if (outside && this.mode === 'play' && !this.busy && !this.dialogue.open) {
      this.greetings();
      this.ambient(dt);
      this.updateChat(dt);
      this.updateAsking(dt);
    }
  }

  /** Has this resident moved to Saltwharf yet, and are they about (not missing)? */
  private present(r: Resident): boolean {
    const s = this.state;
    const day = dayIndex(this.clock.minutes);
    if (r.arrives && day < r.arrives) return false;
    return !s || !((s.life.missing[r.id] ?? -1) >= day);
  }

  /** Where a resident is this hour: their routine, bent by sickness, invitations, feast days, strikes and rain. */
  private stopFor(r: Resident, hour: number): Stop | null {
    const s = this.state;
    if (!s) return stopAt(r, hour);
    const day = dayIndex(s.minutes);
    if (!this.present(r)) return null;
    if ((s.life.sick[r.id] ?? -1) >= day) return hour >= 9 && hour < 18 ? { from: 0, to: 24, x: r.home.x, z: r.home.z, act: 'sick' } : null;
    const inv = s.quests.find((q) => q.kind === 'invite' && q.who === r.id && !q.done && s.minutes >= q.from! - 30 && s.minutes < q.to!);
    if (inv?.place) {
      const pl = this.locations.saltwharf.places.find((p) => p.id === inv.place);
      if (pl) return { from: 0, to: 24, x: pl.door.x + 1, z: pl.door.z, act: 'watch' };
    }
    const hol = holidayOn(day);
    if (hol?.id === 'bonfire' && hour >= 18 && hour < 23 && !['quill', 'silas'].includes(r.id)) {
      const i = RESIDENTS.indexOf(r);
      const a = (i / RESIDENTS.length) * Math.PI * 2;
      return { from: 18, to: 23, x: Math.round(15.5 + Math.cos(a) * 2.6), z: Math.round(20.5 + Math.sin(a) * 2.2), act: 'watch' };
    }
    if (isSunday(day) && hour >= 9 && hour < 11 && ['pell', 'hannah', 'tom', 'lizzie'].includes(r.id)) {
      const i = ['pell', 'hannah', 'tom', 'lizzie'].indexOf(r.id);
      return { from: 9, to: 11, x: 11 + (i % 2) * 3, z: 22 + Math.floor(i / 2), act: 'watch' };
    }
    if (s.strike && day >= s.strike.day && day <= s.strike.until && hour >= 6 && hour < 15 && ['nell', 'tom'].includes(r.id)) {
      return { from: 6, to: 15, x: r.id === 'nell' ? 25 : 27, z: 8, act: 'preach' };
    }
    const st = stopAt(r, hour);
    if (st && s.weather === 'rain' && ['grubb', 'hale', 'quill', 'ashby', 'lizzie'].includes(r.id) && st.act !== 'mend') return null;
    if (st && (s.life.confused[r.id] ?? -1) >= day) return { ...st, act: 'confused' };
    return st;
  }

  /** The face for a speaker's name, rendered from their model. */
  private portraitOf(name: string): string | null {
    const s = this.state;
    if (!s) return null;
    let look: Look | null = null;
    if (name === 'You') look = this.outfitLook(s.outfit);
    else if (name === P) look = { skin: 0xcfe6f4, hair: 0xf2f6fa, coat: 0x7a96b0, trousers: 0x6a86a0, shirt: 0xf0f4f8, boots: 0x4a5a6a, scarf: 0xffffff, hat: 'top', hatColor: 0x8aa6c0, hairStyle: 'wig', eyes: 0x6a8aaa };
    else if (name === NOTORIOUS.name) look = { skin: 0xb08a6a, hair: 0x15110e, coat: 0x1e1a18, trousers: 0x1a1614, shirt: 0x5a2a22, boots: 0x0e0c0a, hat: 'cap', hatColor: 0x121010, build: 1.25, beard: 0x15110e };
    else {
      const r = RESIDENTS.find((x) => x.name === name || this.short(x.id) === name || name.endsWith(x.name));
      if (r) look = r.look;
    }
    return look ? this.portraits.get(JSON.stringify(look), look) : null;
  }

  /** A speech bubble over a point in the street. */
  private bubbleAt(x: number, z: number, name: string, text: string): void {
    if (this.location.id !== 'saltwharf' || this.mode !== 'play') return;
    const pos = new THREE.Vector3(x, 1.8, z).project(this.rig.camera);
    if (Math.abs(pos.x) > 1.1 || Math.abs(pos.y) > 1.1) return;
    this.hud.bubble(name, text, (pos.x * 0.5 + 0.5) * window.innerWidth, (-pos.y * 0.5 + 0.5) * window.innerHeight);
  }

  private dist(n: Npc): number {
    const p = this.player!.position;
    return Math.hypot(n.walker.position.x - p.x, n.walker.position.y - p.y);
  }

  /** Street cries and muttering: what people say while they work. */
  private ambient(dt: number): void {
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 5 + Math.random() * 6;
    const near = this.npcs.filter((n) => n.idle && n.act && this.dist(n) < 8 && n !== this.chat?.a && n !== this.chat?.b);
    if (!near.length) return;
    const n = near[Math.floor(Math.random() * near.length)];
    const act = n.act!;
    const pool = act === 'sick' ? SICK_LINES : act === 'confused' ? CONFUSED_LINES : act === 'preach' && this.state!.strike ? ['Fair pay for fair work!', 'Don\'t cross the line, mate!', 'Out! Out! All out!'] : AMBIENT[n.res.id]?.[act] ?? AMBIENT[n.res.id]?.['*'];
    if (!pool?.length) return;
    const met = this.state!.relations?.[n.res.id]?.met;
    this.bubbleAt(n.walker.position.x, n.walker.position.y, met ? this.short(n.res.id) : '', pool[Math.floor(Math.random() * pool.length)]);
  }

  /** Neighbours stop and talk to each other; if you're close you overhear, and news moves. */
  private updateChat(dt: number): void {
    const s = this.state!;
    const c = this.chat;
    if (c) {
      if (c.a.held || c.b.held) {
        this.endChat();
        return;
      }
      if (c.a.walker.moving) return;
      c.t -= dt;
      if (c.t > 0) return;
      if (c.i === 0) {
        c.a.walker.faceToward({ x: c.b.walker.position.x, z: c.b.walker.position.y });
        c.b.walker.faceToward({ x: c.a.walker.position.x, z: c.a.walker.position.y });
      }
      if (c.i >= c.lines.length) {
        this.endChat();
        return;
      }
      const [who, text] = c.lines[c.i];
      const n = who === c.a.res.id ? c.a : c.b;
      this.bubbleAt(n.walker.position.x, n.walker.position.y, this.short(who), text);
      c.i++;
      c.t = 3.0;
      if (c.i === 1 && c.spread && !c.spread.knowers.includes(c.b.res.id)) {
        c.spread.knowers.push(c.b.res.id);
        if (this.dist(n) < 7) this.hud.toast(`You overhear ${this.first(c.a.res.id)} telling ${this.first(c.b.res.id)} about you.`, 3200);
      }
      return;
    }
    this.chatTimer -= dt;
    if (this.chatTimer > 0) return;
    this.chatTimer = 14 + Math.random() * 14;
    const idle = this.npcs.filter((n) => n.idle && this.dist(n) < 13 && n.act !== 'sick' && n !== this.asking?.npc);
    const pairs: [Npc, Npc][] = [];
    for (const a of idle) for (const b of idle) {
      if (a === b) continue;
      const d = Math.hypot(a.walker.position.x - b.walker.position.x, a.walker.position.y - b.walker.position.y);
      if (d < 11 && d > 0.5) pairs.push([a, b]);
    }
    if (!pairs.length) return;
    const shared = pairs.filter(([a, b]) => Object.values(CIRCLES).some((cl) => cl.includes(a.res.id) && cl.includes(b.res.id)));
    const [a, b] = (shared.length ? shared : pairs)[Math.floor(Math.random() * (shared.length || pairs.length))];
    const day = dayIndex(s.minutes);
    const fact = s.facts.filter((f) => f.knowers.includes(a.res.id) && !f.knowers.includes(b.res.id) && day - f.day <= 5).at(-1) ?? null;
    const ctx = {
      weather: s.weather,
      sick: Object.keys(s.life.sick).filter((k) => s.life.sick[k] >= day),
      missing: Object.keys(s.life.missing).filter((k) => s.life.missing[k] >= day),
      strike: !!s.strike && day >= s.strike.day && day <= s.strike.until,
      holiday: holidayOn(day)?.id ?? null,
      vane: day >= VANE_START && day < VANE_DONE + 4,
      fact,
    };
    const conv = conversation(s, a.res.id, b.res.id, s.character.first, (id) => this.nameOf(id), ctx);
    const cb = b.walker.cell;
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => ({ x: cb.x + dx, z: cb.z + dz })).find((p) => this.location.grid.isWalkable(p.x, p.z));
    if (!spot) return;
    b.visiting = true;
    b.walker.stop();
    if (!a.visit(spot, () => undefined)) {
      b.release();
      return;
    }
    this.chat = { a, b, lines: conv.lines, i: 0, t: 0.4, spread: conv.spreads };
  }

  private endChat(): void {
    const c = this.chat;
    if (!c) return;
    if (!c.a.held) c.a.release();
    if (!c.b.held) c.b.release();
    this.chat = null;
  }

  /** Now and then someone you know walks over with a favour to ask. */
  private updateAsking(dt: number): void {
    const s = this.state!;
    const p = this.player!;
    const a = this.asking;
    if (a) {
      a.t += dt;
      a.retarget -= dt;
      const d = this.dist(a.npc);
      if (a.npc.held || a.t > 25) {
        if (!a.npc.held) a.npc.release();
        this.asking = null;
        return;
      }
      if (d < 1.8 && !p.moving && !this.hud.blocking) {
        this.asking = null;
        a.npc.held = true;
        a.npc.visiting = false;
        a.npc.walker.stop();
        a.npc.walker.faceToward({ x: p.position.x, z: p.position.y });
        p.faceToward({ x: a.npc.walker.position.x, z: a.npc.walker.position.y });
        void this.request(a.npc).then(() => {
          a.npc.held = false;
          a.npc.release();
        });
        return;
      }
      if (a.retarget <= 0) {
        a.retarget = 1.5;
        const c = p.cell;
        const spot = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].map(([dx, dz]) => ({ x: c.x + dx, z: c.z + dz })).find((q) => this.location.grid.isWalkable(q.x, q.z));
        if (spot) a.npc.walker.walkTo(spot);
      }
      return;
    }
    this.askTimer -= dt * (hasPerk(s, 'charisma', 10) ? 2 : 1);
    if (this.askTimer > 0 || this.hud.blocking || p.moving && Math.random() < 0.5) return;
    this.askTimer = 30 + Math.random() * 30;
    if (s.quests.filter((q) => !q.done).length >= 3) return;
    const day = dayIndex(s.minutes);
    const who = this.npcs.filter((n) => {
      const r = s.relations?.[n.res.id];
      return n.idle && r?.met && r.friendship >= 8 && r.rivalry < 25 && ASKS[n.res.id]?.length && s.used[`ask:${n.res.id}`] !== day
        && !s.quests.some((q) => q.who === n.res.id && !q.done) && this.dist(n) < 12 && n.act !== 'sick' && n !== this.chat?.a && n !== this.chat?.b;
    });
    if (!who.length) return;
    const n = who[Math.floor(Math.random() * who.length)];
    s.used[`ask:${n.res.id}`] = day;
    const c = p.cell;
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => ({ x: c.x + dx, z: c.z + dz })).find((q) => this.location.grid.isWalkable(q.x, q.z));
    if (!spot || !n.visit(spot, () => undefined)) return;
    this.bubbleAt(n.walker.position.x, n.walker.position.y, this.short(n.res.id), `${s.character.first}! A moment?`);
    this.asking = { npc: n, t: 0, retarget: 1.5 };
  }

  /** People you know say hello as you pass, once a day; close friends sometimes give you something. */
  private greetings(): void {
    const s = this.state!;
    const p = this.player!;
    const day = dayIndex(s.minutes);
    for (const n of this.npcs) {
      if (!n.visible || n.held) continue;
      const r = s.relations?.[n.res.id];
      if (!r?.met) continue;
      const key = `greet:${n.res.id}`;
      if (s.used[key] === day) continue;
      if (Math.hypot(n.walker.position.x - p.position.x, n.walker.position.y - p.position.y) > 2.5) continue;
      const v = VOICES[n.res.id];
      const reaction = this.outfitReaction(n.res.id);
      const champ = s.champion && r.rivalry < 25 && Math.random() < 0.4 ? [`Make way for ${CHAMPION_TITLE}!`, `There goes ${CHAMPION_TITLE}.`] : null;
      const title = officeTitle(s, s.character.gender === 'woman');
      const ragged = s.wear[s.outfit] < 15 && Math.random() < 0.4 ? ['You look like you slept in a hedge.', 'Lord, what happened to your clothes?', 'Lizzie\'d weep to see that coat.'] : null;
      const office = title && r.rivalry < 25 && Math.random() < 0.35 ? [`Morning, ${title}!`, `There's our ${title}.`, `${title}! When are you fixing the drains?`] : null;
      const lines = reaction ? [reaction] : ragged ?? office ?? champ ?? (r.rivalry >= 25 ? v.rival : r.friendship >= 10 ? v.friend : null);
      if (!lines) continue;
      s.used[key] = day;
      const pos = new THREE.Vector3(n.walker.position.x, 1.8, n.walker.position.y).project(this.rig.camera);
      const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
      this.hud.bubble(this.short(n.res.id), lines[Math.floor(Math.random() * lines.length)], x, y);
      if (r.rivalry >= 25) addNeed(s.needs, 'social', -3);
      else addNeed(s.needs, 'social', 2);
      if (r.friendship >= 60 && Math.random() < 0.3) {
        const gift = ['apple', 'bread', 'potato', 'candle'][Math.floor(Math.random() * 4)];
        if (canCarry(s, gift)) {
          addItem(s, gift);
          this.hud.toast(`${n.res.name.split(' ')[0]} presses a ${ITEMS[gift].name.toLowerCase()} into your hand.`, 3500);
        }
      }
    }
  }

  // --- Favours: neighbours come to you -------------------------------------

  private async request(npc: Npc): Promise<void> {
    const s = this.state!;
    const id = npc.res.id;
    const me = s.character.first;
    const day = dayIndex(s.minutes);
    const asks = ASKS[id] ?? [];
    const ask = asks[Math.floor(Math.random() * asks.length)];
    if (!ask) return;
    const r = this.rel(id);
    const name = npc.res.name;
    const line = ask.line.replace('{me}', me);
    const qid = (s.quests.at(-1)?.id ?? 0) + 1;
    if (ask.kind === 'read') {
      const c = await this.dialogue.ask({ speaker: name, text: line }, ['Let me see it. (Study 2)', 'I can\'t, sorry.']);
      if (c !== 0) return;
      if (s.character.skills.study < 2) {
        r.friendship = Math.min(100, r.friendship + 1);
        await this.dialogue.say({ speaker: '', text: 'The hand is cramped and the ink has run. You can\'t make it out either. They take it back, embarrassed for you both.' });
        return;
      }
      const [letter, after] = READ_LETTERS[id] ?? ['A few lines about the weather and a cousin\'s bad leg.', 'They thank you, and fold it away carefully.'];
      r.friendship = Math.min(100, r.friendship + 7);
      const ups = gainXp(s, 'study', 8);
      this.note('helped', id, undefined, [id]);
      await this.dialogue.say({ speaker: 'You', text: letter }, { speaker: '', text: [after, 'Friendship +7', ...ups].join('\n') });
      return;
    }
    const opts = ask.kind === 'invite' ? ['I\'ll be there.', 'I can\'t, sorry.'] : ['Leave it with me.', 'Not today.'];
    const c = await this.dialogue.ask({ speaker: name, text: line }, opts);
    if (c !== 0) {
      r.friendship = Math.max(0, r.friendship - 1);
      return;
    }
    const q: Quest = { id: qid, kind: ask.kind, who: id, until: day + 1, text: '' };
    if (ask.kind === 'fetch') {
      q.item = ask.item;
      q.text = `Bring ${this.short(id)} ${ask.item!.map((i) => this.itemPhrase(i)).join(' or ')}`;
    } else if (ask.kind === 'lost') {
      const z = LOST_ZONES[ask.zone!];
      let at = { x: z.x0, z: z.z0 };
      for (let k = 0; k < 30; k++) {
        const x = z.x0 + Math.floor(Math.random() * (z.x1 - z.x0 + 1));
        const zz = z.z0 + Math.floor(Math.random() * (z.z1 - z.z0 + 1));
        if (this.locations.saltwharf.grid.isWalkable(x, zz)) { at = { x, z: zz }; break; }
      }
      q.at = at;
      q.thing = ask.thing;
      q.until = day + 2;
      q.text = `Find ${ask.thing!.replace(/^(his|her|my|the) /, `${this.short(id)}'s `)} (look for a glint)`;
    } else if (ask.kind === 'invite') {
      let start = dayStart(day) + ask.hour! * 60;
      if (s.minutes > start - 30) start += DAY;
      q.from = start;
      q.to = start + 90;
      q.place = ask.place;
      q.until = dayIndex(start);
      q.text = `Meet ${this.short(id)} at ${PLACE_NAMES[ask.place!] ?? ask.place} at ${String(ask.hour).padStart(2, '0')}:00${dayIndex(start) > day ? ' tomorrow' : ''}`;
    }
    s.quests.push(q);
    sfx('page');
    this.hud.toast(`Favour: ${q.text}.`, 3500);
    this.refreshObjectives();
  }

  private itemPhrase(id: string): string {
    const n = ITEMS[id]?.name.toLowerCase() ?? id;
    return /^[aeiou]/.test(n) ? `an ${n}` : `a ${n}`;
  }

  /** A favour done: friendship, a little money, and people hear of it. */
  private async favourDone(q: Quest, npc: Npc | null, text: string, pay: number): Promise<void> {
    const s = this.state!;
    q.done = true;
    s.quests = s.quests.filter((x) => x !== q);
    const r = this.rel(q.who);
    const before = r.friendship;
    r.friendship = Math.min(100, r.friendship + 9);
    if (pay > 0) s.money = Math.round((s.money + pay) * 100) / 100;
    addNeed(s.needs, 'social', 8);
    this.note('helped', q.who, undefined, [q.who]);
    sfx('chime');
    await this.dialogue.say({ speaker: this.nameOf(q.who), text: [text, `Friendship +9${pay > 0 ? ` · £${pay.toFixed(2)}` : ''}`].join('\n') });
    await this.hud.celebrate('goal', 'Favour done', this.nameOf(q.who), 'Word gets round that you help people.');
    if (before < 30 && r.friendship >= 30) await this.hud.celebrate('friend', 'A new friend', this.nameOf(q.who), VOICES[q.who].perk.replace(/^Friend: /, ''));
    if (npc?.held) this.showPerson(npc);
    this.refreshObjectives();
  }

  /** Invitations are kept by being there; favours left undone go sour. */
  private checkQuests(): void {
    const s = this.state!;
    const day = dayIndex(s.minutes);
    for (const q of [...s.quests]) {
      if (q.kind === 'invite') {
        if (s.minutes > q.to!) {
          s.quests = s.quests.filter((x) => x !== q);
          const r = this.rel(q.who);
          r.friendship = Math.max(0, r.friendship - 4);
          sendLetter(s, this.nameOf(q.who), 'You never came', `I waited at ${PLACE_NAMES[q.place!] ?? q.place}. I waited a long time.\n\n${this.first(q.who)}`);
          this.refreshObjectives();
          continue;
        }
        if (this.busy || this.dialogue.open || this.hud.blocking || this.location.id !== 'saltwharf' || s.minutes < q.from!) continue;
        const pl = this.locations.saltwharf.places.find((p) => p.id === q.place);
        const npc = this.npcs.find((n) => n.res.id === q.who);
        if (!pl || !npc?.visible) continue;
        const p = this.player!.position;
        if (Math.hypot(pl.door.x + 0.5 - p.x, pl.door.z + 0.5 - p.y) < 3.2 && this.dist(npc) < 4) void this.keepInvite(q, npc);
      } else if (q.until < day) {
        s.quests = s.quests.filter((x) => x !== q);
        const r = this.rel(q.who);
        r.friendship = Math.max(0, r.friendship - 2);
        this.hud.toast(`${this.short(q.who)} gave up waiting on you.`, 3000);
        this.refreshObjectives();
      }
    }
  }

  private async keepInvite(q: Quest, npc: Npc): Promise<void> {
    const s = this.state!;
    q.done = true;
    npc.held = true;
    this.busy = true;
    this.player!.stop();
    const id = q.who;
    const scenes: Record<string, string> = {
      jem: 'Jem buys one round, makes a speech about it, then somehow you buy the next three. He sings. Everybody sings.',
      ruby: `Ruby drinks gin like water and tells you who has been asking about you: "A Vane man. White gloves. Asked where Hester's ${s.character.gender === 'man' ? 'nephew' : 'niece'} sleeps."`,
      lizzie: 'You walk Lizzie through the lanes. Halfway she takes your arm, and doesn\'t let go until the lamp at the yard.',
      nell: 'Nell spars with you until you can\'t lift your arms, then buys you a pie and tells you you\'ll do.',
    };
    addNeed(s.needs, 'social', 22);
    if (id === 'nell') gainXp(s, 'strength', 14);
    this.clock.minutes += 60;
    s.minutes = this.clock.minutes;
    this.busy = false;
    await this.favourDone(q, npc, scenes[id] ?? 'An hour of good company.', 0);
    npc.held = false;
  }

  /** Pick up a lost thing from the gutter. */
  private pickUpLost(id: number): void {
    const s = this.state!;
    const q = s.quests.find((x) => x.id === id);
    if (!q || !q.at) return;
    const go = () => {
      q.found = true;
      q.text = `Return ${q.thing!.replace(/^(his|her|my|the) /, `${this.short(q.who)}'s `)} to ${this.short(q.who)}`;
      sfx('chime');
      this.hud.toast(`You found ${q.thing!.replace(/^(his|her|my) /, 'the ')}. Take it back to ${this.short(q.who)}.`, 3500);
      this.refreshObjectives();
    };
    if (!this.player!.walkTo(q.at, go)) go();
    else this.showMarker(q.at.x + 0.5, q.at.z + 0.5);
  }

  // --- Ambient people and things: crier, ghosts, mourners, the fire ------

  private async lifeTapped(tag: string): Promise<void> {
    const s = this.state!;
    const day = dayIndex(s.minutes);
    if (tag.startsWith('lost:')) return this.pickUpLost(Number(tag.slice(5)));
    const at = this.life.where(tag);
    const p = this.player!;
    if (at && Math.hypot(at.x + 0.5 - p.position.x, at.z + 0.5 - p.position.y) > 2.5) {
      const spot = this.location.grid.nearestWalkable(at.x, at.z + 1, 2);
      if (spot && p.walkTo(spot, () => void this.lifeTapped(tag))) {
        this.showMarker(spot.x + 0.5, spot.z + 0.5);
        return;
      }
    }
    if (tag === 'crier') {
      const heads = gazette(s, day, ZONES.find((z) => z.id === s.hotZone)?.name ?? 'Gull Court', [], `${s.character.first} ${s.character.last}`);
      await this.dialogue.say({ speaker: 'The crier', text: `"Oyez! ${heads[0]}! And: ${heads[1]}!" He rings his bell in your face. "For the rest, the Gazette. One penny."` });
    } else if (tag.startsWith('ghost:')) {
      const g = this.life.ghost(Number(tag.slice(6)));
      if (!hasPerk(s, 'occult', 6) && holidayOn(day)?.id !== 'hallows') {
        await this.dialogue.say({ speaker: g.name, text: 'It passes through you, cold as river water. It doesn\'t seem to know you\'re there. (The dead answer at Occult 6.)' });
        return;
      }
      const key = `ghost:${tag}`;
      const ups = s.used[key] === day ? [] : gainXp(s, 'occult', 12);
      s.used[key] = day;
      await this.dialogue.say({ speaker: g.name, text: [`"${g.lines[Math.floor(Math.random() * g.lines.length)]}"`, ...ups].join('\n') });
    } else if (tag === 'funeral') {
      if (this.usedToday('funeral')) return;
      const c = await this.dialogue.ask({ speaker: 'A mourner', text: 'Old Sam Pike. Mended nets on the quay forty years. The fog had his wits at the end; he didn\'t know his own daughter.' }, ['Walk with the mourners (half an hour)', 'Doff your hat and let them pass']);
      this.markUsed('funeral');
      if (c === 0) {
        addNeed(s.needs, 'social', 10);
        this.clock.minutes += 30;
        for (const id of ['hale', 'pell', 'hannah']) this.rel(id).friendship = Math.min(100, this.rel(id).friendship + 2);
        this.note('helped', 'pell', undefined, ['pell', 'hale']);
        this.hud.toast('You walk behind the coffin to the corner of the Highway. Nobody speaks. Social +10.', 4000);
      }
    } else if (tag === 'evict') {
      if (this.usedToday('okafor')) return;
      const c = await this.dialogue.ask({ speaker: 'Mr. Okafor', text: 'Grubb put the rent up a shilling. Then another. Then the lock. He\'s let our room to a man from the Vane Company. Can you believe it?' }, ['Give them £0.05 for the road', 'Help carry their things', 'I\'m sorry.']);
      this.markUsed('okafor');
      if (c === 0 && s.money >= 0.05) {
        s.money = Math.round((s.money - 0.05) * 100) / 100;
        addNeed(s.needs, 'social', 8);
        this.rel('grubb').rivalry = Math.min(100, this.rel('grubb').rivalry + 2);
        addFact(s, 'helped', ['mag', 'ruby', 'hannah'], 'mag');
        await this.dialogue.say({ speaker: 'Mrs. Okafor', text: '"God keep you." She presses your hand. "Watch Grubb. He\'s selling to the lamp men, house by house."' });
      } else if (c === 1) {
        addNeed(s.needs, 'rest', -8);
        gainXp(s, 'strength', 8);
        this.clock.minutes += 45;
        addFact(s, 'helped', ['mag', 'ruby', 'hannah'], 'mag');
        this.hud.toast('You load a bedstead, two chairs and a lifetime onto the cart. Strength practice.', 3500);
      }
    } else if (tag === 'vane') {
      const c = await this.dialogue.ask({ speaker: 'A Vane Company man', text: '"Mr. Vane\'s compliments. Light for all, free of charge. Your building, Hester\'s, isn\'t it? We\'d like to put a lamp on the stair. No cost. Just sign here."' }, ['Sign', 'No.', 'What does Mr. Vane get out of it?']);
      if (c === 0) await this.dialogue.say({ speaker: 'A Vane Company man', text: '"Splendid." He folds the paper away before you can read it. Somewhere upstairs, you would swear, Pembleton groans.' });
      else if (c === 2) await this.dialogue.say({ speaker: 'A Vane Company man', text: '"Gets? Nothing. Mr. Vane is a philanthropist." His smile does not reach his eyes, which are very pale.' });
      else await this.dialogue.say({ speaker: 'A Vane Company man', text: '"As you like. We\'ll ask again. We always ask again."' });
    } else if (tag === 'bonfire') {
      if (this.usedToday('bonfire')) return void this.hud.toast('You\'ve had your hour by the fire. Your face is still hot.');
      this.markUsed('bonfire');
      addNeed(s.needs, 'social', 22);
      addNeed(s.needs, 'hunger', 15);
      this.clock.minutes += 60;
      for (const n of this.npcs) if (n.visible && this.dist(n) < 7 && s.relations?.[n.res.id]?.met) this.rel(n.res.id).friendship = Math.min(100, this.rel(n.res.id).friendship + 2);
      sfx('chime');
      await this.hud.celebrate('goal', 'Bonfire Night', 'Remember, remember', 'An hour by the fire with half of Saltwharf. Jem\'s Guy looks exactly like Mr. Grubb. Social +22.');
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
    const angry = s.pending.find((p) => p.kind === 'jealousy' && p.who === npc.res.id);
    if (angry) {
      void this.confrontation(npc, angry).then(() => npc.held && this.showPerson(npc));
      return;
    }
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
    const v = VOICES[p.id];
    const doing = npc.act && npc.act !== 'watch' ? ` ${npc.act === 'sick' || npc.act === 'confused' ? 'Today: ' : 'Busy '}${ACTIVITY_TEXT[npc.act]}.` : '';
    const tired = r.today >= DAILY_LIMIT + (hasPerk(s, 'charisma', 6) ? 2 : 0);
    // Sims-style: a pie of bubbles around their head, grouped so it never shows a dozen at once.
    const say = (id: string): PieItem => {
      const i = INTERACTIONS.find((x) => x.id === id)!;
      return {
        label: i.label,
        disabled: tired || (i.id === 'gift' && s.inventory.length === 0),
        onClick: () => {
          this.hud.hidePlace();
          if (i.id === 'gift') this.chooseGift(npc);
          else void this.socialise(npc, i);
        },
      };
    };
    const asPie = (a: Action): PieItem => {
      const m = a.label.match(/^(.*?) \((.*)\)$/);
      return { label: m ? m[1] : a.label, sub: m ? m[2] : undefined, disabled: a.disabled, primary: a.primary, onClick: a.onClick };
    };
    const perks = this.perkActions(npc);
    const romanceExtra = perks.filter((a) => a.label.startsWith('Walk by the river'));
    const businessExtra = perks.filter((a) => a.label.startsWith('Sell to Silas'));
    const askExtra = perks.filter((a) => !romanceExtra.includes(a) && !businessExtra.includes(a));
    const ask = [...this.lessonActions(npc), ...this.parishActions(npc), ...askExtra].map(asPie);
    const favours = this.favourActions(npc).map((a) => ({ ...asPie(a), icon: 'favour' as const, primary: !a.disabled }));
    const items: PieItem[] = [
      ...favours,
      { label: 'Talk', icon: 'talk', children: ['chat', 'joke', 'gossip', 'debate', 'brag'].map(say) },
      { label: 'Kind', icon: 'kind', children: ['compliment', 'confide', 'gift'].map(say) },
      { label: 'Romance', icon: 'romance', children: [say('flirt'), ...romanceExtra.map(asPie)] },
      { label: 'Business', icon: 'business', children: [say('business'), ...businessExtra.map(asPie)] },
      { label: 'Mean', icon: 'mean', children: [say('insult')] },
      ...(ask.length ? [{ label: 'Ask', icon: 'ask' as const, children: ask }] : []),
    ];
    const head = new THREE.Vector3(npc.walker.position.x, 1.5, npc.walker.position.y).project(this.rig.camera);
    this.hud.showPie({
      name: p.name,
      relation: relationLabel(r),
      note: tired ? `${p.role}.${doing} They've had enough of you for today.` : `${p.role}.${doing}${traits.length ? ` ${traits.join(', ')}.` : ` ${v.hint}`}`,
      portrait: this.portraitOf(p.name),
      x: (head.x * 0.5 + 0.5) * window.innerWidth,
      y: (-head.y * 0.5 + 0.5) * window.innerHeight,
    }, items);
  }

  /** Things only friends, sweethearts and certain people offer. */
  private perkActions(npc: Npc): Action[] {
    const s = this.state!;
    const id = npc.res.id;
    const r = this.rel(id);
    const out: Action[] = [];
    const once = (key: string, label: string, fn: () => void): Action => ({
      label: this.usedToday(key) ? `${label} (tomorrow)` : label,
      primary: true,
      disabled: this.usedToday(key),
      onClick: () => {
        this.markUsed(key);
        fn();
        this.showPerson(npc);
      },
    });
    if (id === 'quill' && this.friend(id)) {
      out.push(once('quill', 'Ask for a check-up', () => {
        addNeed(s.needs, 'health', 20);
        this.hud.toast('Dr. Quill listens to your chest and frowns at your tongue. Health +20.');
      }));
    }
    if (id === 'hale' && this.friend(id)) {
      out.push(once('hale', 'Take soup at the church door', () => {
        addNeed(s.needs, 'hunger', 35);
        this.hud.toast('Thin soup, thick bread, and a blessing you didn\'t ask for. Hunger +35.');
      }));
    }
    if (id === 'silas' && this.friend(id)) {
      out.push({ label: 'Sell to Silas (70%)', onClick: () => this.sellToSilas() });
    }
    if (id === 'hale' && isSunday(dayIndex(s.minutes)) && this.clock.hour >= 8 && this.clock.hour < 12) {
      out.push(once('service', 'Attend the open-air service (1 hour)', () => {
        addNeed(s.needs, 'social', 12);
        addNeed(s.needs, 'rest', 4);
        for (const p of ['hale', 'pell', 'hannah']) this.rel(p).friendship = Math.min(100, this.rel(p).friendship + 3);
        this.clock.minutes += 60;
        this.hud.toast('Hymns in the drizzle, a sermon on the Flood, and Mrs. Pell\'s approving nod. Social +12.', 4000);
      }));
    }
    if (r.romance >= 30) {
      out.push(once(`walk:${id}`, 'Walk by the river together', () => {
        r.romance = Math.min(100, r.romance + 6);
        r.friendship = Math.min(100, r.friendship + 3);
        addNeed(s.needs, 'social', 15);
        this.clock.minutes += 60;
        this.note('courting', id);
        this.hud.toast(`An hour along the quay with ${npc.res.name.split(' ')[0]}, watching the lamps come on. Romance +6, Social +15.`, 4000);
      }));
    }
    return out;
  }

  /** Finishing favours: bring what was asked, return what was lost, visit the sick. */
  private favourActions(npc: Npc): Action[] {
    const s = this.state!;
    const id = npc.res.id;
    const out: Action[] = [];
    for (const q of s.quests.filter((x) => x.who === id && !x.done)) {
      if (q.kind === 'fetch') {
        const have = q.item!.find((i) => s.inventory.some((x) => x.id === i));
        out.push({
          label: have ? `Give ${this.itemPhrase(have)} (favour)` : `They want ${q.item!.map((i) => this.itemPhrase(i)).join(' or ')}`,
          primary: !!have, disabled: !have,
          onClick: () => {
            removeItem(s, have!);
            this.hud.hidePlace();
            const pay = Math.round((ITEMS[have!].price * 1.5 + 0.01) * 100) / 100;
            void this.favourDone(q, npc, `"${VOICES[id].friend[0]}" They take it gratefully.`, pay);
          },
        });
      }
      if (q.kind === 'lost' && q.found) {
        out.push({
          label: `Return ${q.thing!.replace(/^(his|her|my) /, 'the ')}`, primary: true,
          onClick: () => {
            this.hud.hidePlace();
            const lines: Record<string, string> = {
              jem: '"ME PURSE! You beauty!" He counts it twice. "All there. You\'re honest. That\'s rare round here. Have a pie. Have two. No, one."',
              ruby: 'Ruby holds the ring to the light for a long time. "I owe you," she says. "I don\'t say that. Remember I said it."',
              silas: 'Silas weighs the parcel in his hand. "Unopened. Good." He tucks a coin into your pocket without seeming to move.',
              mag: '"My feather!" Mag sticks it in her hat. "The dead will be pleased. I\'ll tell them it was you."',
              rudd: 'Rudd flicks through the tally book, nods once. From Rudd, that is a parade.',
              bessa: '"My key! Don\'t tell a soul where you found it, love." She winks. "Drinks are on you. I mean on me."',
            };
            void this.favourDone(q, npc, lines[id] ?? 'They take it back as if you\'d handed them a piece of themselves.', id === 'silas' ? 0.08 : 0.04);
          },
        });
      }
    }
    if (npc.act === 'sick' && !this.usedToday(`sick:${id}`)) {
      const remedy = ['broth', 'stew', 'tonic', 'bandage'].find((i) => s.inventory.some((x) => x.id === i));
      out.push({
        label: remedy ? `Bring them ${this.itemPhrase(remedy)}` : 'Sit with them a while',
        primary: true,
        onClick: () => {
          this.markUsed(`sick:${id}`);
          this.hud.hidePlace();
          const r = this.rel(id);
          if (remedy) {
            removeItem(s, remedy);
            r.friendship = Math.min(100, r.friendship + (remedy === 'broth' || remedy === 'stew' ? 12 : 8));
            s.life.sick[id] = Math.min(s.life.sick[id], dayIndex(s.minutes));
            this.note('helped', id, undefined, [id, 'quill']);
            void this.dialogue.say({ speaker: npc.res.name, text: `They take it with shaking hands. "You didn't have to." By evening the fever is breaking.\nFriendship +${remedy === 'broth' || remedy === 'stew' ? 12 : 8}` });
          } else {
            r.friendship = Math.min(100, r.friendship + 3);
            addNeed(s.needs, 'social', 5);
            void this.dialogue.say({ speaker: npc.res.name, text: '*cough* "Kind of you to sit." (Broth from the stove would do more good.)\nFriendship +3' });
          }
        },
      });
    }
    return out;
  }

  /** Lessons from the mentor for each skill. */
  private lessonActions(npc: Npc): Action[] {
    const s = this.state!;
    const r = this.rel(npc.res.id);
    const out: Action[] = [];
    for (const [skill, m] of Object.entries(MENTORS) as [keyof typeof MENTORS, (typeof MENTORS)['study']][]) {
      if (m.who !== npc.res.id || r.friendship < 10 || npc.act === 'sick') continue;
      const free = r.friendship >= 30;
      const fee = free ? 0 : m.fee;
      const key = `lesson:${skill}`;
      out.push({
        label: this.usedToday(key) ? `${m.label} (tomorrow)` : `${m.label} (1 hour${fee ? ` · £${fee.toFixed(2)}` : ', free for a friend'})`,
        disabled: this.usedToday(key) || s.money + 1e-9 < fee || s.needs.rest < 12,
        onClick: () => {
          this.markUsed(key);
          s.money = Math.round((s.money - fee) * 100) / 100;
          simulateNeeds(s.needs, 1, 'awake');
          addNeed(s.needs, 'rest', -6);
          this.clock.minutes += 60;
          s.minutes = this.clock.minutes;
          const ups = gainXp(s, skill, Math.round(LESSON_XP * (hasPerk(s, 'study', 6) ? 1.25 : 1)));
          r.friendship = Math.min(100, r.friendship + 2);
          this.hud.hidePlace();
          void this.dialogue.say({ speaker: npc.res.name, text: [m.text, `${SKILL_INFO[skill].name} lesson`, ...ups].join('\n') }).then(() => npc.held && this.showPerson(npc));
        },
      });
    }
    return out;
  }

  // --- The parish: standing for the Vestry ---------------------------------

  private parishActions(npc: Npc): Action[] {
    const s = this.state!;
    const id = npc.res.id;
    const out: Action[] = [];
    const office = OFFICES[s.parish.rank];
    if (id === 'hale' && s.parish.standing === null && office) {
      out.push({ label: `Stand for ${office.name} (£${office.deposit.toFixed(2)} deposit)`, onClick: () => void this.standForOffice() });
    }
    if (s.parish.standing !== null && office && voters(RESIDENTS).some((r) => r.id === id) && id !== office.rival && !s.parish.pledges.includes(id)) {
      const key = `vote:${id}`;
      out.push({
        label: s.used[key] !== undefined ? 'They\'ll think about your candidacy' : 'Ask for their vote',
        disabled: s.used[key] !== undefined,
        onClick: () => {
          s.used[key] = dayIndex(s.minutes);
          const r = this.rel(id);
          const chance = pledgeChance(s, npc.res, r.friendship, r.rivalry, this.dressBonus(id));
          this.hud.hidePlace();
          if (Math.random() < chance) {
            s.parish.pledges.push(id);
            void this.dialogue.say({ speaker: npc.res.name, text: `"${id === 'mag' ? 'Mag votes for the one the gulls like.' : 'You\'ll have my vote. Don\'t make me regret it.'}"\nPledged: ${s.parish.pledges.length}` }).then(() => npc.held && this.showPerson(npc));
          } else {
            void this.dialogue.say({ speaker: npc.res.name, text: `"${r.rivalry >= 25 ? 'Vote for you? I\'d sooner vote for the river.' : 'I\'ll think about it. Grubb\'s been round too, you know, with his hat in his hand and his other hand out.'}"` }).then(() => npc.held && this.showPerson(npc));
          }
        },
      });
    }
    return out;
  }

  private async standForOffice(): Promise<void> {
    const s = this.state!;
    const office = OFFICES[s.parish.rank];
    if (!office) return;
    const friends = RESIDENTS.filter((r) => (s.relations?.[r.id]?.friendship ?? 0) >= 30).length;
    const lacks = [
      ...(s.character.skills.study < office.study ? [`Study ${office.study} (you have ${s.character.skills.study})`] : []),
      ...(friends < office.friends ? [`${office.friends} friends in the parish (you have ${friends})`] : []),
      ...(!s.housed ? ['a roof: only ratepayers may stand'] : []),
      ...(s.money < office.deposit ? [`£${office.deposit.toFixed(2)} for the deposit`] : []),
    ];
    if (lacks.length) {
      await this.dialogue.say({ speaker: 'Father Ambrose Hale', text: `"${office.text}" He looks at you over his spectacles. "But the parish will want ${lacks.join(', ')}."` });
      return;
    }
    const rival = this.nameOf(office.rival);
    const c = await this.dialogue.ask({ speaker: 'Father Ambrose Hale', text: `"${office.text} ${rival} stands again. He always stands. The election is in five days, at noon, at the market cross."` }, [`Stand · £${office.deposit.toFixed(2)}`, 'Not yet']);
    if (c !== 0) return;
    s.money = Math.round((s.money - office.deposit) * 100) / 100;
    s.parish.standing = dayIndex(s.minutes) + 5;
    s.parish.pledges = [];
    s.parish.crowd = 0;
    for (const k of Object.keys(s.used)) if (k.startsWith('vote:')) delete s.used[k];
    sfx('fanfare');
    await this.hud.celebrate('goal', 'Candidate', `For ${office.name}`, 'Ask neighbours for their vote; speak to the crowd at the market each day.');
    this.refreshObjectives();
  }

  /** A speech at the market: Study and Charisma win over the undecided. */
  private async speech(): Promise<void> {
    const s = this.state!;
    if (this.usedToday('speech') || s.parish.standing === null) return;
    this.markUsed('speech');
    const sk = s.character.skills;
    const won = Math.max(0, Math.round((0.5 + (sk.study + sk.charisma) / 5) * (0.6 + Math.random() * 0.7) * (hasPerk(s, 'study', 10) ? 2 : 1)));
    s.parish.crowd += won;
    simulateNeeds(s.needs, 1, 'awake');
    addNeed(s.needs, 'rest', -5);
    this.clock.minutes += 60;
    const ups = [...gainXp(s, 'charisma', 10), ...gainXp(s, 'study', 6)];
    const lines = won >= 3 ? 'They cheer! Someone throws a cabbage, but at Grubb\'s poster.' : won >= 1 ? 'A few nods. A man asks about the drains. You promise drains.' : 'They drift away to the eel stall. Jem shrugs at you.';
    await this.dialogue.say({ speaker: '', text: [`You climb on a crate and speak about lamps, drains and rents. ${lines}`, `The undecided: +${won} (crowd ${s.parish.crowd})`, ...ups].join('\n') });
  }

  /** Election day: the count at noon. */
  private async election(): Promise<void> {
    const s = this.state!;
    const office = OFFICES[s.parish.rank];
    if (!office || s.parish.standing === null) return;
    const { mine, theirs } = countVotes(s, office);
    s.parish.standing = null;
    const rival = this.nameOf(office.rival);
    const woman = s.character.gender === 'woman';
    if (mine > theirs) {
      s.parish.rank++;
      const t = officeTitle(s, woman);
      addFact(s, 'elected', ['hale', 'pell', 'grubb', 'ruby', 'mag', 'jem'], undefined, t);
      this.rel(office.rival).rivalry = Math.min(100, this.rel(office.rival).rivalry + 15);
      await this.hud.modal('The count at the market cross', [`${s.character.first} ${s.character.last}: ${mine}`, `${rival}: ${theirs}`, `Elected ${t}.`, OFFICES[s.parish.rank] ? `Next: ${OFFICES[s.parish.rank].name} (Study ${OFFICES[s.parish.rank].study}, ${OFFICES[s.parish.rank].friends} friends).` : `Beyond the parish: ${FUTURE_OFFICES.join(', ')}. Other districts, another day.`], 'ELECTED');
      await this.hud.celebrate('promotion', 'Elected', t, s.parish.rank === 1 ? 'Grubb must give you longer to pay, and the middling sort warm to you.' : 'The parish purse pays you £0.10 a week, and nobody asks how.');
    } else {
      this.rel(office.rival).rivalry = Math.min(100, this.rel(office.rival).rivalry + 5);
      await this.hud.modal('The count at the market cross', [`${rival}: ${theirs}`, `${s.character.first} ${s.character.last}: ${mine}`, `${rival} keeps the seat and your deposit. Stand again when you have more friends.`]);
    }
    this.refreshObjectives();
  }

  // --- Clothes wear ---------------------------------------------------------

  private wearOut(amount: number): void {
    const s = this.state!;
    const before = s.wear[s.outfit];
    s.wear[s.outfit] = Math.max(0, before - amount);
    if (before >= 40 && s.wear[s.outfit] < 40) this.hud.toast(`Your ${OUTFIT_NAMES[s.outfit].toLowerCase()} is getting shabby. Lizzie mends clothes at Rag & Bone.`, 3800);
    if (before >= 15 && s.wear[s.outfit] < 15) this.hud.toast('Your clothes are in rags now. People notice, and not kindly.', 3800);
  }

  private condition(o = this.state!.outfit): string {
    const w = this.state!.wear[o];
    return w >= 70 ? 'good' : w >= 40 ? 'worn' : w >= 15 ? 'shabby' : 'ragged';
  }

  private mend(byLizzie: boolean): void {
    const s = this.state!;
    const fee = byLizzie && !this.friend('lizzie') ? 0.05 : 0;
    if (s.money + 1e-9 < fee) return;
    s.money = Math.round((s.money - fee) * 100) / 100;
    s.wear[s.outfit] = 100;
    if (!byLizzie) {
      this.clock.minutes += 60;
      gainXp(s, 'arts', 6);
    }
    sfx('flip');
    this.hud.toast(byLizzie ? `Lizzie darns, patches and presses while you wait. Good as new${fee ? '' : ', and she won\'t take your money'}.` : 'An hour with needle and thread. Good as new, nearly.', 3500);
  }

  private sellToSilas(): void {
    const s = this.state!;
    const render = () => {
      const rows: ListRow[] = s.inventory.map((it) => ({
        label: `${ITEMS[it.id].name} ×${it.qty}`,
        sub: `Silas offers £${Math.max(0.01, Math.floor(ITEMS[it.id].price * 70) / 100).toFixed(2)}`,
        actions: [{ label: 'Sell', onClick: () => { sell(s, SHOPS.pawnbroker, it.id, 0.7); sfx('coin'); render(); } }],
      }));
      if (!rows.length) rows.push({ label: 'Nothing to sell.', sub: '', actions: [] });
      this.hud.showList('Silas Crane', 'No questions asked', rows);
    };
    render();
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
    // A good coat, and clean linen from Hannah, help first impressions.
    const before = { f: r.friendship, ro: r.romance };
    const dress = this.dressBonus(npc.res.id) + (this.friend('hannah') ? 0.04 : 0) + (this.usedToday('mirror') ? 0.06 : 0);
    const mood = ((seed - Math.floor(seed)) - 0.5) * 0.2 + dress;
    const out = interact(s, npc.res, r, i, mood);
    if (out.success && i.id === 'chat') out.text = VOICES[npc.res.id].chat;
    // What people see becomes what people know.
    if (out.success && (i.id === 'flirt' || i.id === 'compliment') && r.romance >= 30) this.note('courting', npc.res.id);
    if (i.id === 'insult' && !out.success) this.note('wronged', npc.res.id);
    addNeed(s.needs, 'social', out.success ? 6 : 3);
    const xp = [...gainXp(s, i.skill, out.success ? 6 : 3)];
    const names: Record<string, string> = { friendship: 'Friendship', romance: 'Romance', rivalry: 'Rivalry', business: 'Business' };
    const delta = Object.entries(out.changes).filter(([, v]) => v).map(([k, v]) => `${names[k]} ${v! > 0 ? '+' : ''}${Math.round(v!)}`).join(' · ');
    const hint = out.liked ? (out.success ? 'They liked that.' : 'They usually like that, just not today.') : out.disliked ? 'They did not like that.' : '';
    await this.dialogue.say({ speaker: npc.res.name, text: [out.text, hint, delta, ...xp].filter(Boolean).join('\n') });
    if (before.f < 30 && r.friendship >= 30) await this.hud.celebrate('friend', 'A new friend', npc.res.name, VOICES[npc.res.id].perk.replace(/^Friend: /, ''));
    if (before.ro < 30 && r.romance >= 30) await this.hud.celebrate('friend', 'Courting', npc.res.name, 'You can walk by the river together now.');
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
        sub: `${p.role}${traits.length ? ` · ${traits.join(', ')}` : ''}${(() => { const k = knowledgeOf(s, p.id, (id) => this.nameOf(id)); return k.length ? `\nThey ${k.slice(0, 2).join('; ')}` : ''; })()}\nFriendship ${Math.round(r.friendship)} · Romance ${Math.round(r.romance)} · Rivalry ${Math.round(r.rivalry)} · Business ${Math.round(r.business)}\n${r.friendship >= 30 ? VOICES[p.id].perk : `At Friend (30): ${VOICES[p.id].perk.replace(/^Friend: /, '')}`}`,
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
    // The Kin's revenge comes on the night of the warning letter.
    if (dark && s.used.ambush === dayIndex(s.minutes - 6 * 60) && s.used.ambushDone !== dayIndex(s.minutes)) {
      void this.ambush();
      return;
    }
    // Robbery: at most once a night; likelier on dangerous streets, with a fat purse or fine clothes.
    if (dark && s.lastRobberyDay !== day && !this.stalker) {
      const dress = s.outfit === 'sunday' ? 1.4 : s.outfit === 'coat' ? 1.25 : 1;
      const rate = 0.004 * this.dangerHere() * (1 + s.money * 0.6) * dress * (s.notoriety >= 3 ? 0.5 : 1) * (this.friend('ruby') ? 0.5 : 1) * (hasPerk(s, 'strength', 6) ? 0.67 : 1) * gear(s).robbery;
      if (Math.random() < rate * gameMinutes) {
        this.startStalker();
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
    if (fight) {
      const nell = this.friend('nell');
      const foe = nell ? { ...enemy, hp: Math.max(6, enemy.hp - 12) } : enemy;
      await this.fight(foe, nell ? 'Boots on the cobbles: Nell Hartigan comes running and lands the first blow. "Two on one now, friend."' : 'They come at you.', firstStrike && !nell, true);
    }
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
        this.note('helped', npc.res.id);
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
      this.note('wronged', npc.res.id);
      this.hud.toast(`You walk on. ${npc.res.name.split(' ')[0]} saw you go.`, 3500);
    }
    this.busy = false;
    this.save();
  }

  /** Runs a fight; handles winning, losing and the hospital. Returns true if you won or talked them down. */
  private async fight(enemy: Enemy, intro: string, firstStrike: boolean, robbery: boolean): Promise<boolean> {
    const s = this.state!;
    const { outcome, xp } = await runFight(this.container, s, enemy, intro, firstStrike);
    this.wearOut(12);
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

  // --- A living world: memory, gossip, mail, danger, Fight Night, home and dress ---

  private nameOf(id: string): string {
    return RESIDENTS.find((r) => r.id === id)?.name ?? id;
  }

  /** "Mrs. Pell", "Father Hale", "Nell": how a name appears in a bubble or a line. */
  private short(id: string): string {
    const n = this.nameOf(id);
    const m = n.match(/^(Mr\.|Mrs\.|Dr\.|Father|Foreman) (?:\S+ )*?(\S+)$/);
    if (m) return `${m[1]} ${m[2]}`;
    if (n.startsWith('Old ')) return n.split(' ').slice(0, 2).join(' ');
    return n.split(' ')[0];
  }

  private first(id: string): string {
    return this.nameOf(id).replace(/^(Mr\.|Mrs\.|Dr\.|Father|Old|Foreman) /, '').split(' ')[0];
  }

  /** Residents near enough to see what you just did. */
  private witnesses(radius = 6): string[] {
    if (this.location.id !== 'saltwharf' || !this.player) return [];
    const p = this.player.position;
    return this.npcs.filter((n) => n.visible && Math.hypot(n.walker.position.x - p.x, n.walker.position.y - p.y) <= radius).map((n) => n.res.id);
  }

  private note(kind: FactKind, about?: string, note?: string, extra: string[] = []): void {
    addFact(this.state!, kind, [...this.witnesses(), ...extra], about, note);
  }

  /** Overnight: gossip spreads, people react, the post arrives. Returns lines for the morning summary. */
  private nightlyWorld(): string[] {
    const s = this.state!;
    const day = dayIndex(s.minutes);
    const lines: string[] = [];
    const before = s.letters.filter((l) => !l.read).length;
    const learned = spreadGossip(s);
    reactions(s, learned);
    const me = s.character.first;
    for (const p of [...s.pending]) {
      if (p.kind === 'congrats') {
        sendLetter(s, this.nameOf(p.who), `On your promotion`, (CONGRATS[p.who] ?? ((r: string) => `Congratulations on ${r}.`))(p.note ?? '', me));
        s.pending = s.pending.filter((x) => x !== p);
      } else if (p.kind === 'revenge') {
        if (s.used.ambush !== undefined && s.used.ambush >= p.day) continue;
        s.used.ambush = day;
        sendLetter(s, 'Unsigned', 'A warning', `They know about ${this.nameOf(p.about!)}. They know where you sleep. Stay in tonight, or don't walk alone.\n\nA friend`);
        s.pending = s.pending.filter((x) => x !== p);
      } else if (p.kind === 'jealousy' && day - p.day >= 2) {
        // Avoided too long: they write instead.
        const r = this.rel(p.who);
        r.romance = Math.max(0, r.romance - 15);
        r.rivalry = Math.min(100, r.rivalry + 10);
        sendLetter(s, this.nameOf(p.who), 'You know what this is about', `I know about ${this.first(p.about!)}. Everyone knows about ${this.first(p.about!)}. Don't bother coming round with your excuses.\n\n${this.first(p.who)}`);
        s.pending = s.pending.filter((x) => x !== p);
      }
    }
    // Daily post.
    for (const res of RESIDENTS) {
      const r = s.relations?.[res.id];
      if (!r?.met) continue;
      if (r.romance >= 30 && Math.random() < 0.18) sendLetter(s, res.name, 'A note', `${me},\n\nI keep thinking about the river at night. Come and find me.\n\n${this.first(res.id)}`);
      if (r.rivalry >= 50 && Math.random() < 0.15) sendLetter(s, res.name, 'A word', `Watch yourself, ${me}. Saltwharf is a small place and the river is deep.`);
    }
    if (s.debt > 0 && weekday(day) === 3) sendLetter(s, 'The London Hospital', 'Account outstanding', `Sir or Madam,\n\nThe sum of £${s.debt.toFixed(2)} remains owing for treatment received. It will be taken from your next earnings.\n\nThe Almoner`);
    if (weekday(day) === 1 && day >= 7 && s.hesterLetters < HESTER_LETTERS.length) {
      sendLetter(s, 'Mrs. Agnes Pell', 'Found among the shop papers', `I found this in the chandlery ledgers. It is in your aunt's hand. I think it was meant for you.\n\n— A.P.\n\n${HESTER_LETTERS[s.hesterLetters]}`);
      s.hesterLetters++;
    }
    // A stray comes to a comfortable room.
    if (owns(s, 'rug') && !owns(s, 'cat') && Math.random() < 0.35) {
      s.owned.push('cat');
      this.applyFurniture();
      lines.push('A thin grey cat has moved in. She sleeps on the end of your bed and has decided you may stay.');
    }
    lines.push(...this.nightlyLives(day));
    s.hotZone = HOT_ZONES[Math.floor(Math.random() * HOT_ZONES.length)];
    const after = s.letters.filter((l) => !l.read).length;
    if (after > before) lines.push(`${after - before} new letter${after - before === 1 ? '' : 's'} by your door.`);
    if (s.pending.some((p) => p.kind === 'jealousy')) lines.push('Someone you are courting has heard things. Expect a conversation.');
    return lines;
  }

  /** The neighbourhood changes overnight: weather, sickness, the missing, the strike, newcomers. */
  private nightlyLives(day: number): string[] {
    const s = this.state!;
    const lines: string[] = [];
    const L = s.life;
    const yesterday = s.weather;
    s.weather = s.tomorrow;
    s.tomorrow = rollWeather(day + 1);
    this.locations.saltwharf.setWeather?.(s.weather);
    // The missing come back, confused; on a fog night someone else may not come home.
    for (const [id, until] of Object.entries(L.missing)) {
      if (until < day) {
        delete L.missing[id];
        L.confused[id] = day + 1;
        lines.push(`${this.nameOf(id)} came back out of the fog at dawn. They don't remember the last two days, and keep asking what day it is.`);
        sendLetter(s, 'Mrs. Constance Ashby', 'They came back', `${this.first(id)} came back. Mine did not. Ask them what they saw. They will say a white light. They all say a white light.\n\nC.A.`);
      }
    }
    for (const [id, until] of Object.entries(L.confused)) if (until < day) delete L.confused[id];
    const takeable = ['tom', 'lizzie', 'jem', 'hannah', 'ruby', 'moss'].filter((id) => !(L.sick[id] >= day) && !(L.missing[id] >= day));
    if (yesterday === 'fog' && !Object.keys(L.missing).length && Math.random() < 0.4 && takeable.length) {
      const id = takeable[Math.floor(Math.random() * takeable.length)];
      L.missing[id] = day + 1;
      lines.push(`MISSING: ${this.nameOf(id)} walked home through last night's fog and never arrived. Posters are going up.`);
    }
    // Sickness.
    for (const [id, until] of Object.entries(L.sick)) if (until < day) delete L.sick[id];
    const healthy = RESIDENTS.filter((r) => this.present(r) && !['mag', 'quill', 'ashby'].includes(r.id) && !(L.sick[r.id] >= day)).map((r) => r.id);
    if (!Object.keys(L.sick).length && Math.random() < 0.09 && healthy.length) {
      const id = healthy[Math.floor(Math.random() * healthy.length)];
      L.sick[id] = day + 2;
      lines.push(`${this.nameOf(id)} has taken a fever. They're wrapped up on their step; a hot broth would do more than Quill's tonic.`);
    }
    // The strike.
    if (s.strike && day > s.strike.until && s.strike.won === undefined) {
      const won = Math.random() < (s.strike.side === 'scab' ? 0.35 : s.strike.side === 'picket' ? 0.75 : 0.55);
      s.strike.won = won;
      if (won) {
        s.dockRaise = 0.1;
        lines.push('The strike is won: the owners give the dockers back their penny, and a tenth on top.');
      } else {
        lines.push('The strike is broken. Rudd takes back the men he likes, and remembers the ones he doesn\'t.');
        if (s.strike.side === 'picket') this.rel('rudd').rivalry = Math.min(100, this.rel('rudd').rivalry + 6);
      }
    } else if (strikeStarts(s, day)) {
      s.strike = { day, until: day + 2, side: '' };
      lines.push('STRIKE: the dockers are out. Pickets at the Hiring Office for three days. Join them, or cross the line for double pay.');
    }
    // Scripted days.
    if (day === FUNERAL_DAY) lines.push('A funeral this morning at eleven: old Sam Pike the net-mender, from Gull Court along Quay Street.');
    if (day === VANE_START) lines.push('Men in white coats are digging a hole on the quay. A Vane Company lamp is going in.');
    if (day === EVICTION_DAY) lines.push('Grubb has turned the Okafors out of Gull Court. Their things are on a cart in the street.');
    const newcomer = RESIDENTS.find((r) => r.arrives === day);
    if (newcomer) lines.push(`Someone new has taken the Okafors' room in Gull Court: ${newcomer.name}, in black.`);
    // Parish purse for a churchwarden.
    if (s.parish.rank >= 2 && weekday(day) === 1) {
      s.money = Math.round((s.money + 0.1) * 100) / 100;
      lines.push('Your share of the pew rents: £0.10. Nobody asks how the parish purse is kept.');
    }
    return lines;
  }

  private openLetters(): void {
    const s = this.state!;
    const render = () => {
      const rows: ListRow[] = [...s.letters].reverse().slice(0, 20).map((l) => ({
        label: `${l.read ? '' : '● '}${l.from}`,
        sub: `${l.subject} · ${this.clock.formatShortDate(new Date(1871, 9, 1 + l.day))}`,
        actions: [{ label: 'Read', onClick: () => void this.readLetter(l.id) }],
      }));
      if (!rows.length) rows.push({ label: 'No letters yet.', sub: 'Friends write when there is news.', actions: [] });
      this.hud.showList('Letters', `${s.letters.filter((l) => !l.read).length} unread`, rows);
    };
    render();
  }

  private async readLetter(id: number): Promise<void> {
    const l = this.state!.letters.find((x) => x.id === id);
    if (!l) return;
    l.read = true;
    this.hud.closeList();
    sfx('page');
    await this.hud.modal(l.subject, l.body.split('\n\n'), '', 'letter', `From ${l.from}`);
    this.openLetters();
  }

  private async readGazette(): Promise<void> {
    const s = this.state!;
    if (s.money < 0.01) return;
    s.money = Math.round((s.money - 0.01) * 100) / 100;
    const day = dayIndex(s.minutes);
    const hot = ZONES.find((z) => z.id === s.hotZone)?.name ?? 'Gull Court';
    const recent = s.facts.filter((f) => day - f.day <= 2);
    const heads = gazette(s, day, hot, recent, `${s.character.first} ${s.character.last}`);
    const missing = Object.keys(s.life.missing).filter((k) => s.life.missing[k] >= day);
    if (missing.length) heads.splice(1, 0, `MISSING IN THE FOG: ${this.nameOf(missing[0]).toUpperCase()} OF SALTWHARF; NEIGHBOURS SEARCH THE RIVER STAIRS`);
    if (s.strike && day >= s.strike.day && day <= s.strike.until) heads.splice(1, 0, 'DOCKERS OUT AT SALTWHARF: OWNERS THREATEN "MEN FROM WAPPING"');
    if (day >= VANE_START && day < VANE_DONE) heads.splice(1, 0, 'FIRST VANE LAMP FOR SALTWHARF QUAY: "LIGHT FOR ALL," SAYS COMPANY');
    if (s.parish.standing !== null) heads.push(`VESTRY ELECTION: ${s.character.last.toUpperCase()} CHALLENGES ${this.nameOf(OFFICES[s.parish.rank].rival).toUpperCase()}`);
    const hol = holidayOn(day + 1) ?? holidayOn(day);
    if (hol) heads.push(`${hol.name.toUpperCase()}: ${hol.text.split(': ')[1]?.toUpperCase() ?? ''}`);
    if (hasPerk(s, 'study', 3)) heads.push(`Small print, tomorrow's weather: ${s.tomorrow === 'clear' ? 'dry' : s.tomorrow === 'rain' ? 'rain from the estuary' : 'FOG on the river'}.`);
    sfx('page');
    await this.hud.modal('The Saltwharf Gazette', heads, '', 'gazette', `${this.clock.formatDate()} · One Penny`);
  }

  // Danger -----------------------------------------------------------------

  private nearLamp(x: number, z: number, r = 1.8): boolean {
    return (this.locations.saltwharf.lamps ?? []).some((l) => Math.hypot(l.x - x, l.z - z) <= r);
  }

  private dangerHere(): number {
    const s = this.state!;
    if (this.location.id !== 'saltwharf' || !this.player) return 0;
    const p = this.player.position;
    let d = dangerAt(p.x, p.y, this.clock.hour, s.hotZone, this.nearLamp(p.x, p.y));
    if (s.weather === 'fog') d *= 1.3;
    if (hasPerk(s, 'cunning', 6)) d *= 0.75;
    if (this.life.constableNear(p.x, p.y)) d *= 0.5;
    if (this.life.bonfireLit && Math.hypot(p.x - 15.5, p.y - 20.5) < 7) d *= 0.3;
    return Math.min(1, d);
  }

  /** Warn once per zone per night when you walk somewhere dangerous; the screen darkens at the edges. */
  private updateDanger(): void {
    const s = this.state!;
    const d = this.dangerHere();
    document.querySelector('.atmo')?.classList.toggle('danger', d >= 0.5);
    if (d < 0.5 || !this.player) return;
    const zn = zoneAt(Math.floor(this.player.position.x), Math.floor(this.player.position.y));
    const key = `warn:${zn?.id}`;
    const day = dayIndex(s.minutes - 6 * 60);
    if (!zn || s.used[key] === day) return;
    s.used[key] = day;
    const hot = zn.id === s.hotZone;
    this.hud.toast(hot ? `${zn.name[0].toUpperCase()}${zn.name.slice(1)}. The Gazette warned about this street tonight. The lamps are out.` : `${zn.name[0].toUpperCase()}${zn.name.slice(1)} after dark. Keep to the lamplight.`, 3800);
  }

  /** Before a robbery, a figure follows you. Reach a lamp, or a door, and it melts away. */
  private startStalker(): void {
    const s = this.state!;
    const p = this.player!;
    const grid = this.locations.saltwharf.grid;
    const angle = Math.random() * Math.PI * 2;
    const spot = grid.nearestWalkable(Math.floor(p.position.x + Math.cos(angle) * 6), Math.floor(p.position.y + Math.sin(angle) * 6), 4);
    if (!spot) return void this.robbery();
    const look = { skin: 0x9a8a7a, hair: 0x101010, coat: 0x14161c, trousers: 0x101216, shirt: 0x202228, boots: 0x0a0a0a, hat: 'cap' as const, hatColor: 0x0e0e12, build: 1.08 };
    const shadow = new Player(grid, look, spot.x + 0.5, spot.z + 0.5);
    shadow.speedMult = hasPerk(s, 'cunning', 3) ? 0.75 : 0.9;
    this.locations.saltwharf.scene.add(shadow.rig.root);
    this.stalker = { walker: shadow, t: 0, retarget: 0 };
    s.lastRobberyDay = dayIndex(s.minutes);
    sfx('tick');
    this.hud.toast('Footsteps behind you, keeping pace. Get to a lamp.', 3500);
    document.querySelector('.atmo')?.classList.add('stalked');
  }

  private updateStalker(dt: number): void {
    const st = this.stalker;
    if (!st || !this.player) return;
    const p = this.player.position;
    st.t += dt;
    st.retarget -= dt;
    if (st.retarget <= 0) {
      st.retarget = 0.5;
      st.walker.walkTo(this.player.cell);
    }
    st.walker.update(dt, this.elapsed);
    const gone = this.location.id !== 'saltwharf' || this.nearLamp(p.x, p.y, 1.4);
    const caught = Math.hypot(st.walker.position.x - p.x, st.walker.position.y - p.y) < 1.1 || st.t > (hasPerk(this.state!, 'cunning', 3) ? 14 : 9);
    if (gone || caught) {
      st.walker.rig.root.removeFromParent();
      this.stalker = null;
      document.querySelector('.atmo')?.classList.remove('stalked');
      if (gone) this.hud.toast('In the lamplight the footsteps stop, and turn away.');
      else void this.robbery();
    }
  }

  /** The Kin's revenge: two of Silas's friends wait in the fog. */
  private async ambush(): Promise<void> {
    const s = this.state!;
    s.used.ambushDone = dayIndex(s.minutes);
    this.busy = true;
    this.player!.stop();
    this.hud.hidePlace();
    const foe: Enemy = { name: 'Two of the Kin', hp: 44, dmg: [6, 11], hit: 0.7, nerve: 110 };
    await this.dialogue.say({ speaker: 'A voice in the fog', text: 'Silas sends his regards. You should have been nicer to his friends.' });
    await this.fight(foe, 'Two shapes close in from either side.', true, true);
    this.busy = false;
  }

  // Black Jack Tully --------------------------------------------------------

  private updateTully(dt: number): void {
    const s = this.state!;
    const h = this.clock.hour;
    const out = (h >= NOTORIOUS.from || h < NOTORIOUS.to) && s.used.tullyBeaten === undefined;
    this.tully.rig.root.visible = out && this.location.id === 'saltwharf';
    if (!out) return;
    this.tully.update(dt, this.elapsed);
    this.tully.faceToward({ x: this.player!.position.x, z: this.player!.position.y });
    if (this.location.id !== 'saltwharf' || this.busy || this.dialogue.open || this.hud.blocking) return;
    const near = Math.hypot(this.tully.position.x - this.player!.position.x, this.tully.position.y - this.player!.position.y) < 2.2;
    const night = dayIndex(s.minutes - 6 * 60);
    if (near && s.used.tullyMet !== night) {
      s.used.tullyMet = night;
      void this.meetTully();
    }
  }

  private async meetTully(): Promise<void> {
    const s = this.state!;
    this.busy = true;
    this.player!.stop();
    const c = await this.dialogue.ask(
      { speaker: NOTORIOUS.name, text: 'A big man with a broken nose and a docker\'s hook through his belt. "Lost, are we? This is my alley. Toll\'s twenty pence."' },
      [`Pay £0.20`, 'Fight him', 'Back away'],
    );
    if (c === 0 && s.money >= 0.2) {
      s.money = Math.round((s.money - 0.2) * 100) / 100;
      await this.dialogue.say({ speaker: NOTORIOUS.name, text: '"Pleasure doing business."' });
    } else if (c === 1 || (c === 0 && s.money < 0.2)) {
      const won = await this.fight({ name: NOTORIOUS.name, hp: 62, dmg: [8, 14], hit: 0.72, nerve: 140 }, 'Tully grins and rolls up his sleeves.', false, true);
      if (won) {
        s.used.tullyBeaten = dayIndex(s.minutes);
        s.notoriety += 3;
        s.money = Math.round((s.money + 0.5) * 100) / 100;
        this.note('champion', undefined, 'Black Jack Tully', ['ruby', 'mag', 'silas']);
        await this.hud.celebrate('promotion', 'Notorious', 'Tully is down', 'His purse is yours: £0.50. The alley is safe again.');
      }
    } else if (Math.random() < 0.4 + s.character.skills.cunning * 0.05) {
      this.hud.toast('You back away slowly. Tully laughs and lets you go.');
    } else {
      await this.fight({ name: NOTORIOUS.name, hp: 62, dmg: [8, 14], hit: 0.72, nerve: 140 }, '"Not so fast."', true, true);
    }
    this.busy = false;
  }

  // Fight Night -------------------------------------------------------------

  private fightNightOpen(): boolean {
    const s = this.state!;
    const day = dayIndex(s.minutes);
    const h = this.clock.hour;
    return weekday(day) === FIGHT_NIGHT.day && h >= FIGHT_NIGHT.from && h < FIGHT_NIGHT.to && s.used.fightnight !== day;
  }

  private nextBout(): Bout {
    const s = this.state!;
    if (s.ladder < LADDER.length) return LADDER[s.ladder];
    return { enemy: { name: 'A challenger from Hollow Lane', hp: 44, dmg: [7, 12], hit: 0.72, nerve: 110 }, purse: 0.4, intro: 'Hollow Lane has sent someone to take your title. The crowd howls.' };
  }

  private async fightNight(): Promise<void> {
    const s = this.state!;
    if (!this.fightNightOpen() || s.money < FIGHT_NIGHT.entry) return;
    s.money = Math.round((s.money - FIGHT_NIGHT.entry) * 100) / 100;
    s.used.fightnight = dayIndex(s.minutes);
    const bout = this.nextBout();
    this.busy = true;
    this.player!.stop();
    await this.dialogue.say({ speaker: 'The Boxing Yard', text: bout.intro });
    const { outcome, xp } = await runFight(this.container, s, bout.enemy, `${bout.enemy.name}. Fight Night. The crowd roars.`, false);
    gainXp(s, 'strength', xp.strength + 15);
    gainXp(s, 'cunning', xp.cunning);
    if (outcome === 'won' || outcome === 'talked') {
      s.money = Math.round((s.money + bout.purse) * 100) / 100;
      s.notoriety++;
      addNeed(s.needs, 'social', 20);
      this.note('champion', undefined, bout.enemy.name, ['nell', 'jem', 'ruby', 'bessa']);
      const wasLast = s.ladder === LADDER.length - 1;
      if (s.ladder < LADDER.length) s.ladder++;
      if (bout.enemy.name.startsWith('Iron Nell')) {
        const r = this.rel('nell');
        r.friendship = Math.min(100, r.friendship + 10);
        await this.dialogue.say({ speaker: 'Nell Hartigan', text: 'Nell spits blood into the sawdust and laughs until she coughs. "There it is. There it is!"' });
      }
      if (wasLast) {
        s.champion = true;
        await this.hud.celebrate('promotion', 'Champion', CHAMPION_TITLE, `Saltwharf will remember the name. Purse £${bout.purse.toFixed(2)}`);
      } else {
        await this.hud.celebrate('goal', 'Fight Night', `${bout.enemy.name} is down`, `Purse £${bout.purse.toFixed(2)} · next Saturday: ${this.nextBout().enemy.name}`);
      }
    } else if (outcome === 'lost') {
      s.needs.health = Math.max(s.needs.health, 12);
      await this.dialogue.say({ speaker: '', text: 'You come round on the sawdust. Someone has emptied a bucket over you. The crowd has already forgotten your name.' });
    } else {
      this.hud.toast('You duck under the ropes and away. The crowd boos. Nobody gets their money back.');
    }
    this.busy = false;
    this.save();
  }

  // Home and dress ----------------------------------------------------------

  /** Shows owned furniture in Hester's room and blocks the tiles it stands on. */
  private applyFurniture(): void {
    const s = this.state;
    const room = this.locations.hesterRoom;
    if (!s || !room.extras) return;
    for (const [id, x] of Object.entries(room.extras)) {
      const have = owns(s, id);
      x.obj.visible = have;
      for (const t of x.tiles) (have ? room.grid.block(t.x, t.z) : room.grid.unblock(t.x, t.z));
    }
  }

  private comfort(): number {
    const s = this.state!;
    return ['mattress', 'rug', 'curtains', 'mirror', 'bookshelf', 'cat'].filter((id) => owns(s, id)).length;
  }

  /** Pembleton has something to say about each new piece of furniture. */
  private async pembletonOnFurniture(): Promise<void> {
    const s = this.state!;
    const lines: Record<string, string> = {
      rug: 'A rug. How very bourgeois. I find, to my horror, that I approve.',
      curtains: 'Velvet. The room has stopped looking like a cell and started looking like a cell with ambitions.',
      bookshelf: 'Books! Hester would weep. I would weep, if the dead could manage it.',
      mirror: 'I do not appear in it. I have checked. Repeatedly. It is very dispiriting.',
      workbench: 'Sawdust. On my floor. In my day apprentices were beaten for less.',
      mattress: 'Feathers. You will sleep like the dead. Take it from one who knows.',
      cat: 'The cat can see me. We have reached an understanding. She sits on my chair and I let her.',
    };
    for (const id of Object.keys(lines)) {
      if (owns(s, id) && !s.used[`pem:${id}`]) {
        s.used[`pem:${id}`] = 1;
        await this.dialogue.say({ speaker: P, text: lines[id] });
        return;
      }
    }
  }

  private outfitLook(o: Outfit): Look {
    const look = this.clothesLook(o);
    const e = this.state!.equip;
    const hat = e.hat ? ITEMS[e.hat].gear : undefined;
    if (hat?.hat) {
      look.hat = hat.hat;
      look.hatColor = hat.color;
    }
    if (e.cloak) look.cloak = ITEMS[e.cloak].gear?.color;
    if (e.weapon) look.weapon = ITEMS[e.weapon].gear?.weapon;
    return look;
  }

  private clothesLook(o: Outfit): Look {
    const base = { ...this.state!.character.look };
    const woman = this.state!.character.gender === 'woman';
    if (o === 'work') return { ...base, coat: 0x4a3a2e, hat: 'cap', hatColor: 0x2e2a26, scarf: 0x6a5a3a };
    if (o === 'sunday') return { ...base, coat: 0x1b1f2a, shirt: 0xf2efe6, hat: woman ? 'bonnet' : 'top', hatColor: 0x1b1f2a, scarf: undefined };
    if (o === 'coat') return { ...base, coat: 0x2e3a4a, scarf: 0xdcefff };
    return base;
  }

  /** Change clothes: the player's model changes, and people notice. */
  private dress(o: Outfit): void {
    const s = this.state!;
    s.outfit = o;
    this.refreshLook();
    sfx('flip');
    this.hud.toast(o === 'plain' ? 'You change back into your travelling clothes.' : `You change into your ${OUTFIT_NAMES[o].replace(/^Docker's /, "docker's ")}.`);
  }

  /** Rebuild the player's model from clothes and equipment. */
  private refreshLook(): void {
    const s = this.state!;
    const o = s.outfit;
    const old = this.player!;
    const p = new Player(this.location.grid, this.outfitLook(o), old.position.x, old.position.y);
    p.faceToward({ x: old.position.x, z: old.position.y + 1 }, true);
    old.rig.root.removeFromParent();
    this.location.scene.add(p.rig.root);
    this.player = p;
    this.applyUpgrades();
  }

  private chooseOutfit(): void {
    this.openBag(0);
  }

  /** What someone says the first time they see you in new clothes. */
  private outfitReaction(id: string): string | null {
    const s = this.state!;
    const key = `outfit:${id}`;
    const seen = s.used[key];
    const code = ['plain', 'work', 'sunday', 'coat'].indexOf(s.outfit);
    if (seen === code || (seen === undefined && s.outfit === 'plain')) return null;
    s.used[key] = code;
    const res = RESIDENTS.find((r) => r.id === id)!;
    if (id === 'lizzie' && s.outfit !== 'plain') {
      const r = this.rel('lizzie');
      r.friendship = Math.min(100, r.friendship + 3);
      return 'That\'s my stitching! Oh, it sits beautifully on you.';
    }
    const lower = res.cls === 'lower';
    const R: Record<Outfit, [string[], string[]]> = {
      work: [['Proper docker now, eh?', 'That jacket\'s seen a hard day. Good.'], ['Dressed for the docks, I see.']],
      sunday: [['Look at you! Off to see the Queen?', 'Lord Muck! Mind your shoes in the gutter.'], ['Very proper. Very proper indeed.', 'Now that is how one dresses.']],
      coat: [['Swanky coat. Who\'d you rob?', 'Fancy coat, that.'], ['A respectable coat. One begins to take you seriously.']],
      plain: [['Back in your old things?'], ['Ah. The old clothes again.']],
    };
    const pool = R[s.outfit][lower ? 0 : 1];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** How your clothes change your odds with this person. */
  private dressBonus(id: string): number {
    const s = this.state!;
    const res = RESIDENTS.find((r) => r.id === id)!;
    const w = s.wear[s.outfit];
    const g = gear(s).dress * (res.cls === 'middle' ? 1 : 0.6);
    if (w < 15) return -0.08 + g;
    const k = w < 40 ? 0.5 : 1;
    const office = res.cls === 'middle' ? s.parish.rank * 0.04 : 0;
    if (s.outfit === 'coat') return 0.08 * k + office + g;
    if (s.outfit === 'work') return (CIRCLES.docks.includes(id) ? 0.08 : 0) * k + office + g;
    if (s.outfit === 'sunday') return (res.cls === 'middle' ? 0.1 : res.traits.includes('jovial') || res.traits.includes('cynical') ? -0.05 : 0.02) * k + office + g;
    return office + g;
  }

  /** The jealousy confrontation, when you next speak to someone who has heard. */
  private async confrontation(npc: Npc, p: Pending): Promise<void> {
    const s = this.state!;
    s.pending = s.pending.filter((x) => x !== p);
    const r = this.rel(npc.res.id);
    const other = p.about!;
    const ro = this.rel(other);
    const c = await this.dialogue.ask(
      { speaker: npc.res.name, text: `"${this.first(other)}. Don't pretend. Ruby told Jem, Jem told half the market, and the other half told me."` },
      ['I\'m sorry. It\'s you I want. (Charisma)', 'It\'s gossip. Nothing happened. (Cunning)', `I'll end it with ${this.first(other)}.`, 'I court who I please.'],
    );
    const lost = async (text: string) => {
      r.romance = 0;
      r.rivalry = Math.min(100, r.rivalry + 30);
      r.friendship = Math.max(0, r.friendship - 20);
      this.note('wronged', npc.res.id, undefined, [npc.res.id]);
      await this.dialogue.say({ speaker: npc.res.name, text });
    };
    if (c === 0) {
      if (Math.random() < 0.3 + s.character.skills.charisma * 0.05) {
        r.romance = Math.max(0, r.romance - 5);
        await this.dialogue.say({ speaker: npc.res.name, text: '"…Fine. But I\'m watching you."' });
      } else await lost('"Sorry is a word. I wanted a person." They walk away.');
    } else if (c === 1) {
      if (Math.random() < 0.25 + s.character.skills.cunning * 0.06) {
        await this.dialogue.say({ speaker: npc.res.name, text: '"…Ruby does make things up." They want to believe you. For now.' });
      } else await lost('"Liar." The word lands harder than a fist.');
    } else if (c === 2) {
      ro.romance = 0;
      ro.rivalry = Math.min(100, ro.rivalry + 25);
      addFact(s, 'wronged', [other], other);
      r.romance = Math.min(100, r.romance + 5);
      await this.dialogue.say({ speaker: npc.res.name, text: `"Good." They take your hand. Somewhere, ${this.first(other)} is going to hear about this too.` });
    } else {
      await lost('"Then court them." They turn their back on you.');
    }
    s.facts = s.facts.filter((f) => !(f.kind === 'courting' && f.about === other && c === 2));
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

  private async sleep(kind: 'morning' | 'nap' | 'collapse' | 'rough'): Promise<void> {
    const s = this.state!;
    if (this.busy) return;
    if ((kind === 'morning' || kind === 'rough') && s.needs.rest > 90) {
      this.hud.toast("You're not tired enough to sleep.");
      return;
    }
    this.busy = true;
    this.player!.stop();
    this.hud.hidePlace();
    await this.hud.fade(true);

    let minutes: number;
    if (kind === 'morning' || kind === 'rough') {
      const nowMin = minuteOfDay(s.minutes);
      const today = dayIndex(s.minutes);
      const wakeToday = this.wakeTime(today);
      minutes = nowMin < wakeToday ? wakeToday - nowMin : DAY - nowMin + this.wakeTime(today + 1);
    } else if (kind === 'nap') minutes = 120;
    else minutes = 6 * 60;

    const outdoors = this.location.id === 'saltwharf';
    if (kind === 'morning' && this.location.id === 'hesterRoom') {
      const e = this.locations.hesterRoom.entries.bed;
      this.player!.teleport(this.location.grid, e.x, e.z);
    }
    const mode = outdoors ? 'roughSleep' : 'asleep';
    const scarf = outdoors && (owns(s, 'scarf') || gear(s).warm);
    const mattress = !outdoors && owns(s, 'mattress');
    for (let m = 0; m < minutes; m += 10) {
      simulateNeeds(s.needs, 10 / 60, mode);
      if (mattress) addNeed(s.needs, 'rest', 6.5 / 6);
      if (scarf) addNeed(s.needs, 'rest', 2 / 6);
      this.clock.minutes += 10;
    }
    s.minutes = this.clock.minutes;
    if (kind === 'collapse') addNeed(s.needs, 'health', -10);
    if (outdoors && !scarf) addNeed(s.needs, 'health', -5);
    if (outdoors) this.wearOut(8);
    const theft = outdoors ? this.theftWhileAsleep() : null;
    const rentNews = this.checkRent();
    await this.hud.fade(false);
    this.busy = false;

    if (kind === 'morning') this.hud.toast(`You wake at ${this.clock.formatTime()}, ${this.clock.formatDate()}.`);
    if (kind === 'rough') this.hud.toast(`You wake stiff and cold at ${this.clock.formatTime()}.`, 3500);
    if (kind === 'nap') this.hud.toast('You doze for two hours.');
    if (kind === 'collapse') this.hud.toast('You collapse from exhaustion and wake hours later, aching.', 4000);
    if (theft) await this.dialogue.say({ speaker: '', text: theft });
    if (rentNews) await this.announceRent(rentNews);
    await this.attendance();

    if (kind === 'morning' && s.tutorial.step === 'explore') {
      s.tutorial.slept = true;
      this.refreshObjectives();
      if (s.tutorial.askedDocks && s.tutorial.askedCup) await this.firstMorningScene();
    }
    if (kind === 'morning' || kind === 'rough') await this.morningSummary(this.nightlyWorld());
    this.save();
  }

  /** Wake half an hour before the first morning shift that day; otherwise at seven. */
  private wakeTime(day: number): number {
    const s = this.state!;
    let wake = 7 * 60;
    for (const e of s.jobs) {
      const job = JOBS[e.jobId];
      if (job.days.includes(weekday(day)) && job.start < 12 * 60) wake = Math.min(wake, job.start - 30);
    }
    return wake;
  }

  /** The day's opening: yesterday's money, today's obligations, the nearest goal. */
  private async morningSummary(world: string[] = []): Promise<void> {
    const s = this.state!;
    const day = dayIndex(s.minutes);
    const lines: string[] = [];
    const delta = Math.round((s.money - s.dayStartMoney) * 100) / 100;
    lines.push(`Purse: £${s.money.toFixed(2)} (${delta >= 0 ? '+' : '−'}£${Math.abs(delta).toFixed(2)} since yesterday morning)`);
    // Business partners pay a small weekly cut, on Mondays.
    if (weekday(day) === 1 && s.used.dividend !== day) {
      s.used.dividend = day;
      const partners = RESIDENTS.filter((p) => (s.relations?.[p.id]?.business ?? 0) >= 30);
      if (partners.length) {
        const cut = Math.round(partners.length * 0.03 * 100) / 100;
        s.money = Math.round((s.money + cut) * 100) / 100;
        lines.push(`Your business partners send their weekly cut: £${cut.toFixed(2)} (${partners.map((p) => p.name.split(' ')[0]).join(', ')})`);
      }
    }
    const shifts = s.jobs.filter((e) => JOBS[e.jobId].days.includes(weekday(day)));
    lines.push(shifts.length
      ? `Today: ${shifts.map((e) => `${title(s, e)} at ${String(Math.floor(JOBS[e.jobId].start / 60)).padStart(2, '0')}:00`).join(', ')}`
      : s.jobs.length ? 'Today: no shifts. A day of your own.' : 'Today: no work yet. The Dock Hiring Office and the Copper Cup are hiring.');
    if (s.housed) {
      const days = Math.max(0, Math.ceil((this.clock.rentDue.getTime() - this.clock.date.getTime()) / 86_400_000));
      lines.push(`Rent: £${s.rent.amount.toFixed(2)} in ${days} day${days === 1 ? '' : 's'}${s.money >= s.rent.amount ? ' (you have it)' : ''}`);
    } else lines.push(`Homeless: Grubb wants £${s.rent.arrears.toFixed(2)} to let you back in`);
    lines.push(...world);
    lines.push(`Weather: ${WEATHER_TEXT[s.weather]}`);
    if (hasPerk(s, 'occult', 10) && s.tomorrow === 'fog') lines.push('You feel it in your teeth: fog tomorrow.');
    const hol = holidayOn(day);
    if (hol) lines.push(hol.text);
    const soon = holidayOn(day + 1);
    if (soon) lines.push(`Tomorrow: ${soon.name}.`);
    if (isSunday(day)) lines.push('Sunday: Father Hale holds a service at the market cross until noon.');
    for (const e of s.jobs) {
      const t = MOOD_TEXT[e.jobId]?.[bossMood(e.jobId, day, s)];
      if (t && bossMood(e.jobId, day, s) !== 'fair') lines.push(t);
    }
    if (s.parish.standing !== null) lines.push(s.parish.standing === day ? 'Election day: the count is at noon at the market cross.' : `Election in ${s.parish.standing - day} days: ${s.parish.pledges.length} pledged, ${s.parish.crowd} won by speeches.`);
    const hot = ZONES.find((z) => z.id === s.hotZone)?.name;
    if (hot) lines.push(`Word on the street: stay out of ${hot} after dark.`);
    if (weekday(day) === FIGHT_NIGHT.day) lines.push(`Fight Night tonight at the boxing yard, 20:00: ${this.nextBout().enemy.name}.`);
    const g = this.goals().find((x) => !x.startsWith('Rent'));
    if (g) lines.push(`Goal: ${g}`);
    s.dayStartMoney = s.money;
    await this.hud.modal(this.clock.formatDate(), lines);
  }

  /** Sleeping in the street: someone may go through your pockets. Cunning wakes you; a friend may keep watch. */
  private theftWhileAsleep(): string | null {
    const s = this.state!;
    if (hasPerk(s, 'cunning', 10)) return null;
    const mag = s.relations?.mag;
    const watched = !!mag && mag.friendship >= 30;
    const chance = Math.max(0.05, 0.45 - s.character.skills.cunning * 0.04) * (watched ? 0.4 : 1);
    if (Math.random() >= chance) return watched ? 'Old Mag sat up all night beside you, muttering at shadows. Nothing was taken.' : null;
    if (Math.random() < 0.3 + s.character.skills.cunning * 0.03) return 'You wake to a hand in your coat and grab the wrist. A boy tears free and runs. Nothing taken, this time.';
    const take = Math.round(s.money * 0.5 * 100) / 100;
    if (take > 0) {
      s.money = Math.round((s.money - take) * 100) / 100;
      return `Someone went through your pockets while you slept. £${take.toFixed(2)} gone.`;
    }
    if (s.inventory.length) {
      const it = s.inventory[Math.floor(Math.random() * s.inventory.length)];
      removeItem(s, it.id);
      return `Someone went through your bag while you slept. Your ${ITEMS[it.id].name.toLowerCase()} is gone.`;
    }
    return null;
  }

  /** Grubb's news; if he has thrown you out, you are put on the street. */
  private async announceRent(news: string): Promise<void> {
    await this.dialogue.say({ speaker: 'Mr. Grubb', text: news });
    if (this.rentPaid) {
      this.rentPaid = false;
      await this.hud.celebrate('goal', 'Goal complete', 'Rent paid', 'A roof for another month');
    }
    if (!this.state!.housed && this.location.id === 'hesterRoom') {
      await this.goTo('saltwharf', 'hester');
      this.hud.toast('Evicted. Sleep rough in the Gull Court archway, or pay Grubb to get the room back.', 5000);
    }
  }

  /** Pay off the arrears and take the room back. */
  private async reclaimRoom(): Promise<void> {
    const s = this.state!;
    const cost = s.rent.arrears;
    if (s.money < cost) return;
    s.money = Math.round((s.money - cost) * 100) / 100;
    s.rent.arrears = 0;
    s.housed = true;
    s.rent.dueMonth = monthIndex(this.clock.date);
    void this.hud.celebrate('goal', 'Goal complete', 'Home again', "Hester's room is yours once more");
    await this.dialogue.say({ speaker: 'Mr. Grubb', text: `£${cost.toFixed(2)}. Here's the new key. Next month's due at the end of the month, same as ever.` });
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
    if (!s.housed) return null;
    if (r.graceUntil === null && now > r.dueMonth) {
      if (s.money >= r.amount) {
        pay();
        this.rentPaid = true;
        return `Rent, £${r.amount.toFixed(2)}. Paid. Pleasure, I'm sure. Same again at the end of the month.`;
      }
      r.graceUntil = this.clock.minutes + ((this.friend('grubb') ? 14 : 7) + (s.parish.rank > 0 ? 7 : 0)) * DAY;
      return `£${r.amount.toFixed(2)}, and you haven't got it. ${this.friend('grubb') ? 'Fourteen days, because I like you.' : 'Seven days.'} After that you and your things go in the gutter.`;
    }
    if (r.graceUntil !== null) {
      if (s.money >= r.amount) {
        pay();
        r.graceUntil = null;
        this.rentPaid = true;
        return "Paid at last. Don't make me climb those stairs again.";
      }
      if (this.clock.minutes > r.graceUntil) {
        s.housed = false;
        addFact(s, 'evicted', ['grubb', 'pell', 'mag']);
        r.graceUntil = null;
        r.arrears = r.amount;
        return `Time's up. The lock's changed and the room's let. You want it back, it's £${r.arrears.toFixed(2)}, cash.`;
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
    if (!s) return;
    if (s.tutorial.step === 'explore') {
      const t = s.tutorial;
      this.hud.setGoals([
        ...(t.askedDocks ? [] : ['Ask for work at the Dock Hiring Office']),
        ...(t.askedCup ? [] : ['Ask for work at the Copper Cup']),
        ...(t.slept ? [] : ['Sleep in your bed tonight']),
      ]);
      return;
    }
    this.hud.setGoals(this.goals());
  }

  /** Short goals for after the tutorial: rent, the next rank, a person, something to buy. */
  private goals(): string[] {
    const s = this.state!;
    const out: string[] = [];
    for (const q of s.quests.filter((x) => !x.done).slice(0, 2)) out.push(`Favour: ${q.text}`);
    if (s.parish.standing !== null) out.push(`Election in ${Math.max(0, s.parish.standing - dayIndex(s.minutes))} days: ${s.parish.pledges.length} pledges, ${s.parish.crowd} from speeches`);
    if (!s.housed) out.push(`Get your room back: £${s.money.toFixed(2)} / £${s.rent.arrears.toFixed(2)}`);
    else if (s.money < s.rent.amount) out.push(`Rent by ${this.clock.formatShortDate(this.clock.rentDue)}: £${s.money.toFixed(2)} / £${s.rent.amount.toFixed(2)}`);
    if (s.jobs.length === 0) out.push('Find work: the Dock Hiring Office or the Copper Cup');
    for (const e of s.jobs) {
      const p = promotionText(s, e.jobId);
      if (p.startsWith('Next:')) out.push(p.replace('Next:', 'Promotion:'));
    }
    const known = RESIDENTS.filter((p) => s.relations?.[p.id]?.met);
    const close = known
      .map((p) => ({ p, f: s.relations[p.id].friendship }))
      .filter((x) => x.f < 30)
      .sort((a, b) => b.f - a.f)[0];
    if (close) out.push(`Befriend ${close.p.name.split(' ')[0]}: friendship ${Math.round(close.f)} / 30`);
    else if (known.length < RESIDENTS.filter((r) => this.present(r)).length) out.push(`Meet the neighbours: ${known.length} / ${RESIDENTS.filter((r) => this.present(r)).length}`);
    const office = OFFICES[s.parish.rank];
    if (office && s.parish.standing === null && s.character.skills.study >= office.study - 1) out.push(`Stand for ${office.name}: ask Father Hale (Study ${office.study}, ${office.friends} friends)`);
    const want = Object.values(ITEMS).filter((i) => i.upgrade && !s.owned.includes(i.id)).sort((a, b) => a.price - b.price)[0];
    if (want) {
      const where = SHOPS.hester.stock.includes(want.id) ? "Pell's Chandlery" : 'Rag & Bone';
      out.push(s.money >= want.price
        ? `Buy ${want.name.toLowerCase()} at ${where}: you can afford it`
        : `Save for ${want.name.toLowerCase()}: £${s.money.toFixed(2)} / £${want.price.toFixed(2)}`);
    }
    return out;
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
    await this.hud.celebrate('goal', 'Chapter one', 'You survived your first day', 'Saltwharf is yours to make or break');
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
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    const c = s.character;
    const due = this.clock.formatShortDate(this.clock.rentDue);
    const attraction = { men: 'men', women: 'women', both: 'men and women' }[c.attraction];
    // Skills page: level, progress to the next, perks, mentors, and how you feel.
    const skills = SKILLS.map((k) => {
      const lvl = c.skills[k];
      const pct = lvl >= 20 ? 100 : Math.min(100, Math.round((s.skillXp[k] / xpToNext(lvl)) * 100));
      const np = nextPerk(s, k);
      const m = MENTORS[k];
      return `<div class="skillrow"><div class="sk-h"><span>${SKILL_INFO[k].name}</span><b>${lvl}<small> / 20</small></b></div>
        <div class="sk-bar"><i style="width:${pct}%"></i></div>
        <div class="sk-sub">${np ? `At ${np.level}: <em>${esc(np.name)}</em>` : 'Every perk learned'} · mentor ${esc(this.short(m.who))}</div></div>`;
    }).join('');
    const perks = PERKS_OWNED(s).map((p) => `<li><b>${esc(p.name)}</b>: ${esc(p.text)}</li>`).join('');
    const needs = (['hunger', 'rest', 'social', 'health'] as NeedId[]).map((n) => `<div class="needrow"><span>${NEED_NAMES[n]}</span><div class="sk-bar"><i style="width:${Math.round(s.needs[n])}%"></i></div><b>${Math.round(s.needs[n])}</b></div>`).join('');
    const skillsHtml = `<p class="meta">${c.gender === 'man' ? 'Man' : 'Woman'} · attracted to ${attraction}</p>
      ${skills}
      <h3>Perks</h3><ul class="perks">${perks || '<li>None yet: they come at levels 3, 6 and 10.</li>'}</ul>
      <h3>How you are</h3>${needs}`;
    // Missions page: the story, favours, goals, work, money and standing.
    const story = s.hesterLetters > 0
      ? `Hester's letters (${s.hesterLetters} of ${HESTER_LETTERS.length}) speak of Wardens, the fog and Mr. Vane's lamps. The trunk in your room will not open yet.`
      : 'Hester left you her room, her ghost and a trunk that will not open. Mrs. Pell may know more.';
    const favours = s.quests.filter((q) => !q.done).map((q) => `<li>${esc(q.text)}</li>`).join('') || '<li>Nobody needs anything from you just now. Make friends, and they will.</li>';
    const goals = this.goals().filter((g) => !g.startsWith('Favour')).map((g) => `<li>${esc(g)}</li>`).join('');
    const work = s.jobs.map((e) => `<li>${esc(title(s, e))} at the ${esc(JOBS[e.jobId].employer)}: ${esc(nextShiftText(s, e.jobId))}. ${esc(promotionText(s, e.jobId))}</li>`).join('') || '<li>Unemployed.</li>';
    const rent = s.rent.graceUntil !== null ? `Rent of £${s.rent.amount.toFixed(2)} is overdue.` : `Rent of £${s.rent.amount.toFixed(2)} is due ${due}.`;
    const office = officeTitle(s, c.gender === 'woman');
    const missionsHtml = `
      <h3>The story</h3><p>${esc(story)}</p>
      <h3>Favours</h3><ul class="perks">${favours}</ul>
      <h3>Goals</h3><ul class="perks">${goals}</ul>
      <h3>Work</h3><ul class="perks">${work}</ul>
      <h3>Purse</h3><p>£${s.money.toFixed(2)}. ${rent}${s.debt > 0 ? ` You owe the hospital £${s.debt.toFixed(2)}.` : ''}</p>
      <h3>Standing</h3><p>${office ? `${office} of St. Botolph. ` : ''}${s.parish.standing !== null ? `Standing for ${OFFICES[s.parish.rank].name}: ${s.parish.pledges.length} pledged, ${s.parish.crowd} won by speeches.` : OFFICES[s.parish.rank] ? `Next: ${OFFICES[s.parish.rank].name} (Study ${OFFICES[s.parish.rank].study}, ${OFFICES[s.parish.rank].friends} friends; ask Father Hale).` : ''}${s.champion ? ` ${CHAMPION_TITLE}.` : ''}</p>
      <h3>Days ahead</h3><p>${HOLIDAYS.map((h) => `${h.name}, ${h.date} ${h.month === 9 ? 'Oct' : 'Nov'}`).join(' · ')}. Today: ${s.weather}.</p>`;
    this.hud.setJournal(Hud.titleFor(s), skillsHtml, missionsHtml);
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

    this.sound.setAmbience(this.mode === 'play' ? this.clock.hour : 21, this.location.id !== 'saltwharf', document.querySelector('.minigame') !== null, this.mode === 'play' && this.state?.weather === 'rain');

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
      if (news) void this.announceRent(news);
      this.checkCollapse();
      this.night(this.clock.minutes - before);
      this.remindShifts();
      this.goalsTimer -= dt;
      if (this.goalsTimer <= 0) {
        this.goalsTimer = 1;
        this.refreshObjectives();
      }
      // Wages pay off hospital debt first.
      if (s.debt > 0 && s.money > 0) {
        const pay = Math.min(s.debt, s.money);
        s.money = Math.round((s.money - pay) * 100) / 100;
        s.debt = Math.round((s.debt - pay) * 100) / 100;
        if (s.debt === 0) this.hud.toast('Your hospital bill is paid off.');
      }
      // A strike is no absence: shifts lost to the picket line don't count against you.
      const today = dayIndex(s.minutes);
      const e = employment(s, 'docks');
      if (e && s.strike && today >= s.strike.day && today <= s.strike.until) e.checkedDay = Math.max(e.checkedDay, today);
      void this.attendance();
      // Rain soaks you outdoors, unless you have a good coat on.
      const mins = this.clock.minutes - before;
      if (s.weather === 'rain' && this.location.id === 'saltwharf' && mins > 0) {
        if (s.outfit !== 'coat' && !gear(s).rain) addNeed(s.needs, 'health', (-1.5 * mins) / 60);
        this.wearOut((2 * mins) / 60);
      }
      this.checkQuests();
      if (s.parish.standing !== null && today >= s.parish.standing && this.clock.hour >= 12 && !this.busy && !this.dialogue.open && !this.hud.blocking) void this.election();
      if (s.minutes - this.lastSaveMinute >= 60) this.save();
    }

    player.update(dt, this.elapsed);
    this.updateNpcs(dt);
    this.updateStalker(dt);
    this.updateTully(dt);
    if (this.location.id === 'saltwharf') {
      const day = dayIndex(s.minutes);
      const hol = holidayOn(day)?.id ?? (holidayOn(dayIndex(s.minutes - 6 * 60))?.id === 'hallows' && this.clock.hour < 6 ? 'hallows' : null);
      this.life.update(dt, this.elapsed, {
        hour: this.clock.hour, day, weather: s.weather, player: player.position,
        sight: s.character.skills.occult + gear(s).occult >= 3 || hol === 'hallows', holiday: hol,
        headline: this.headline ??= gazette(s, day, 'Gull Court', [], '')[0],
        lost: s.quests.filter((q) => q.kind === 'lost' && !q.found && q.at).map((q) => ({ id: q.id, x: q.at!.x, z: q.at!.z })),
      });
      if (this.headlineDay !== day) {
        this.headlineDay = day;
        this.headline = null;
      }
    }
    const atmo = document.querySelector('.atmo');
    atmo?.classList.toggle('foggy', s.weather === 'fog' && this.location.id === 'saltwharf');
    atmo?.classList.toggle('rainy', s.weather === 'rain' && this.location.id === 'saltwharf');
    this.dangerTimer -= dt;
    if (this.dangerTimer <= 0) {
      this.dangerTimer = 0.4;
      this.updateDanger();
    }
    // A comfortable room tops up Social while you are home.
    if (!paused && this.location.id === 'hesterRoom') addNeed(s.needs, 'social', (this.comfort() * 0.6 * dt) / 60 * this.clock.speed);
    this.location.update(this.clock.hour, this.elapsed);
    for (const d of this.doorIcons) {
      d.sprite.position.y = d.y + Math.sin(this.elapsed * 2.4) * 0.07;
      d.sprite.scale.setScalar(0.62 + Math.sin(this.elapsed * 4.8) * 0.03);
    }
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
    // Any skill that rose since last frame gets its moment, wherever the XP came from.
    if (!this.prevSkills) this.prevSkills = { ...s.character.skills };
    for (const k of SKILLS) {
      if (s.character.skills[k] > (this.prevSkills[k] ?? 0)) {
        const perk = perkAt(k, s.character.skills[k]);
        void this.hud.celebrate('skill', perk ? `New perk: ${perk.name}` : 'Skill improved', `${SKILL_INFO[k].name} ${s.character.skills[k]}`, perk ? perk.text : SKILL_INFO[k].blurb);
      }
    }
    this.prevSkills = { ...s.character.skills };
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
