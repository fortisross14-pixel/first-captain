import Phaser from 'phaser';

type InteriorKey = 'home' | 'tavern' | 'sheriff' | 'smithy';

const DATA: Record<InteriorKey,{title:string,npc:string,texture:string,lines:string[],accent:number}> = {
  home:{title:'Family Home',npc:'Father',texture:'villager-b',accent:0x7e5939,lines:['Your grandfather carried that amulet when he served the old duke.','A sword wins a duel. People win a war. Remember that.']},
  tavern:{title:'The Copper Cup',npc:'Innkeeper Bessa',texture:'villager-a',accent:0x8b542f,lines:['No recruits yet—the company system returns in the next gameplay pass.','Still, this room now exists as a real scene rather than a painted door.']},
  sheriff:{title:"Sheriff's Office",npc:'Sheriff Mara',texture:'sheriff',accent:0x5d5141,lines:['The road bounty will be rebuilt on top of this collision foundation.','I need captains who can bring criminals back alive—but I will pay either way.']},
  smithy:{title:'Blacksmith',npc:'Master Oren',texture:'villager-b',accent:0x4d4439,lines:['Equipment screens come after the world and combat are stable.','Good steel is balanced. Good code should be too.']},
};

export class InteriorScene extends Phaser.Scene {
  private interior: InteriorKey = 'home';
  constructor(){ super('InteriorScene'); }
  init(data:{interior?:InteriorKey}):void { this.interior = data.interior ?? 'home'; }

  create():void {
    const d = DATA[this.interior];
    this.cameras.main.setBackgroundColor('#11120f');
    const cx = this.scale.width/2, cy=this.scale.height/2;
    const floor=this.add.rectangle(cx,cy,760,500,d.accent).setStrokeStyle(8,0x261b13);
    this.add.grid(cx,cy,740,480,48,48,0x8a7251,.25,0x2b2118,.6);
    this.add.rectangle(cx,cy-210,620,28,0x2b2018);
    this.add.rectangle(cx-310,cy,25,400,0x2b2018);
    this.add.rectangle(cx+310,cy,25,400,0x2b2018);
    for(let i=0;i<5;i++) this.add.rectangle(cx-220+i*110,cy-155,72,34,0x50351f).setStrokeStyle(2,0x1e1712);
    this.add.rectangle(cx,cy+196,90,24,0x2d2118);
    this.add.text(cx,cy+165,'EXIT',{fontFamily:'Arial',fontSize:'13px',color:'#f2d79a'}).setOrigin(.5);
    const npc=this.add.image(cx,cy-40,d.texture).setScale(1.35).setInteractive({useHandCursor:true});
    this.tweens.add({targets:npc,y:npc.y-3,duration:900,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    this.add.text(cx,42,d.title,{fontFamily:'Georgia',fontSize:'28px',color:'#f4e7c1',stroke:'#24170f',strokeThickness:6}).setOrigin(.5);
    const help=this.add.text(cx,this.scale.height-36,'Click the character to talk · Click EXIT or press ESC to leave',{fontFamily:'Arial',fontSize:'14px',color:'#d8d0ba',backgroundColor:'#171a15dd',padding:{x:10,y:6}}).setOrigin(.5);
    const dialog=this.add.text(cx,cy+78,'',{fontFamily:'Georgia',fontSize:'18px',color:'#fff0c6',backgroundColor:'#171512ee',padding:{x:16,y:12},wordWrap:{width:560},align:'center'}).setOrigin(.5).setVisible(false);
    npc.on('pointerdown',()=>dialog.setText(`${d.npc}\n\n${Phaser.Utils.Array.GetRandom(d.lines)}`).setVisible(true));
    const exit=this.add.rectangle(cx,cy+185,100,55,0xffffff,0.001).setInteractive({useHandCursor:true});
    exit.on('pointerdown',()=>this.scene.start('TownScene'));
    this.input.keyboard?.on('keydown-ESC',()=>this.scene.start('TownScene'));
    void floor; void help;
  }
}
