import { Chat, ChatOptions, ModelType, Site } from './base';
import { You } from './you';
import { Mcbbs } from './mcbbs';
import { Phind } from './phind';
import { Forefrontnew } from './forefront';
import { Vita } from './vita';
import { Skailar } from './skailar';
import { FakeOpen } from './fakeopen';
import { EasyChat } from './easychat';
import { Better } from './better';
import { PWeb } from './pweb';
import { Bai } from './bai';
import { Gra } from './gra';
import { Magic } from './magic';
import { Chim } from './chim';
import { Ram } from './ram';
import { Chur } from './chur';
import { Xun } from './xun';
import { VVM } from './vvm';
import { Claude } from './claude';
import { Cursor } from './cursor';
import { Auto } from './auto';
import { ChatBase } from './chatbase';
import { AILS } from './ails';
import { ChatDemo } from './chatdemo';
import { SinCode } from './sincode';
import { OpenAI } from './openai';
import { OneAPI } from './oneapi';
import { Jasper } from './jasper';
import { MyShell } from './myshell';
import { AcyToo } from './acytoo';
import { Google } from './google';
import { WWW } from './www';
import { DDG } from './ddg';

export class ChatModelFactory {
  private readonly modelMap: Map<Site, Chat>;
  private readonly options: ChatOptions | undefined;

  constructor(options?: ChatOptions) {
    this.modelMap = new Map();
    this.options = options;
    this.init();
  }

  init() {
    // register new model here
    this.modelMap.set(Site.You, new You({ name: Site.You }));
    this.modelMap.set(Site.Phind, new Phind({ name: Site.Phind }));
    this.modelMap.set(
      Site.Forefront,
      new Forefrontnew({ name: Site.Forefront, net: false }),
    );
    this.modelMap.set(Site.Mcbbs, new Mcbbs({ name: Site.Mcbbs }));
    this.modelMap.set(Site.ChatDemo, new ChatDemo({ name: Site.ChatDemo }));
    this.modelMap.set(Site.Vita, new Vita({ name: Site.Vita }));
    this.modelMap.set(Site.Skailar, new Skailar({ name: Site.Skailar }));
    this.modelMap.set(Site.FakeOpen, new FakeOpen({ name: Site.FakeOpen }));
    this.modelMap.set(
      Site.EasyChat,
      new EasyChat({ name: Site.EasyChat, model: ModelType.GPT4 }),
    );
    this.modelMap.set(Site.Better, new Better({ name: Site.Better }));
    this.modelMap.set(Site.PWeb, new PWeb({ name: Site.PWeb }));
    this.modelMap.set(Site.Bai, new Bai({ name: Site.Bai }));
    this.modelMap.set(Site.Gra, new Gra({ name: Site.Gra }));
    this.modelMap.set(Site.Magic, new Magic({ name: Site.Magic }));
    this.modelMap.set(Site.Chim, new Chim({ name: Site.Chim }));
    this.modelMap.set(Site.Ram, new Ram({ name: Site.Ram }));
    this.modelMap.set(Site.Chur, new Chur({ name: Site.Chur }));
    this.modelMap.set(Site.Xun, new Xun({ name: Site.Xun }));
    this.modelMap.set(Site.VVM, new VVM({ name: Site.VVM }));
    this.modelMap.set(Site.Claude, new Claude({ name: Site.Claude }));
    this.modelMap.set(Site.Cursor, new Cursor({ name: Site.Cursor }));
    this.modelMap.set(Site.OneAPI, new OneAPI({ name: Site.OneAPI }));
    this.modelMap.set(
      Site.Auto,
      new Auto({ name: Site.Auto, ModelMap: this.modelMap }),
    );
    this.modelMap.set(Site.ChatBase, new ChatBase({ name: Site.ChatBase }));
    this.modelMap.set(Site.AiLs, new AILS({ name: Site.AiLs }));
    this.modelMap.set(Site.SinCode, new SinCode({ name: Site.SinCode }));
    this.modelMap.set(Site.OpenAI, new OpenAI({ name: Site.OpenAI }));
    this.modelMap.set(Site.Jasper, new Jasper({ name: Site.Jasper }));
    this.modelMap.set(Site.MyShell, new MyShell({ name: Site.MyShell }));
    this.modelMap.set(Site.AcyToo, new AcyToo({ name: Site.AcyToo }));
    this.modelMap.set(Site.Google, new Google({ name: Site.Google }));
    this.modelMap.set(Site.WWW, new WWW({ name: Site.WWW }));
    this.modelMap.set(Site.DDG, new DDG({ name: Site.DDG }));
  }

  get(model: Site): Chat | undefined {
    return this.modelMap.get(model);
  }
}
