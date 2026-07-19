import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create(): void {
    this.makeTile('grass', 0x60783b, 0x6f8b45, 0x465d2b);
    this.makeTile('grass-dark', 0x4b6330, 0x59763a, 0x354923);
    this.makeTile('road', 0xa9854d, 0xb9985f, 0x765b35);
    this.makeTile('stone', 0x817b68, 0x9b927b, 0x5c584b);
    this.makeTile('water', 0x386d70, 0x4f8988, 0x285052);
    this.makeCharacter('captain', 0x713b2c, 0x2f4965, 0xd4b07e, 0xc5c9ce);
    this.makeCharacter('sheriff', 0x4c2b24, 0x364a2d, 0xcda978, 0xb6bec3);
    this.makeCharacter('villager-a', 0x8b4b38, 0x745332, 0xc99f70, 0x8b704e);
    this.makeCharacter('villager-b', 0x4b2c22, 0x65465f, 0xd2aa79, 0x9d8b76);
    this.makeTree();
    this.makeLamp();
    this.makeCrate();
    this.makeFence();
    this.makeBuilding('house', 0x8a5133, 0x5d3427, 0xd1b073, 0x6f432e);
    this.makeBuilding('tavern', 0x72402c, 0x3f2922, 0xc29a5a, 0x6c472b);
    this.makeBuilding('sheriff-building', 0x67513c, 0x38322b, 0xada18a, 0x53412e);
    this.makeBuilding('smithy', 0x55473a, 0x2d2b28, 0x9a7953, 0x3c332a);
    this.makeDoor();
    this.scene.start('TownScene');
  }

  private makeTile(key: string, base: number, light: number, dark: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(dark).fillPoints([{x:32,y:2},{x:63,y:16},{x:32,y:31},{x:1,y:16}], true);
    g.fillStyle(base).fillPoints([{x:32,y:0},{x:62,y:15},{x:32,y:29},{x:2,y:15}], true);
    g.lineStyle(1, light, .6).lineBetween(6,15,32,3).lineBetween(32,3,58,15);
    g.fillStyle(light, .75).fillRect(20, 10, 3, 2).fillRect(42, 15, 2, 2).fillRect(30, 21, 4, 1);
    g.generateTexture(key, 64, 32);
    g.destroy();
  }

  private makeCharacter(key: string, hair: number, clothes: number, skin: number, metal: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x182017, .45).fillEllipse(24, 45, 24, 9);
    g.fillStyle(0x30251f).fillRect(17, 34, 6, 11).fillRect(26, 34, 6, 11);
    g.fillStyle(clothes).fillRect(14, 21, 21, 17);
    g.fillStyle(0x263145).fillRect(12, 23, 5, 13);
    g.fillStyle(skin).fillRect(17, 11, 15, 12);
    g.fillStyle(hair).fillRect(16, 8, 17, 7).fillRect(15, 12, 4, 7);
    g.fillStyle(0x1d1714).fillRect(20, 16, 2, 2).fillRect(28, 16, 2, 2);
    g.fillStyle(metal).fillRect(35, 18, 3, 22).fillTriangle(32, 18, 41, 18, 36, 10);
    g.generateTexture(key, 48, 52);
    g.destroy();
  }

  private makeTree(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x1d291a, .45).fillEllipse(33, 69, 46, 13);
    g.fillStyle(0x5a3c25).fillRect(28, 42, 10, 25);
    g.fillStyle(0x203d25).fillCircle(33, 30, 27);
    g.fillStyle(0x2f5a31).fillCircle(22, 35, 21).fillCircle(45, 36, 20).fillCircle(34, 17, 22);
    g.fillStyle(0x4d7540).fillCircle(24, 22, 9).fillCircle(40, 27, 8).fillCircle(30, 42, 7);
    g.generateTexture('tree', 68, 76);
    g.destroy();
  }

  private makeLamp(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x20211d).fillRect(12, 18, 5, 52).fillRect(8, 66, 13, 5);
    g.fillStyle(0xd5a64d).fillRect(7, 7, 15, 16);
    g.fillStyle(0xffdc7b).fillRect(10, 10, 9, 10);
    g.lineStyle(2, 0x3b352b).strokeRect(7, 7, 15, 16);
    g.generateTexture('lamp', 30, 74);
    g.destroy();
  }

  private makeCrate(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x5d3d25).fillRect(1, 1, 30, 25);
    g.fillStyle(0x8a6038).fillRect(4, 4, 24, 19);
    g.lineStyle(3, 0x53351f).lineBetween(4,4,28,23).lineBetween(28,4,4,23);
    g.generateTexture('crate', 32, 28);
    g.destroy();
  }

  private makeFence(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x4d3422).fillRect(0, 8, 64, 5).fillRect(4, 0, 6, 24).fillRect(28, 0, 6, 24).fillRect(54, 0, 6, 24);
    g.fillStyle(0x765035).fillRect(5, 1, 4, 20).fillRect(29, 1, 4, 20).fillRect(55, 1, 4, 20);
    g.generateTexture('fence', 64, 24);
    g.destroy();
  }

  private makeBuilding(key: string, wall: number, roof: number, trim: number, door: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x182017, .35).fillEllipse(90, 128, 165, 28);
    g.fillStyle(wall).fillRect(22, 48, 136, 73);
    g.fillStyle(trim).fillRect(28, 56, 124, 57);
    g.fillStyle(roof).fillTriangle(10, 56, 90, 8, 170, 56).fillRect(15, 48, 150, 18);
    g.fillStyle(0x34251e).fillRect(80, 73, 27, 48);
    g.fillStyle(door).fillRect(84, 77, 19, 44);
    g.fillStyle(0x1d282d).fillRect(40, 73, 27, 24).fillRect(119, 73, 27, 24);
    g.fillStyle(0xc7d6c6).fillRect(44, 77, 19, 16).fillRect(123, 77, 19, 16);
    g.lineStyle(3, 0x57432f).strokeRect(40,73,27,24).strokeRect(119,73,27,24);
    g.fillStyle(0x5d3c27).fillRect(19, 113, 142, 9);
    g.generateTexture(key, 180, 140);
    g.destroy();
  }

  private makeDoor(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x201913).fillRect(0, 0, 28, 42);
    g.fillStyle(0x624128).fillRect(3, 3, 22, 39);
    g.fillStyle(0xd1a34b).fillCircle(21, 23, 2);
    g.generateTexture('door', 28, 42);
    g.destroy();
  }
}
