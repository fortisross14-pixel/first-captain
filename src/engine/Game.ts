import * as THREE from 'three';
import { Player } from '../actors/Player';
import { createCharacter, type Rig } from '../actors/characterModel';
import { GRADE_INFO, JOBS, dayIndex, gradeFor, type Grade } from '../game/jobs';
import { addNeed, simulateNeeds } from '../game/needs';
import {
  canStartShift, checkAttendance, completeShift, currentJob, dayStart, hire, isBanned, nextShiftText, promotionText,
} from '../game/work';
import { playCargo } from '../minigames/cargo';
import { loadGame, newGame, saveGame, type Character, type GameState, type LocationId } from '../game/state';
import { Creator } from '../ui/Creator';
import { Dialogue, type Line } from '../ui/Dialogue';
import { Hud, type Action } from '../ui/Hud';
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
          return [act('Go up to your room', () => this.goTo('hesterRoom', 'door'), { primary: true })];
        case 'dockoffice': {
          if (s.job?.jobId !== 'docks') return [act('Ask about work', () => this.askDocks(), { primary: true })];
          const open = canStartShift(s);
          const rank = JOBS.docks.ranks[s.job.rank].title;
          return [
            act(`Work your shift as ${rank}`, () => this.workShift(true), { primary: true, disabled: !open }),
            act(s.job.lastGrade ? `Autopilot (${GRADE_INFO[s.job.lastGrade].name} pay, no points)` : 'Autopilot (play one shift first)',
              () => this.workShift(false), { disabled: !open || !s.job.lastGrade }),
            act('Quit the job', () => this.quitJob()),
          ];
        }
        case 'coppercup':
          return [act('Ask about work', () => this.askCup(), { primary: true })];
        case 'market':
          return [
            act('Hot potato · £0.02', () => this.buyFood('a hot potato', 0.02, 25), { disabled: s.money < 0.02 }),
            act('Eel pie · £0.06', () => this.buyFood('an eel pie', 0.06, 45), { disabled: s.money < 0.06 }),
          ];
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

  private buyFood(what: string, price: number, hunger: number): void {
    const s = this.state!;
    if (s.money < price) return;
    s.money = Math.round((s.money - price) * 100) / 100;
    addNeed(s.needs, 'hunger', hunger);
    this.hud.toast(`You eat ${what} standing up, like everyone else here.`);
  }

  private eatBread(): void {
    const s = this.state!;
    if (s.larderBread <= 0) return;
    s.larderBread--;
    addNeed(s.needs, 'hunger', 30);
    this.hud.toast(s.larderBread > 0 ? 'Stale, but bread.' : "That was the last of Hester's bread.");
  }

  private async askDocks(): Promise<void> {
    const s = this.state!;
    const R = JOBS.docks.boss;
    s.tutorial.askedDocks = true;
    this.refreshObjectives();
    if (s.job) {
      await this.dialogue.say({ speaker: R, text: 'You\'ve already got work. I don\'t share hands with other masters.' });
      return;
    }
    if (isBanned(s, 'docks') !== null) {
      await this.dialogue.say({ speaker: R, text: 'You? After last time? Come back in a month, if you\'ve learned to set an alarm.' });
      return;
    }
    const yes = await this.dialogue.ask(
      { speaker: R, text: 'Work? I need a mudlark: fetching, carrying, stacking what the real men won\'t. Six till two, Monday to Saturday. Eight pence a shift.' },
      ['I\'ll take it.', 'Not now.'],
    );
    if (yes !== 0) return;
    hire(s, 'docks');
    await this.dialogue.say(
      { speaker: R, text: 'Be here at six. Late is the same as absent, and absent three times is gone.' },
      { speaker: R, text: 'Load the barge level. A barge that lists drops my cargo in the Thames, and then I drop you in after it.' },
    );
    this.save();
  }

  private async quitJob(): Promise<void> {
    const s = this.state!;
    const yes = await this.dialogue.ask({ speaker: 'You', text: 'Quit the docks? You will lose your rank and points.' }, ['Quit', 'Stay']);
    if (yes !== 0) return;
    s.job = null;
    await this.dialogue.say({ speaker: JOBS.docks.boss, text: 'Suit yourself. There\'s ten behind you for every one that walks.' });
    this.save();
  }

  /** Plays (or skips) a shift, then jumps the clock to the end of the shift and reports. */
  private async workShift(play: boolean): Promise<void> {
    const s = this.state!;
    const job = currentJob(s);
    if (!job || !s.job || !canStartShift(s) || this.busy) return;
    this.busy = true;
    this.player!.stop();
    let grade: Grade;
    let lines: string[] = [];
    if (play) {
      const r = await playCargo(this.container, {
        rank: s.job.rank,
        title: `${job.career} · ${job.ranks[s.job.rank].title}`,
        main: s.character.skills[job.main],
        second: s.character.skills[job.second],
        // Testing aid: ?mgseconds=8 shortens minigames.
        seconds: Number(new URLSearchParams(location.search).get('mgseconds')) || undefined,
      });
      grade = gradeFor(r.percent);
      lines = r.lines;
    } else {
      grade = s.job.lastGrade!;
    }
    await this.hud.fade(true);
    const end = dayStart(dayIndex(s.minutes)) + job.end;
    const hours = Math.max(0, (end - this.clock.minutes) / 60);
    simulateNeeds(s.needs, hours, 'awake');
    addNeed(s.needs, 'hunger', job.strain.hunger);
    addNeed(s.needs, 'rest', job.strain.rest);
    addNeed(s.needs, 'social', 6);
    this.clock.minutes = Math.max(this.clock.minutes, end);
    const rankBefore = job.ranks[s.job.rank].title;
    const rep = completeShift(s, grade, play);
    s.minutes = this.clock.minutes;
    await this.hud.fade(false);
    const report = [
      ...(play ? lines : ['You kept your head down and did the same as last time.']),
      `Grade: ${GRADE_INFO[grade].name}`,
      `Pay: £${rep.pay.toFixed(2)}`,
      `Promotion points: ${rep.points >= 0 ? '+' : ''}${rep.points}`,
      ...rep.levelUps,
    ];
    await this.hud.modal(`Shift over · ${rankBefore}`, report);
    if (rep.promotedTo) {
      await this.dialogue.say({ speaker: job.boss, text: `You've a back on you after all. From tomorrow you're ${rep.promotedTo}. More pay, heavier crates, same river.` });
    }
    if (rep.fired) {
      await this.dialogue.say({ speaker: job.boss, text: 'That\'s enough. Collect your pennies and don\'t come back this month.' });
    }
    this.busy = false;
    this.save();
  }

  /** Penalises missed shifts; called every frame and after sleeping. */
  private async attendance(): Promise<void> {
    const s = this.state!;
    const job = currentJob(s);
    const { missed, fired } = checkAttendance(s);
    if (!job || missed === 0) return;
    if (fired) {
      await this.dialogue.say({ speaker: job.boss, text: 'You didn\'t turn up. Again. You\'re finished here. Don\'t come back this month.' });
    } else {
      this.hud.toast(`You missed ${missed === 1 ? 'a shift' : `${missed} shifts`} at the docks. Promotion points -${missed * 3}.`, 4000);
    }
  }

  private async askCup(): Promise<void> {
    await this.dialogue.say(
      { speaker: 'Bessa Hartigan', text: 'Short of hands? Always. Short of coin to pay them? Also always.' },
      { speaker: 'Bessa Hartigan', text: "The brewer gets paid at the end of the week. Come back after that and we'll talk." },
    );
    this.state!.tutorial.askedCup = true;
    this.refreshObjectives();
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
    if (s.needs.health <= 0) void this.sleep('faint');
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
    const job = currentJob(s);
    const work = job && s.job
      ? `${job.ranks[s.job.rank].title} at the ${job.employer}. ${nextShiftText(s)}. ${promotionText(s)}`
      : '';
    this.hud.setJournal(Hud.titleFor(s), this.hud.journalHtml(s, rentLine, work));
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
      void this.attendance();
      if (s.minutes - this.lastSaveMinute >= 60) this.save();
    }

    player.update(dt, this.elapsed);
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

    const job = currentJob(s);
    const jobLine = job && s.job ? `${job.ranks[s.job.rank].title} · ${nextShiftText(s)}` : '';
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
