import { Chat, ChatOptions, ModelType, Site } from './base';
import { You } from './you';
import { Mcbbs } from './mcbbs';
import { Phind } from './phind';
import { Forefrontnew } from './forefront';
import { Vita } from './vita';
import { Copilot } from './copilot';
import { Skailar } from './skailar';
import { FakeOpen } from './fakeopen';
import { EasyChat } from './easychat';
import { Better } from './better';
import { PWeb } from './pweb';
import { Bai } from './bai';
import { Gra } from './gra';
import { Magic } from './magic';
import { Chim } from './chim';
import { Poe } from './poe';
import { Ram } from './ram';
import { Chur } from './chur';
import { Xun } from './xun';
import { VVM } from './vvm';
import { Poef } from './poef';
import { ClaudeChat } from './claude';
import { Cursor } from './cursor';
import { Auto } from './auto';
import { ChatBase } from './chatbase';
import { OpenPrompt } from './openprompt';
import { AILS } from './ails';
import { Perplexity } from './perplexity';
import { ChatDemo } from './chatdemo';
import { SinCode } from './sincode';
import { OpenAI } from './openai';
import { OneAPI } from './oneapi';
import { Jasper } from './jasper';
import { Pap } from './pap';
import { MyShell } from './myshell';
import { AcyToo } from './acytoo';
import { Google } from './google';
import { WWW } from './www';
import { Bing } from './bing';
import { DDG } from './ddg';
import { Vanus } from './vanus';
import { Mixer } from './mixer';
import { Merlin } from './merlin';
import { Airops } from './airops';
import { Langdock } from './langdock';
import { Toyy } from './toyy';
import { TakeOff } from './takeoff';
import { Navit } from './navit';
import { ClaudeAPI } from './claudeapi';
import { Stack } from './stack';
import { OpenChat3 } from './openchat3';
import { PoeAuto } from './poeauto';
import { TD } from './td';
import { OpenChat4 } from './openchat4';
import { PoeVIP } from './poevip';
import { Izea } from './izea';
import { Askx } from './askx';
import { OpenSess } from './opensess';
import { Hypotenuse } from './hypotenuse';
import { Gemini } from './gemini';
import { AIRoom } from './airoom';
import { GPTGOD } from './gptgod';
import { Arkose } from './arkose';
import { Midjourney } from './midjourney';
import { FreeGPT4 } from './freegpt4';
import { Domo } from './domo';

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
    // this.modelMap.set(Site.You, new You({ name: Site.You }));
    this.modelMap.set(Site.Phind, new Phind({ name: Site.Phind }));
    // this.modelMap.set(
    //   Site.Forefront,
    //   new Forefrontnew({ name: Site.Forefront, net: false }),
    // );
    // this.modelMap.set(Site.Mcbbs, new Mcbbs({ name: Site.Mcbbs }));
    // this.modelMap.set(Site.ChatDemo, new ChatDemo({ name: Site.ChatDemo }));
    // this.modelMap.set(Site.Vita, new Vita({ name: Site.Vita }));
    // this.modelMap.set(Site.Copilot, new Copilot({ name: Site.Copilot }));
    // this.modelMap.set(Site.Skailar, new Skailar({ name: Site.Skailar }));
    this.modelMap.set(Site.FakeOpen, new FakeOpen({ name: Site.FakeOpen }));
    // this.modelMap.set(
    //   Site.EasyChat,
    //   new EasyChat({ name: Site.EasyChat, model: ModelType.GPT4 }),
    // );
    // this.modelMap.set(Site.Better, new Better({ name: Site.Better }));
    // this.modelMap.set(Site.PWeb, new PWeb({ name: Site.PWeb }));
    // this.modelMap.set(Site.Bai, new Bai({ name: Site.Bai }));
    // this.modelMap.set(Site.Gra, new Gra({ name: Site.Gra }));
    // this.modelMap.set(Site.Magic, new Magic({ name: Site.Magic }));
    // this.modelMap.set(Site.Chim, new Chim({ name: Site.Chim }));
    // this.modelMap.set(Site.Poe, new Poe({ name: Site.Poe }));
    // this.modelMap.set(Site.Ram, new Ram({ name: Site.Ram }));
    // this.modelMap.set(Site.Chur, new Chur({ name: Site.Chur }));
    // this.modelMap.set(Site.Xun, new Xun({ name: Site.Xun }));
    // this.modelMap.set(Site.VVM, new VVM({ name: Site.VVM }));
    // this.modelMap.set(Site.Poef, new Poef({ name: Site.Poef }));
    this.modelMap.set(Site.PoeAuto, new PoeAuto({ name: Site.PoeAuto }));
    this.modelMap.set(Site.PoeVIP, new PoeVIP({ name: Site.PoeVIP }));
    this.modelMap.set(
      Site.ClaudeChat,
      new ClaudeChat({ name: Site.ClaudeChat }),
    );
    // this.modelMap.set(Site.Cursor, new Cursor({ name: Site.Cursor }));
    this.modelMap.set(Site.OneAPI, new OneAPI({ name: Site.OneAPI }));
    this.modelMap.set(
      Site.Auto,
      new Auto({ name: Site.Auto, ModelMap: this.modelMap }),
    );
    // this.modelMap.set(Site.ChatBase, new ChatBase({ name: Site.ChatBase }));
    // this.modelMap.set(
    //   Site.OpenPrompt,
    //   new OpenPrompt({ name: Site.OpenPrompt }),
    // );
    // this.modelMap.set(Site.AiLs, new AILS({ name: Site.AiLs }));
    this.modelMap.set(Site.SinCode, new SinCode({ name: Site.SinCode }));
    this.modelMap.set(Site.OpenAI, new OpenAI({ name: Site.OpenAI }));
    // this.modelMap.set(Site.Jasper, new Jasper({ name: Site.Jasper }));
    // this.modelMap.set(Site.Pap, new Pap({ name: Site.Pap }));
    // this.modelMap.set(Site.MyShell, new MyShell({ name: Site.MyShell }));
    // this.modelMap.set(Site.AcyToo, new AcyToo({ name: Site.AcyToo }));
    this.modelMap.set(Site.Google, new Google({ name: Site.Google }));
    this.modelMap.set(Site.WWW, new WWW({ name: Site.WWW }));
    this.modelMap.set(Site.Bing, new Bing({ name: Site.Bing }));
    this.modelMap.set(Site.DDG, new DDG({ name: Site.DDG }));
    // this.modelMap.set(Site.Vanus, new Vanus({ name: Site.Vanus }));
    this.modelMap.set(Site.Mixer, new Mixer({ name: Site.Mixer }));
    this.modelMap.set(Site.Merlin, new Merlin({ name: Site.Merlin }));
    // this.modelMap.set(Site.Airops, new Airops({ name: Site.Airops }));
    this.modelMap.set(Site.Langdock, new Langdock({ name: Site.Langdock }));
    // this.modelMap.set(Site.Toyy, new Toyy({ name: Site.Toyy }));
    // this.modelMap.set(Site.TakeOff, new TakeOff({ name: Site.TakeOff }));
    this.modelMap.set(Site.Navit, new Navit({ name: Site.Navit }));
    this.modelMap.set(Site.Claude, new ClaudeAPI({ name: Site.Claude }));
    this.modelMap.set(Site.Stack, new Stack({ name: Site.Stack }));
    this.modelMap.set(Site.OpenChat3, new OpenChat3({ name: Site.OpenChat3 }));
    this.modelMap.set(Site.TD, new TD({ name: Site.TD }));
    this.modelMap.set(Site.OpenChat4, new OpenChat4({ name: Site.OpenChat4 }));
    this.modelMap.set(Site.Izea, new Izea({ name: Site.Izea }));
    this.modelMap.set(Site.Askx, new Askx({ name: Site.Askx }));
    this.modelMap.set(Site.OpenSess, new OpenSess({ name: Site.OpenSess }));
    this.modelMap.set(Site.Gemini, new Gemini({ name: Site.Gemini }));
    this.modelMap.set(Site.AIRoom, new AIRoom({ name: Site.AIRoom }));
    this.modelMap.set(Site.GPTGOD, new GPTGOD({ name: Site.GPTGOD }));
    this.modelMap.set(Site.Arkose, new Arkose({ name: Site.Arkose }));
    this.modelMap.set(Site.FreeGPT4, new FreeGPT4({ name: Site.FreeGPT4 }));
    this.modelMap.set(Site.Domo, new Domo({ name: Site.Domo }));
    this.modelMap.set(
      Site.Midjourney,
      new Midjourney({ name: Site.Midjourney }),
    );
    this.modelMap.set(
      Site.Hypotenuse,
      new Hypotenuse({ name: Site.Hypotenuse }),
    );
    this.modelMap.set(
      Site.Perplexity,
      new Perplexity({ name: Site.Perplexity }),
    );
  }

  get(model: Site): Chat | undefined {
    return this.modelMap.get(model);
  }
}

export const chatModel = new ChatModelFactory();
