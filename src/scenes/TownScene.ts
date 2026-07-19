import Phaser from 'phaser';
import { findPath } from '../game/pathfinding';
import { gridToWorld, keyOf, worldToGrid, type GridPoint } from '../game/iso';

const MAP_W = 22;
const MAP_H = 22;
const ORIGIN_X = 640;
const ORIGIN_Y = 80;

type BuildingDef = {
  id: string;
  label: string;
  texture: string;
  col: number;
  row: number;
  width: number;
  height: number;
  door: GridPoint;
  interior: 'home' | 'tavern' | 'sheriff' | 'smithy';
};

type NpcDef = { name: string; texture: string; col: number; row: number; lines: string[] };

export class TownScene extends Phaser.Scene {
  private blocked = new Set<string>();
  private player!: Phaser.GameObjects.Image;
  private playerGrid: GridPoint = { col: 11, row: 17 };
  private moving = false;
  private prompt!: Phaser.GameObjects.Text;
  private dialogueBox!: Phaser.GameObjects.Container;
  private dialogueText!: Phaser.GameObjects.Text;
  private activeDoor?: BuildingDef;
  private nearbyNpc?: NpcDef;
  private destinationMarker!: Phaser.GameObjects.Ellipse;

  private readonly buildings: BuildingDef[] = [
    { id: 'home', label: 'Family Home', texture: 'house', col: 4, row: 5, width: 4, height: 4, door: { col: 6, row: 9 }, interior: 'home' },
    { id: 'tavern', label: 'The Copper Cup', texture: 'tavern', col: 13, row: 4, width: 5, height: 4, door: { col: 15, row: 8 }, interior: 'tavern' },
    { id: 'sheriff', label: "Sheriff's Office", texture: 'sheriff-building', col: 3, row: 13, width: 4, height: 4, door: { col: 5, row: 17 }, interior: 'sheriff' },
    { id: 'smithy', label: 'Blacksmith', texture: 'smithy', col: 15, row: 13, width: 4, height: 4, door: { col: 17, row: 17 }, interior: 'smithy' },
  ];

  private readonly npcs: NpcDef[] = [
    { name: 'Mira the Herbalist', texture: 'villager-a', col: 9, row: 7, lines: ['The northern road has been unsafe.', 'Bring me bitterleaf and I can make a stronger tonic.'] },
    { name: 'Old Garran', texture: 'villager-b', col: 12, row: 11, lines: ['A captain should be judged by who follows them.', 'And by who still speaks kindly of them afterward.'] },
    { name: 'Market Trader', texture: 'villager-a', col: 8, row: 14, lines: ['Fresh bread, lamp oil, and absolutely no stolen goods.', 'The last part is mostly for the sheriff.'] },
    { name: 'Gate Watch', texture: 'sheriff', col: 11, row: 19, lines: ['The road beyond the south gate will open in the next slice.', 'For now, test the town and its interiors.'] },
  ];

  constructor() { super('TownScene'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#172216');
    this.buildGround();
    this.buildEnvironment();
    this.buildBuildings();
    this.buildNpcs();
    this.createPlayer();
    this.createHud();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointer(pointer));
    this.input.keyboard?.on('keydown-E', () => this.interact());
    this.input.keyboard?.on('keydown-ESC', () => this.hideDialogue());
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.15);
    this.cameras.main.setBounds(-500, -100, 2300, 1300);
  }

  update(): void {
    this.refreshNearbyInteraction();
    this.player.setDepth(this.player.y + 70);
  }

  private iso(col: number, row: number): { x: number; y: number } {
    const p = gridToWorld(col, row);
    return { x: ORIGIN_X + p.x, y: ORIGIN_Y + p.y };
  }

  private buildGround(): void {
    for (let row = 0; row < MAP_H; row++) {
      for (let col = 0; col < MAP_W; col++) {
        const road = Math.abs(col - 11) <= 2 || Math.abs(row - 11) <= 2;
        const plaza = col >= 8 && col <= 14 && row >= 8 && row <= 14;
        const border = col === 0 || row === 0 || col === MAP_W - 1 || row === MAP_H - 1;
        const texture = border ? 'grass-dark' : (road || plaza ? 'road' : 'grass');
        const p = this.iso(col, row);
        this.add.image(p.x, p.y, texture).setDepth(p.y - 1000);
        if (border) this.blocked.add(keyOf(col, row));
      }
    }
  }

  private buildEnvironment(): void {
    const trees: GridPoint[] = [
      {col:1,row:2},{col:2,row:3},{col:1,row:7},{col:2,row:9},{col:19,row:2},{col:20,row:5},
      {col:19,row:9},{col:20,row:12},{col:2,row:20},{col:19,row:19},{col:20,row:20},{col:7,row:2},
    ];
    trees.forEach(({col,row}) => {
      const p = this.iso(col,row);
      this.add.image(p.x, p.y - 34, 'tree').setOrigin(.5,.9).setDepth(p.y + 35);
      this.blocked.add(keyOf(col,row));
    });

    const crates: GridPoint[] = [{col:8,row:6},{col:18,row:10},{col:7,row:16},{col:14,row:18}];
    crates.forEach(({col,row}) => {
      const p = this.iso(col,row);
      this.add.image(p.x,p.y-10,'crate').setDepth(p.y+10);
      this.blocked.add(keyOf(col,row));
    });

    const lamps: GridPoint[] = [{col:9,row:9},{col:13,row:9},{col:9,row:13},{col:13,row:13}];
    lamps.forEach(({col,row}) => {
      const p = this.iso(col,row);
      this.add.image(p.x,p.y-34,'lamp').setOrigin(.5,.9).setDepth(p.y+40);
      this.blocked.add(keyOf(col,row));
    });

    for (let col = 3; col <= 7; col++) {
      const row = 11;
      if (col === 5) continue;
      const p = this.iso(col,row);
      this.add.image(p.x,p.y-7,'fence').setScale(.55).setDepth(p.y+15);
      this.blocked.add(keyOf(col,row));
    }

    const waterTiles = [{col:17,row:6},{col:18,row:6},{col:17,row:7},{col:18,row:7}];
    waterTiles.forEach(({col,row}) => {
      const p = this.iso(col,row);
      this.add.image(p.x,p.y,'water').setDepth(p.y-999);
      this.blocked.add(keyOf(col,row));
    });
  }

  private buildBuildings(): void {
    for (const building of this.buildings) {
      for (let row = building.row; row < building.row + building.height; row++) {
        for (let col = building.col; col < building.col + building.width; col++) {
          this.blocked.add(keyOf(col,row));
        }
      }
      this.blocked.delete(keyOf(building.door.col, building.door.row));
      const center = this.iso(building.col + (building.width - 1) / 2, building.row + building.height - 1);
      const image = this.add.image(center.x, center.y - 58, building.texture).setOrigin(.5,1);
      image.setDepth(center.y + 30);
      image.setInteractive({ useHandCursor: true });
      image.on('pointerdown', () => this.walkToAdjacent(building.door, () => this.enterBuilding(building)));
      const label = this.add.text(center.x, center.y - 170, building.label, {
        fontFamily: 'Georgia', fontSize: '16px', color: '#f7e8b5', stroke: '#25190e', strokeThickness: 4,
      }).setOrigin(.5).setDepth(center.y + 200);
      label.setInteractive({ useHandCursor: true });
      label.on('pointerdown', () => this.walkToAdjacent(building.door, () => this.enterBuilding(building)));
    }
  }

  private buildNpcs(): void {
    this.npcs.forEach((npc, index) => {
      const p = this.iso(npc.col,npc.row);
      const image = this.add.image(p.x,p.y-20,npc.texture).setOrigin(.5,.85).setDepth(p.y+45);
      image.setData('npcIndex', index).setInteractive({ useHandCursor: true });
      image.on('pointerdown', () => this.walkToAdjacent({col:npc.col,row:npc.row}, () => this.showDialogue(npc.name, npc.lines)));
      this.blocked.add(keyOf(npc.col,npc.row));
      this.tweens.add({ targets:image, y:image.y-2, duration:850+index*90, yoyo:true, repeat:-1, ease:'Sine.inOut' });
    });
  }

  private createPlayer(): void {
    const p = this.iso(this.playerGrid.col,this.playerGrid.row);
    this.player = this.add.image(p.x,p.y-20,'captain').setOrigin(.5,.85).setDepth(p.y+70);
    this.destinationMarker = this.add.ellipse(p.x,p.y,22,10,0xffe29a,.35).setDepth(p.y-1).setVisible(false);
  }

  private createHud(): void {
    const title = this.add.text(22,18,'THE FIRST CAPTAIN · v2 FOUNDATION', {
      fontFamily:'Georgia', fontSize:'20px', color:'#f8edc9', stroke:'#1b140c', strokeThickness:5,
    }).setScrollFactor(0).setDepth(100000);
    this.add.text(22,48,'Click ground to move · Click NPC/building or press E to interact', {
      fontFamily:'Arial', fontSize:'14px', color:'#d5cfb8', backgroundColor:'#1b2118cc', padding:{x:8,y:5},
    }).setScrollFactor(0).setDepth(100000);

    this.prompt = this.add.text(0,0,'', {
      fontFamily:'Arial', fontSize:'15px', color:'#fff3c4', backgroundColor:'#20271ddd', padding:{x:10,y:6},
    }).setOrigin(.5).setScrollFactor(0).setDepth(100001).setVisible(false);

    const panel = this.add.rectangle(0,0,620,142,0x171a15,.96).setStrokeStyle(2,0xb99a5b);
    this.dialogueText = this.add.text(-280,-48,'', { fontFamily:'Georgia', fontSize:'18px', color:'#f8edcf', wordWrap:{width:560}, lineSpacing:7 });
    const hint = this.add.text(280,51,'ESC to close', { fontFamily:'Arial', fontSize:'12px', color:'#b9b29f' }).setOrigin(1);
    this.dialogueBox = this.add.container(this.scale.width/2,this.scale.height-105,[panel,this.dialogueText,hint])
      .setScrollFactor(0).setDepth(100010).setVisible(false);
    this.scale.on('resize',(size:Phaser.Structs.Size) => this.dialogueBox.setPosition(size.width/2,size.height-105));
    void title;
  }

  private handlePointer(pointer: Phaser.Input.Pointer): void {
    if (this.dialogueBox.visible || this.moving) return;
    const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const grid = worldToGrid(world.x - ORIGIN_X, world.y - ORIGIN_Y);
    if (grid.col < 0 || grid.row < 0 || grid.col >= MAP_W || grid.row >= MAP_H) return;
    this.walkTo(grid);
  }

  private walkTo(goal: GridPoint, onDone?: () => void): void {
    if (this.moving) return;
    const path = findPath(this.playerGrid, goal, MAP_W, MAP_H, this.blocked);
    if (path.length === 0) return;
    this.moving = true;
    const gp = this.iso(goal.col,goal.row);
    this.destinationMarker.setPosition(gp.x,gp.y).setDepth(gp.y-1).setVisible(true);
    const moveStep = (index: number): void => {
      if (index >= path.length) {
        this.moving = false;
        this.destinationMarker.setVisible(false);
        onDone?.();
        return;
      }
      const step = path[index];
      const p = this.iso(step.col, step.row);
      this.player.setFlipX(step.col < this.playerGrid.col);
      this.tweens.add({
        targets: this.player,
        x: p.x,
        y: p.y - 20,
        duration: 120,
        ease: 'Linear',
        onUpdate: () => this.player.setDepth(this.player.y + 70),
        onComplete: () => {
          this.playerGrid = step;
          moveStep(index + 1);
        },
      });
    };
    moveStep(0);
  }

  private walkToAdjacent(target: GridPoint, onDone: () => void): void {
    const options = [
      {col:target.col+1,row:target.row},{col:target.col-1,row:target.row},
      {col:target.col,row:target.row+1},{col:target.col,row:target.row-1}, target,
    ].filter(p => p.col>=0 && p.row>=0 && p.col<MAP_W && p.row<MAP_H && !this.blocked.has(keyOf(p.col,p.row)));
    options.sort((a,b) => this.manhattan(this.playerGrid,a)-this.manhattan(this.playerGrid,b));
    for (const option of options) {
      const path = findPath(this.playerGrid,option,MAP_W,MAP_H,this.blocked);
      if (path.length > 0 || this.manhattan(this.playerGrid,option)===0) {
        if (path.length === 0) onDone(); else this.walkTo(option,onDone);
        return;
      }
    }
  }

  private refreshNearbyInteraction(): void {
    this.activeDoor = this.buildings.find(b => this.manhattan(this.playerGrid,b.door) <= 1);
    this.nearbyNpc = this.npcs.find(n => this.manhattan(this.playerGrid,{col:n.col,row:n.row}) <= 1);
    const text = this.activeDoor ? `E · Enter ${this.activeDoor.label}` : this.nearbyNpc ? `E · Talk to ${this.nearbyNpc.name}` : '';
    this.prompt.setText(text).setVisible(Boolean(text));
    if (text) this.prompt.setPosition(this.scale.width/2,this.scale.height-46);
  }

  private interact(): void {
    if (this.dialogueBox.visible) { this.hideDialogue(); return; }
    if (this.activeDoor) this.enterBuilding(this.activeDoor);
    else if (this.nearbyNpc) this.showDialogue(this.nearbyNpc.name,this.nearbyNpc.lines);
  }

  private enterBuilding(building: BuildingDef): void {
    this.scene.start('InteriorScene',{ interior:building.interior, returnGrid:this.playerGrid });
  }

  private showDialogue(name: string, lines: string[]): void {
    this.dialogueText.setText(`${name}\n\n${Phaser.Utils.Array.GetRandom(lines)}`);
    this.dialogueBox.setVisible(true);
  }

  private hideDialogue(): void { this.dialogueBox.setVisible(false); }
  private manhattan(a:GridPoint,b:GridPoint):number { return Math.abs(a.col-b.col)+Math.abs(a.row-b.row); }
}
