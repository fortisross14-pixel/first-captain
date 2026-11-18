import * as THREE from 'three';
import { Npc } from '../actors/Npc';
import { Player } from '../actors/Player';
import { createCharacter, type Look, type Rig } from '../actors/characterModel';
import { GRADE_INFO, JOBS, autopilotGrade, dayIndex, gradeFor, minuteOfDay, weekday, type Grade } from '../game/jobs';
import { addNeed, simulateNeeds } from '../game/needs';
import { AUTHORED_RESIDENTS, RESIDENTS, stopAt, type Resident, type Stop } from '../game/residents';
import {
  AUTHORED, HAUNTS, HOMES, JOB_KINDS, ageOf, authoredRecords, babyNames, childRecord, fullNameOf, generatePopulation, roleOf, scheduleFor, simulateNight, voiceFor,
  type LifeEvent, type PersonRec,
} from '../game/population';
import { RECIPES, cookMult, ingredients, missing as recipeMissing } from '../game/food';
import { LESSON_XP, MENTORS, PERKS, hasPerk, nextPerk, perkAt } from '../game/skills';

const PERKS_OWNED = (s: GameState) => PERKS.filter((p) => s.character.skills[p.skill] >= p.level);
import { HOLIDAYS, MOOD_PAY, MOOD_TEXT, WEATHER_TEXT, bossMood, holidayOn, isSunday, rollWeather, strikeStarts } from '../game/calendar';
import { JOURNAL, URGENT, clockWord } from '../game/story';
import { FACTIONS, FACTION_IDS, addDeed, factionOf, joinBlockers, rankIn, standing, type FactionId } from '../game/factions';
import { FUTURE_OFFICES, OFFICES, count as countVotes, officeTitle, pledgeChance, voters } from '../game/parish';
import { ASKS, LOST_ZONES, PLACE_NAMES, READ_LETTERS, type Quest } from '../game/quests';
import { ACTIVITY_TEXT, AMBIENT, CONFUSED_LINES, GENERIC, SICK_LINES, conversation } from '../game/talk';
import { EVICTION_DAY, FUNERAL_DAY, Life, VANE_DONE, VANE_START } from './Life';
import {
  DAILY_LIMIT, INTERACTIONS, canRomance, interact, knownTraits, newRelation, relationLabel, type Interaction, type Relation,
} from '../game/social';
import { HOT_ZONES, NOTORIOUS, ZONES, dangerAt, zoneAt } from '../game/danger';
import { CHAMPION_TITLE, FIGHT_NIGHT, LADDER, type Bout } from '../game/fightnight';
import { CONGRATS, HESTER_LETTERS, gazette, sendLetter } from '../game/letters';
import { CIRCLES, addFact, knowledgeOf, reactions, spreadGossip, type FactKind, type Pending } from '../game/world';
import { OUTFIT_NAMES, SLOT_NAMES, gear, isFood, isJunk, type Outfit, type Slot, ITEMS, SHOPS, addItem, buy, canCarry, owns, removeItem, sell, sellPrice, slots, usedSlots, useItem } from '../game/items';
import { SHOP_KEEPERS, VOICES } from '../game/voices';
import {
  canStartShift, checkAttendance, completeShift, dayStart, employment, gainXp, hire, hireBlocker, leave, nextShiftText,
  promotionText, title,
} from '../game/work';
import { formatMinutes, rankTitle, xpToNext } from '../game/jobs';
import { playBar } from '../minigames/bar';
import { ENEMIES, runFight, type Enemy } from '../minigames/fight';
import { playCargo } from '../minigames/cargo';
import { NEED_NAMES, SKILLS, SKILL_INFO, currentSlot, deleteSave, latestSlot, loadGame, newGame, saveGame, slotInfo, useSlot, type Character, type GameState, type LocationId, type NeedId, type SkillId } from '../game/state';
import { Creator } from '../ui/Creator';
import { Dialogue, type Line } from '../ui/Dialogue';
import { Hud, type Action, type ListRow, type PieItem } from '../ui/Hud';
import { Title } from '../ui/Title';
import { Prologue } from '../ui/Prologue';
import { installPrompt, isIOSInstallable, runInstall } from '../pwa';
import { buildHesterRoom } from '../world/hesterRoom';
import { HOMES_TO_LET, type HomeId } from '../world/homes';
import type { Location, Place } from '../world/location';
import { buildSaltwharf } from '../world/saltwharf';
import { makeDoorIcon } from '../world/doorIcon';
import { FLOOR_COLORS, FURNITURE, WALL_COLORS, defaultLayout, footprint, type FurnitureType } from '../world/furniture';
import { SPOTS, rummage } from '../world/scavenge';
import { EXITS, ROUTE_TO } from '../world/exits';
import { INTERIORS, buildInterior, isOpen } from '../world/interior';
import { HOUSES, OLD_HOMES } from '../world/saltwharfHomes';
import { MAIN_IDS, MISSION, MISSIONS, currentChapter, objectiveOf, reqMet, reqText, sideStatus, type MissionDef, type MissionState, type Req } from '../game/missions';
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

const LONDON_NAMES: Record<string, string> = {
  market: 'Lantern Market', hollow: 'Hollow Lane', inkwell: 'Inkwell Row and Greymourne', ironmonger: 'Ironmonger\'s Cross',
};

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
  /** Your family at home in Hester's room, in the evenings. */
  private homeNpcs: Npc[] = [];
  /** Keepers behind their counters, one per interior. */
  private keepers = new Map<string, Npc>();
  /** The regulars actually in the Copper Cup tonight. */
  private patrons: Npc[] = [];
  private patronTimer = 0;
  private readonly portraits: Portraits;
  private readonly doorIcons: { sprite: THREE.Sprite; y: number; loc: LocationId; place: string; to: [LocationId, string] }[] = [];
  private ambientTimer = 4;
  private chatTimer = 12;
  private chat: { a: Npc; b: Npc; lines: [string, string][]; i: number; t: number; spread: import('../game/world').Fact | null } | null = null;
  private askTimer = 20;
  private shadowTimer = 0;
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
    this.renderer.toneMappingExposure = 1.3;
    container.appendChild(this.renderer.domElement);
    // Drifting fog and a vignette over the world: cheap, compositor-only layers.
    container.insertAdjacentHTML('beforeend', '<div class="atmo" aria-hidden="true"><i class="fog f1"></i><i class="fog f2"></i><div class="vignette"></div></div>');

    this.locations = { saltwharf: buildSaltwharf(), hesterRoom: buildHesterRoom() } as Record<LocationId, Location>;
    for (const def of INTERIORS) this.locations[`int:${def.id}`] = buildInterior(def);
    this.location = this.locations.saltwharf;
    for (const r of RESIDENTS) {
      const npc = new Npc(r, this.locations.saltwharf.grid);
      this.locations.saltwharf.scene.add(npc.walker.rig.root);
      this.npcs.push(npc);
    }
    for (const def of INTERIORS) {
      const res = AUTHORED_RESIDENTS.find((r) => r.id === def.keeper);
      const loc = this.locations[`int:${def.id}`];
      if (!res) continue;
      const at = { x: Math.floor(def.w / 2), z: def.d - 1 };
      const npc = new Npc({ ...res, home: at, schedule: [{ from: def.open[0], to: def.open[1], x: at.x, z: at.z, act: def.kind === 'tavern' ? 'count' : def.kind === 'office' ? 'read' : 'count' }] }, loc.grid);
      loc.scene.add(npc.walker.rig.root);
      this.keepers.set(def.id, npc);
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
    this.hud.onDecor = () => this.startDecor();
    this.hud.onRelations = (on) => {
      this.relOn = on;
      if (on) this.tip('rings', 'Rings show how you stand: deep green for close friends, red for rivals, grey for strangers.');
      this.updateRings();
    };
    this.hud.onClosed = () => this.save();
    this.hud.onInstall = () => void runInstall().then(() => { if (!installPrompt && !isIOSInstallable()) this.hud.toast('Use your browser menu: "Install app" or "Add to Home Screen".', 4000); });
    this.hud.onMap = (v) => this.openMap(v);
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
    this.dialogue.onClose = () => this.save();
    window.setInterval(() => this.save(), 20000);
    this.portraits = new Portraits(this.renderer);
    this.dialogue.portraitFor = (name) => this.portraitOf(name);
    // Ways in and out are marked: the stairs down from Hester's room, and her door from the street.
    const icon = (loc: LocationId, kind: 'exit' | 'home', x: number, y: number, z: number, place: string, to: [LocationId, string]) => {
      const sp = makeDoorIcon(kind);
      sp.position.set(x, y, z);
      this.locations[loc].scene.add(sp);
      this.doorIcons.push({ sprite: sp, y, loc, place, to });
    };
    icon('hesterRoom', 'exit', 0.45, 1.55, 1.5, 'door', ['saltwharf', 'hester']);
    icon('saltwharf', 'home', 11.5, 2.7, 8.95, 'hester', ['hesterRoom', 'door']);
    icon('saltwharf', 'home', 3.5, 2.7, 16.95, 'tenements', ['hesterRoom', 'door']);
    for (const def of INTERIORS) icon(`int:${def.id}`, 'exit', def.w / 2, 1.3, 0.25, 'exit', ['saltwharf', def.id]);
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
      slotInfo(),
      latestSlot(),
      (n) => {
        useSlot(n);
        const s = loadGame(n);
        if (s) void this.startGame(s);
      },
      (n) => {
        useSlot(n);
        this.showCreator();
      },
      (n) => deleteSave(n),
      { can: () => !!installPrompt || isIOSInstallable(), run: () => runInstall() },
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
    this.syncPopulation();
    this.syncHome();
    this.homeBuilt = false;
    this.rebuildHome();
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
    if (s.tutorial.step === 'intro') await new Prologue(this.container, s.character).done;
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
    if (this.decor && id !== 'hesterRoom') this.endDecor();
    this.hud.decorButton = id === 'hesterRoom';
    this.hud.relButton = id !== 'hesterRoom';
  }

  private async goTo(id: LocationId, entry: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.hud.hidePlace();
    await this.hud.fade(true);
    const loc = this.locations[id];
    let e = loc.entries[entry];
    if (!e) {
      // Coming out of a building: stand on its doorstep.
      const pl = loc.places.find((p) => p.id === entry);
      e = pl ? { x: pl.door.x + 0.5, z: pl.door.z + 0.5, faceX: pl.door.x + 0.5, faceZ: pl.door.z - 2 } : loc.entries[Object.keys(loc.entries)[0]];
    }
    this.enterLocation(id, e.x, e.z, e.faceX, e.faceZ);
    await this.hud.fade(false);
    this.busy = false;
    if (id === 'hesterRoom') await this.pembletonOnFurniture();
    if (id === 'hesterRoom' && this.state?.tutorial.step === 'done') this.tip('ghostwork', 'Saltwharf only pays for Strength and Charisma. Ask Pembleton what your other skills are good for. Other rooms to rent: Gull Court and over the Copper Cup.');
    if (id === 'int:church') this.tip('church', 'Sunday service is at 11:00, after Hale\'s sermon at the market cross. The registers and the poor box are here too.');
    this.save();
  }

  // --- Input ----------------------------------------------------------------

  private tap(clientX: number, clientY: number): void {
    if (this.mode !== 'play' || this.busy || this.dialogue.open || this.hud.blocking || !this.player) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.rig.camera);

    if (this.decorTap()) return;
    for (const n of this.npcs) n.held = false;
    // The door icons: a generous target; tapping one walks you there and through.
    for (const d of this.doorIcons) {
      if (d.loc !== this.location.id || !d.sprite.visible) continue;
      const pr = d.sprite.position.clone().project(this.rig.camera);
      const sx = (pr.x * 0.5 + 0.5) * rect.width + rect.left;
      const sy = (-pr.y * 0.5 + 0.5) * rect.height + rect.top;
      if (Math.hypot(sx - clientX, sy - clientY) > 48) continue;
      if (d.loc === 'hesterRoom') {
        this.leaveHome();
        return;
      }
      if (d.to[0] === 'saltwharf' || this.state!.housed) {
        this.exitThrough(d.place, d.to);
        return;
      }
    }
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
    if (this.location.id !== 'saltwharf') {
      const keeper = this.location.id.startsWith('int:') ? this.keepers.get(this.location.id.slice(4)) : undefined;
      const vis = [...this.homeNpcs, ...this.patrons, ...(keeper ? [keeper] : [])].filter((n) => n.visible && n.walker.rig.root.parent === this.location.scene);
      const hit = this.raycaster.intersectObjects(vis.map((n) => n.walker.rig.root), true)[0];
      if (hit) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.npcId) o = o.parent;
        const npc = vis.find((n) => n.res.id === o?.userData.npcId);
        if (npc) {
          this.approach(npc);
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
    if (this.location.id === 'hesterRoom' && p.x < 0.9 && p.z > 0.6 && p.z < 2.4) {
      this.leaveHome();
      return;
    }
    if (this.location.id.startsWith('int:') && p.z < 0.5) {
      this.exitThrough('exit', ['saltwharf', this.location.id.slice(4)]);
      return;
    }
    const cell = this.location.grid.nearestWalkable(Math.floor(p.x), Math.floor(p.z), 3);
    this.hud.hidePlace();
    if (!cell) {
      this.hud.toast("You can't get there.", 1400);
      return;
    }
    if (this.player.walkTo(cell)) this.showMarker(cell.x + 0.5, cell.z + 0.5);
    else this.hud.toast("You can't find a way there.", 1400);
  }

  /** The Back Lane Pump: asking at Back Lane doors. Three houses tell you where the sick drink. */
  private pumpKnock(key: string): void {
    const m = this.mission('pump');
    if (!m || m.done || m.stage !== 1 || !HOUSES.find((x) => x.key === key)?.name.endsWith('Back Lane') || m.flags[`k:${key}`]) return;
    m.flags[`k:${key}`] = 1;
    m.flags.knocks = (m.flags.knocks ?? 0) + 1;
    if (m.flags.knocks >= 3) {
      void this.dialogue.say({ speaker: '', text: 'Three doors, three answers, all the same: "We get our water from the pump, same as everyone on the Lane. It tastes a bit off, lately." Church Street has its own pump. Church Street has no fever.' }).then(() => this.advance('pump', 2));
    } else this.hud.toast(`"Fever? Two of the children. We drink from the Lane pump, like everyone." (${m.flags.knocks} of 3 houses)`, 3500);
  }

  /** A house door: who lives here, and knocking for them. */
  private showHouse(place: Place): void {
    const s = this.state!;
    const key = place.id === 'tenements' ? 'court' : place.id.slice(6);
    const day = dayIndex(s.minutes);
    const h = Math.floor(this.clock.hour);
    const people = s.people.filter((p) => p.alive && p.home === key && p.district === 'Saltwharf');
    const met = (id: string) => !!s.relations?.[id]?.met;
    const actions: Action[] = [];
    for (const p of people) {
      const age = ageOf(p, day);
      const npc = this.npcs.find((n) => n.res.id === p.id);
      const known = met(p.id);
      const who = known ? this.nameOf(p.id) : age < 16 ? `the ${p.last} ${p.gender === 'man' ? 'boy' : 'girl'}` : p.gender === 'man' ? `Mr. ${p.last}` : p.spouse || p.widowed ? `Mrs. ${p.last}` : `Miss ${p.last}`;
      if (age < 3) continue;
      actions.push({
        label: `Knock for ${known ? this.short(p.id) : who}${!known && people.filter((q) => q.last === p.last && q.gender === p.gender && ageOf(q, day) >= 16 === age >= 16).length > 1 ? ` (${age})` : ''}`,
        onClick: () => {
          this.hud.hidePlace();
          sfx('drop');
          this.pumpKnock(key);
          const out = npc ? npc.visible || this.stopFor(npc.res, h) !== null : true;
          if (!npc || out || h >= 22 || h < 7) {
            const l = this.lifeOf(p.id);
            void this.dialogue.say({ speaker: '', text: h >= 22 || h < 7 ? 'A light goes on upstairs, then off again. Nobody comes down at this hour.' : `Nobody answers.${known && l.now !== 'Indoors somewhere' ? ` ${l.now}.` : ''}` });
            return;
          }
          npc.callOut(place.door);
          npc.walker.faceToward({ x: this.player!.position.x, z: this.player!.position.y });
          s.known[p.id] = { ...(s.known[p.id] ?? {}), home: true };
          this.hud.toast(`${known ? this.first(p.id) : `Someone`} opens the door.`, 2000);
          this.approach(npc);
        },
      });
    }
    const names = people.map((p) => (met(p.id) ? this.first(p.id) : null)).filter(Boolean);
    const desc = people.length
      ? `${place.description} The ${[...new Set(people.map((p) => p.last))].slice(0, 3).join(', ')} famil${new Set(people.map((p) => p.last)).size > 1 ? 'ies live' : 'y lives'} here${names.length ? ` (you know ${names.join(', ')})` : ''}.`
      : `${place.description} Empty, and to let. A card in the window: "Apply Mr. Grubb."`;
    if (place.id === 'tenements') actions.push(...this.streetActions('tenements', (label, fn, opts) => ({ label, onClick: () => { this.hud.hidePlace(); void fn(); }, ...opts })));
    this.hud.showPlace({ ...place, description: desc }, actions);
  }

  // --- The map --------------------------------------------------------------

  /** A one-line tip, the first time something comes up. */
  private tip(key: string, text: string): void {
    const s = this.state;
    if (!s) return;
    s.tips ??= {};
    if (s.tips[key]) return;
    s.tips[key] = true;
    window.setTimeout(() => this.hud.toast(`Tip · ${text}`, 6500), 400);
  }

  private openMap(view: 'london' | 'district'): void {
    if (!this.state) return;
    this.tip('map', 'Tap a building to read about it and walk there. The roads at the edges lead to other districts.');
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    // Shared engraving: dark paper, hatching, waves, fog, a compass rose.
    const defs = `<defs>
      <radialGradient id="mp-paper" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#4a3f2e"/><stop offset=".6" stop-color="#2e271d"/><stop offset="1" stop-color="#14110c"/></radialGradient>
      <pattern id="mp-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#2a231a"/><line x1="0" y1="0" x2="0" y2="5" stroke="#cdb88a" stroke-opacity=".38" stroke-width="1"/></pattern>
      <pattern id="mp-hatch2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="4" height="4" fill="#3a2e1c"/><line x1="0" y1="0" x2="0" y2="4" stroke="#e8c66a" stroke-opacity=".55" stroke-width="1"/></pattern>
      <pattern id="mp-cross" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#262019"/><path d="M0 0L6 6M6 0L0 6" stroke="#cdb88a" stroke-opacity=".3" stroke-width=".8"/></pattern>
      <pattern id="mp-waves" width="24" height="8" patternUnits="userSpaceOnUse"><rect width="24" height="8" fill="#141a22"/><path d="M0 5 Q6 1 12 5 T24 5" fill="none" stroke="#8aa0b0" stroke-opacity=".45" stroke-width=".9"/></pattern>
      <radialGradient id="mp-glow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".85"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
      <radialGradient id="mp-vane"><stop offset="0" stop-color="#e8f4ff" stop-opacity=".95"/><stop offset="1" stop-color="#e8f4ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="mp-vign" cx="50%" cy="50%" r="72%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
      <filter id="mp-fog" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".009 .016" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .82  0 0 0 0 .85  0 0 0 0 .88  0 0 0 1.25 -.5"/></filter>
      <filter id="mp-fogheavy" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .02" numOctaves="4" seed="11"/><feColorMatrix values="0 0 0 0 .7  0 0 0 0 .73  0 0 0 0 .76  0 0 0 2.2 -.55"/></filter>
    </defs>`;
    const rose = (x: number, y: number, r: number, north: 'up' | 'down') => `<g transform="translate(${x} ${y}) rotate(${north === 'down' ? 180 : 0})" class="mp-rose">
      <circle r="${r}" fill="none" stroke="#cdb88a" stroke-opacity=".6"/><circle r="${r * 0.78}" fill="none" stroke="#cdb88a" stroke-opacity=".35" stroke-dasharray="2 2"/>
      ${[0, 90, 180, 270].map((a) => `<path transform="rotate(${a})" d="M0 ${-r * 1.05} L${r * 0.16} 0 L0 ${r * 0.12} L${-r * 0.16} 0 Z" fill="${a === 0 ? '#e8c66a' : '#cdb88a'}" fill-opacity="${a === 0 ? 1 : 0.55}"/>`).join('')}
      ${[45, 135, 225, 315].map((a) => `<path transform="rotate(${a})" d="M0 ${-r * 0.65} L${r * 0.1} 0 L${-r * 0.1} 0 Z" fill="#cdb88a" fill-opacity=".4"/>`).join('')}
      <text y="${-r * 1.18}" transform="rotate(${north === 'down' ? 180 : 0} 0 ${-r * 1.25})" class="mp-n">N</text></g>`;
    const cartouche = (x: number, y: number, w: number, title: string, sub: string) => `<g class="mp-cart" transform="translate(${x} ${y})">
      <rect x="${-w / 2}" y="-22" width="${w}" height="44" fill="#1b1610" stroke="#c9a24a" stroke-width="1.2"/><rect x="${-w / 2 + 4}" y="-18" width="${w - 8}" height="36" fill="none" stroke="#c9a24a" stroke-opacity=".5"/>
      <text y="-2" class="mp-title">${title}</text><text y="12" class="mp-sub">${sub}</text></g>`;
    const fogLayer = (w: number, h: number, heavy = false) => `<rect width="${w}" height="${h}" filter="url(#${heavy ? 'mp-fogheavy' : 'mp-fog'})" class="mp-fogrect"/>`;

    if (view === 'london') {
      const D: [string, string, string, number, number, string, boolean][] = [
        ['inkwell', 'INKWELL ROW', 'M124 36 L238 30 L246 100 L132 106 Z', 185, 70, 'North. Clerks, presses, scholars: the newspaper office, the library, the Society for Psychical Inquiry.', false],
        ['greymourne', 'GREYMOURNE', 'M252 26 L348 36 L346 112 L258 106 Z', 300, 70, 'North-east, on the hill. A gothic cemetery; undertakers and stonemasons. The dead do not all stay put.', false],
        ['mayfield', 'MAYFIELD', 'M12 72 L120 66 L128 204 L16 210 Z', 68, 140, 'West. Elite, glittering, cruel: tailors, jewellers, salons, the Velvet Court, and Vane House.', false],
        ['market', 'LANTERN MARKET', 'M134 112 L276 106 L280 184 L140 190 Z', 206, 150, 'The centre. The busy hub: grocers, the music hall, the theatre and the omnibus depot.', false],
        ['hollow', 'HOLLOW LANE', 'M146 198 L266 192 L268 242 L152 248 Z', 206, 222, 'On the river, west of Saltwharf. The rookery: fences, fight pits, black markets, and the Kin\'s tunnels.', false],
        ['saltwharf', 'SALTWHARF', 'M276 192 L352 186 L352 244 L278 248 Z', 314, 216, 'East, on the north bank of the Thames. Poor, foggy and honest. You live here.', true],
        ['ironmonger', 'IRONMONGER\'S CROSS', 'M40 312 L300 304 L306 380 L48 386 Z', 172, 348, 'South, across the river. Smoke, steel and factories; the Lamplighters\' Guild hall.', false],
        ['undercroft', 'THE UNDERCROFT', 'M90 398 L290 398 L280 436 L100 436 Z', 190, 420, 'Beneath. The drowned streets of older Londons. Nothing for sale; things that want out.', false],
      ];
      // The roads out of Saltwharf, dotted: west, north, and the ferry south.
      const routes = ['M278 232 C 262 232, 258 226, 250 224', 'M280 206 C 262 196, 258 180, 252 170', 'M330 190 C 326 160, 318 130, 306 104', 'M318 248 C 316 270, 300 290, 284 306'];
      const svg = `<svg viewBox="0 0 360 450" class="map-london">${defs}
        <rect width="360" height="450" fill="url(#mp-paper)"/>
        <path d="M-10 256 C 60 238, 120 280, 190 262 S 300 250, 370 256 L 370 292 C 300 282, 250 302, 190 296 S 60 274, -10 292 Z" fill="url(#mp-waves)" stroke="#8aa0b0" stroke-opacity=".6"/>
        <text x="30" y="282" class="mp-river">The River Thames</text>
        ${D.map(([id, name, path, x, y, , open]) => `<g data-id="${id}" class="mp-dist${open ? ' open' : ''}"><path d="${path}" fill="url(#${open ? 'mp-hatch2' : id === 'undercroft' ? 'mp-cross' : 'mp-hatch'})" stroke="${open ? '#e8c66a' : '#cdb88a'}" stroke-opacity="${open ? 1 : 0.5}" stroke-width="${open ? 1.6 : 1}" ${id === 'undercroft' ? 'stroke-dasharray="4 3"' : ''}/><text x="${x}" y="${y}">${name}</text>${open ? `<text x="${x}" y="${y + 13}" class="mp-here">— you are here —</text>` : ''}</g>`).join('')}
        <g pointer-events="none">${routes.map((d) => `<path d="${d}" fill="none" stroke="#e8c66a" stroke-opacity=".8" stroke-width="1.4" stroke-dasharray="2 3"/>`).join('')}</g>
        <g class="mp-shroud" pointer-events="none">${fogLayer(360, 450, true)}</g>
        <ellipse cx="314" cy="218" rx="56" ry="40" fill="url(#mp-glow)" opacity=".25" pointer-events="none"/>
        <rect width="360" height="450" fill="url(#mp-vign)" pointer-events="none"/>
        ${cartouche(180, 30, 230, 'A PLAN OF LONDON', 'with its Districts · 1871')}
        ${rose(334, 420, 16, 'up')}
      </svg>`;
      this.hud.showMap('london', svg, (id) => {
        const d = D.find((x) => x[0] === id);
        if (!d) return null;
        const title = d[1].toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()).replace("'S", "'s");
        if (d[6]) return { title, text: d[5], go: () => this.openMap('district') };
        const road = EXITS.find((e) => e.id === ROUTE_TO[id]);
        if (!road) return { title, text: `${d[5]} No road goes there. Not one you can walk, anyway.` };
        return {
          title, text: `${d[5]} Lost in the fog for now: it opens in a later chapter. The way there: ${road.title.replace(/^The /, 'the ')}.`,
          goLabel: 'Walk to the road', go: () => this.walkToExit(road.id),
        };
      });
      return;
    }
    const loc = this.locations.saltwharf;
    const m = loc.map!;
    const K = 10;
    const W = m.w * K;
    const H = m.h * K;
    const X = (x: number) => (m.w - x) * K;
    const Y = (z: number) => (m.h - z) * K;
    const where = (() => {
      if (this.location.id === 'saltwharf') return this.player!.position;
      const id = this.location.id === 'hesterRoom' ? HOMES_TO_LET[this.residence()].building : this.location.id.slice(4);
      const pl = loc.places.find((p) => p.id === id);
      return pl ? new THREE.Vector2(pl.door.x + 0.5, pl.door.z + 0.5) : this.player!.position;
    })();
    const fill = (k: string) => (k === 'shop' ? 'url(#mp-hatch2)' : k === 'church' ? 'url(#mp-cross)' : k === 'open' ? 'none' : 'url(#mp-hatch)');
    const rects = m.rects.map((r) => `<g data-id="${r.placeId}" class="mp-b ${r.kind}"><rect x="${X(r.x + r.w)}" y="${Y(r.z + r.d)}" width="${r.w * K}" height="${r.d * K}" fill="${fill(r.kind)}"/>${r.kind === 'church' ? `<path d="M${X(r.x + r.w / 2)} ${Y(r.z + r.d / 2) - 12} v14 M${X(r.x + r.w / 2) - 5} ${Y(r.z + r.d / 2) - 7} h10" class="mp-crossmark"/>` : ''}<text x="${X(r.x + r.w / 2)}" y="${Y(r.z + r.d / 2) + (r.kind === 'church' ? 14 : 4)}">${esc(r.label)}</text></g>`).join('');
    const lamps = (loc.lamps ?? []).map((l) => `<circle cx="${X(l.x)}" cy="${Y(l.z)}" r="9" fill="url(#mp-glow)"/><circle cx="${X(l.x)}" cy="${Y(l.z)}" r="1.6" fill="#ffd27a"/>`).join('') + `<circle cx="${X(27.5)}" cy="${Y(15.5)}" r="13" fill="url(#mp-vane)"/><circle cx="${X(27.5)}" cy="${Y(15.5)}" r="2" fill="#fff"/>`;
    // People you know who are out on the streets, coloured by how you stand with them.
    const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
    const folk = this.npcs.filter((n) => n.visible && this.state!.relations[n.res.id]?.met).map((n) => {
      const c = this.relColor(n.res.id).color;
      return `<g class="mp-folk"><circle cx="${X(n.walker.position.x)}" cy="${Y(n.walker.position.y)}" r="5.5" fill="${hex(c)}" stroke="#0b0d10" stroke-width="1.5"/><text x="${X(n.walker.position.x)}" y="${Y(n.walker.position.y) - 8}">${esc(this.first(n.res.id))}</text></g>`;
    }).join('');
    const svg = `<svg viewBox="0 0 ${W} ${H + 40}" class="map-district">${defs}
      <rect width="${W}" height="${H + 40}" fill="url(#mp-paper)"/>
      <rect x="0" y="${Y(4)}" width="${W}" height="${4 * K + 40}" fill="url(#mp-waves)"/>
      <line x1="0" y1="${Y(4)}" x2="${W}" y2="${Y(4)}" stroke="#cdb88a" stroke-opacity=".6" stroke-width="1.5"/>
      <text x="${W / 2}" y="${Y(1.5) + 8}" class="mp-river">The River Thames</text>
      ${rects}
      ${lamps}
      ${m.streets.map((t) => `<text x="${X(t.x)}" y="${Y(t.z)}" class="mp-street" style="text-anchor:${X(t.x) > W / 2 ? 'end' : 'start'}">${esc(t.label)}</text>`).join('')}
      <g pointer-events="none">${fogLayer(W, H + 40)}</g>
      <rect width="${W}" height="${H + 40}" fill="url(#mp-vign)" pointer-events="none"/>
      <g pointer-events="none">${folk}</g>
      <g class="mp-you" pointer-events="none"><circle cx="${X(where.x)}" cy="${Y(where.y)}" r="16" fill="url(#mp-glow)"/><circle cx="${X(where.x)}" cy="${Y(where.y)}" r="5.5" class="you"/><circle cx="${X(where.x)}" cy="${Y(where.y)}" r="12" class="you-ring"/></g>
      ${cartouche(W / 2, 30, 270, 'SALTWHARF DOCKS', 'in the Parish of St. Botolph · 1871')}
      ${rose(W - 34, 82, 18, 'up')}
      <g class="mp-scale" transform="translate(${W - 80} ${H - 14})"><path d="M0 0 h60 M0 -4 v8 M30 -3 v6 M60 -4 v8"/><text x="30" y="-8">one furlong</text></g>
    </svg>`;
    this.hud.showMap('district', svg, (id) => {
      const pl = loc.places.find((p) => p.id === id);
      if (!pl) return null;
      const inside = INTERIORS.find((d) => d.id === id);
      const hours = inside ? ` Open ${String(inside.open[0]).padStart(2, '0')}:00–${inside.open[1] === 24 ? 'midnight' : `${inside.open[1]}:00`}${isOpen(inside, this.clock.hour) ? ' (open now)' : ' (closed now)'}.` : '';
      return {
        title: pl.name, text: `${pl.description}${hours}`,
        go: () => {
          if (this.location.id === 'saltwharf') return this.goToPlace(pl);
          const from = this.location.id === 'hesterRoom' ? HOMES_TO_LET[this.residence()].building : this.location.id.slice(4);
          void this.goTo('saltwharf', from).then(() => this.goToPlace(pl));
        },
      };
    });
  }

  // --- St. Botolph's -----------------------------------------------------------

  private churchActions(placeId: string, act: (label: string, fn: () => void | Promise<void>, opts?: Partial<Action>) => Action): Action[] {
    const s = this.state!;
    const day = dayIndex(s.minutes);
    const h = this.clock.hour;
    if (placeId === 'exit') return [act('Go out to Church Street', () => this.goTo('saltwharf', 'church'), { primary: true })];
    if (placeId === 'register') return [
      ...this.missionPlaceActions('church', act),
      act(this.usedToday('register') ? 'You read the registers today' : 'Read the old registers (1 hour)', async () => {
        this.markUsed('register');
        this.clock.minutes += 60;
        s.minutes = this.clock.minutes;
        simulateNeeds(s.needs, 1, 'awake');
        const ups = gainXp(s, 'study', 8);
        const lines = ['1741: "Ann Doyle, drowned at the Stairs in a fog so thick the bell could not be heard." Doyle, like Old Mag.', '1790: "Augustus Pembleton, gentleman, of a fall upon the stairs at the chandlery." Somebody has pencilled beside it: "pushed?"', '1832: forty burials in one week, all of cholera, all from Back Lane.', '1871: "Hester ' + s.character.last + ', spinster, of Quay Street. No family present." The ink is hardly dry.'];
        await this.dialogue.say({ speaker: '', text: `${lines[day % lines.length]}\n${ups.join(' ')}`.trim() });
      }, { disabled: this.usedToday('register') }),
    ];
    if (placeId === 'poorbox') return [act(this.usedToday('poorbox') ? 'You gave today' : 'Give a penny to the poor box (£0.01)', () => {
      s.money = Math.round((s.money - 0.01) * 100) / 100;
      this.markUsed('poorbox');
      this.warm('hale', 2);
      sfx('coin');
      this.hud.toast('It rattles alone at the bottom of the box. Father Hale notices, and pretends not to. Hale +2.', 3500);
    }, { primary: true, disabled: s.money < 0.01 || this.usedToday('poorbox') })];
    if (placeId === 'counter') {
      const sunday = weekday(day) === 0 && h >= 11 && h < 13;
      const hale = this.keepers.get('church');
      return [
        sunday
          ? act(this.usedToday('service') ? 'You heard the service today' : 'Sit through the Sunday service (1 hour)', async () => {
            this.markUsed('service');
            this.clock.minutes += 60;
            s.minutes = this.clock.minutes;
            simulateNeeds(s.needs, 1, 'awake');
            addNeed(s.needs, 'social', 18);
            addNeed(s.needs, 'rest', 6);
            this.warm('hale', 4);
            for (const r of RESIDENTS) if (r.traits.includes('pious') && this.rel(r.id).met) this.warm(r.id, 2);
            await this.dialogue.say({ speaker: 'Father Ambrose Hale', text: '"...and the sea gave up the dead which were in it." Hale reads it as if he means it, and the church is very quiet. Afterwards there is weak tea and gossip in the porch. (Social +18, Rest +6, Hale +4; the pious notice you came.)' });
          }, { primary: true, disabled: this.usedToday('service') })
          : act('Kneel at the rail a while (30 min)', () => {
            this.clock.minutes += 30;
            s.minutes = this.clock.minutes;
            addNeed(s.needs, 'rest', 5);
            addNeed(s.needs, 'health', 1);
            this.hud.toast('Cold stone, candle smoke, the river through the walls. You feel steadier. Rest +5. (Services on Sundays, 11:00–13:00, after Hale\'s sermon at the market cross.)', 4000);
          }, { primary: true }),
        ...(hale?.visible ? [act('Talk to Father Hale', () => this.approach(hale))] : []),
      ];
    }
    return [];
  }

  // --- Pembleton on the talents Saltwharf has no work for ------------------------

  private async talentsTalk(): Promise<void> {
    const s = this.state!;
    const sk = s.character.skills;
    const best = (['study', 'arts', 'occult', 'cunning'] as const).filter((k) => sk[k] >= 2);
    const where: Record<string, string> = {
      study: 'Inkwell Row\'s presses and archives pay clerks and copyists, and the Society\'s library pays readers.',
      arts: 'Lantern Market has a theatre, print shops and a music hall that pay for clever hands.',
      occult: 'The Society for Psychical Inquiry pays for second sight, and Mayfield\'s drawing rooms pay better still, for séances.',
      cunning: 'Hollow Lane pays for quick fingers and quiet feet. Not honestly, but promptly.',
    };
    await this.dialogue.say(
      { speaker: P, text: '"Saltwharf wants two things of a person: a strong back for the docks, or a quick tongue for the Copper Cup. That is all this street has ever paid for."' },
      { speaker: P, text: best.length
        ? `"Do not let that make you think your other gifts are wasted. ${best.map((k) => where[k]).join(' ')} When the fog lets you out of this district, they will be worth more than any crate."`
        : '"Study, craft and the second sight have no wages here. Elsewhere in London they do: the presses of Inkwell Row, the theatres of Lantern Market, the Society. Practise them anyway."' },
      { speaker: P, text: '"Until then: work the docks or the Cup to keep the rent paid, and keep reading, drawing and listening to the dead in the evenings. Hester did. It kept her alive, and then it did not, but that was not the reading\'s fault."' },
    );
  }

  // --- Relationship rings: who's a friend, at a glance --------------------------

  private relOn = false;
  private ringTimer = 0;
  private readonly rings = new Map<Npc, THREE.Mesh>();
  private ringGeo: THREE.PlaneGeometry | null = null;
  private ringTex: THREE.Texture | null = null;

  /** Green for friends (deep green for the closest), yellow for acquaintances, red for rivals, grey for strangers. */
  private relColor(id: string): { color: number; strong: number } {
    const r = this.state?.relations[id];
    if (!r?.met) return { color: 0x9a9a9a, strong: 0.28 };
    const score = Math.max(-60, Math.min(90, r.friendship + r.romance * 0.5 - r.rivalry * 1.2));
    const c = new THREE.Color();
    const t = (score + 60) / 150;
    c.setHSL(0.02 + t * 0.32, 0.78, score > 40 ? 0.5 - ((score - 40) / 50) * 0.2 : 0.52);
    return { color: c.getHex(), strong: 1 };
  }

  private updateRings(): void {
    const all = [...this.npcs, ...this.patrons, ...this.keepers.values()];
    if (!this.relOn) {
      for (const m of this.rings.values()) m.visible = false;
      return;
    }
    if (!this.ringGeo) {
      this.ringGeo = new THREE.PlaneGeometry(1.5, 1.5);
      this.ringGeo.rotateX(-Math.PI / 2);
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const g = cv.getContext('2d')!;
      const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.3, 'rgba(255,255,255,0.45)');
      grad.addColorStop(0.44, 'rgba(255,255,255,1)');
      grad.addColorStop(0.64, 'rgba(255,255,255,1)');
      grad.addColorStop(0.8, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      this.ringTex = new THREE.CanvasTexture(cv);
    }
    for (const n of all) {
      let m = this.rings.get(n);
      if (!m) {
        m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ map: this.ringTex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
        m.position.y = 0.04;
        m.renderOrder = 2;
        n.walker.rig.root.add(m);
        this.rings.set(n, m);
      }
      const { color, strong } = this.relColor(n.res.id);
      (m.material as THREE.MeshBasicMaterial).color.setHex(color);
      (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, strong);
      m.visible = true;
    }
  }

  // --- Where you live ---------------------------------------------------------

  private residence(): HomeId {
    return this.state?.residence ?? 'hester';
  }

  /** Down from your room: to the street, or to the Cup's taproom. */
  private leaveHome(): void {
    const b = HOMES_TO_LET[this.residence()].building;
    const go = () => void (b === 'coppercup' ? this.goTo('int:coppercup', 'stairs') : this.goTo('saltwharf', b));
    const place = this.location.places.find((p) => p.id === 'door');
    this.hud.hidePlace();
    if (place && this.player && this.player.walkTo(place.door, go)) this.showMarker(place.door.x + 0.5, place.door.z + 0.5);
    else go();
  }

  /** Renting somewhere else: what the landlord offers, and the move. */
  private moveActions(to: HomeId, act: (label: string, fn: () => void | Promise<void>, opts?: Partial<Action>) => Action): Action[] {
    const s = this.state!;
    if (this.residence() === to) return [];
    const h = HOMES_TO_LET[to];
    const owed = s.rent.arrears > 0 || s.rent.graceUntil !== null;
    return [act(`${to === 'hester' ? 'Move back into Hester\'s room' : `Rent ${h.name.replace(/^A /, 'a ').replace(/^Rooms/, 'the rooms')}`} · £${h.rent.toFixed(2)} a month`, () => this.moveTo(to), { disabled: owed })];
  }

  private async moveTo(to: HomeId): Promise<void> {
    const s = this.state!;
    const h = HOMES_TO_LET[to];
    const landlord = to === 'cup' ? 'Bessa Hartigan' : 'Mr. Grubb';
    const c = await this.dialogue.ask({ speaker: landlord, text: `${to === 'cup' ? '"Two rooms, knocked through, warm from the taproom. Noisy till midnight. A pound a month, and no bringing the fog in on your boots."' : to === 'court' ? '"Third floor back. Damp, but it\'s dry damp. Forty pence a month, and I collect on the last day, same as everywhere."' : '"The clerk left in a hurry. Something about a cold spot on the stairs." Grubb sniffs. "Sixty pence, as before."'}
${h.blurb}` }, ['Take it', 'Not yet']);
    if (c !== 0) return;
    s.residence = to;
    s.rent.amount = h.rent;
    this.rebuildHome();
    sfx('page');
    await this.dialogue.say({ speaker: P, text: to === 'hester' ? '"Home again. I kept your side of the bed warm. Figuratively."' : '"You thought you could leave me? I am bound to Hester\'s trunk, not to the building, as it turns out. Where it goes, I go. Mind the stairs with it."' });
    this.hud.toast(`${h.name} is yours from today. Rent: £${h.rent.toFixed(2)} on the last day of each month. Your furniture came with you.`, 5000);
    await this.goTo('hesterRoom', 'door');
    this.save();
  }

  /** Builds your home for wherever you live now, and puts your furniture in it. */
  private rebuildHome(): void {
    const old = this.locations.hesterRoom;
    const spec = HOMES_TO_LET[this.residence()];
    if (old.name === spec.name && this.homeBuilt) return;
    this.homeBuilt = true;
    const room = buildHesterRoom(spec);
    // Move the way-out icon into the new room.
    for (const d of this.doorIcons) if (d.loc === 'hesterRoom') { d.sprite.removeFromParent(); room.scene.add(d.sprite); }
    this.locations.hesterRoom = room;
    this.applyFurniture();
  }

  private homeBuilt = false;

  /** Walk to the road out toward another district (leaving whatever building you are in). */
  private walkToExit(id: string): void {
    const place = this.locations.saltwharf.places.find((p) => p.id === `exit:${id}`);
    if (!place) return;
    if (this.location.id === 'saltwharf') return this.goToPlace(place);
    const from = this.location.id === 'hesterRoom' ? HOMES_TO_LET[this.residence()].building : this.location.id.slice(4);
    void this.goTo('saltwharf', from).then(() => this.goToPlace(place));
  }

  /** Walk to a door and straight through it. */
  private exitThrough(placeId: string, to: [LocationId, string]): void {
    const place = this.location.places.find((p) => p.id === placeId);
    if (!place || !this.player) return;
    this.hud.hidePlace();
    const go = () => void this.goTo(to[0], to[1]);
    if (this.player.walkTo(place.door, go)) this.showMarker(place.door.x + 0.5, place.door.z + 0.5);
    else go();
  }

  private goToPlace(place: Place): void {
    const player = this.player!;
    this.hud.hidePlace();
    const inside = this.location.id === 'saltwharf' ? INTERIORS.find((d) => d.id === place.id) : undefined;
    if (inside && isOpen(inside, this.clock.hour)) {
      if (player.walkTo(place.door, () => void this.goTo(`int:${inside.id}`, 'door'))) this.showMarker(place.door.x + 0.5, place.door.z + 0.5);
      return;
    }
    if (place.id.startsWith('house:') || place.id === 'tenements') {
      const ok = player.walkTo(place.door, () => { player.faceToward(place.faceTo); this.showHouse(place); });
      if (ok) this.showMarker(place.door.x + 0.5, place.door.z + 0.5);
      return;
    }
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

    if (this.location.id.startsWith('int:')) {
      const bid = this.location.id.slice(4);
      if (place.id === 'exit') return [act('Go out to the street', () => this.goTo('saltwharf', bid), { primary: true })];
      if (place.id === 'stairs') {
        const mine = HOMES_TO_LET[this.residence()].building === bid;
        if (mine) return [act('Up to your room', () => s.housed ? this.goTo('hesterRoom', 'door') : this.hud.toast('Grubb has changed the lock on your door.'), { primary: true })];
        return bid === 'hester'
          ? [act('Hester\'s room is let to a Vane Company clerk now', () => undefined, { disabled: true }), ...this.moveActions('hester', act)]
          : this.moveActions('cup', act);
      }
      if (bid === 'church') return this.churchActions(place.id, act);
      if (place.id === 'counter') {
        const keeper = this.keepers.get(bid);
        const acts = this.streetActions(bid, act).filter((a) => !a.label.startsWith('Go up'));
        if (keeper?.visible) acts.push(act(`Talk to ${this.short(keeper.res.id)}`, () => this.approach(keeper)));
        return acts;
      }
    }
    if (this.location.id === 'saltwharf') {
      if (place.id === 'tenements' || place.id.startsWith('house:')) return [];
      if (place.id.startsWith('exit:')) {
        this.tip('roads', 'This road leads out of Saltwharf. The other districts open in later chapters; until then the fog turns you back.');
        const ex = EXITS.find((e) => `exit:${e.id}` === place.id)!;
        const dest = LONDON_NAMES[ex.to] ?? 'the city';
        return [
          ...this.missionPlaceActions(place.id, act),
          act(`Travel to ${dest} · lost in the fog for now`, () => undefined, { primary: true, disabled: true }),
          act('Look at the map of London', () => this.openMap('london')),
        ];
      }
      if (place.id.startsWith('scav:')) {
        this.tip('scav', 'Heaps, buckets and the foreshore can each be searched once a day. Lizzie at Rag & Bone pays best for what you find.');
        const sp = SPOTS.find((x) => `scav:${x.id}` === place.id)!;
        const low = sp.kind !== 'foreshore' || this.lowTide();
        if (this.usedToday(place.id)) return [act('Picked clean. Come back tomorrow.', () => undefined, { disabled: true })];
        if (!low) return [act('The tide is in. The mud shows from 05:00 to 10:00 and 16:00 to 21:00.', () => undefined, { disabled: true })];
        return [act(sp.kind === 'foreshore' ? 'Go down and mudlark (30 min)' : 'Rummage through it (15 min)', () => this.scavenge(sp.id), { primary: true })];
      }
      if (place.id === 'church') return [act('The doors are locked for the night. St. Botolph\'s opens at 07:00', () => undefined, { disabled: true })];
      if (place.id === 'pump') return [...this.missionPlaceActions('pump', act), act('Work the handle and drink (no thank you)', () => undefined, { disabled: true })];
      const inside = INTERIORS.find((d) => d.id === place.id);
      const closed = inside && !isOpen(inside, this.clock.hour) ? [act(`Closed. Opens at ${String(inside.open[0]).padStart(2, '0')}:00`, () => undefined, { disabled: true })] : [];
      return [...closed, ...this.streetActions(place.id, act)];
    }
    return this.roomActions(place, act);
  }

  private streetActions(id: string, act: (label: string, fn: () => void | Promise<void>, opts?: Partial<Action>) => Action): Action[] {
    return [...this.missionPlaceActions(id, act), ...this.streetActionsBase(id, act)];
  }

  private streetActionsBase(id: string, act: (label: string, fn: () => void | Promise<void>, opts?: Partial<Action>) => Action): Action[] {
    const s = this.state!;
    {
      switch (id) {
        case 'hester':
          return [
            ...(this.residence() !== 'hester' ? this.moveActions('hester', act) : s.housed
              ? [act('Go up to your room', () => this.goTo('hesterRoom', 'door'), { primary: true })]
              : [act(`Locked out. Pay Grubb £${s.rent.arrears.toFixed(2)}`, () => this.reclaimRoom(), { primary: true, disabled: s.money < s.rent.arrears })]),
            act("Browse Pell's Chandlery", () => this.openShop('hester')),
          ];
        case 'tenements':
          return [
            ...(this.residence() === 'court' ? (s.housed ? [act('Go up to your room', () => this.goTo('hesterRoom', 'door'), { primary: true })] : [act(`Locked out. Pay Grubb £${s.rent.arrears.toFixed(2)}`, () => this.reclaimRoom(), { primary: true, disabled: s.money < s.rent.arrears })]) : this.moveActions('court', act)),
            act('Sleep rough in the archway', () => this.sleep('rough'), { primary: !s.housed }),
          ];
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
            act('Sell Lizzie your finds', () => this.sellFinds()),
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
  }

  private roomActions(place: Place, act: (label: string, fn: () => void | Promise<void>, opts?: Partial<Action>) => Action): Action[] {
    const s = this.state!;
    switch (place.id.split('#')[0]) {
      case 'armchair':
        return [act('Sit by the window (1 hour)', () => { simulateNeeds(s.needs, 1, 'awake'); addNeed(s.needs, 'rest', 8); addNeed(s.needs, 'social', 3); this.clock.minutes += 60; this.hud.toast('An hour in the armchair, watching the river. Rest +8.'); }, { primary: true })];
      case 'plant':
        return [act(this.usedToday('plant') ? 'Watered today' : 'Water the aspidistra', () => { this.markUsed('plant'); this.hud.toast('It does not need it, and does not thank you.'); }, { disabled: this.usedToday('plant') })];
      case 'painting': case 'clock': case 'wardrobe': case 'lamp': case 'cradle': case 'rug': case 'curtains':
        return [act('Rearrange the room (Decor)', () => this.startDecor(), { primary: true })];
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
        const candle = s.inventory.some((i) => i.id === 'candle' || i.id === 'candle2') || this.placed('lamp');
        return [
          act(night ? (candle ? 'Read by candlelight (1 hour)' : 'Read (needs a candle after dark)') : 'Read by the window (1 hour)', () => this.read(this.member('lantern')), { primary: true, disabled: night && !candle }),
          ...(this.member('lantern') && !s.factions.dutyDone ? [act('Write your essay for the Lantern Society (1 hour)', () => this.essay(), { primary: true })] : []),
          ...this.missionPlaceActions('table', act),
        ];
      }
      case 'bookshelf':
        return [act('Read from the shelf (1 hour)', () => this.read(true), { primary: true, disabled: (this.clock.hour >= 18 || this.clock.hour < 7) && !s.inventory.some((i) => i.id === 'candle' || i.id === 'candle2') && !this.placed('lamp') })];
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
        return s.story.trunk
          ? [act('Look in the trunk', () => this.dialogue.say({ speaker: 'You', text: 'Mothballs, a widow\'s black gloves, a bag of coarse salt, an iron nail as long as your hand, and the shape in the dust where the journal and the watch lay.' }))]
          : [act('Try the lid', () => this.tryTrunk(), { primary: this.trunkReady() })];
      case 'door': {
        const unread = s.letters.filter((l) => !l.read).length;
        return [
          act(this.residence() === 'cup' ? 'Go down to the taproom' : this.residence() === 'court' ? 'Go down to Gull Court' : 'Go down to Quay Street', () => this.leaveHome(), { primary: true }),
          act(unread ? `Read letters (${unread} new)` : 'Letters', () => this.openLetters(), { primary: unread > 0 }),
        ];
      }
      case 'pembleton':
        return [act('Talk', () => this.chatPembleton(), { primary: true }), act('Ask about work for your other talents', () => this.talentsTalk())];
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
    if (this.member('brotherhood') && weekday(dayIndex(s.minutes)) === 3) addDeed(s, 'brotherhood', -3);
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
    const guildShop = ['hester', 'pawnbroker', 'clothier'].includes(shopId);
    if (guildShop && this.member('guild')) p *= 0.9;
    if (guildShop && (this.state!.factions.deeds.guild ?? 0) < -10) p *= 1.33;
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
        if (itemId === 'jmedal') continue;
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
    if (night && !this.placed('lamp')) {
      const c = s.inventory.find((i) => i.id === 'candle') ?? s.inventory.find((i) => i.id === 'candle2');
      if (!c) return;
      if (c.id === 'candle2' && !this.usedToday('wax-half')) this.markUsed('wax-half');
      else removeItem(s, c.id);
    }
    simulateNeeds(s.needs, 1, 'awake');
    addNeed(s.needs, 'rest', -3);
    this.clock.minutes += 60;
    s.minutes = this.clock.minutes;
    const ups = gainXp(s, 'study', Math.round((night ? 18 : 12) * (shelf || owns(s, 'bookshelf') ? 1.5 : 1) * (hasPerk(s, 'study', 6) ? 1.25 : 1) * (this.member('lantern') ? 1.25 : 1)));
    this.hud.toast(`An hour with Hester's books. Study practice.${ups.length ? ` ${ups.join(' ')}` : ''}`, 3500);
  }

  private essay(): void {
    const s = this.state!;
    simulateNeeds(s.needs, 1, 'awake');
    addNeed(s.needs, 'rest', -5);
    this.clock.minutes += 60;
    s.factions.dutyDone = true;
    const good = Math.random() < 0.4 + s.character.skills.study * 0.04;
    addDeed(s, 'lantern', good ? 5 : 1);
    const ups = gainXp(s, 'study', 14);
    const topics = ['On the Lighting of Quay Street, and Its Effects upon the Fog', 'A Short History of St. Botolph-by-the-River', 'Observations of the Thames at Low Water', 'On Certain Persons Lately Missing from Saltwharf'];
    this.hud.toast(`"${topics[Math.floor(Math.random() * topics.length)]}." ${good ? 'Quill will like it.' : 'Hale will correct the commas.'} Duty done.${ups.length ? ` ${ups.join(' ')}` : ''}`, 4500);
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
      if (it.id === 'hjournal') actions.push({ label: 'Read', onClick: () => { this.hud.closeList(); void this.readJournal(); } });
      if (!['hjournal', 'hwatch', 'jmedal'].includes(it.id)) actions.push({ label: 'Drop', onClick: () => { removeItem(s, it.id); again(); } });
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
    const rec = s.recommend[jobId];
    const recOk = rec && dayIndex(s.minutes) - rec.day <= 5 && (s.relations?.[rec.by]?.friendship ?? 0) >= 30;
    const opts = recOk ? [`${this.first(rec.by)} sent me. (Start as ${job.ranks[1].title})`, "I'll take it.", 'Not now.'] : ["I'll take it.", 'Not now.'];
    const yes = await this.dialogue.ask({ speaker: B, text: job.lines.offer }, opts);
    if (yes === opts.length - 1) return;
    hire(s, jobId);
    this.tip('work', 'Your hours, pay and what the next promotion needs are in the journal, under Work.');
    if (recOk && yes === 0) {
      const e = employment(s, jobId)!;
      e.rank = 1;
      e.recommendedBy = rec.by;
      delete s.recommend[jobId];
      await this.dialogue.say({ speaker: B, text: `"${this.first(rec.by)} vouched for you. That's worth a rung. You start as ${job.ranks[1].title}. Don't shame them."` });
    }
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
    if (rep.fired) {
      this.shame(e);
      await this.dialogue.say({ speaker: job.boss, text: job.lines.fired });
    }
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
    addDeed(s, 'court', 3);
    this.rel('rudd').rivalry = Math.min(100, this.rel('rudd').rivalry + 3);
    addFact(s, 'helped', ['nell', 'tom', 'hannah', 'jem'], 'nell');
    this.hud.toast('Two hours at the gate in the cold, shouting at carts. Nell shares her tea. Dockers\' friendship +5, Social +14. Rudd is writing names down.', 4500);
  }

  /** Fired soon after someone vouched for you: they lose face, and lose patience with you. */
  private shame(e: { recommendedBy?: string; hiredDay: number }): void {
    if (!e.recommendedBy || dayIndex(this.state!.minutes) - e.hiredDay > 10) return;
    const r = this.rel(e.recommendedBy);
    r.friendship = Math.max(0, r.friendship - 15);
    r.rivalry = Math.min(100, r.rivalry + 5);
    this.hud.toast(`${this.first(e.recommendedBy)} vouched for you. Now they look a fool. Friendship −15.`, 4000);
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
    const before = this.state!.jobs.map((e) => ({ ...e }));
    for (const r of checkAttendance(this.state!)) {
      if (r.fired) {
        const e = before.find((x) => x.jobId === r.job.id);
        if (e) this.shame(e);
        await this.dialogue.say({ speaker: r.job.boss, text: r.job.lines.absentFired });
      }
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
    this.shadowTimer -= dt;
    const recheck = this.shadowTimer <= 0;
    if (recheck) this.shadowTimer = 0.5;
    // Only so many people are about at once: the rest are at work, at home, or inside somewhere.
    const STREET_CAP = 16;
    let out = this.npcs.filter((n) => n.visible && !AUTHORED[n.res.id]).length;
    for (const n of this.npcs) {
      let stop = this.stopFor(n.res, hour);
      if (stop && !stop.inside && !n.visible && !AUTHORED[n.res.id]) {
        if (out >= STREET_CAP) stop = null;
        else out++;
      }
      n.follow(stop, outside);
      n.update(dt, this.elapsed);
      if (recheck && this.player && n.visible) n.setShadow(this.dist(n) < 9);
      void stop;
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
    // Weddings at the market cross at eleven; the supper outside the Copper Cup at seven.
    const wed = s.ceremonies.find((c) => c.kind === 'wedding' && c.day === day);
    if (wed) {
      const i = wed.ids.indexOf(r.id);
      const guest = i < 0 && (r.id === 'hale' || wed.ids.some((w) => Object.values(CIRCLES).some((cl) => cl.includes(w) && cl.includes(r.id))));
      if ((i >= 0 || guest) && hour >= 10 && hour < 12) {
        if (r.id === 'hale') return { from: 10, to: 12, x: 12, z: 19, act: 'preach' };
        if (i >= 0) return { from: 10, to: 12, x: 12 + i, z: 21, act: 'watch' };
        const k = RESIDENTS.indexOf(r);
        return { from: 10, to: 12, x: 10 + (k % 6), z: 22 + (k % 2), act: 'watch' };
      }
      if (i >= 0 && hour >= 19 && hour < 22) return { from: 19, to: 22, x: 18 + i, z: 8, act: 'drink' };
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
    const st0 = stopAt(r, hour);
    // Generated people don't go out every evening.
    const rec = this.rec(r.id);
    const varied = rec && !rec.authored && st0 && st0.from >= 15 && (Math.sin((day + 1) * 7.13 + r.id.length * 3.7 + r.id.charCodeAt(1)) + 1) / 2 < 0.3;
    const st = varied ? null : st0;
    if (st && s.weather === 'rain' && ['grubb', 'hale', 'quill', 'ashby', 'lizzie'].includes(r.id) && st.act !== 'mend') return null;
    if (st && (s.life.confused[r.id] ?? -1) >= day) return { ...st, act: 'confused' };
    // Most evenings drinkers are inside the Copper Cup, and the chapel-goers inside St. Botolph's.
    const roll = (Math.sin((day + 3) * 4.17 + r.id.length * 9.3 + r.id.charCodeAt(0) * 0.7) + 1) / 2;
    if (st && st.act === 'drink' && st.x >= 15 && st.x <= 22 && st.z <= 9 && roll < 0.65) return { ...st, inside: 'coppercup', x: 18, z: 8 };
    if (st && st.act === 'read' && st.x <= 2 && st.z >= 10 && st.z <= 14) return { ...st, inside: 'church', x: 5, z: 34 };
    // Sunday morning: the pious, and about a third of the rest, go to the service.
    if (weekday(day) === 0 && hour >= 11 && hour < 13 && r.id !== 'hale' && r.id !== 'silas' && (r.traits.includes('pious') || roll < 0.33) && (s.life.sick[r.id] ?? -1) < day) return { from: 11, to: 13, x: 5, z: 34, act: 'read', inside: 'church' };
    return st;
  }

  /** The face for a speaker's name, rendered from their model. */
  private portraitOf(name: string): string | null {
    const s = this.state;
    if (!s) return null;
    let look: Look | null = null;
    if (name === 'You') look = this.outfitLook(s.outfit);
    else if (name === P) look = { skin: 0xcfe6f4, hair: 0xf2f6fa, coat: 0x7a96b0, trousers: 0x6a86a0, shirt: 0xf0f4f8, boots: 0x4a5a6a, scarf: 0xffffff, hat: 'top', hatColor: 0x8aa6c0, hairStyle: 'wig', eyes: 0x6a8aaa };
    else if (name === 'The drowned sailor' || name === 'A drowned sailor') look = { skin: 0xa8c8d8, hair: 0x4a6a7a, coat: 0x2a4a5a, trousers: 0x2a3a4a, shirt: 0x8aa8b8, boots: 0x1a2a3a, hat: 'cap', hatColor: 0x1a3a4a, beard: 0x4a6a7a, eyes: 0xd8f0ff };
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
    const pool = act === 'sick' ? SICK_LINES : act === 'confused' ? CONFUSED_LINES : act === 'preach' && this.state!.strike ? ['Fair pay for fair work!', 'Don\'t cross the line, mate!', 'Out! Out! All out!'] : AMBIENT[n.res.id]?.[act] ?? AMBIENT[n.res.id]?.['*'] ?? GENERIC[act];
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

  // --- A city of lives -------------------------------------------------------

  private rec(id: string): PersonRec | undefined {
    return this.state?.people.find((p) => p.id === id);
  }

  /** Builds the population for a new life, and the street's cast from it. */
  private syncPopulation(): void {
    const s = this.state!;
    if (!s.people.length) s.people = [...authoredRecords(AUTHORED_RESIDENTS), ...generatePopulation(Math.floor(Math.random() * 1e9))];
    const day = dayIndex(s.minutes);
    // Addresses from older saves move into the new houses.
    for (const p of s.people) {
      const opts = OLD_HOMES[p.home];
      if (opts) p.home = opts[[...p.last].reduce((a, c) => a + c.charCodeAt(0), 0) % opts.length];
    }
    const cast: Resident[] = [];
    for (const res of AUTHORED_RESIDENTS) {
      const p = this.rec(res.id);
      if (p && !p.alive) continue;
      if (p) res.home = HOMES[p.home]?.door ?? res.home;
      cast.push(res);
    }
    for (const p of s.people) {
      if (p.authored || !p.alive || p.district !== 'Saltwharf' || !p.look || ageOf(p, day) < 3) continue;
      VOICES[p.id] ??= voiceFor(p);
      const circle = p.work && JOB_KINDS[p.work]?.employer === 'docks' ? 'docks' : p.haunt === 'cupfront' ? 'cup' : p.haunt === 'church' ? 'church' : 'street';
      if (!CIRCLES[circle].includes(p.id)) CIRCLES[circle].push(p.id);
      cast.push({
        id: p.id, name: fullNameOf(p), gender: p.gender, attraction: p.attraction, cls: p.cls, traits: p.traits, role: roleOf(p, day),
        look: p.look, home: HOMES[p.home]?.door ?? HOMES.court.door, schedule: scheduleFor(p, day),
      });
    }
    RESIDENTS.splice(0, RESIDENTS.length, ...cast);
    // The street's figures follow the cast: the dead leave, the new arrive.
    const scene = this.locations.saltwharf.scene;
    for (const n of [...this.npcs]) {
      const now = cast.find((r) => r.id === n.res.id);
      if (now && JSON.stringify(now.look) === JSON.stringify(n.res.look)) {
        Object.assign(n.res, now);
        continue;
      }
      n.walker.rig.root.removeFromParent();
      this.npcs.splice(this.npcs.indexOf(n), 1);
    }
    for (const r of cast) {
      if (this.npcs.some((n) => n.res.id === r.id)) continue;
      const npc = new Npc(r, this.locations.saltwharf.grid);
      scene.add(npc.walker.rig.root);
      this.npcs.push(npc);
    }
  }

  /** Overnight, for everyone in London: courtships, weddings, births, deaths. Lines for the morning. */
  private nightlyLivesOfAll(day: number): string[] {
    const s = this.state!;
    const lines: string[] = [];
    const courting = new Set(Object.entries(s.relations ?? {}).filter(([, r]) => r.romance >= 30).map(([id]) => id));
    for (const id of [s.family.spouse, s.family.engaged?.with]) if (id) courting.add(id);
    const events = simulateNight(s.people, day, courting);
    const name = (id: string) => { const p = this.rec(id); return p ? fullNameOf(p) : this.nameOf(id); };
    const known = (id: string) => !!s.relations?.[id]?.met;
    const friendOf = (ids: string[]) => ids.find((id) => (s.relations?.[id]?.friendship ?? 0) >= 30);
    const local = (id: string) => this.rec(id)?.district === 'Saltwharf';
    for (const e of events) this.lifeEvent(e, lines, name, known, friendOf, local);
    // Friendships fade when you don't see people.
    for (const [id, r] of Object.entries(s.relations ?? {})) {
      if (!r.met) continue;
      r.seen ??= day;
      const gap = day - r.seen;
      if (gap <= 3) continue;
      const was = r.friendship;
      r.friendship = Math.max(0, r.friendship - 1.5);
      r.romance = Math.max(0, r.romance - 2);
      r.business = Math.max(0, r.business - 0.5);
      r.rivalry = Math.max(0, r.rivalry - 1);
      if (was >= 30 && r.friendship < 30) sendLetter(s, name(id), 'Haven\'t seen you', `${s.character.first},\n\nIt's been ${gap} days. I thought we were friends. Come and find me, if you remember where.\n\n${this.first(id)}`);
    }
    this.syncPopulation();
    return lines;
  }

  private lifeEvent(e: LifeEvent, lines: string[], name: (id: string) => string, known: (id: string) => boolean, friendOf: (ids: string[]) => string | undefined, local: (id: string) => boolean): void {
    const s = this.state!;
    const [a, b] = e.ids;
    if (e.kind === 'death') {
      const p = this.rec(a)!;
      const age = ageOf(p, e.day);
      if (local(a) || known(a)) lines.push(`${name(a)} died in the night, aged ${age}.${local(a) ? ' The funeral is tomorrow at eleven.' : ''}`);
      if (local(a)) s.ceremonies.push({ kind: 'funeral', ids: [a], names: name(a), day: e.day + 1 });
      if ((s.relations?.[a]?.friendship ?? 0) >= 30 || friendOf([...p.children, p.spouse ?? ''])) {
        const writer = friendOf([...p.children, p.spouse ?? '']);
        sendLetter(s, writer ? name(writer) : 'The parish of St. Botolph', `${p.first} ${p.last}`, `${p.first} has gone, at ${age}, in their sleep. ${local(a) ? 'We bury them tomorrow at eleven. Walk with us, if you can.' : 'They spoke of you.'}\n\n${writer ? this.first(writer) : 'A. Hale, curate'}`);
      }
      this.portraits.forget(a);
    } else if (e.kind === 'engaged') {
      const wedding = this.rec(a)?.courting?.wedding ?? e.day + 4;
      if (known(a) || known(b)) lines.push(`${name(a)} and ${name(b)} are to be married, ${wedding - e.day} days from now.`);
      const f = friendOf([a, b]);
      if (f && (local(a) || local(b))) sendLetter(s, `${name(a)} & ${name(b)}`, 'An invitation', `${s.character.first},\n\nWe are to be married on ${this.clock.formatShortDate(new Date(1871, 9, 1 + wedding))}, at eleven, at the market cross; Father Hale will do it, and there's a supper at the Copper Cup after. Come. It wouldn't be right without you.\n\n${this.first(f)}`);
    } else if (e.kind === 'wedding') {
      if (local(a) || local(b)) s.ceremonies.push({ kind: 'wedding', ids: [a, b], names: `${name(a)} and ${name(b)}`, day: e.day });
      if (known(a) || known(b)) lines.push(`Today ${name(a)} marries ${name(b)}, at eleven at the market cross.`);
      // Someone you were courting marrying someone else stings.
      for (const id of [a, b]) if ((s.relations?.[id]?.romance ?? 0) >= 15) lines.push(`${this.first(id)} is marrying someone else. You hear it like a door closing.`);
    } else if (e.kind === 'birth') {
      if (known(b) || known(e.ids[2])) lines.push(`${name(b)} has had a baby: ${this.rec(a)?.gender === 'man' ? 'a son' : 'a daughter'}, ${this.rec(a)?.first}.`);
      const f = friendOf([b, e.ids[2]]);
      if (f) sendLetter(s, name(f), 'A new arrival', `${s.character.first},\n\n${this.rec(a)?.gender === 'man' ? 'A boy' : 'A girl'}! ${this.rec(a)?.first}, we've called ${this.rec(a)?.gender === 'man' ? 'him' : 'her'}. Loud as the river and twice as wet. Come and see.\n\n${this.first(f)}`);
    } else if (e.kind === 'courting') {
      if ((known(a) || known(b)) && Math.random() < 0.5) lines.push(`Word is ${name(a)} is walking out with ${name(b)}.`);
    } else if (e.kind === 'grownup') {
      if (known(a)) lines.push(`${name(a)} has started work, at twelve: ${JOB_KINDS[this.rec(a)!.work!].name.toLowerCase()}.`);
    }
  }

  /** A wedding or funeral at eleven: be at the market cross (or on Quay Street) to attend. */
  private checkCeremonies(): void {
    const s = this.state!;
    const day = dayIndex(s.minutes);
    // Leaving someone at the altar.
    for (const c of s.ceremonies) {
      if (c.ids.includes('you') && !c.attended && (c.day < day || (c.day === day && this.clock.hour > 12.5))) {
        c.attended = true;
        const id = c.ids.find((x) => x !== 'you')!;
        const r = this.rel(id);
        r.romance = 0;
        r.friendship = Math.max(0, r.friendship - 30);
        r.rivalry = Math.min(100, r.rivalry + 40);
        const p = this.rec(id);
        if (p) delete p.courting;
        delete s.family.engaged;
        addFact(s, 'wronged', [id, 'hale', 'ruby', 'mag', 'pell'], id);
        sendLetter(s, this.nameOf(id), 'The market cross', `I stood there in my best, in front of all of Saltwharf, until Father Hale sent them home.\n\nDon't.`);
        this.hud.toast(`You never came to your own wedding. ${this.first(id)} waited at the market cross until noon.`, 5000);
      }
    }
    s.ceremonies = s.ceremonies.filter((c) => c.day >= day - 1);
    if (this.busy || this.dialogue.open || this.hud.blocking || this.location.id !== 'saltwharf') return;
    const h = this.clock.hour;
    for (const c of s.ceremonies) {
      if (c.day !== day || c.attended || h < 11 || h > 12.4) continue;
      const p = this.player!.position;
      const mourner = c.kind === 'funeral' ? this.life.where('funeral') : null;
      const near = c.kind === 'wedding' ? Math.hypot(p.x - 12.5, p.y - 20.5) < 4.5 : !!mourner && Math.hypot(p.x - mourner.x - 0.5, p.y - mourner.z - 0.5) < 4;
      if (!near) continue;
      c.attended = true;
      if (c.ids.includes('you')) void this.ownWedding(c);
      else void this.attendCeremony(c);
    }
  }

  private async attendCeremony(c: GameState['ceremonies'][number]): Promise<void> {
    const s = this.state!;
    this.busy = true;
    this.player!.stop();
    const day = dayIndex(s.minutes);
    if (c.kind === 'wedding') {
      const choice = await this.dialogue.ask({ speaker: 'Father Ambrose Hale', text: `"Dearly beloved..." A crowd in its Sunday best round the market cross: ${c.names}. Someone has tied ribbons to Jem's barrow.` }, ['Give them a gift (from your bag)', 'Throw rice and cheer', 'Watch from the back']);
      let gain = choice === 2 ? 2 : 6;
      if (choice === 0 && s.inventory.length) {
        const it = [...s.inventory].sort((x, y) => ITEMS[y.id].price - ITEMS[x.id].price)[0];
        removeItem(s, it.id);
        gain = 12;
        this.hud.toast(`You give them your ${ITEMS[it.id].name.toLowerCase()}.`, 3000);
      }
      for (const id of c.ids) {
        const r = this.rel(id);
        r.met = true;
        r.friendship = Math.min(100, r.friendship + gain);
        r.seen = day;
      }
      addNeed(s.needs, 'social', 20);
      this.clock.minutes += 60;
      this.busy = false;
      await this.hud.celebrate('friend', 'A wedding', c.names, 'Social +20. There\'s a supper at the Copper Cup tonight.');
    } else {
      await this.dialogue.say({ speaker: '', text: `The coffin of ${c.names} goes by on four shoulders. Father Hale reads the words. A woman you don't know takes your arm for a moment, then lets go.` });
      addNeed(s.needs, 'social', 8);
      for (const p of this.npcs) if (p.visible && this.dist(p) < 8 && s.relations?.[p.res.id]?.met) this.rel(p.res.id).friendship = Math.min(100, this.rel(p.res.id).friendship + 2);
      this.clock.minutes += 30;
      this.busy = false;
    }
  }

  /** What you know of someone's life, for their card. */
  private lifeOf(id: string): { age: number | null; home: string; work: string; haunt: string; family: string[]; now: string } {
    const s = this.state!;
    const p = this.rec(id);
    const k = s.known[id] ?? {};
    const day = dayIndex(s.minutes);
    const a = AUTHORED[id];
    const home = p ? HOMES[p.home]?.name ?? p.home : a?.home ?? '';
    const work = a?.work ?? (p?.work ? JOB_KINDS[p.work].place : ageOf(p ?? { birth: 0 }, day) < 9 ? 'too young to work' : 'no work');
    const haunt = a?.haunt ?? (p?.haunt ? HAUNTS[p.haunt].name : '');
    const family: string[] = [];
    const who = (x: string) => (x === 'you' ? 'you' : this.rec(x) ? fullNameOf(this.rec(x)!) : this.nameOf(x));
    if (p?.spouse) family.push(`married to ${who(p.spouse)}`);
    else if (p?.widowed) family.push('widowed');
    if (p?.courting) family.push(`${p.courting.wedding !== undefined ? 'engaged to' : 'walking out with'} ${who(p.courting.with)}`);
    const kids = (p?.children ?? []).map((c) => this.rec(c)).filter((c) => c?.alive);
    if (kids.length) family.push(`${kids.length === 1 ? 'a child' : `${kids.length} children`}: ${kids.map((c) => `${c!.first} (${ageOf(c!, day)})`).join(', ')}`);
    // Where they are likely to be right now.
    const npc = this.npcs.find((n) => n.res.id === id);
    const h = Math.floor(this.clock.hour);
    const st = npc ? this.stopFor(npc.res, h) : null;
    const job = p?.work ? JOB_KINDS[p.work] : null;
    const atWork = job ? (job.from <= h && h < job.to) : false;
    const now = !p?.alive ? 'Dead.' : p.district !== 'Saltwharf' ? `Lives in ${p.district}.` : st ? (k.haunt || k.work ? `Out: ${st.act ? ACTIVITY_TEXT[st.act] : 'about'}` : 'Out somewhere in Saltwharf') : atWork && k.work ? `At work, ${job!.place}` : k.home ? `At home, ${home}` : 'Indoors somewhere';
    return { age: p ? ageOf(p, day) : null, home: k.home ? home : '?', work: k.work ? work : '?', haunt: k.haunt ? haunt : '?', family, now };
  }

  /** "Tell me about yourself": they tell you where they live, work and drink. */
  private async askAboutLife(npc: Npc): Promise<void> {
    const s = this.state!;
    const id = npc.res.id;
    const r = this.rel(id);
    const k = (s.known[id] ??= {});
    k.home = k.home || r.friendship >= 5 || Math.random() < 0.6;
    k.work = true;
    k.haunt = k.haunt || r.friendship >= 10 || Math.random() < 0.5;
    const l = this.lifeOf(id);
    r.seen = dayIndex(s.minutes);
    r.today++;
    this.markUsed(`life:${id}`);
    const fam = l.family.length ? ` ${l.family[0][0].toUpperCase()}${l.family[0].slice(1)}.` : '';
    await this.dialogue.say({ speaker: npc.res.name, text: `"${l.age !== null ? `${l.age} years, and ` : ''}${l.work === '?' ? 'I get by' : `I work at ${l.work}`}. ${l.home === '?' ? 'Where I live is my business.' : `I live in ${l.home}.`}${l.haunt === '?' ? '' : ` Most evenings you'll find me ${/^(by|wherever|outside|in|on|at) /.test(l.haunt) ? l.haunt : `at ${l.haunt}`}.`}"${fam}\nAdded to their card in People.` });
    if (npc.held) this.showPerson(npc);
  }

  /** A friend tells you where someone is right now. */
  private whereIs(npc: Npc): void {
    const s = this.state!;
    const rows: ListRow[] = RESIDENTS.filter((p) => p.id !== npc.res.id && s.relations?.[p.id]?.met).map((p) => {
      const n = this.npcs.find((x) => x.res.id === p.id);
      const st = n ? this.stopFor(p, Math.floor(this.clock.hour)) : null;
      const zn = st ? zoneAt(st.x, st.z) : null;
      return {
        label: p.name,
        sub: st ? `"${this.first(p.id)}? ${st.act ? ACTIVITY_TEXT[st.act] : 'about'}, ${zn?.name ?? 'round here'}."` : '"Indoors, I\'d say. Home or at work."',
        actions: [],
      };
    });
    if (!rows.length) rows.push({ label: 'You know nobody else yet.', sub: '', actions: [] });
    this.hud.showList(`${this.first(npc.res.id)} knows where everyone is`, 'Right now', rows);
  }

  /** Friends who work somewhere can recommend you there: you start at the second rank. */
  private recommendActions(npc: Npc): Action[] {
    const s = this.state!;
    const id = npc.res.id;
    const p = this.rec(id);
    const employer = AUTHORED[id]?.employer ?? (p?.work ? JOB_KINDS[p.work].employer : undefined);
    if (!employer || employment(s, employer) || (s.relations?.[id]?.friendship ?? 0) < 30) return [];
    const job = JOBS[employer];
    const has = s.recommend[employer]?.by === id && dayIndex(s.minutes) - s.recommend[employer].day <= 5;
    return [{
      label: has ? `${this.first(id)} has put in a word (${job.employer})` : `Ask for a word at ${job.career === 'Docks' ? 'the docks' : job.employer}`,
      disabled: has,
      onClick: () => {
        s.recommend[employer] = { by: id, day: dayIndex(s.minutes) };
        this.hud.hidePlace();
        void this.dialogue.say({ speaker: npc.res.name, text: `"I'll tell ${job.boss.split(' ').pop()} you're all right. Go and ask in the next few days, and don't make a liar of me."\nStart as ${job.ranks[1]?.title ?? 'a hand'} instead of at the bottom.` }).then(() => npc.held && this.showPerson(npc));
      },
    }];
  }

  // --- The main story: the Fog Clock and Act I ---------------------------------

  private trunkReady(): boolean {
    const s = this.state!;
    return s.hesterLetters >= 3 || s.story.clock >= 25 || Object.keys(s.life.missing).length > 0 || s.character.skills.occult >= 2;
  }

  private async tryTrunk(): Promise<void> {
    const s = this.state!;
    if (!this.trunkReady()) {
      await this.dialogue.say({ speaker: 'You', text: 'The lid will not move. The lock is old, but well made.' }, { speaker: P, text: 'Leave that be. Not yet. When the fog comes up the stairs, then.' });
      return;
    }
    s.story.trunk = true;
    s.story.act1 = 'open';
    s.story.pages = 1;
    if (canCarry(s, 'hjournal')) addItem(s, 'hjournal');
    if (canCarry(s, 'hwatch')) addItem(s, 'hwatch');
    sfx('page');
    await this.dialogue.say(
      { speaker: '', text: 'This time the lid lifts, as if it had only been waiting to be asked. Mothballs. Salt. An iron nail as long as your hand. A journal in Hester\'s slanting hand, and a silver pocket watch that starts ticking the moment you touch it.' },
      { speaker: P, text: '"So. She wanted you to have it." For once he does not make a joke. "Read the journal. Keep the watch on you. When it stops, something is near that should not be."' },
    );
    await this.completeMission('a1c1', 'opened', '', true);
    this.startMission('a1c2');
    await this.hud.celebrate('promotion', 'Act I · The Fog', 'II. The First to Vanish', 'Hester\'s journal and watch are in your bag. Keep the watch close tonight.');
    await this.readJournal();
    this.refreshObjectives();
  }

  private async readJournal(): Promise<void> {
    const s = this.state!;
    sfx('page');
    const pages = JOURNAL.slice(0, Math.max(1, s.story.pages));
    await this.hud.modal('Hester\'s journal', pages, '', 'letter', 'In her own hand');
  }

  /** What the story wants of you now, for goals: the chapter, then the first side story under way. */
  private storyGoals(): string[] {
    const s = this.state!;
    const out: string[] = [];
    const ch = currentChapter(s);
    if (ch?.id === 'a1c1') {
      if (this.trunkReady()) out.push('Hester\'s trunk: try the lid again');
    } else if (ch) out.push(`${ch.title.replace(/^[IVX]+\. /, '')}: ${objectiveOf(s, ch)}`);
    const side = MISSIONS.find((d) => d.kind === 'side' && s.missions[d.id] && !s.missions[d.id].done);
    if (side) out.push(`${side.title}: ${objectiveOf(s, side)}`);
    return out;
  }

  // --- Missions: the chapters of Act I and the side stories ---------------------

  private mission(id: string): MissionState | undefined {
    return this.state!.missions[id];
  }

  /** The stage a mission is on, or -1 if it isn't under way. */
  private stageOf(id: string): number {
    const m = this.mission(id);
    return m && !m.done ? m.stage : -1;
  }

  private startMission(id: string, stage = 0): MissionState {
    const s = this.state!;
    const m: MissionState = { stage, started: dayIndex(s.minutes), flags: {} };
    s.missions[id] = m;
    this.refreshObjectives();
    return m;
  }

  private advance(id: string, stage: number): void {
    const m = this.mission(id);
    if (!m) return;
    m.stage = stage;
    sfx('page');
    const def = MISSION(id);
    this.hud.toast(`${def.title.replace(/^[IVX]+\. /, '')}: ${objectiveOf(this.state!, def)}`, 5000);
    this.refreshObjectives();
    this.save();
  }

  private async completeMission(id: string, outcome: string, reward: string, quiet = false): Promise<void> {
    const s = this.state!;
    const m = this.mission(id) ?? this.startMission(id);
    m.done = true;
    m.outcome = outcome;
    const def = MISSION(id);
    if (!quiet) await this.hud.celebrate(def.kind === 'main' ? 'promotion' : 'goal', def.kind === 'main' ? 'Chapter complete' : 'Story complete', def.title.replace(/^[IVX]+\. /, ''), reward);
    if (def.kind === 'main') {
      const next = currentChapter(s);
      if (next && !s.missions[next.id] && next.id !== 'a1c2') this.startMission(next.id);
    }
    this.refreshObjectives();
    this.save();
  }

  private warm(id: string, f: number): void {
    const r = this.rel(id);
    r.met = true;
    r.friendship = Math.max(0, Math.min(100, r.friendship + f));
  }

  private sk(k: SkillId, n: number): boolean {
    return this.state!.character.skills[k] >= n;
  }

  /** Story bubbles for someone: chapters, side stories on offer, and what each stage needs of them. */
  private missionActions(npc: Npc): Action[] {
    const s = this.state!;
    const id = npc.res.id;
    const h = this.clock.hour;
    const out: Action[] = [];
    const A = (label: string, fn: () => void | Promise<void>, opts: Partial<Action> = {}): Action => ({ label, primary: true, onClick: () => { this.hud.hidePlace(); void Promise.resolve(fn()).then(() => npc.held && this.showPerson(npc)); }, ...opts });
    const say = (text: string) => this.dialogue.say({ speaker: npc.res.name, text });
    // Side stories on offer.
    for (const d of MISSIONS) if (d.kind === 'side' && d.giver === id && sideStatus(s, d) === 'offered') out.push(A(`A story: ${d.title}`, () => this.offerSide(npc, d.id)));

    // II. The First to Vanish.
    const c2 = this.stageOf('a1c2');
    if (c2 === 0 && id === 'lizzie' && this.mission('a1c2')!.flags.vanish) out.push(A('Ask about Tom', async () => {
      await say('"He never came home. His mam\'s been up all night. He always walks back along the quay, and the fog was so thick..." She twists a measuring tape round her fingers. "Ruby was out on Rope Walk last night. Ruby sees everything after dark. Ask her."');
      this.advance('a1c2', 1);
    }));
    if (c2 === 1 && id === 'ruby') {
      const lead = async (how: 'charm' | 'friend' | 'lean') => {
        if (how === 'lean') {
          const r = this.rel('ruby');
          r.friendship = Math.max(0, r.friendship - 10);
          r.rivalry = Math.min(100, r.rivalry + 8);
          await say('She flinches when you take her wrist. "All right! All right. Let go." She rubs it. "I saw him. Remember that I told you, and remember how you asked."');
        } else if (how === 'charm') await say(`She laughs despite herself. "You could talk the fog off the river, ${s.character.first}." Then she stops laughing.`);
        gainXp(s, how === 'lean' ? 'strength' : 'charisma', 8);
        await say('"I saw Tom. Midnight, near enough. There was a light on the quay, white, like the new lamp but lower, moving. He walked after it like a dog after its master. I called him. He didn\'t turn round."');
        this.advance('a1c2', 2);
      };
      out.push(A('Ask what she saw (charm: Charisma 3)', () => lead('charm'), { disabled: !this.sk('charisma', 3) }));
      out.push(A('Ask as a friend (Friendship 15)', () => lead('friend'), { disabled: this.rel('ruby').friendship < 15 }));
      out.push(A('Lean on her (Strength 3)', () => lead('lean'), { primary: false, disabled: !this.sk('strength', 3) }));
    }
    if (c2 === 2 && id === 'mag' && !this.mission('a1c2')!.flags.mag) out.push(A('Ask Mag to read Hester\'s watch (Friendship 10)', async () => {
      this.mission('a1c2')!.flags.mag = 1;
      await say('She holds the watch to her ear like a shell. "Oh, Hester. Still ticking." She shows you the hands: they do not tell the time; they point. "Down the quay. When the dead walk, after ten. I\'ll come with you, and you\'ll hold my arm, and we\'ll see what we see."');
      this.refreshObjectives();
    }, { disabled: this.rel('mag').friendship < 10 }));

    // III. A Name for the Drowned.
    const c3 = this.stageOf('a1c3');
    const f3 = this.mission('a1c3')?.flags;
    if (c3 === 0 && f3) {
      if (id === 'mag' && !f3.mag) {
        out.push(A('Ask about the Kittiwake (Friendship 10)', () => this.clue('mag'), { disabled: this.rel('mag').friendship < 10 }));
        const food = s.inventory.find((i) => isFood(i.id));
        if (food) out.push(A(`Give her ${ITEMS[food.id].name.toLowerCase()}, and ask`, () => { removeItem(s, food.id); this.warm('mag', 4); return this.clue('mag'); }));
      }
      if (id === 'rudd' && !f3.rudd) out.push(A('Ask to see the old tally books (Friendship 15)', () => this.clue('rudd'), { disabled: this.rel('rudd').friendship < 15 }));
      if (id === 'hale' && !f3.hale) out.push(A('Ask him to read the burial register (Friendship 15)', () => this.clue('hale'), { disabled: this.rel('hale').friendship < 15 }));
    }

    // IV. The Gallantry Medal.
    const c4 = this.stageOf('a1c4');
    if (c4 === 0 && id === 'moss') out.push(A('Ask about Jack Merrow\'s medal', async () => {
      await say('"Merrow, Merrow..." Moss turns the pages of a ledger the size of a gravestone. "Gallantry medal, silver, brig Kittiwake. Pawned \'69 by the widow, never redeemed. And sold, last month, to Silas Crane." He closes the book. "Silas buys what the dead leave behind. I don\'t ask what for. Neither should you."');
      this.advance('a1c4', 1);
    }));
    if (c4 === 1 && id === 'silas') {
      const price = this.member('kin') ? 0.3 : 0.8;
      const got = async (how: string, text: string) => {
        if (canCarry(s, 'jmedal')) addItem(s, 'jmedal');
        s.story.medal = true;
        await say(text);
        await this.completeMission('a1c4', how, 'Jack Merrow\'s medal is in your bag. Now he has a name and something he loved.');
      };
      out.push(A(`Buy the medal (£${price.toFixed(2)})`, () => {
        s.money = Math.round((s.money - price) * 100) / 100;
        return got('coin', '"Sentimental, are we?" He takes your money and drops the medal in your palm, still warm from his pocket. "He\'ll be wanting that. They always want their things."');
      }, { disabled: s.money + 1e-9 < price }));
      out.push(A('Talk him round (Charisma 3)', () => {
        gainXp(s, 'charisma', 10);
        addDeed(s, 'kin', 2);
        return got('word', 'You tell him what the medal is for. He listens, which is worse than if he laughed. "Take it. Call it a loan. The Kin like to be owed by people who go out on the quay at night."');
      }, { disabled: !this.sk('charisma', 3) }));
      out.push(A('Take it from him (Strength 4)', async () => {
        const won = await this.fight({ name: 'Silas Crane', hp: 45, dmg: [5, 9], hit: 0.6, nerve: 30 }, '"Oh, you want to do it that way." Silas takes his coat off and folds it, carefully, first.', false, false);
        if (won) {
          addDeed(s, 'kin', -12);
          await got('steel', 'He spits blood and the medal onto the cobbles. "The Kin will hear about this. The Kin hear about everything."');
        }
      }, { primary: false, disabled: !this.sk('strength', 4) }));
    }

    // V. The Quay at Night: the coin ending.
    if (this.stageOf('a1c5') === 0 && id === 'silas' && s.story.kinPaid === undefined) {
      const cost = this.member('kin') ? 0.75 : 1.5;
      out.push(A(`Pay the Kin to deal with the drowned man (£${cost.toFixed(2)})`, async () => {
        s.money = Math.round((s.money - cost) * 100) / 100;
        s.story.kinPaid = dayIndex(s.minutes);
        addDeed(s, 'kin', 6);
        await say('"Iron, salt and a boat with no bottom. He\'ll be someone else\'s ghost by morning. Upriver, I should think. Hollow Lane, maybe." He smiles. "Don\'t ask what we do with it."');
      }, { primary: false, disabled: s.money + 1e-9 < cost }));
    }

    // Side: Letters for Lizzie.
    const lt = this.stageOf('letters');
    if (lt === 1 && id === 'lizzie' && s.inventory.some((i) => i.id === 'lovetoken')) out.push(A('Give her Tom\'s love token', async () => {
      removeItem(s, 'lovetoken');
      await say(`She reads it twice. Her eyes fill. "${this.mission('letters')!.flags.card ? 'He pressed a forget-me-not for me. Tom did?' : 'Tom wrote this? Tom can\'t write.'}" A long breath. "He\'s the sweetest boy on the river, and I can\'t. Not Tom. Not any boy." She looks at you, frightened of what she just said. "Will you tell him gently? Please. And nobody else."`);
      this.advance('letters', 2);
    }));
    if (lt === 2 && id === 'tom') {
      out.push(A('Tell him the truth, gently', async () => {
        await say('He listens with his cap in his hands. "Not any boy." He nods slowly. "I think I knew. I just wanted her to know someone thought she hung the moon." He swallows. "Thank you for not lying to me."');
        this.warm('tom', 12);
        this.warm('lizzie', 10);
        await this.completeMission('letters', 'truth', 'Tom Friendship +12, Lizzie Friendship +10. Some secrets are safest with a friend.');
      }));
      out.push(A('Tell him she\'s promised to someone in Kent', async () => {
        await say('"Kent." He laughs, a bit wet. "Course she is. Course there\'s someone." He claps your shoulder too hard. "Well. You tried. You\'re a good friend."');
        this.warm('tom', 8);
        this.warm('lizzie', 4);
        await this.completeMission('letters', 'kent', 'Tom Friendship +8. Lizzie\'s secret is safe; Tom\'s heart, less so.');
      }, { primary: false }));
    }

    // Side: Ruby's Debt.
    if (this.stageOf('ruby') === 0) {
      if (id === 'silas') {
        out.push(A('Pay off Ruby\'s debt (£1.00)', async () => {
          s.money = Math.round((s.money - 1) * 100) / 100;
          addDeed(s, 'kin', 2);
          await say('"A pound, and a penny for my trouble. No? Then a pound." He strikes her name out of a little black book. "She\'ll be back. They always come back."');
          this.warm('ruby', 15);
          await this.completeMission('ruby', 'paid', 'Ruby Friendship +15. She\'s free of the Kin, for now.');
        }, { disabled: s.money < 1 }));
        out.push(A('Talk him into writing it off (Charisma 3)', async () => {
          gainXp(s, 'charisma', 10);
          await say('You talk about bad debts and good will, and how the Kin are only as strong as the street that keeps their secrets. Silas sighs. "Fine. Ruby\'s square. But you\'re not, now."');
          this.warm('ruby', 15);
          await this.completeMission('ruby', 'talked', 'Ruby Friendship +15. Silas wrote off her debt, and wrote your name down instead.');
        }, { disabled: !this.sk('charisma', 3) }));
      }
      if (id === 'ruby') {
        const night = h >= 21 && h < 24;
        out.push(A(night ? 'Wait with her for Skint Joe (Strength 3)' : 'Wait with her for Skint Joe (after 21:00; Strength 3)', async () => {
          const won = await this.fight({ name: 'Skint Joe', hp: 35, dmg: [4, 8], hit: 0.6, nerve: 25 }, 'Skint Joe comes down Rope Walk swinging a cosh on a string. "Evening, Ruby. And who\'s your friend?"', false, false);
          if (won) {
            addDeed(s, 'kin', -6);
            await say('"He won\'t come back. Not to me." She squeezes your hand, hard. "You\'re mad. Thank you."');
            this.warm('ruby', 15);
            await this.completeMission('ruby', 'fought', 'Ruby Friendship +15. Skint Joe won\'t collect from her again. The Kin won\'t forget it.');
          }
        }, { disabled: !night || !this.sk('strength', 3) }));
      }
    }

    // Side: The Back Lane Pump.
    const pm = this.stageOf('pump');
    if (pm === 0 && id === 'quill') {
      const remedy = s.inventory.find((i) => ['bandage', 'tonic', 'broth'].includes(i.id));
      out.push(A(remedy ? `Give Quill the ${ITEMS[remedy.id].name.toLowerCase()}` : 'Give Quill a remedy (bandages, tonic or broth)', async () => {
        removeItem(s, remedy!.id);
        const m = this.mission('pump')!;
        m.flags.given = (m.flags.given ?? 0) + 1;
        gainXp(s, 'study', 6);
        if (m.flags.given >= 2) {
          await say('"That will see the Doyle children through the night." He frowns at his notebook. "Five houses, all on Back Lane, none on Church Street. Fevers don\'t keep to streets. Something on Back Lane is doing this. Find it."');
          this.advance('pump', 1);
        } else await say('"Good. One more and I can do my rounds properly."');
      }, { disabled: !remedy }));
    }
    if (pm === 2 && id === 'hale') out.push(A('Ask him to have the vestry chain the pump (Charisma 3)', async () => {
      gainXp(s, 'charisma', 8);
      await say('"A pump? Doctor Quill thinks the water is... yes. Yes, there was a paper on it, in Soho." He looks at you over his spectacles. "You argue like a barrister. I\'ll have the beadle chain it this afternoon."');
      this.warm('hale', 6);
      await this.endPump('chained');
    }, { disabled: !this.sk('charisma', 3) }));

    return out;
  }

  /** A side story is offered: the giver's lines, and yes or not yet. */
  private async offerSide(npc: Npc, id: string): Promise<void> {
    const s = this.state!;
    const lines: Record<string, string> = {
      letters: '"Can I ask you something? Don\'t laugh." Tom stares at his boots. "Lizzie. Lizzie Barlow. I can\'t say it to her face. I can\'t write it either. You could write it. Or make her something. You\'re clever with your hands."',
      ruby: '"I borrowed a pound off the Kin last winter, when my mam was bad. It\'s three pound now, by their sums, and they\'ve sent Skint Joe." She tries to laugh. "He collects after dark. With a cosh."',
      bruiser: '"Big Dan Sallow, out of Hollow Lane. He wants the yard\'s belt, and he wants it Saturday." Nell cracks her knuckles. "I need someone to spar with who won\'t fold. And someone to watch his corner. Dan doesn\'t fight clean."',
      pump: '"Fever in Back Lane, and more every day. I need someone who can read, and carry, and keep a list." Quill is grey with tiredness. "Bring me remedies, and then help me find the cause. There is always a cause."',
      cellar: '"Can you keep your mouth shut and your feet quiet?" Bessa doesn\'t wait for an answer. "There\'s a boat at the Wherry Stairs some nights. Brandy for my cellar. The constable walks the quay at midnight. Ten pence a run."',
    };
    const yes = await this.dialogue.ask({ speaker: npc.res.name, text: lines[id] ?? MISSION(id).blurb }, ['I\'ll help', 'Not now']);
    if (yes !== 0) return;
    this.startMission(id);
    sfx('page');
    const def = MISSION(id);
    await this.hud.celebrate('goal', 'A new story', def.title, objectiveOf(s, def));
    this.save();
  }

  /** III: a record of the drowned man; two of three give his name. */
  private async clue(which: 'mag' | 'rudd' | 'hale'): Promise<void> {
    const s = this.state!;
    const m = this.mission('a1c3');
    if (!m || m.flags[which]) return;
    m.flags[which] = 1;
    const texts = {
      mag: { speaker: 'Old Mag Doyle', text: '"Kittiwake. A brig, a pretty one. Came in the fog of \'69 and one of her men walked off the quay with his pockets full of nothing. A young one. His wife used to stand where you\'re standing, every night, till she didn\'t." She can\'t remember his name. "The river took it."' },
      rudd: { speaker: 'Foreman Rudd', text: 'The tally book for November 1869: Kittiwake, brig, 14 hands paid off. One line in red ink: "J. MERROW. Did not collect wages. Presumed drowned." Rudd shuts the book. "We don\'t get many in red."' },
      hale: { speaker: 'Father Ambrose Hale', text: 'The register, in a hand older than Hale\'s: "December 1869. John Merrow, called Jack, seaman of the brig Kittiwake, aged 24. No body. Buried at the widow\'s request and expense." In the margin: "Widow pawned a medal to pay. God forgive us."' },
    };
    await this.dialogue.say(texts[which]);
    const count = ['mag', 'rudd', 'hale'].filter((k) => m.flags[k]).length;
    if (count >= 2) {
      s.story.name = true;
      s.story.pages = Math.max(s.story.pages, 2);
      await this.dialogue.say({ speaker: P, text: '"Jack Merrow." Pembleton says it into the cold air of your room that night. "A name is a handle. Now you can pick him up. Or put him down." He hesitates. "The widow\'s medal. Moss buys from widows."' });
      await this.completeMission('a1c3', 'named', `His name was Jack Merrow, of the brig Kittiwake. Hester's journal has more now.`);
    } else this.refreshObjectives();
  }

  /** Place actions for missions: the table at home, the church, the yard, the Cup, the stairs, the pump. */
  private missionPlaceActions(placeId: string, act: (label: string, fn: () => void | Promise<void>, opts?: Partial<Action>) => Action): Action[] {
    const s = this.state!;
    const h = this.clock.hour;
    const out: Action[] = [];
    const hourOn = async (mins: number) => {
      this.clock.minutes += mins;
      s.minutes = this.clock.minutes;
      simulateNeeds(s.needs, mins / 60, 'awake');
    };
    if (placeId === 'table') {
      if (this.stageOf('letters') === 0) {
        const make = async (card: boolean) => {
          await hourOn(60);
          gainXp(s, card ? 'arts' : 'study', 10);
          addItem(s, 'lovetoken');
          this.mission('letters')!.flags.card = card ? 1 : 0;
          await this.dialogue.say({ speaker: '', text: card ? 'A forget-me-not from Hester\'s window box, pressed flat in her Bible, glued to a card with a border you inked yourself. It is better than it has any right to be.' : '"Dear Lizzie," you write, and then, for an hour, everything Tom has never managed to say. You leave out the bit about her laugh sounding like a kettle. Tom would want it in. You put it back.' });
          this.advance('letters', 1);
        };
        out.push(act('Write Tom\'s letter to Lizzie (Study 2, 1 hour)', () => make(false), { primary: true, disabled: !this.sk('study', 2) }));
        out.push(act('Press a flower card for Lizzie (Arts & Crafts 2, 1 hour)', () => make(true), { disabled: !this.sk('arts', 2) }));
      }
      if (this.stageOf('pump') === 1) out.push(act('Map the fever cases (Study 3, 1 hour)', async () => {
        await hourOn(60);
        gainXp(s, 'study', 12);
        await this.dialogue.say({ speaker: '', text: 'You draw Back Lane from memory and put a cross on every house with a fever. The crosses make a ring. In the middle of the ring is the pump.' });
        this.advance('pump', 2);
      }, { primary: true, disabled: !this.sk('study', 3) }));
    }
    if (placeId === 'church' && this.stageOf('a1c3') === 0 && !this.mission('a1c3')!.flags.hale) {
      out.push(act('Read the old burial register (Study 2)', () => { gainXp(s, 'study', 8); return this.clue('hale'); }, { primary: true, disabled: !this.sk('study', 2) }));
    }
    if (placeId === 'dockoffice') {
      if (this.stageOf('a1c3') === 0 && !this.mission('a1c3')!.flags.rudd) out.push(act('Read Rudd\'s old tally book upside down (Cunning 3)', () => { gainXp(s, 'cunning', 8); return this.clue('rudd'); }, { disabled: !this.sk('cunning', 3) }));
      if (this.stageOf('strike') === 0 && s.strike && dayIndex(s.minutes) >= s.strike.day) {
        out.push(act('Speak for the men to the owners\' agent (Charisma 3)', async () => {
          gainXp(s, 'charisma', 12);
          await this.dialogue.say({ speaker: 'The owners\' agent', text: 'You talk about barges rotting at anchor and cargo spoiling in the hold, and about how much Wapping men charge to sleep on a Saltwharf floor. The agent writes a number down, crosses it out, writes a bigger one. "Tell them the penny\'s back. And a tenth."' });
          this.mission('strike')!.flags.won = 1;
          for (const id of ['nell', 'tom', 'hannah']) this.warm(id, 6);
          await this.completeMission('strike', 'spoke', 'The strike is won: the penny back, and a tenth on top. The dockers will drink to you for a month.');
        }, { primary: true, disabled: !this.sk('charisma', 3) }));
        out.push(act('Hold the gate against the Wapping men (Strength 3, dawn)', async () => {
          const won = await this.fight({ name: 'A Wapping blackleg', hp: 40, dmg: [5, 9], hit: 0.6, nerve: 25 }, 'A cart of Wapping men comes up Quay Street in the grey light. The biggest jumps down first.', false, false);
          if (won) {
            this.mission('strike')!.flags.won = 1;
            for (const id of ['nell', 'tom', 'hannah']) this.warm(id, 8);
            this.rel('rudd').rivalry = Math.min(100, this.rel('rudd').rivalry + 4);
            await this.completeMission('strike', 'held', 'The Wapping men turned their cart round. The strike will be won, and the dockers know whose fists did it.');
          }
        }, { disabled: !this.sk('strength', 3) || h < 5 || h >= 9 }));
      }
    }
    if (placeId === 'boxing') {
      const b = this.stageOf('bruiser');
      if (b === 0) out.push(act(this.usedToday('spar') ? 'You sparred with Nell today' : 'Spar with Nell (1 hour; dawn until ten)', async () => {
        this.markUsed('spar');
        await hourOn(60);
        addNeed(s.needs, 'rest', -8);
        this.warm('nell', 3);
        const ups = gainXp(s, 'strength', 12);
        const m = this.mission('bruiser')!;
        m.flags.spar = (m.flags.spar ?? 0) + 1;
        this.hud.toast(['An hour of Nell hitting you and calling it love. Nell +3.', ...ups].join(' '), 3500);
        if (m.flags.spar >= 3) {
          await this.dialogue.say({ speaker: 'Nell Hartigan', text: '"You\'ll do. I\'ll do." She unwraps her hands. "Saturday, fight night. Dan always has something in his gloves. Catch him at it, or be in my corner when his seconds try something. Both, if you\'re greedy."' });
          this.advance('bruiser', 1);
        }
      }, { primary: true, disabled: this.usedToday('spar') || h < 5 || h >= 10 }));
      if (b === 1) {
        const m = this.mission('bruiser')!;
        out.push(act('Stand in Nell\'s corner against Dan Sallow', async () => {
          if (m.flags.gloves) {
            await this.dialogue.say({ speaker: '', text: 'Before the bell you hold up Dan\'s glove and pour lead shot out of the knuckle onto the sawdust. The crowd goes quiet, then very loud. Dan leaves over the back fence. Nell wins without throwing a punch, and is furious about it.' });
            s.money = Math.round((s.money + 0.2) * 100) / 100;
            this.warm('nell', 15);
            await this.completeMission('bruiser', 'exposed', 'Nell keeps the belt. Her share of the purse is yours: £0.20. Nell Friendship +15.');
            return;
          }
          const won = await this.fight({ name: 'Knuckles Pratt, Dan\'s second', hp: 50, dmg: [6, 10], hit: 0.65, nerve: 40 }, 'Third round, Nell has Dan on the ropes, and his second climbs through to help him. You get there first.', false, false);
          s.money = Math.round((s.money + (won ? 0.2 : 0)) * 100) / 100;
          this.warm('nell', won ? 15 : 5);
          await this.completeMission('bruiser', won ? 'fought' : 'lost', won ? 'Nell beat Dan Sallow fair and square, once you\'d dealt with his second. Her share of the purse is yours: £0.20. Nell Friendship +15.' : 'Dan\'s men swarmed the ring and Nell lost the belt. "Next year," she says, through a split lip. Nell Friendship +5.');
        }, { primary: true, disabled: !this.fightNightOpen() || (!m.flags.gloves && !this.sk('strength', 4)) }));
      }
    }
    if (placeId === 'coppercup' && this.stageOf('bruiser') === 1 && !this.mission('bruiser')!.flags.gloves) {
      out.push(act('Search Dan Sallow\'s kit bag (Cunning 3; evenings)', async () => {
        gainXp(s, 'cunning', 12);
        this.mission('bruiser')!.flags.gloves = 1;
        await this.dialogue.say({ speaker: '', text: 'Dan drinks at the bar with his back to his bag. Inside: a towel, a bottle, and a pair of gloves that weigh a pound each. Lead shot, sewn into the knuckles. You put them back exactly where they were, and keep one in your coat.' });
        this.refreshObjectives();
      }, { disabled: !this.sk('cunning', 3) || h < 18 }));
    }
    if (placeId === 'exit:wherry' && this.stageOf('cellar') === 0) {
      const late = h >= 22 || h < 2;
      out.push(act(this.usedToday('keg') ? 'You ran the kegs tonight' : 'Run brandy for Bessa (after 22:00)', async () => {
        this.markUsed('keg');
        await hourOn(60);
        addNeed(s.needs, 'rest', -6);
        const strong = this.sk('strength', 3);
        gainXp(s, strong ? 'strength' : 'charisma', 10);
        const m = this.mission('cellar')!;
        m.flags.runs = (m.flags.runs ?? 0) + 1;
        s.money = Math.round((s.money + 0.1) * 100) / 100;
        addDeed(s, 'kin', 2);
        await this.dialogue.say({ speaker: '', text: strong ? 'Two kegs on your shoulders, up the stairs, along the quay, down the Cup\'s cellar flap, and back before the constable\'s lantern turns the corner. Ten pence.' : 'You ask the constable about his feet, his wife and his chances of sergeant, while behind him six kegs go up the stairs like ducklings. Ten pence.' });
        if (m.flags.runs >= 3) {
          s.money = Math.round((s.money + 0.2) * 100) / 100;
          this.warm('bessa', 12);
          await this.completeMission('cellar', strong ? 'carried' : 'talked', 'Bessa\'s cellar is full and nobody\'s the wiser. A bonus of £0.20, Bessa Friendship +12, and the Kin know your name.');
        } else this.refreshObjectives();
      }, { primary: true, disabled: !late || this.usedToday('keg') }));
    }
    if (placeId === 'pump') {
      if (this.stageOf('pump') === 2) out.push(act('Wrench the handle off (Strength 3; after dark)', async () => {
        gainXp(s, 'strength', 10);
        await this.dialogue.say({ speaker: '', text: 'You brace a boot against the trough and pull until something in the pump gives with a crack like a gunshot. Windows go up all along Back Lane. You walk away with the handle under your arm.' });
        await this.endPump('wrenched');
      }, { primary: true, disabled: !this.sk('strength', 3) || (h >= 6 && h < 21) }));
    }
    return out;
  }

  private async endPump(how: string): Promise<void> {
    const s = this.state!;
    this.warm('quill', 12);
    s.parish.crowd += 3;
    await this.completeMission('pump', how, 'No new fevers in Back Lane. Quill Friendship +12, and the parish talks about you: three more votes if you stand for the vestry. Fevers will be rarer in Saltwharf.');
  }

  /** The drowned man on the quay: following him (II) or facing him (V). */
  private async quayGhost(): Promise<void> {
    const s = this.state!;
    if (this.stageOf('a1c2') === 2) {
      const m = this.mission('a1c2')!;
      if (!this.sk('occult', 2) && !m.flags.mag) {
        await this.dialogue.say({ speaker: '', text: 'Hester\'s watch has stopped, but its hands twitch and swing like a compass in a storm. You can\'t make sense of them, and the drowned man drifts away into the fog. (Occult 2, or ask Old Mag to read the watch with you.)' });
        return;
      }
      await this.dialogue.say(
        { speaker: '', text: `${m.flags.mag ? 'Mag grips your arm. ' : ''}The watch's hands point after the drowned man as he drifts west along the quay. You follow, and the fog follows you. At the top of the Wherry Stairs he stops, and looks down, and is gone.` },
        { speaker: '', text: 'Tom is sitting on the bottom step with the river round his ankles, soaked and blue, smiling at nothing. "He wanted to show me his ship," he says. "Kittiwake. Kittiwake. He kept saying it." You get him up the steps and home.' },
      );
      delete s.life.missing.tom;
      s.life.confused.tom = dayIndex(s.minutes) + 1;
      this.warm('tom', 10);
      this.warm('lizzie', 10);
      if (m.flags.mag) this.warm('mag', 6);
      s.story.pages = Math.max(s.story.pages, 2);
      await this.completeMission('a1c2', m.flags.mag ? 'mag' : 'watch', 'Tom is home, cold and confused. Tom +10, Lizzie +10. The drowned man kept saying a ship\'s name: Kittiwake.');
      return;
    }
    if (this.stageOf('a1c5') === 0) await this.sailor();
  }

  /** Face the drowned sailor: steel, word or coin. */
  private async sailor(): Promise<void> {
    const s = this.state!;
    const st = s.story;
    if (!s.inventory.some((i) => i.id === 'hwatch') && s.character.skills.occult < 3) return;
    const hasMedal = s.inventory.some((i) => i.id === 'jmedal');
    const opts = [
      'Fight it (iron and fists)',
      st.name ? (hasMedal ? `Say his name, and give him his medal` : 'Say his name') : 'Speak to it',
      'Back away',
    ];
    const c = await this.dialogue.ask({ speaker: 'The drowned sailor', text: 'Hester\'s watch stops. The fog thickens round a shape in a pea-coat, water running from its sleeves that never reaches the ground. It turns to you. Its face is the river at night.' }, opts);
    if (c === 2) return;
    if (c === 0) {
      const lamplighters = this.member('brotherhood');
      const won = await this.fight({ name: 'The drowned sailor', hp: lamplighters ? 40 : 60, dmg: [7, 12], hit: 0.72, nerve: 999 }, lamplighters ? 'Nell and two lamplighters come running with poles and salt. "Hit it where it\'s thinnest!"' : 'It comes at you like a wave comes at a wall.', false, false);
      if (won) await this.endAct1('steel');
      return;
    }
    // Word: his name, and something he loved.
    if (!st.name) {
      await this.dialogue.say({ speaker: 'The drowned sailor', text: '"...who..." The word comes up like a bubble from deep water. It does not know its own name. Neither do you.' });
      return;
    }
    // With his medal, Occult 3 or Charisma 3 makes it sure; without, it is a gamble.
    const chance = hasMedal && (this.sk('occult', 3) || this.sk('charisma', 3)) ? 1 : (hasMedal ? 0.45 : 0.15) + s.character.skills.occult * 0.04 + s.character.skills.charisma * 0.03;
    if (Math.random() < chance) {
      if (hasMedal) removeItem(s, 'jmedal');
      await this.dialogue.say(
        { speaker: 'You', text: `"Jack. Jack Merrow. ${hasMedal ? 'This is yours. She kept it for you as long as she could.' : 'You were on the Kittiwake. You can go home now.'}"` },
        { speaker: 'The drowned sailor', text: '"...Jack." It says it as if tasting it. The water stops running from its sleeves. For a moment there is a man there, young, embarrassed, with salt in his beard. Then there is only fog, thinning, and the river going on.' },
      );
      await this.endAct1('word');
    } else {
      addNeed(s.needs, 'health', -12);
      await this.dialogue.say({ speaker: 'The drowned sailor', text: `"...JACK..." It screams the name back at you and the cold goes through you like a blade. Not enough. Not yet. (Health −12. ${hasMedal ? 'Try again another night.' : 'Something of his might hold him.'})` });
    }
  }

  private async endAct1(path: 'steel' | 'word' | 'coin'): Promise<void> {
    const s = this.state!;
    const st = s.story;
    st.act1 = 'done';
    st.path = path;
    st.pages = JOURNAL.length;
    st.clock = Math.max(0, st.clock - (path === 'coin' ? 15 : 30));
    // The lost come home out of the fog.
    for (const id of Object.keys(s.life.missing)) {
      delete s.life.missing[id];
      s.life.confused[id] = dayIndex(s.minutes) + 1;
    }
    const sub = { steel: 'You put him down with iron and fists. The quay is quiet; the river is not grateful.', word: 'You gave him back his name. He went. The fog over the quay has thinned.', coin: 'The Kin took him away in a boat with no bottom. He is someone else\'s ghost now.' }[path];
    for (const id of MAIN_IDS) if (!s.missions[id]?.done) s.missions[id] = { ...(s.missions[id] ?? { stage: 0, started: dayIndex(s.minutes), flags: {} }), done: true, outcome: id === 'a1c5' ? path : 'skipped' };
    await this.hud.celebrate('promotion', 'Act I complete', 'The Fog', sub);
    sendLetter(s, 'Mrs. Constance Ashby', 'A card for you', `I hear you have been on the quay at night, doing what my husband\'s friends would not.\n\nMy cousin holds séances in Mayfield, for the Velvet Court. One of them stopped being a trick. When the season opens, come. Bring Hester\'s watch.\n\nC.A.\n\n(Act II, "The Social Season", opens with Mayfield in a later district. Until then the fog thickens slowly, and Saltwharf is yours.)`);
    this.refreshObjectives();
  }

  /** Each night: the Fog Clock moves, urgent calls fire, the Kin keep their bargains, and London may fall. */
  private nightlyStory(day: number): string[] {
    const s = this.state!;
    const st = s.story;
    const lines: string[] = [];
    // II: the night after the trunk opens, Tom walks into the fog.
    const c2 = s.missions.a1c2;
    if (c2 && !c2.done && !c2.flags.vanish) {
      c2.flags.vanish = 1;
      s.life.missing.tom = 99999;
      st.clock += 2;
      lines.push('MISSING: Tom Fairley walked home along the quay through last night\'s fog and never arrived. Lizzie Barlow is asking everyone.');
    }
    if (st.kinPaid !== undefined && st.act1 === 'open' && day > st.kinPaid) {
      void this.endAct1('coin');
      lines.push('Before dawn, the Kin rowed something out onto the river and came back without it.');
    }
    const before = st.clock;
    let rate = 0.6 + (s.weather === 'fog' ? 0.3 : 0) + (day >= VANE_DONE ? 0.2 : 0);
    if (st.act1 === 'done') rate *= 0.25;
    st.clock = Math.min(st.act1 === 'done' ? 70 : 100, st.clock + rate);
    if (Math.floor(st.clock / 10) > Math.floor(before / 10)) lines.push(`The Fog Clock stands at ${Math.round(st.clock)}: the fog is ${clockWord(st.clock)}.`);
    for (const t of [25, 50, 75]) {
      if (st.clock >= t && st.urgent < t && st.act1 !== 'done') {
        st.urgent = t;
        const u = URGENT[t];
        lines.push(`URGENT: ${u.title}. ${u.text}`);
        if (t === 25 && !st.trunk) lines.push('Pembleton is pacing. "The trunk," he says. "Now."');
      }
    }
    if (st.clock >= 100 && !st.fallen) {
      st.fallen = true;
      this.pendingFall = true;
    }
    return lines;
  }

  private pendingFall = false;

  /** The losing ending: the fog takes London. */
  private async fallOfLondon(): Promise<void> {
    const s = this.state!;
    await this.hud.modal('The Fall of London', [
      'The fog came up Quay Street, and then up the stairs, and then it did not leave.',
      'The white lamps burned on in Mayfield for a week after the last gas lamp in Saltwharf went out. Then they too went dark, and the city was quiet.',
      `Nobody remembers ${s.character.first} ${s.character.last}. Nobody remembers anyone. That is what the Pale does.`,
    ], 'THE END', 'letter', 'An ending');
    await this.dialogue.say({ speaker: P, text: '"She told me this would happen if nobody listened." The ghost is fading too. "Begin again. Do better. Open the trunk sooner."' });
    deleteSave();
    location.reload();
  }

  /** The watch in the dock stops when the dead are near. */
  private watchStopped = false;
  private updateWatch(): void {
    const s = this.state!;
    if (!s.inventory.some((i) => i.id === 'hwatch')) return;
    const ghost = this.location.id === 'saltwharf' && this.life.ghostNear(this.player!.position, 6);
    if (ghost !== this.watchStopped) {
      this.watchStopped = ghost;
      document.querySelector('.tok.watch')?.classList.toggle('stopped', ghost);
      if (ghost) this.hud.toast('Hester\'s watch has stopped.', 2500);
    }
  }

  // --- Factions ----------------------------------------------------------------

  private member(f: FactionId): boolean {
    return this.state!.factions.member === f;
  }

  private respectable(): boolean {
    const s = this.state!;
    return (s.outfit === 'coat' || s.outfit === 'sunday') && s.wear[s.outfit] >= 40;
  }

  /** Joining, leaving and the duties that pass through a faction's members. */
  private factionActions(npc: Npc): Action[] {
    const s = this.state!;
    const id = npc.res.id;
    const F = s.factions;
    const out: Action[] = [];
    const f = factionOf(id);
    if (f && f !== 'society') {
      const def = { ...FACTIONS[f], name: FACTIONS[f].name.replace(/^The /, 'the ') };
      if (F.member === f) {
        out.push({ label: `Leave ${def.name}`, onClick: () => { this.hud.hidePlace(); void this.leaveFaction(true); } });
      } else {
        const blockers = joinBlockers(s, f, this.respectable());
        const other = F.member ? FACTIONS[F.member].name.replace(/^The /, 'the ') : null;
        out.push({
          label: other ? `Join ${def.name} (leave ${other} first)` : blockers.length ? `Join ${def.name} (needs ${blockers.join(', ')})` : `Ask to join ${def.name}`,
          primary: !other && !blockers.length,
          disabled: !!other || blockers.length > 0,
          onClick: () => { this.hud.hidePlace(); void this.joinFaction(f, npc.res.name); },
        });
      }
    }
    // Duties.
    if (F.member === 'kin' && F.debtor === id && !F.dutyDone) {
      out.push({ label: 'Collect the Kin\'s debt', primary: true, onClick: () => { this.hud.hidePlace(); void this.collectDebt(npc); } });
    }
    if (F.member === 'court' && id === 'mag' && !F.dutyDone) {
      const bread = s.inventory.some((i) => i.id === 'bread');
      out.push({
        label: bread ? 'Put a loaf in the poor box' : 'Put £0.03 in the poor box', primary: true, disabled: !bread && s.money < 0.03,
        onClick: () => {
          if (bread) removeItem(s, 'bread');
          else s.money = Math.round((s.money - 0.03) * 100) / 100;
          F.dutyDone = true;
          addDeed(s, 'court', 2);
          this.hud.hidePlace();
          void this.dialogue.say({ speaker: npc.res.name, text: '"The Court thanks you. The Court never forgets, neither the good nor the other." Duty done for the week.' });
        },
      });
    }
    if (F.member === 'court' && id === 'hannah') {
      out.push({ label: this.usedToday('courtpot') ? 'Bread from the Court\'s pot (tomorrow)' : 'Bread from the Court\'s pot', disabled: this.usedToday('courtpot'), onClick: () => { this.markUsed('courtpot'); addNeed(s.needs, 'hunger', 25); this.hud.hidePlace(); this.hud.toast('A heel of bread and a ladle of something hot. Hunger +25.'); } });
    }
    if (F.member === 'guild' && id === 'pell' && rankIn(s, 'guild') === 2 && !F.loan) {
      out.push({ label: 'Ask the Guild for a loan (£1)', onClick: () => { F.loan = true; s.money = Math.round((s.money + 1) * 100) / 100; s.debt = Math.round((s.debt + 1.1) * 100) / 100; this.hud.hidePlace(); this.hud.toast('The Guild lends you £1, to be repaid with a shilling\'s interest from your wages.', 4000); } });
    }
    return out;
  }

  private async joinFaction(f: FactionId, via: string): Promise<void> {
    const s = this.state!;
    const def = FACTIONS[f];
    const F = s.factions;
    const day = dayIndex(s.minutes);
    const yes = await this.dialogue.ask({ speaker: via, text: `"${def.blurb}" A long look. "Our rules: ${def.rules.map((r) => r.charAt(0).toLowerCase() + r.slice(1)).join('; ')}. Break them and ${def.punishment.charAt(0).toLowerCase()}${def.punishment.slice(1)}."` }, ['I\'m in.', 'Let me think on it.']);
    if (yes !== 0) return;
    F.member = f;
    F.since = day;
    F.dutyDue = day + 7;
    F.dutyDone = false;
    this.pickDebtor();
    addDeed(s, f, 5);
    for (const r of def.rivals) {
      addDeed(s, r, -15);
      for (const m of FACTIONS[r].members) { const rr = this.rel(m); rr.friendship = Math.max(0, rr.friendship - 8); }
    }
    await this.hud.celebrate('promotion', 'Sworn in', def.name, `${def.ranks[0]}. This week: ${def.duty.charAt(0).toLowerCase()}${def.duty.slice(1)}.`);
    this.refreshObjectives();
  }

  private async leaveFaction(voluntary: boolean): Promise<void> {
    const s = this.state!;
    const F = s.factions;
    const f = F.member;
    if (!f) return;
    if (voluntary) {
      const yes = await this.dialogue.ask({ speaker: 'You', text: `Leave ${FACTIONS[f].name}? They will take it badly.` }, ['Leave', 'Stay']);
      if (yes !== 0) return;
    }
    F.member = null;
    addDeed(s, f, voluntary ? -20 : -35);
    if (f === 'kin') sendLetter(s, 'Unsigned', 'Nobody leaves', 'Nobody leaves the Kin, friend. They just stop being lucky.');
    this.hud.toast(`You are no longer one of ${FACTIONS[f].name}.`, 3500);
  }

  /** Thrown out: each faction punishes in its own way. */
  private expel(f: FactionId, why: string): void {
    const s = this.state!;
    const day = dayIndex(s.minutes);
    if (s.factions.member === f) s.factions.member = null;
    s.factions.expelled[f] = day + 14;
    addDeed(s, f, -30);
    const def = FACTIONS[f];
    sendLetter(s, def.name, 'You are out', `${why}\n\n${def.punishment}.`);
    if (f === 'kin') s.used.ambush = day;
    if (f === 'society' && s.jobs.length) {
      const e = s.jobs[Math.floor(Math.random() * s.jobs.length)];
      leave(s, e.jobId, true);
      sendLetter(s, JOBS[e.jobId].boss, 'Your position', 'A letter has reached me from Mayfield. I am sorry. Don\'t come in tomorrow.');
    }
    this.hud.toast(`Thrown out of ${def.name}: ${def.punishment.charAt(0).toLowerCase()}${def.punishment.slice(1)}.`, 5000);
  }

  private pickDebtor(): void {
    const s = this.state!;
    const day = dayIndex(s.minutes);
    const pool = s.people.filter((p) => !p.authored && p.alive && p.district === 'Saltwharf' && ageOf(p, day) >= 20 && p.work && JOB_KINDS[p.work].area);
    s.factions.debtor = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : undefined;
  }

  private async collectDebt(npc: Npc): Promise<void> {
    const s = this.state!;
    const c = await this.dialogue.ask({ speaker: npc.res.name, text: '"Silas sent you? I told him, Friday. I\'ll have it Friday."' }, ['Talk them round (Charisma)', 'Lean on them (Strength)', 'Let it go']);
    if (c === 2) return;
    const sk = c === 0 ? s.character.skills.charisma : s.character.skills.strength;
    if (Math.random() < 0.45 + sk * 0.06) {
      s.factions.dutyDone = true;
      s.money = Math.round((s.money + 0.05) * 100) / 100;
      addDeed(s, 'kin', 3);
      if (c === 1) {
        const r = this.rel(npc.res.id);
        r.rivalry = Math.min(100, r.rivalry + 15);
        this.note('wronged', npc.res.id);
      }
      await this.dialogue.say({ speaker: npc.res.name, text: c === 0 ? '"...All right. All right. Here. Tell him we\'re square." (£0.05 is your cut.)' : 'They count it out with shaking hands. Somebody saw. (£0.05 is your cut.)' });
    } else {
      await this.dialogue.say({ speaker: npc.res.name, text: c === 0 ? '"Friday," they say again, and walk off.' : 'They shove past you. Not today.' });
    }
  }

  /** Meetings and Saturdays: the Brotherhood, the Guild, Lady Vane. */
  private checkFactionEvents(): void {
    const s = this.state!;
    if (this.busy || this.dialogue.open || this.hud.blocking || this.location.id !== 'saltwharf' || !this.player) return;
    const F = s.factions;
    const day = dayIndex(s.minutes);
    const wd = weekday(day);
    const h = this.clock.hour;
    const p = this.player.position;
    const near = (x: number, z: number, r = 3) => Math.hypot(p.x - x, p.y - z) < r;
    const once = (k: string) => (s.used[k] === day ? false : ((s.used[k] = day), true));
    if (F.member === 'brotherhood' && wd === 3 && h >= 21 && h < 23 && near(26.5, 8.5) && once('meet:brotherhood')) void this.patrol();
    if (F.member === 'guild' && wd === 5 && h >= 19 && h < 21 && near(18.5, 8.5) && once('meet:guild')) void this.meeting('guild', 0.05, 'Mutton, claret and the minutes of the last meeting. Grubb proposes a motion against the Kin. Mrs. Pell proposes a motion against Grubb.');
    if (wd === 6 && h >= 19 && h < 21 && near(1.5, 8.5, 2.5) && (F.member === 'society' || F.invited) && once('soiree')) void this.soiree();
  }

  /** The Lamplighters' Wednesday patrol: the old lamps, and what waits between them. */
  private async patrol(): Promise<void> {
    const s = this.state!;
    this.busy = true;
    this.player!.stop();
    s.factions.dutyDone = true;
    addDeed(s, 'brotherhood', 3);
    const r = this.rel('nell');
    r.met = true;
    r.seen = dayIndex(s.minutes);
    this.busy = false;
    await this.dialogue.say({ speaker: 'Nell Hartigan', text: '"Lantern up. Pole up. Stay in the light, and if the light goes out, stay behind me." The patrol walks Quay Street lamp by lamp, and the fog walks with you.' });
    if (Math.random() < 0.5 + s.story.clock / 200) {
      const won = await this.fight({ name: 'A thing in the fog', hp: 34, dmg: [5, 10], hit: 0.68, nerve: 999 }, 'Between two lamps the fog stands up. It has a shape, nearly. It has a mouth, nearly.', false, false);
      if (won) {
        s.money = Math.round((s.money + 0.1) * 100) / 100;
        addDeed(s, 'brotherhood', 4);
        s.story.clock = Math.max(0, s.story.clock - 1);
        this.hud.toast('It comes apart like wet paper. The Guild pays a bounty: £0.10.', 4000);
      }
    } else this.hud.toast('A quiet round. The lamps burn, the fog keeps its distance. Duty done.', 3500);
    this.clock.minutes += 120;
  }

  private async meeting(f: FactionId, dues: number, text: string): Promise<void> {
    const s = this.state!;
    this.busy = true;
    this.player!.stop();
    s.money = Math.max(0, Math.round((s.money - dues) * 100) / 100);
    s.factions.dutyDone = true;
    addDeed(s, f, 2);
    addNeed(s.needs, 'social', 18);
    for (const m of FACTIONS[f].members) { const r = this.rel(m); r.met = true; r.friendship = Math.min(100, r.friendship + 2); r.seen = dayIndex(s.minutes); }
    this.clock.minutes += 90;
    this.busy = false;
    await this.dialogue.say({ speaker: '', text: `${text}\nDues paid (£${dues.toFixed(2)}). Duty done for the week. Social +18.` });
  }

  /** Lady Vane's Saturday, in Ashcombe Square. */
  private async soiree(): Promise<void> {
    const s = this.state!;
    const F = s.factions;
    this.busy = true;
    this.player!.stop();
    await this.hud.fade(true);
    this.clock.minutes += 150;
    await this.hud.fade(false);
    const sk = s.character.skills;
    let score = 0;
    const a = await this.dialogue.ask({ speaker: 'Lady Vane', text: '"And you are the one from the river. How thrilling. Tell me, do you read?"' }, ['Quote Gibbon at her (Study)', 'Make her laugh (Charisma)', '"Only the Gazette, ma\'am."']);
    score += a === 0 ? (sk.study >= 6 ? 2 : -1) : a === 1 ? (sk.charisma >= 5 ? 2 : 0) : -1;
    const b = await this.dialogue.ask({ speaker: 'Mr. Vane', text: 'A pale man with paler eyes takes your hand and does not let go. "My lamps. Saltwharf is grateful for them, I hope?"' }, ['"They are very bright, sir."', '"Some people won\'t walk under them."', 'Say nothing, and take your hand back']);
    score += b === 0 ? 1 : b === 1 ? -2 : 0;
    if (b === 1) addDeed(s, 'lantern', 4);
    const c = await this.dialogue.ask({ speaker: 'A dowager', text: '"Whom will you marry, child? One must marry someone."' }, ['"Someone of good family."', '"Whomever I please."', '"I am married already."']);
    score += c === 0 ? 1 : c === 1 ? -1 : 0;
    addNeed(s.needs, 'social', 15);
    addNeed(s.needs, 'rest', -10);
    this.busy = false;
    if (!F.member) {
      F.invited = false;
      if (score >= 1) {
        F.member = 'society';
        F.since = dayIndex(s.minutes);
        F.dutyDue = F.since + 7;
        F.dutyDone = true;
        addDeed(s, 'society', 25);
        for (const r of FACTIONS.society.rivals) addDeed(s, r, -15);
        await this.hud.celebrate('promotion', 'Admitted', 'The Velvet Court', 'A Guest of Mayfield. Saturdays, the carriage waits at the west end of Quay Street.');
      } else await this.dialogue.say({ speaker: 'Lady Vane', text: '"How very... authentic." The carriage takes you home. No second invitation comes.' });
    } else {
      F.dutyDone = true;
      addDeed(s, 'society', score * 2);
      await this.dialogue.say({ speaker: '', text: `Vane House, Mayfield: candles, string quartet, ices in October, and every window lit with a white lamp. You come home at midnight smelling of other people\'s money. Duty done for the week.${score < 0 ? ' Lady Vane was cool with you at the door.' : ''}` });
    }
  }

  /** Each night: the week's duty is judged; Lady Vane may write; Monday's cuts. */
  private nightlyFactions(day: number): string[] {
    const s = this.state!;
    const F = s.factions;
    const lines: string[] = [];
    const f = F.member;
    if (f) {
      const def = FACTIONS[f];
      if (day > F.dutyDue) {
        if (F.dutyDone) {
          addDeed(s, f, 6);
          lines.push(`${def.name}: your duty this week is noted. Standing ${standing(s, f)}.`);
        } else {
          addDeed(s, f, -12);
          lines.push(`${def.name}: you neglected your duty this week. They noticed.`);
          if (standing(s, f) < def.at[0] - 25) this.expel(f, 'You were told the rules. You have not kept them.');
        }
        F.dutyDue = day + 7;
        F.dutyDone = false;
        this.pickDebtor();
      }
      if (F.member && weekday(day) === 1) {
        if (f === 'kin' && rankIn(s, 'kin') === 2) { s.money = Math.round((s.money + 0.1) * 100) / 100; lines.push('Your cut of the Kin\'s week: £0.10, in a twist of newspaper under the door.'); }
        if (f === 'society') { s.money = Math.round((s.money + 0.15) * 100) / 100; lines.push('Returns from your Mayfield investments: £0.15.'); }
      }
      if (F.member) {
        const r = rankIn(s, F.member);
        const key = `frank:${F.member}`;
        if ((s.used[key] ?? 0) < r) {
          s.used[key] = r;
          lines.push(`${def.name} now count you a ${def.ranks[r]}.`);
        }
      }
      if (F.member === 'kin' && F.debtor) lines.push(`The Kin want a debt collected from ${this.nameOf(F.debtor)} this week.`);
    }
    // Lady Vane notices those who rise.
    if (!F.member && !F.invited && !(F.expelled.society && F.expelled.society > day) && joinBlockers(s, 'society', this.respectable()).every((b) => b.startsWith('standing'))) {
      F.invited = true;
      addDeed(s, 'society', Math.max(0, 20 - standing(s, 'society')));
      sendLetter(s, 'Lady Honoria Vane', 'An invitation', `Lady Vane requests the pleasure of your company on Saturday at eight, at Vane House, Mayfield. A carriage will wait at the west end of Quay Street from seven.\n\nR.S.V.P. is unnecessary. One comes.`);
    }
    return lines;
  }

  /** Standing with every faction, for the journal. */
  private factionsHtml(): string {
    const s = this.state!;
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    const F = s.factions;
    const day = dayIndex(s.minutes);
    return FACTION_IDS.map((f) => {
      const def = FACTIONS[f];
      const st = standing(s, f);
      const mine = F.member === f;
      const pct = Math.max(0, Math.min(100, st));
      const blockers = joinBlockers(s, f, this.respectable());
      const status = mine
        ? `<b>${esc(def.ranks[rankIn(s, f)])}</b>. ${F.dutyDone ? 'Duty done this week.' : `Duty: ${esc(f === 'kin' && F.debtor ? `collect from ${this.short(F.debtor)}` : def.duty.split(':')[0].split('(')[0].trim())}.`}`
        : (F.expelled[f] ?? -1) > day ? 'They threw you out.' : blockers.length ? `To join: ${esc(blockers.slice(0, 2).join(', '))}` : f === 'society' ? 'By invitation only.' : `Ask ${esc(def.members.slice(0, 2).map((m) => this.short(m)).join(' or '))} to join.`;
      return `<div class="skillrow"><div class="sk-h"><span>${esc(def.name)}${mine ? ' ❦' : ''}</span><b>${st}</b></div><div class="sk-bar"><i style="width:${pct}%"></i></div>
        <div class="sk-sub">${status}</div>
        <details><summary>Rules and perks</summary><p>${esc(def.rules.join('. '))}.</p><p>${esc(def.perks.join('. '))}.</p></details></div>`;
    }).join('') + '<p class="meta">One at a time. Joining one cools its rivals.</p>';
  }

  // --- A family of your own --------------------------------------------------

  private playerAge(day = dayIndex(this.state!.minutes)): number {
    return ageOf({ birth: this.state!.character.birth ?? -504 }, day);
  }

  /** Proposing, and the things only a spouse or a child of yours can do. */
  private familyActions(npc: Npc): Action[] {
    const s = this.state!;
    const id = npc.res.id;
    const r = this.rel(id);
    const p = this.rec(id);
    const day = dayIndex(s.minutes);
    const out: Action[] = [];
    const f = s.family;
    const adult = p ? ageOf(p, day) >= 18 : true;
    if (!f.spouse && !f.engaged && adult && p?.alive && !p.spouse && canRomance(s, npc.res) && r.romance >= 45) {
      out.push({
        label: r.romance >= 60 && r.friendship >= 40 ? 'Ask for their hand' : 'Ask for their hand (needs Romance 60, Friendship 40)',
        primary: r.romance >= 60 && r.friendship >= 40,
        disabled: r.romance < 60 || r.friendship < 40 || !s.housed,
        onClick: () => { this.hud.hidePlace(); void this.propose(npc); },
      });
    }
    if (f.spouse === id) {
      out.push({
        label: this.usedToday('evening') ? 'An evening together (tomorrow)' : 'Spend the evening together (1 hour)',
        primary: !this.usedToday('evening'),
        disabled: this.usedToday('evening'),
        onClick: () => {
          this.markUsed('evening');
          f.lastEvening = day;
          f.strain = Math.max(0, f.strain - 6);
          r.romance = Math.min(100, r.romance + 4);
          r.friendship = Math.min(100, r.friendship + 2);
          r.seen = day;
          addNeed(s.needs, 'social', 22);
          addNeed(s.needs, 'rest', 4);
          this.clock.minutes += 60;
          this.hud.hidePlace();
          const lines = ['You talk about nothing for an hour, and it is the best hour of the day.', 'Bread, dripping, the last of the candle, and their feet in your lap.', 'They read you the Gazette in silly voices. Even the obituaries.', 'You sit by the window and count the lamps along the quay together.'];
          this.hud.toast(`${lines[Math.floor(Math.random() * lines.length)]} Social +22, Romance +4.`, 4000);
        },
      });
      const canBear = this.canHaveBaby(id);
      if (canBear) {
        out.push({
          label: f.due ? `A baby is coming (${Math.max(0, f.due - day)} days)` : f.trying ? 'Stop trying for a baby' : 'Talk about having a baby',
          disabled: !!f.due,
          onClick: () => {
            f.trying = !f.trying;
            this.hud.hidePlace();
            void this.dialogue.say({ speaker: npc.res.name, text: f.trying ? '"A baby." They say it as if trying the word for size. Then they smile. "Yes. Yes, all right."' : '"Not yet, then." They squeeze your hand. "When we\'re steadier."' });
          },
        });
      }
    }
    // Your children: play with them; teach them what you know.
    if (f.children.includes(id) && p) {
      const age = ageOf(p, day);
      out.push({
        label: this.usedToday(`play:${id}`) ? 'Played today' : age < 9 ? 'Play with them' : 'Walk along the quay together',
        disabled: this.usedToday(`play:${id}`),
        onClick: () => {
          this.markUsed(`play:${id}`);
          r.friendship = Math.min(100, r.friendship + 6);
          r.seen = day;
          addNeed(s.needs, 'social', 14);
          this.hud.hidePlace();
          this.hud.toast(age < 9 ? `Hide and seek round the table. ${p.first} cheats. Social +14.` : `${p.first} tells you everything, then nothing, then everything again. Social +14.`, 3500);
        },
      });
      if (age >= 5) {
        const best = SKILLS.slice().sort((a, b) => s.character.skills[b] - s.character.skills[a])[0];
        out.push({
          label: this.usedToday(`teach:${id}`) ? 'Taught today' : `Teach them ${SKILL_INFO[best].name} (1 hour)`,
          disabled: this.usedToday(`teach:${id}`) || s.character.skills[best] < 1,
          onClick: () => {
            this.markUsed(`teach:${id}`);
            const t = (f.taught[id] ??= {});
            t[best] = Math.min(10, (t[best] ?? 0) + 0.5);
            this.clock.minutes += 60;
            r.friendship = Math.min(100, r.friendship + 3);
            this.hud.hidePlace();
            this.hud.toast(`An hour of ${SKILL_INFO[best].name.toLowerCase()} with ${p.first}. They have it now to ${Math.floor(t[best] ?? 0)}.`, 3500);
          },
        });
      }
    }
    if (id === 'hale' && f.spouse && !this.canHaveBaby(f.spouse) && f.children.length < 4) {
      out.push({ label: 'Ask about a foundling to take in', onClick: () => { this.hud.hidePlace(); void this.foundling(); } });
    }
    return out;
  }

  private canHaveBaby(spouse: string): boolean {
    const s = this.state!;
    const p = this.rec(spouse);
    if (!p) return false;
    const day = dayIndex(s.minutes);
    const me = { g: s.character.gender, age: this.playerAge(day) };
    const them = { g: p.gender, age: ageOf(p, day) };
    if (me.g === them.g) return false;
    const mother = me.g === 'woman' ? me : them;
    return mother.age >= 18 && mother.age <= 44 && s.family.children.length < 6;
  }

  private async propose(npc: Npc): Promise<void> {
    const s = this.state!;
    const id = npc.res.id;
    const r = this.rel(id);
    const p = this.rec(id)!;
    const day = dayIndex(s.minutes);
    const ok = await this.dialogue.ask({ speaker: 'You', text: `You take ${this.first(id)}'s hand. The street goes quiet, or seems to.` }, ['Will you marry me?', 'Not here. Another time.']);
    if (ok !== 0) return;
    const chance = 0.35 + (r.romance - 60) / 80 + s.character.skills.charisma * 0.02 + this.dressBonus(id) - (p.courting && p.courting.with !== 'you' ? 0.35 : 0);
    if (Math.random() < chance) {
      if (p.courting && p.courting.with !== 'you') {
        const o = this.rec(p.courting.with);
        if (o) delete o.courting;
      }
      const wedding = day + 3;
      p.courting = { with: 'you', since: day, wedding };
      s.family.engaged = { with: id, day: wedding };
      s.ceremonies.push({ kind: 'wedding', ids: [id, 'you'], names: `${npc.res.name} and you`, day: wedding });
      this.note('courting', id, undefined, [id]);
      r.romance = Math.min(100, r.romance + 10);
      await this.dialogue.say({ speaker: npc.res.name, text: '"Yes." Then, louder, so the whole street can hear: "YES."' });
      await this.hud.celebrate('friend', 'Engaged', npc.res.name, `The wedding is in three days, at eleven, at the market cross. Don't be late.`);
    } else {
      r.romance = Math.max(0, r.romance - 10);
      await this.dialogue.say({ speaker: npc.res.name, text: p.courting && p.courting.with !== 'you' ? `"I'm promised to ${this.first(p.courting.with)}. I thought you knew."` : '"I... not yet. Ask me again, when I\'m sure of you."' });
    }
    this.refreshObjectives();
  }

  /** Your own wedding at the market cross. */
  private async ownWedding(c: GameState['ceremonies'][number]): Promise<void> {
    const s = this.state!;
    const id = c.ids.find((x) => x !== 'you')!;
    const p = this.rec(id)!;
    const day = dayIndex(s.minutes);
    this.busy = true;
    this.player!.stop();
    await this.dialogue.say(
      { speaker: 'Father Ambrose Hale', text: `"Dearly beloved, we are gathered here in the sight of God, and of most of Saltwharf..."` },
      { speaker: 'Father Ambrose Hale', text: `"...I now pronounce you married. You may, ah. Yes. Quite."` },
    );
    p.spouse = 'you';
    delete p.courting;
    delete p.widowed;
    p.home = 'hester';
    s.family.spouse = id;
    delete s.family.engaged;
    s.family.lastEvening = day;
    s.family.strain = 0;
    const r = this.rel(id);
    r.romance = Math.min(100, r.romance + 15);
    r.friendship = Math.min(100, r.friendship + 10);
    r.seen = day;
    addNeed(s.needs, 'social', 35);
    this.clock.minutes += 60;
    // Crossing classes is talked about.
    const mine = s.parish.rank > 0 || s.outfit === 'coat' || s.outfit === 'sunday' ? 'middle' : 'lower';
    if (p.cls !== mine) addFact(s, 'courting', ['ruby', 'mag', 'pell'], id, 'scandal');
    // Factions have views on whom you marry.
    if (this.member('society') && p.cls === 'lower') this.expel('society', 'You married beneath you, in front of everyone.');
    if (this.member('kin') && p.cls !== 'lower') addDeed(s, 'kin', -20);
    this.busy = false;
    this.syncPopulation();
    this.syncHome();
    await this.hud.celebrate('promotion', 'Married', `${this.first(id)} and you`, `${this.first(id)} moves into Hester's room tonight. Pembleton will have opinions.`);
  }

  /** Overnight for your family: neglect, a baby on the way, a baby born, wages. */
  private nightlyFamily(day: number): string[] {
    const s = this.state!;
    const f = s.family;
    const lines: string[] = [];
    const id = f.spouse;
    if (id) {
      const p = this.rec(id);
      if (!p?.alive) {
        lines.push(`You are a ${s.character.gender === 'man' ? 'widower' : 'widow'}. The bed is too big.`);
        delete f.spouse;
        f.trying = false;
        delete f.due;
      } else {
        const r = this.rel(id);
        if (day - (f.lastEvening ?? day) > 4) {
          f.strain += 1;
          r.romance = Math.max(0, r.romance - 2);
          if (f.strain === 6) sendLetter(s, this.nameOf(id), 'On the table', `You come in late and leave early. I married you, not your shadow on the stairs.\n\n${this.first(id)}`);
        }
        if (f.strain >= 12 && r.romance < 20) {
          lines.push(`${this.first(id)} has gone back to ${p.gender === 'man' ? 'his' : 'her'} mother's. The note says only: "You were never here."`);
          delete p.spouse;
          p.widowed = true;
          p.home = AUTHORED[id]?.home ?? 'court';
          delete f.spouse;
          f.trying = false;
          r.romance = 0;
          r.rivalry = Math.min(100, r.rivalry + 30);
          addFact(s, 'wronged', [id, 'ruby', 'mag'], id);
        }
        // Their wages, on Mondays.
        if (f.spouse && weekday(day) === 1 && (p.work || AUTHORED[id]?.employer)) {
          s.money = Math.round((s.money + 0.08) * 100) / 100;
          lines.push(`${this.first(id)} puts their week's wages on the table: £0.08.`);
        }
        if (f.spouse && f.trying && !f.due && this.canHaveBaby(id) && Math.random() < 0.06) {
          f.due = day + 14;
          lines.push(`${s.character.gender === 'woman' ? 'You are' : `${this.first(id)} is`} expecting. A baby, in about two weeks of days.`);
        }
      }
    }
    if (f.due !== undefined && day >= f.due) this.pendingBirth = true;
    return lines;
  }

  private pendingBirth = false;
  private pendingDeath = false;

  /** A baby is born: you name them. */
  private async birth(): Promise<void> {
    const s = this.state!;
    const f = s.family;
    this.pendingBirth = false;
    delete f.due;
    const day = dayIndex(s.minutes);
    const g = Math.random() < 0.5 ? 'man' : 'woman';
    const names = babyNames(g);
    const spouse = f.spouse ? this.rec(f.spouse) : undefined;
    const pick = await this.dialogue.ask({ speaker: spouse ? spouse.first : 'Mrs. Pell', text: `${g === 'man' ? 'A boy' : 'A girl'}! Small, red and furious, with your chin. What shall we call ${g === 'man' ? 'him' : 'her'}?` }, names);
    const child = childRecord({ first: names[pick], last: s.character.last, gender: g, parents: ['you', ...(f.spouse ? [f.spouse] : [])], home: 'hester', birth: day, day, cls: 'lower' });
    s.people.push(child);
    f.children.push(child.id);
    if (spouse) spouse.children.push(child.id);
    const r = this.rel(child.id);
    r.met = true;
    r.friendship = 50;
    r.seen = day;
    if (s.character.gender === 'woman') {
      addNeed(s.needs, 'health', -20);
      addNeed(s.needs, 'rest', -30);
    }
    for (const id of ['pell', 'mag', 'hannah']) sendLetter(s, this.nameOf(id), 'For the baby', `A little something for ${child.first}. Every child in Saltwharf should have one good thing.\n\n${this.first(id)}`);
    this.syncPopulation();
    this.syncHome();
    await this.hud.celebrate('friend', 'Born today', `${child.first} ${child.last}`, 'Mrs. Pell, Old Mag and Hannah have sent things for the baby.');
  }

  /** Father Hale finds you a foundling to take in. */
  private async foundling(): Promise<void> {
    const s = this.state!;
    const day = dayIndex(s.minutes);
    const g = Math.random() < 0.5 ? 'man' : 'woman';
    const names = babyNames(g);
    const age = 3 + Math.floor(Math.random() * 4);
    const yes = await this.dialogue.ask({ speaker: 'Father Ambrose Hale', text: `"There is a ${g === 'man' ? 'boy' : 'girl'} at the Foundling Hospital, ${age} years old, who has stopped asking when ${g === 'man' ? 'his' : 'her'} mother is coming. ${names[0]}, they call ${g === 'man' ? 'him' : 'her'}."` }, [`Bring ${names[0]} home`, 'Not yet']);
    if (yes !== 0) return;
    const f = s.family;
    const child = childRecord({ first: names[0], last: s.character.last, gender: g, parents: ['you', ...(f.spouse ? [f.spouse] : [])], home: 'hester', birth: day - age * 24, day, cls: 'lower' });
    s.people.push(child);
    f.children.push(child.id);
    const r = this.rel(child.id);
    r.met = true;
    r.friendship = 25;
    r.seen = day;
    this.syncPopulation();
    this.syncHome();
    await this.hud.celebrate('friend', 'Home at last', `${child.first} ${child.last}`, 'Small, wary, and already eating your bread.');
  }

  /** Your family in Hester's room: the spouse in the evenings, the children when they're home. */
  private syncHome(): void {
    const s = this.state!;
    const room = this.locations.hesterRoom;
    for (const n of this.homeNpcs) n.walker.rig.root.removeFromParent();
    this.homeNpcs = [];
    const spots = [{ x: 2, z: 2 }, { x: 4, z: 1 }, { x: 1, z: 2 }, { x: 6, z: 2 }, { x: 5, z: 3 }, { x: 2, z: 1 }];
    const ids = [s.family.spouse, ...s.family.children].filter((x): x is string => !!x);
    ids.forEach((id, i) => {
      const res = RESIDENTS.find((r) => r.id === id);
      const p = this.rec(id);
      if (!res && !(p?.look && p.alive)) return;
      const base: Resident = res ?? { id, name: fullNameOf(p!), gender: p!.gender, attraction: p!.attraction, cls: p!.cls, traits: p!.traits, role: 'Your baby', look: p!.look!, home: spots[i], schedule: [] };
      const at = spots[i % spots.length];
      const npc = new Npc({ ...base, home: at, schedule: [{ from: 0, to: 24, x: at.x, z: at.z, act: i === 0 && s.family.spouse ? 'watch' : 'play' }] }, room.grid);
      room.scene.add(npc.walker.rig.root);
      this.homeNpcs.push(npc);
    });
  }

  /** Seat whoever is drinking in the Cup right now. */
  private syncPatrons(): void {
    const bid = this.location.id.slice(4);
    const loc = this.locations[`int:${bid}`];
    const h = Math.floor(this.clock.hour);
    const want = RESIDENTS.filter((r) => this.stopFor(r, h)?.inside === bid).slice(0, 6);
    const ids = want.map((r) => r.id).join();
    if (ids === this.patrons.map((p) => p.res.id).join()) return;
    for (const p of this.patrons) {
      p.walker.rig.root.removeFromParent();
      this.rings.delete(p);
    }
    const church = bid === 'church';
    const seats = church
      ? [{ x: 2, z: 1 }, { x: 3, z: 1 }, { x: 5, z: 1 }, { x: 6, z: 1 }, { x: 2, z: 3 }, { x: 6, z: 3 }]
      : [{ x: 0, z: 1 }, { x: 2, z: 1 }, { x: 3, z: 1 }, { x: 5, z: 1 }, { x: 6, z: 1 }, { x: 7, z: 2 }];
    this.patrons = want.map((r, i) => {
      const at = seats[i];
      const n = new Npc({ ...r, home: at, schedule: [{ from: 0, to: 24, x: at.x, z: at.z, act: church ? 'read' : 'drink' }] }, loc.grid);
      n.follow(n.res.schedule[0], false);
      n.walker.faceToward(church ? { x: at.x + 0.5, z: 6 } : { x: Math.floor(at.x / 3) * 3 + 1.5, z: 1.6 }, true);
      loc.scene.add(n.walker.rig.root);
      return n;
    });
  }

  /** Who of your family is home right now; who is behind the counter. */
  private updateHome(dt: number): void {
    if ((this.location.id === 'int:coppercup' || this.location.id === 'int:church') && this.state) {
      this.patronTimer -= dt;
      if (this.patronTimer <= 0) {
        this.patronTimer = 3;
        this.syncPatrons();
      }
      for (const p of this.patrons) p.update(dt, this.elapsed);
    }
    if (this.location.id.startsWith('int:') && this.state) {
      const id = this.location.id.slice(4);
      const k = this.keepers.get(id);
      const def = INTERIORS.find((d) => d.id === id)!;
      if (k) {
        const p = this.rec(k.res.id);
        const day = dayIndex(this.state.minutes);
        const there = isOpen(def, this.clock.hour) && (!p || p.alive) && !((this.state.life.sick[k.res.id] ?? -1) >= day) && !((this.state.life.missing[k.res.id] ?? -1) >= day);
        k.follow(there ? k.res.schedule[0] : null, false);
        k.update(dt, this.elapsed);
      }
    }
    if (this.location.id !== 'hesterRoom' || !this.state) return;
    const h = Math.floor(this.clock.hour);
    for (const n of this.homeNpcs) {
      const street = this.npcs.find((x) => x.res.id === n.res.id);
      const p = this.rec(n.res.id);
      const baby = p && ageOf(p, dayIndex(this.state.minutes)) < 3;
      const out = street ? this.stopFor(street.res, h) !== null : false;
      const home = baby || (!out && (h >= 17 || h < 9));
      n.follow(home ? n.res.schedule[0] : null, false);
      n.update(dt, this.elapsed);
    }
  }

  /** You die, in your sleep, an old soul. The epilogue; this life is over for good. */
  private async playerDies(): Promise<void> {
    const s = this.state!;
    this.busy = true;
    const day = dayIndex(s.minutes);
    const c = s.character;
    const age = this.playerAge(day);
    const friends = Object.values(s.relations ?? {}).filter((r) => r.friendship >= 30).length;
    const kids = s.family.children.map((id) => this.rec(id)).filter((p) => p?.alive) as PersonRec[];
    const spouse = s.family.spouse ? this.nameOf(s.family.spouse) : null;
    const summary = [
      `${c.first} ${c.last} died in ${c.gender === 'man' ? 'his' : 'her'} sleep in Hester's room, aged ${age}, after ${Math.max(1, Math.floor(day / 24))} year${Math.floor(day / 24) > 1 ? 's' : ''} in Saltwharf.`,
      spouse ? `Survived by ${spouse}.` : `${c.gender === 'man' ? 'He' : 'She'} never married, or outlived the one ${c.gender === 'man' ? 'he' : 'she'} did.`,
      kids.length ? `Children: ${kids.map((k) => `${k.first} (${ageOf(k, day)})`).join(', ')}.` : 'No children of their own.',
      `${friends} friends walked behind the coffin. They left £${s.money.toFixed(2)}.`,
      s.parish.rank ? `${officeTitle(s, c.gender === 'woman')} of the parish.` : '',
      s.champion ? `Remembered as ${CHAMPION_TITLE}.` : '',
    ].filter(Boolean);
    this.busy = false;
    await this.hud.modal('In Memoriam', summary, 'R.I.P.', 'letter', `${c.first} ${c.last}`);
    await this.dialogue.ask({ speaker: P, text: kids.length
      ? '"So. That is that." The ghost is quiet a long while. "They will grow up without you, the way I grew old without anyone. The room will be let again."'
      : '"So. That is that. The room will be let again, I suppose." He sounds, for once, sorry.' }, ['Rest in peace']);
    // Death is for good: this life's slot is cleared, and the title screen waits.
    deleteSave();
    location.reload();
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
    r.seen = dayIndex(s.minutes);
    const before = r.friendship;
    r.friendship = Math.min(100, r.friendship + 9);
    if (pay > 0) s.money = Math.round((s.money + pay) * 100) / 100;
    addNeed(s.needs, 'social', 8);
    this.note('helped', q.who, undefined, [q.who]);
    const qf = factionOf(q.who);
    if (qf) addDeed(s, qf, 3);
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
    } else if (tag === 'ghost:0' && (this.stageOf('a1c2') === 2 || this.stageOf('a1c5') === 0)) {
      await this.quayGhost();
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
        addDeed(s, 'court', 6);
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
    const seesAll = r.friendship >= 30 && (p.id === 'mag' || p.id === 'ruby' || !AUTHORED[p.id]);
    const story = this.missionActions(npc).map((a) => ({ ...asPie(a), icon: 'favour' as const }));
    if (story.length) this.tip('story', 'Gold bubbles are story steps. The journal\'s Quests page lists every step and the ways through it.');
    const ask = [...this.factionActions(npc), ...this.recommendActions(npc), ...this.lessonActions(npc), ...this.parishActions(npc), ...askExtra].map(asPie);
    if (seesAll) ask.unshift({ label: 'Where is everyone?', sub: 'they know', onClick: () => { this.hud.hidePlace(); this.whereIs(npc); } });
    const favours = this.favourActions(npc).map((a) => ({ ...asPie(a), icon: 'favour' as const, primary: !a.disabled }));
    const fam = this.familyActions(npc);
    const propose = fam.filter((a) => a.label.startsWith('Ask for their hand')).map(asPie);
    const foundling = fam.filter((a) => a.label.startsWith('Ask about a foundling')).map(asPie);
    const family = fam.filter((a) => !a.label.startsWith('Ask for their hand') && !a.label.startsWith('Ask about a foundling')).map(asPie);
    ask.push(...foundling);
    const items: PieItem[] = [
      ...(story.length > 2 ? [{ label: 'Story', icon: 'favour' as const, primary: true, children: story }] : story),
      ...favours,
      { label: 'Talk', icon: 'talk', children: [...['chat', 'joke', 'gossip', 'debate', 'brag'].map(say), {
        label: 'About their life', sub: 'home, work, evenings', disabled: tired || this.usedToday(`life:${p.id}`),
        onClick: () => { this.hud.hidePlace(); void this.askAboutLife(npc); },
      }] },
      { label: 'Kind', icon: 'kind', children: ['compliment', 'confide', 'gift'].map(say) },
      ...(family.length ? [{ label: 'Family', icon: 'family' as const, children: family }] : []),
      { label: 'Romance', icon: 'romance', children: [say('flirt'), ...romanceExtra.map(asPie), ...propose] },
      { label: 'Business', icon: 'business', children: [say('business'), ...businessExtra.map(asPie)] },
      { label: 'Mean', icon: 'mean', children: [say('insult')] },
      ...(ask.length ? [{ label: 'Ask', icon: 'ask' as const, children: ask }] : []),
    ];
    const head = new THREE.Vector3(npc.walker.position.x, 1.5, npc.walker.position.y).project(this.rig.camera);
    const life = this.lifeOf(p.id);
    this.hud.showPie({
      name: p.name,
      relation: `${relationLabel(r)}${life.age !== null ? ` · ${life.age}` : ''}`,
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
    if (id === 'silas' && (this.friend(id) || this.member('kin'))) {
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
      if ((m.who === 'hale' || m.who === 'quill') && (s.factions.deeds.lantern ?? 0) < -10) continue;
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
          const ups = gainXp(s, skill, Math.round(LESSON_XP * (hasPerk(s, 'study', 6) ? 1.25 : 1) * (this.member('lantern') ? 1.25 : 1)));
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
      addDeed(s, 'guild', 12);
      addDeed(s, 'society', 10);
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
    s.wear[s.outfit] = Math.max(0, before - amount * (this.placed('wardrobe') ? 0.6 : 1));
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

  /** The tide is out twice a day: morning and evening. */
  private lowTide(): boolean {
    const h = this.clock.hour;
    return (h >= 5 && h < 10) || (h >= 16 && h < 21);
  }

  /** Rummage a heap, a bucket or the foreshore: rags and bottles mostly, now and then something worth having. */
  private scavenge(spotId: string): void {
    const s = this.state!;
    const sp = SPOTS.find((x) => x.id === spotId)!;
    const key = `scav:${sp.id}`;
    this.clock.minutes += sp.kind === 'foreshore' ? 30 : 15;
    this.markUsed(key);
    const cun = s.character.skills.cunning;
    const finds: string[] = [];
    let pennies = 0;
    const tries = 1 + (Math.random() < 0.2 + cun * 0.03 ? 1 : 0);
    for (let i = 0; i < tries; i++) {
      const got = rummage(sp.kind, cun);
      if (got === '£') pennies += 0.01 + Math.floor(Math.random() * 3) / 100;
      else if (got) finds.push(got);
    }
    const kept: string[] = [];
    let full = false;
    for (const id of finds) {
      if (canCarry(s, id)) {
        addItem(s, id);
        const n = ITEMS[id].name.toLowerCase();
        kept.push(/^(clean bones|brass buttons|old rope)$/.test(n) ? `some ${n}` : `${/^[aeiou]/.test(n) ? 'an' : 'a'} ${n}`);
      } else full = true;
    }
    if (pennies) s.money = Math.round((s.money + pennies) * 100) / 100;
    const xp = gainXp(s, 'cunning', 3);
    // Rats, glass and the cold river.
    let hurt = '';
    if (Math.random() < (sp.kind === 'foreshore' ? 0.12 : 0.08)) {
      addNeed(s.needs, 'health', -4);
      hurt = sp.kind === 'foreshore' ? ' The mud takes a boot and nearly a foot. Health −4.' : ' A rat bites, and you bite back a curse. Health −4.';
    }
    s.needs.social = Math.max(0, s.needs.social - 1);
    const what = [...kept, ...(pennies ? [`${Math.round(pennies * 100)}d in coppers`] : [])];
    const rare = finds.some((id) => ['ring', 'watch', 'spoon'].includes(id));
    sfx(what.length ? (rare ? 'chime' : 'coin') : 'flip');
    const text = what.length
      ? `${sp.kind === 'foreshore' ? 'Knee-deep in the mud' : 'Elbow-deep'}, you come up with ${what.join(' and ')}.${rare ? ' Moss will want to see that.' : ''}`
      : sp.kind === 'foreshore' ? 'Half an hour of mud for nothing but cold hands.' : 'Nothing but ash and cabbage stalks.';
    this.hud.toast(`${text}${full ? ' Your bag is full: you leave the rest.' : ''}${hurt} ${xp.join(' ')}`.trim(), 4500);
    if (this.player) {
      const v = new THREE.Vector3(this.player.position.x, 1.95, this.player.position.y).project(this.rig.camera);
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      what.forEach((w, k) => this.hud.floater(`+ ${w}`, x, y - 10 - k * 22, 'gain'));
    }
    this.save();
  }

  /** Lizzie Barlow buys rags, bones, bottles and the like at a better rate than Moss. */
  private sellFinds(): void {
    const s = this.state!;
    const rate = this.friend('lizzie') ? 0.7 : 0.55;
    const render = () => {
      const finds = s.inventory.filter((it) => isJunk(it.id));
      const rows: ListRow[] = finds.map((it) => ({
        label: `${ITEMS[it.id].name} ×${it.qty}`,
        sub: `Lizzie offers £${sellPrice(SHOPS.pawnbroker, it.id, rate).toFixed(2)} each`,
        actions: [{ label: 'Sell', onClick: () => { sell(s, SHOPS.pawnbroker, it.id, rate); sfx('coin'); render(); } }],
      }));
      if (finds.length) {
        const all = finds.reduce((a, it) => a + sellPrice(SHOPS.pawnbroker, it.id, rate) * it.qty, 0);
        rows.unshift({ label: 'Sell everything you found', sub: `£${all.toFixed(2)} for the lot`, actions: [{ label: 'Sell all', onClick: () => { for (const it of [...finds]) while (s.inventory.some((x) => x.id === it.id)) sell(s, SHOPS.pawnbroker, it.id, rate); sfx('coin'); render(); } }] });
      } else rows.push({ label: 'Nothing she wants.', sub: 'Rags, bones, bottles: rummage the heaps in the alleys, the slop buckets, the foreshore at low tide.', actions: [] });
      this.hud.showList('Rag & Bone', '"Rags, bones, bottles! I\'ll take the lot, love."', rows);
    };
    render();
  }

  private sellToSilas(): void {
    const s = this.state!;
    const render = () => {
      const rows: ListRow[] = s.inventory.map((it) => ({
        label: `${ITEMS[it.id].name} ×${it.qty}`,
        sub: `Silas offers £${Math.max(0.01, Math.floor(ITEMS[it.id].price * (this.member('kin') ? 80 : 70)) / 100).toFixed(2)}`,
        actions: [{ label: 'Sell', onClick: () => { sell(s, SHOPS.pawnbroker, it.id, this.member('kin') ? 0.8 : 0.7); if (this.member('guild')) addDeed(s, 'guild', -10); if (this.member('brotherhood')) addDeed(s, 'brotherhood', -10); sfx('coin'); render(); } }],
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
    r.seen = dayIndex(s.minutes);
    if (out.success && i.id === 'chat') out.text = VOICES[npc.res.id].chat;
    // What people see becomes what people know.
    if (out.success && (i.id === 'flirt' || i.id === 'compliment') && r.romance >= 30) this.note('courting', npc.res.id);
    if (i.id === 'insult' && !out.success) this.note('wronged', npc.res.id);
    addNeed(s.needs, 'social', out.success ? 6 : 3);
    const xp = [...gainXp(s, i.skill, out.success ? 6 : 3)];
    // Sims-style: icons in bubbles over both heads, then the results float up. No dialogue box.
    const names: Record<string, string> = { friendship: 'Friendship', romance: 'Romance', rivalry: 'Rivalry', business: 'Business' };
    const head = (w: { position: THREE.Vector2 }, h = 1.95) => {
      const v = new THREE.Vector3(w.position.x, h, w.position.y).project(this.rig.camera);
      return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
    };
    const me = head(this.player!);
    const them = head(npc.walker);
    this.hud.iconBubble(me.x, me.y, i.id, 'mine');
    sfx('click');
    await new Promise((r2) => setTimeout(r2, 650));
    const mood2 = out.success ? (out.liked ? 'love' : 'good') : out.disliked ? 'angry' : 'bad';
    this.hud.iconBubble(them.x, them.y, mood2, mood2 === 'love' || mood2 === 'good' ? 'good' : 'bad');
    sfx(out.success ? 'chime' : 'bad');
    await new Promise((r2) => setTimeout(r2, 500));
    let k = 0;
    for (const [m, v] of Object.entries(out.changes)) {
      if (!v || Math.abs(v) < 0.5) continue;
      const good = m === 'rivalry' ? v < 0 : v > 0;
      this.hud.floater(`${v > 0 ? '+' : '−'}${Math.round(Math.abs(v))} ${names[m]}`, them.x, them.y - 10 - k * 22, good ? 'gain' : 'loss');
      k++;
    }
    if (out.liked || out.disliked) this.hud.floater(out.disliked ? 'They didn\'t like that' : out.success ? 'They liked that' : 'Not today', them.x, them.y - 10 - k * 22, out.disliked || !out.success ? 'loss' : 'gain');
    if (xp.length) this.hud.toast(xp.join(' '), 2500);
    await new Promise((r2) => setTimeout(r2, 900));
    if (before.f < 30 && r.friendship >= 30) await this.hud.celebrate('friend', 'A new friend', npc.res.name, VOICES[npc.res.id].perk.replace(/^Friend: /, ''));
    if (before.ro < 30 && r.romance >= 30) await this.hud.celebrate('friend', 'Courting', npc.res.name, 'You can walk by the river together now.');
    if (npc.held) this.showPerson(npc);
  }

  private openContacts(): void {
    const s = this.state!;
    s.relations ??= {};
    const met = RESIDENTS.filter((p) => s.relations[p.id]?.met);
    const order = (id: string) => { const r = s.relations[id]; return -(r.friendship + r.romance * 1.2 + r.business * 0.5); };
    const rows: ListRow[] = met.sort((x, y) => order(x.id) - order(y.id)).map((p) => {
      const r = s.relations[p.id];
      const traits = knownTraits(p, r);
      const l = this.lifeOf(p.id);
      const heard = knowledgeOf(s, p.id, (id) => this.nameOf(id));
      const lines = [
        `${p.role}${l.age !== null ? ` · ${l.age}` : ''}${traits.length ? ` · ${traits.join(', ')}` : ''}`,
        `Works: ${l.work} · Lives: ${l.home} · Usually: ${l.haunt}`,
        `Now: ${l.now}`,
        ...(l.family.length ? [l.family.join('; ')] : []),
        `Friendship ${Math.round(r.friendship)} · Romance ${Math.round(r.romance)} · Rivalry ${Math.round(r.rivalry)} · Business ${Math.round(r.business)}${r.seen !== undefined && dayIndex(s.minutes) - r.seen > 3 ? ' · fading, go and see them' : ''}`,
        ...(heard.length ? [`They ${heard.slice(0, 2).join('; ')}`] : []),
        r.friendship >= 30 ? VOICES[p.id].perk : `At Friend (30): ${VOICES[p.id].perk.replace(/^Friend: /, '')}`,
      ];
      return { label: `${p.name} · ${relationLabel(r)}`, sub: lines.join('\n'), actions: [] };
    });
    if (rows.length === 0) rows.push({ label: 'You know nobody yet.', sub: 'Tap people in the street to talk to them. Ask about their life to learn where to find them.', actions: [] });
    const total = s.people.filter((p) => p.alive).length;
    const here = RESIDENTS.length;
    this.hud.showList('People', `${rows.length} known · ${here} live in Saltwharf · ${total} souls in this London`, rows);
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
      const rate = 0.004 * this.dangerHere() * (1 + s.money * 0.6) * dress * (s.notoriety >= 3 ? 0.5 : 1) * (this.friend('ruby') ? 0.5 : 1) * (hasPerk(s, 'strength', 6) ? 0.67 : 1) * gear(s).robbery * (this.member('kin') ? 0.33 : 1);
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
      const nell = this.friend('nell') || this.member('brotherhood');
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
    lines.push(...this.nightlyLives(day), ...this.nightlyLivesOfAll(day), ...this.nightlyFamily(day), ...this.nightlyFactions(day), ...this.nightlyStory(day));
    const myAge = this.playerAge(day);
    if (myAge >= 60 && Math.random() < 0.0004 * Math.pow(myAge - 57, 1.3) + (myAge >= 92 ? 1 : 0)) this.pendingDeath = true;
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
    if (s.tomorrow !== 'fog' && Math.random() < s.story.clock / 250) s.tomorrow = 'fog';
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
    const fogTakes = (yesterday === 'fog' ? 0.4 : 0) + (s.story.clock >= 50 && s.story.act1 !== 'done' ? 0.35 : 0);
    if (!Object.keys(L.missing).length && Math.random() < fogTakes && takeable.length) {
      s.story.clock += 2;
      const id = takeable[Math.floor(Math.random() * takeable.length)];
      L.missing[id] = day + 1;
      lines.push(`MISSING: ${this.nameOf(id)} walked home through last night's fog and never arrived. Posters are going up.`);
    }
    // Sickness.
    for (const [id, until] of Object.entries(L.sick)) if (until < day) delete L.sick[id];
    const healthy = RESIDENTS.filter((r) => this.present(r) && !['mag', 'quill', 'ashby'].includes(r.id) && !(L.sick[r.id] >= day)).map((r) => r.id);
    if (!Object.keys(L.sick).length && Math.random() < (s.missions.pump?.done ? 0.045 : 0.09) && healthy.length) {
      const id = healthy[Math.floor(Math.random() * healthy.length)];
      L.sick[id] = day + 2;
      lines.push(`${this.nameOf(id)} has taken a fever. They're wrapped up on their step; a hot broth would do more than Quill's tonic.`);
    }
    // The strike.
    if (s.strike && day > s.strike.until && s.strike.won === undefined) {
      const won = !!s.missions.strike?.flags.won || Math.random() < (s.strike.side === 'scab' ? 0.35 : s.strike.side === 'picket' ? 0.75 : 0.55);
      if (s.missions.strike && !s.missions.strike.done) s.missions.strike = { ...s.missions.strike, done: true, outcome: won ? (s.strike.side === 'scab' ? 'crossed' : 'picket') : 'lost' };
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
      s.missions.strike = { stage: 0, started: day, flags: {} };
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
    // When Saltwharf goes dark, the gas lamps are no help.
    if (this.state && this.state.story.clock >= 75 && this.state.story.act1 !== 'done') return false;
    return (this.locations.saltwharf.lamps ?? []).some((l) => Math.hypot(l.x - x, l.z - z) <= r);
  }

  private dangerHere(): number {
    const s = this.state!;
    if (this.location.id !== 'saltwharf' || !this.player) return 0;
    const p = this.player.position;
    let d = dangerAt(p.x, p.y, this.clock.hour, s.hotZone, this.nearLamp(p.x, p.y));
    if (s.weather === 'fog') d *= 1.3;
    if (s.story.clock >= 75 && s.story.act1 !== 'done') d *= 1.4;
    if (hasPerk(s, 'cunning', 6)) d *= 0.75;
    if (this.life.constableNear(p.x, p.y)) d *= 0.5;
    if (this.life.bonfireLit && Math.hypot(p.x - 15.5, p.y - 20.5) < 7) d *= 0.3;
    if (this.member('brotherhood')) d *= 0.8;
    if ((s.factions.deeds.brotherhood ?? 0) < -10) d *= 1.25;
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
      addDeed(s, 'kin', 4);
      addDeed(s, 'brotherhood', 2);
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
  /** Furnish Hester's room from the saved layout; anything bought but not yet placed goes in. */
  private applyFurniture(): void {
    const s = this.state;
    const room = this.locations.hesterRoom;
    if (!s || !room.furnish) return;
    s.home ??= defaultLayout(s.owned);
    // Anything that no longer fits (a smaller room) finds a new spot, or goes into storage.
    for (const it of s.home.items) {
      if (it.stored || this.canPlace(it.type, it.x, it.z, it.rot, it.uid)) continue;
      const spot = this.freeSpot(it.type, it.rot, it.uid);
      if (spot) Object.assign(it, spot);
      else it.stored = true;
    }
    for (const id of s.owned) {
      const type = id as FurnitureType;
      if (!FURNITURE[type] || s.home.items.some((i) => i.type === type)) continue;
      const it = { uid: Math.max(0, ...s.home.items.map((i) => i.uid)) + 1, type, x: 0, z: 0, rot: 0, color: FURNITURE[type].colors[0], stored: true };
      s.home.items.push(it);
      const spot = this.freeSpot(it.type, it.rot, it.uid);
      if (spot) Object.assign(it, spot, { stored: false });
    }
    room.furnish(s.home, owns(s, 'cat'));
    if (this.player && this.location === room && !room.grid.isWalkable(this.player.cell.x, this.player.cell.z)) {
      const c = room.grid.nearestWalkable(this.player.cell.x, this.player.cell.z, 4);
      if (c) this.player.teleport(room.grid, c.x + 0.5, c.z + 0.5);
    }
  }

  // --- Decor: arrange Hester's room --------------------------------------------

  private decor: { sel: number | null; moving: boolean } | null = null;
  private decorRing: THREE.Mesh | null = null;

  private startDecor(): void {
    if (this.location.id !== 'hesterRoom' || this.busy) return;
    this.tip('decor', 'Tap a piece to move, turn, recolour, store or sell it. With nothing picked, change the walls and the floor.');
    this.hud.hidePlace();
    this.player!.stop();
    this.decor = { sel: null, moving: false };
    this.hud.decorButton = false;
    this.decorMenu();
  }

  private endDecor(): void {
    this.decor = null;
    this.decorRing?.removeFromParent();
    this.hud.decorBar(null);
    this.hud.decorButton = this.location.id === 'hesterRoom';
    this.save();
  }

  private decorMenu(): void {
    const s = this.state!;
    const d = this.decor!;
    const home = s.home!;
    const stored = home.items.filter((i) => i.stored);
    if (d.sel === null) {
      this.decorRing?.removeFromParent();
      this.hud.decorBar('Decor: tap a piece of furniture', [
        { label: 'Wall colour', onClick: () => this.hud.pickColor('Walls', WALL_COLORS, home.wall, (c) => { home.wall = c; this.applyFurniture(); }) },
        { label: 'Floor', onClick: () => this.hud.pickColor('Floorboards', FLOOR_COLORS, home.floor, (c) => { home.floor = c; this.applyFurniture(); }) },
        { label: `Stored (${stored.length})`, disabled: !stored.length, onClick: () => this.decorStored() },
        { label: 'Done', primary: true, onClick: () => this.endDecor() },
      ]);
      return;
    }
    const it = home.items.find((i) => i.uid === d.sel)!;
    const def = FURNITURE[it.type];
    this.showRing(it.uid);
    this.hud.decorBar(d.moving ? `${def.name}: tap where it should go` : def.name, d.moving ? [
      { label: 'Cancel', onClick: () => { d.moving = false; this.decorMenu(); } },
    ] : [
      { label: 'Move', primary: true, onClick: () => { d.moving = true; this.decorMenu(); } },
      { label: 'Turn', disabled: def.kind !== 'floor', onClick: () => {
        for (let k = 1; k <= 3; k++) {
          const r = (it.rot + k) % 4;
          if (this.canPlace(it.type, it.x, it.z, r, it.uid)) { it.rot = r; break; }
        }
        this.applyFurniture();
        this.showRing(it.uid);
      } },
      { label: 'Colour', disabled: def.colors.length < 2, onClick: () => this.hud.pickColor(def.name, def.colors, it.color, (c) => { it.color = c; this.applyFurniture(); this.showRing(it.uid); }) },
      { label: 'Put away', disabled: def.keep && it.type !== 'trunk' ? false : !!def.keep, onClick: () => { it.stored = true; d.sel = null; this.applyFurniture(); this.decorMenu(); } },
      { label: def.keep ? 'Keep' : `Sell to Moss · £${(ITEMS[it.type]?.price ? Math.floor(ITEMS[it.type].price * 40) / 100 : 0).toFixed(2)}`, disabled: !!def.keep, onClick: () => {
        s.money = Math.round((s.money + Math.floor((ITEMS[it.type]?.price ?? 0) * 40) / 100) * 100) / 100;
        home.items = home.items.filter((x) => x !== it);
        s.owned = s.owned.filter((x) => x !== it.type || home.items.some((y) => y.type === it.type));
        sfx('coin');
        d.sel = null;
        this.applyFurniture();
        this.decorMenu();
      } },
      { label: 'Back', onClick: () => { d.sel = null; this.decorMenu(); } },
    ]);
  }

  private decorStored(): void {
    const s = this.state!;
    const rows: ListRow[] = s.home!.items.filter((i) => i.stored).map((it) => ({
      label: FURNITURE[it.type].name,
      sub: FURNITURE[it.type].text,
      actions: [{ label: 'Place', onClick: () => {
        const spot = this.freeSpot(it.type, it.rot, it.uid);
        if (!spot) return this.hud.toast('There is no room for it. Put something else away first.');
        Object.assign(it, spot, { stored: false });
        this.hud.closeList();
        this.applyFurniture();
        this.decor = { sel: it.uid, moving: false };
        this.decorMenu();
      } }],
    }));
    this.hud.showList('In storage', 'Under the bed, behind the door, in the trunk\'s shadow', rows);
  }

  private showRing(uid: number): void {
    const obj = this.locations.hesterRoom.objectFor?.(uid);
    if (!obj) return;
    if (!this.decorRing) {
      this.decorRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 28), new THREE.MeshBasicMaterial({ color: 0xf0d78a, transparent: true, opacity: 0.85, depthWrite: false }));
      this.decorRing.rotation.x = -Math.PI / 2;
    }
    this.decorRing.position.set(obj.position.x, 0.04, obj.position.z);
    const it = this.state!.home!.items.find((i) => i.uid === uid)!;
    const def = FURNITURE[it.type];
    this.decorRing.scale.setScalar(Math.max(def.w, def.d) * 0.85);
    this.locations.hesterRoom.scene.add(this.decorRing);
  }

  /** In decor mode, taps select furniture or place the piece being moved. */
  private decorTap(): boolean {
    const d = this.decor;
    if (!d || this.location.id !== 'hesterRoom') return false;
    const s = this.state!;
    if (d.moving && d.sel !== null) {
      const p = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return true;
      const it = s.home!.items.find((i) => i.uid === d.sel)!;
      const def = FURNITURE[it.type];
      const turned = it.rot % 2 === 1;
      const w = turned ? def.d : def.w;
      const dd = turned ? def.w : def.d;
      const x = Math.round(p.x - w / 2);
      const z = def.kind === 'wall' ? it.z : Math.round(p.z - dd / 2);
      if (this.canPlace(it.type, x, z, it.rot, it.uid)) {
        it.x = x;
        it.z = z;
        d.moving = false;
        sfx('drop');
        this.applyFurniture();
        this.decorMenu();
      } else this.hud.toast('It won\'t fit there.', 1500);
      return true;
    }
    const hits = this.raycaster.intersectObjects(this.location.tappables, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.furniture === undefined) o = o.parent;
      if (o) {
        d.sel = o.userData.furniture as number;
        sfx('click');
        this.decorMenu();
        return true;
      }
    }
    return true;
  }

  private placed(type: FurnitureType): boolean {
    return !!this.state?.home?.items.some((i) => i.type === type && !i.stored);
  }

  /** Can this piece stand here? Floor pieces need free tiles; wall pieces need free wall. */
  private canPlace(type: FurnitureType, x: number, z: number, rot: number, uid: number): boolean {
    const s = this.state!;
    const def = FURNITURE[type];
    const spec = HOMES_TO_LET[this.residence()];
    const W = spec.w;
    const D = spec.d;
    const others = s.home!.items.filter((i) => !i.stored && i.uid !== uid);
    if (def.kind === 'wall') {
      if (x < 0 || x + def.w > W) return false;
      return !others.some((o) => FURNITURE[o.type].kind === 'wall' && o.x < x + def.w && x < o.x + FURNITURE[o.type].w);
    }
    const tiles = footprint(type, x, z, rot);
    if (tiles.some((t) => t.x < 0 || t.z < 0 || t.x >= W || t.z >= D)) return false;
    if (def.kind === 'rug') return true;
    const taken = new Set(others.filter((o) => FURNITURE[o.type].kind === 'floor').flatMap((o) => footprint(o.type, o.x, o.z, o.rot).map((t) => `${t.x},${t.z}`)));
    // Keep the doorway, Pembleton's corner and the way to the door clear.
    for (const k of ['0,1', '1,1', `${spec.ghost.x},${spec.ghost.z}`, `${spec.ghost.x - 1},${spec.ghost.z}`]) taken.add(k);
    return !tiles.some((t) => taken.has(`${t.x},${t.z}`));
  }

  private freeSpot(type: FurnitureType, rot: number, uid: number): { x: number; z: number; rot: number } | null {
    const spec = HOMES_TO_LET[this.residence()];
    for (const r of [rot, (rot + 1) % 4]) for (let z = spec.d - 1; z >= 0; z--) for (let x = 0; x < spec.w; x++) if (this.canPlace(type, x, z, r, uid)) return { x, z, rot: r };
    return null;
  }

  private comfort(): number {
    const s = this.state!;
    const items = (s.home?.items ?? []).filter((i) => !i.stored);
    return (owns(s, 'mattress') ? 1 : 0) + (owns(s, 'cat') ? 1 : 0) + items.reduce((a, i) => a + (FURNITURE[i.type].comfort ?? 0), 0);
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
    const age = this.playerAge();
    if (age >= 58) {
      look.age = 2;
      look.hair = age >= 66 ? 0xd0d0d0 : 0xa0a0a0;
    }
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
    const office = res.cls === 'middle' ? s.parish.rank * 0.04 + (this.member('society') ? 0.06 : 0) : 0;
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
    if (s.story.act1 === 'done' && !s.story.told) {
      s.story.told = true;
      await this.dialogue.say(
        { speaker: P, text: '"You did it. Whatever you did, the quay is quiet. Then I suppose you should know." He looks at the trunk, not at you.' },
        { speaker: P, text: '"Your aunt was a Warden. One of the last. The dead of London do not lie easy, and for three hundred years a few stubborn souls have kept them quiet. She kept them quiet in Saltwharf for thirty years."' },
        { speaker: P, text: '"She died the month the white lamps reached the docks. That was not a coincidence, whatever the coroner said. The lamps burn something. Ask in Mayfield what."' },
      );
      return;
    }
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
    if (this.pendingDeath) {
      this.pendingDeath = false;
      await this.playerDies();
      return;
    }
    if (this.pendingBirth) await this.birth();
    if (this.pendingFall) {
      this.pendingFall = false;
      await this.fallOfLondon();
      return;
    }
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
    if (hasPerk(s, 'cunning', 10) || this.member('court')) return this.member('court') ? 'Someone from the Court sat up beside you all night. Nothing was taken.' : null;
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
      r.graceUntil = this.clock.minutes + ((this.friend('grubb') || this.member('guild') ? 14 : 7) + (s.parish.rank > 0 ? 7 : 0)) * DAY;
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
    out.push(...this.storyGoals().slice(0, 1));
    for (const q of s.quests.filter((x) => !x.done).slice(0, 2)) out.push(`Favour: ${q.text}`);
    if (s.factions?.member && !s.factions.dutyDone) {
      const d = FACTIONS[s.factions.member];
      out.push(`${d.ranks[rankIn(s, s.factions.member)]}: ${s.factions.member === 'kin' && s.factions.debtor ? `collect the Kin's debt from ${this.short(s.factions.debtor)}` : d.duty}`);
    }
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
    if (close) out.push(`Befriend ${this.first(close.p.id)}: friendship ${Math.round(close.f)} / 30`);
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
      { speaker: P, text: 'Saltwharf pays for a strong back or a quick tongue, and nothing else. If your gifts are books, craft or the dead, do not despair, and do not neglect them: London has other streets, and they will pay for those.' },
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
    if (announce) this.hud.toast(ok ? `Saved in slot ${currentSlot()}.` : 'Could not save on this device.');
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
    const day = dayIndex(s.minutes);
    const age = ageOf({ birth: c.birth ?? -504 }, day);
    const years = Math.floor(day / 24) + 1;
    const skillsHtml = `<p class="meta">${c.gender === 'man' ? 'Man' : 'Woman'} · ${age} years old · attracted to ${attraction} · year ${years} in Saltwharf</p>
      ${skills}
      <h3>Perks</h3><ul class="perks">${perks || '<li>None yet: they come at levels 3, 6 and 10.</li>'}</ul>
      <h3>How you are</h3>${needs}`;
    // Quests page: the main story by chapter, the side stories, favours and family.
    const nm = (id: string) => (id === 'pembleton' ? 'Pembleton' : this.short(id));
    const reqChip = (r: Req) => `<span class="req ${reqMet(s, r) ? 'ok' : 'no'}">${esc(reqText(s, r, nm))}</span>`;
    const waysHtml = (def: MissionDef) => {
      const m = s.missions[def.id] ?? { stage: 0, started: 0, flags: {} };
      const ways = def.stages[Math.min(m.stage, def.stages.length - 1)].ways ?? [];
      if (!ways.length) return '';
      return `<ul class="ways">${ways.map((w) => {
        const done = w.done?.(m);
        const ok = done || !w.any || w.any.some((r) => reqMet(s, r));
        return `<li class="${done ? 'done' : ok ? 'ok' : 'no'}">${esc(w.text)}${!done && w.any ? `<span class="reqs">${w.any.map(reqChip).join('<i>or</i>')}</span>` : ''}</li>`;
      }).join('')}</ul>`;
    };
    const chapter = currentChapter(s);
    const mains = MISSIONS.filter((d) => d.kind === 'main');
    const OUT: Record<string, string> = { word: 'gave him his name', steel: 'put him down', coin: 'paid the Kin', mag: 'with Mag', watch: 'by the watch', named: 'named', opened: 'opened', skipped: 'passed' };
    const mainHtml = mains.map((d) => {
      const m = s.missions[d.id];
      if (m?.done) return `<div class="mcard done"><b>${esc(d.title)}</b><span class="mstat">Done${m.outcome && OUT[m.outcome] ? ` · ${OUT[m.outcome]}` : ''}</span></div>`;
      if (d === chapter) return `<div class="mcard now"><b>${esc(d.title)}</b><span class="mstat">Now · from ${esc(nm(d.giver))}</span><p class="mblurb">${esc(d.blurb)}</p><p class="mobj">${esc(objectiveOf(s, d))}</p>${waysHtml(d)}</div>`;
      return `<div class="mcard later"><b>${esc(d.title)}</b><span class="mstat">Later</span></div>`;
    }).join('');
    const sides = MISSIONS.filter((d) => d.kind === 'side');
    const sideCard = (d: MissionDef) => {
      const st = sideStatus(s, d);
      const m = s.missions[d.id];
      if (st === 'active') return `<div class="mcard now"><b>${esc(d.title)}</b><span class="mstat">Under way · ${esc(nm(d.giver))}</span><p class="mobj">${esc(objectiveOf(s, d))}</p>${waysHtml(d)}</div>`;
      if (st === 'offered') return `<div class="mcard offer"><b>${esc(d.title)}</b><span class="mstat">On offer</span><p class="mobj">${esc(d.blurb)} Talk to ${esc(nm(d.giver))}.</p></div>`;
      if (st === 'rumour') return `<div class="mcard later"><b>${esc(d.title)}</b><span class="mstat">Rumour</span><p class="mobj">${esc(d.rumour ?? d.blurb)}</p>${(d.opens ?? []).map(reqChip).join(' ')}</div>`;
      if (st === 'done') return `<div class="mcard done"><b>${esc(d.title)}</b><span class="mstat">${m?.outcome === 'lost' ? 'Over · it went badly' : 'Done'}</span></div>`;
      return '';
    };
    const sideOrder = (d: MissionDef) => ['active', 'offered', 'rumour', 'done', 'hidden'].indexOf(sideStatus(s, d));
    const sideHtml = [...sides].sort((a, b) => sideOrder(a) - sideOrder(b)).map(sideCard).join('') || '<p class="meta">Nothing yet.</p>';
    const favours = s.quests.filter((q) => !q.done).map((q) => `<li>${esc(q.text)}</li>`).join('') || '<li>Nobody needs anything from you just now. Make friends, and they will.</li>';
    const goals = this.goals().filter((g) => !g.startsWith('Favour') && !this.storyGoals().includes(g)).map((g) => `<li>${esc(g)}</li>`).join('');
    const missionsHtml = `
      <h3>Act I · The Fog</h3>
      <div class="fogline"><span>Fog Clock ${Math.round(s.story.clock)}</span><div class="sk-bar fogclock"><i style="width:${Math.round(s.story.clock)}%"></i></div></div>
      <p class="meta">The fog is ${clockWord(s.story.clock)}. At 25, 50 and 75 an urgent call; at 100, London falls. Finishing an act pushes it back.${s.story.act1 === 'done' ? ' Act II, The Social Season, waits in Mayfield.' : ''}</p>
      ${mainHtml}
      <h3>Saltwharf stories</h3>
      ${sideHtml}
      <h3>Favours</h3><ul class="perks">${favours}</ul>
      ${goals ? `<h3>Goals</h3><ul class="perks">${goals}</ul>` : ''}
      <h3>Family</h3><ul class="perks">${(() => {
        const f = s.family;
        const items: string[] = [];
        if (f.spouse) items.push(`Married to ${esc(this.nameOf(f.spouse))}${f.strain >= 6 ? ' (things are strained: spend an evening together)' : ''}`);
        else if (f.engaged) items.push(`Engaged to ${esc(this.nameOf(f.engaged.with))}: the wedding is on ${this.clock.formatShortDate(new Date(1871, 9, 1 + f.engaged.day))} at eleven, at the market cross`);
        else items.push('Unmarried. Court someone to Romance 60 and Friendship 40, then ask for their hand.');
        for (const id of f.children) { const p = this.rec(id); if (p?.alive) items.push(`${esc(p.first)}, ${ageOf(p, day)}`); }
        if (f.due) items.push(`A baby due in ${f.due - day} days`);
        return items.map((x) => `<li>${x}</li>`).join('');
      })()}</ul>
      <h3>Days ahead</h3><p>${HOLIDAYS.map((h) => `${h.name}, ${h.date} ${h.month === 9 ? 'Oct' : 'Nov'}`).join(' · ')}. Today: ${s.weather}.</p>`;
    // Work page: each job in full (hours, pay, the next rank and what it needs), what else is going, money and the parish.
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysText = (d: number[]) => (d.length === 6 && !d.includes(0) ? 'Mon–Sat' : d.length === 6 && !d.includes(1) ? 'every day but Monday' : d.map((x) => DAYS[x]).join(', '));
    const hours = (j: (typeof JOBS)[string]) => `${formatMinutes(j.start)}–${j.end >= 1440 ? 'midnight' : formatMinutes(j.end)}, ${daysText(j.days)}`;
    const need = (k: SkillId, n: number) => `<span class="req ${c.skills[k] >= n ? 'ok' : 'no'}">${SKILL_INFO[k].name} ${n} (you ${c.skills[k]})</span>`;
    const jobCard = (e: (typeof s.jobs)[number]) => {
      const j = JOBS[e.jobId];
      const r = j.ranks[e.rank];
      const next = j.ranks[e.rank + 1];
      const raise = e.jobId === 'docks' && s.dockRaise ? ` + ${Math.round(s.dockRaise * 100)}% strike raise` : '';
      const ladder = j.ranks.map((x, i) => `<span class="rung${i === e.rank ? ' here' : i < e.rank ? ' past' : ''}">${esc(rankTitle(j, i, c.gender))} · £${x.pay.toFixed(2)}</span>`).join('<i>›</i>');
      return `<div class="mcard now"><b>${esc(title(s, e))}</b><span class="mstat">${esc(j.employer)} · ${esc(j.boss)}</span>
        <dl class="jobdl"><dt>Hours</dt><dd>${hours(j)} (${esc(nextShiftText(s, e.jobId))})</dd>
        <dt>Pay</dt><dd>£${r.pay.toFixed(2)} a shift${raise}. Played shifts pay more for good work: Good ×1.2, Excellent ×1.5, Poor ×0.6.</dd>
        <dt>Skills</dt><dd>${SKILL_INFO[j.main].name} first, ${SKILL_INFO[j.second].name} second. Played shifts train both.</dd>
        <dt>Promotion</dt><dd>${next ? `To ${esc(rankTitle(j, e.rank + 1, c.gender))} (£${next.pay.toFixed(2)}): <span class="req ${e.points >= next.points ? 'ok' : 'no'}">${e.points} / ${next.points} points</span>${next.needMain ? ' ' + need(j.main, next.needMain) : ''}${next.needSecond ? ' ' + need(j.second, next.needSecond) : ''}` : 'Top rank in Saltwharf, for now.'}</dd>
        <dt>Mind</dt><dd>Excellent +3 points, Good +2, Fair +1, Poor −2. A missed shift is −3; at −6 you're let go.</dd></dl>
        <div class="ladder">${ladder}</div></div>`;
    };
    const others = Object.values(JOBS).filter((j) => !employment(s, j.id)).map((j) => {
      const b = hireBlocker(s, j.id);
      const why = b === 'banned' ? 'They won\'t have you back yet.' : b === 'full' ? 'You have two jobs already.' : b === 'clash' ? 'Its hours clash with your other job.' : `Ask ${esc(j.boss)} at the ${esc(j.employer)}.`;
      return `<div class="mcard offer"><b>${esc(j.ranks[0].title)}</b><span class="mstat">${esc(j.employer)}</span><p class="mobj">${hours(j)}. £${j.ranks[0].pay.toFixed(2)} a shift to start. ${SKILL_INFO[j.main].name} work. ${why}</p></div>`;
    }).join('');
    const rent = s.rent.graceUntil !== null ? `Rent of £${s.rent.amount.toFixed(2)} is overdue.` : `Rent of £${s.rent.amount.toFixed(2)} is due ${due}.`;
    const office = officeTitle(s, c.gender === 'woman');
    const workHtml = `
      <h3>Your work</h3>${s.jobs.map(jobCard).join('') || '<p class="meta">Unemployed. Two jobs at once at most, if their hours don\'t clash.</p>'}
      ${others ? `<h3>Also hiring in Saltwharf</h3>${others}` : ''}
      <h3>Purse</h3><p>£${s.money.toFixed(2)}. ${rent}${s.debt > 0 ? ` You owe the hospital £${s.debt.toFixed(2)}.` : ''}</p>
      <h3>Parish</h3><p>${office ? `${office} of St. Botolph. ` : ''}${s.parish.standing !== null ? `Standing for ${OFFICES[s.parish.rank].name}: ${s.parish.pledges.length} pledged, ${s.parish.crowd} won by speeches.` : OFFICES[s.parish.rank] ? `Next: ${OFFICES[s.parish.rank].name} (Study ${OFFICES[s.parish.rank].study}, ${OFFICES[s.parish.rank].friends} friends; ask Father Hale).` : ''}${s.champion ? ` ${CHAMPION_TITLE}.` : ''}</p>`;
    this.hud.setJournal(Hud.titleFor(s), skillsHtml, missionsHtml, this.factionsHtml(), workHtml);
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
    // Reading or deciding stops the clock: dialogue, sheets, place panels, Decor, the prologue.
    const paused = this.busy || this.dialogue.open || this.hud.blocking || this.hud.placeOpen || !!this.decor || !!document.querySelector('.prologue');
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
      this.checkCeremonies();
      this.checkFactionEvents();
      if (s.parish.standing !== null && today >= s.parish.standing && this.clock.hour >= 12 && !this.busy && !this.dialogue.open && !this.hud.blocking) void this.election();
      if (s.minutes - this.lastSaveMinute >= 60) this.save();
    }

    player.update(dt, this.elapsed);
    this.updateNpcs(dt);
    this.updateHome(dt);
    if (this.mode === 'play') this.updateWatch();
    this.updateStalker(dt);
    this.updateTully(dt);
    if (this.location.id === 'saltwharf') {
      const day = dayIndex(s.minutes);
      const hol = holidayOn(day)?.id ?? (holidayOn(dayIndex(s.minutes - 6 * 60))?.id === 'hallows' && this.clock.hour < 6 ? 'hallows' : null);
      this.life.update(dt, this.elapsed, {
        hour: this.clock.hour, day, weather: s.weather, player: player.position,
        sight: s.character.skills.occult + gear(s).occult >= 3 || hol === 'hallows' || s.inventory.some((i) => i.id === 'hwatch'), holiday: hol,
        headline: this.headline ??= gazette(s, day, 'Gull Court', [], '')[0],
        lost: s.quests.filter((q) => q.kind === 'lost' && !q.found && q.at).map((q) => ({ id: q.id, x: q.at!.x, z: q.at!.z })),
        funeral: day === FUNERAL_DAY ? 'Sam Pike' : s.ceremonies.find((c) => c.kind === 'funeral' && c.day === day)?.names ?? null,
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
      if (d.loc === 'saltwharf' && d.to[0] === 'hesterRoom') d.sprite.visible = HOMES_TO_LET[this.residence()].building === d.place;
      d.sprite.position.y = d.y + Math.sin(this.elapsed * 2.4) * 0.07;
      d.sprite.scale.setScalar(0.62 + Math.sin(this.elapsed * 4.8) * 0.03);
    }
    this.rig.update(dt, player.position.x, player.position.y + this.location.camera.offsetZ);
    this.location.focus?.(player.position.x, player.position.y);
    this.ringTimer -= dt;
    if (this.ringTimer <= 0) {
      this.ringTimer = 0.4;
      this.updateRings();
    }

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
