// WindShield 第1話「風の沈黙」の台本。
// 1行 = {who:話し手, shot:カメラ, expr:表情, text:セリフ}
//   who  : lumina(=エルフィナ) | ciel(=若い神官) | priest(司祭・声のみ) | people(民の声・声のみ) | narr(ナレーション)
//          ※ lumina / ciel は既存モデルの内部名。表示名は下の NAMES で決まる
//   shot : lumina(エルフィナの顔) | ciel(神官の顔) | two(2人) | wide / wide2(引き)
//   expr : VRMの表情名（happy / sad / surprised / angry / relaxed）
// （　）で囲んだセリフはエルフィナの心の声。
// 世界の謎（風が止まった理由・影の正体・エルフィナの出生）は第1話では語らない。
// @ts-nocheck
export const SCENES = {
  // ① 夜明け：日常と、巫女としての立場
  ep1_dawn:[
    {who:'narr', shot:'wide', text:'風が、街を目覚めさせる。'},
    {who:'narr', shot:'wide2', text:'聖都アウリス――〈アースファン〉の羽根が、今日も空を渡っていく。'},
    {who:'ciel', shot:'ciel', expr:'happy', text:'エルフィナさま、おはようございます。\n今日もいい風ですね。'},
    {who:'lumina', shot:'lumina', expr:'relaxed', text:'うん。……東から、やわらかい風。'},
    {who:'ciel', shot:'ciel', expr:'happy', text:'さすがです。\nわたしには、ただの風にしか聞こえません。'},
    {who:'ciel', shot:'two', text:'朝の祈りの刻です。\nみなさん、台座の前でお待ちですよ。'},
    {who:'lumina', shot:'lumina', expr:'happy', text:'……わかった。すぐ行くね。'},
    {who:'lumina', shot:'lumina', text:'（みんなが待ってる。ちゃんと、聞かなきゃ）'}
  ],
  // ③ 最初の沈黙：小さな違和感と、はじめての嘘
  ep1_hush:[
    {who:'narr', shot:'wide2', text:'エルフィナは目を閉じ、風に耳を澄ませる。'},
    {who:'lumina', shot:'lumina', text:'…………'},
    {who:'lumina', shot:'lumina', expr:'surprised', text:'（……聞こえない？）'},
    {who:'ciel', shot:'ciel', expr:'surprised', text:'エルフィナさま？'},
    {who:'lumina', shot:'lumina', expr:'happy', text:'……ううん。今日も、穏やかな風だって。'},
    {who:'lumina', shot:'lumina', expr:'sad', text:'（嘘をついた。はじめて）'}
  ],
  // ④ 異変：都市全体に広がる不安
  ep1_unrest:[
    {who:'narr', shot:'wide', text:'三日後。'},
    {who:'people', shot:'wide', text:'おい……風車が、止まりかけてないか？'},
    {who:'people', shot:'wide2', text:'こんなこと、今まで一度も……'},
    {who:'ciel', shot:'ciel', expr:'sad', text:'エルフィナさま、風は……\n風は、何と言っているんですか？'},
    {who:'lumina', shot:'lumina', text:'…………'},
    {who:'lumina', shot:'lumina', expr:'sad', text:'（お願い。なにか、言って）'},
    {who:'narr', shot:'wide', text:'風が途切れた広場に、黒い影が滲み出した。'}
  ],
  // ⑤ 異端：居場所を失う
  ep1_heresy:[
    {who:'narr', shot:'wide', text:'影は消えた。けれど、風は戻らなかった。'},
    {who:'priest', shot:'lumina', text:'巫女エルフィナ。\n風の声は、まだ聞こえるか。'},
    {who:'lumina', shot:'lumina', expr:'sad', text:'……聞こえません。'},
    {who:'priest', shot:'wide2', text:'風を失った巫女の前に、影が現れた。\n……偶然と思う者は、ここにはおるまい。'},
    {who:'people', shot:'wide', text:'巫女さまのせいなのか……？'},
    {who:'people', shot:'wide', text:'風を返せ！'},
    {who:'ciel', shot:'ciel', expr:'sad', text:'待ってください！\nエルフィナさまは、わたしたちを守って……！'},
    {who:'priest', shot:'two', text:'教団は、そなたを異端と定める。\n夜明けまでに、聖都を去れ。'},
    {who:'lumina', shot:'lumina', expr:'sad', text:'…………はい。'}
  ],
  // ⑥ 別れ
  ep1_farewell:[
    {who:'ciel', shot:'ciel', expr:'sad', text:'わたしには、風の声なんて\n一度も聞こえませんでした。'},
    {who:'ciel', shot:'ciel', expr:'relaxed', text:'それでも……\nエルフィナさまの言葉は、好きでした。'},
    {who:'lumina', shot:'two', expr:'relaxed', text:'……ありがとう。'}
  ],
  // ⑧ ラスト：風のない世界へ
  ep1_departure:[
    {who:'narr', shot:'wide', text:'その夜、アースファンの羽根がひとつ、音もなく止まった。'},
    {who:'narr', shot:'wide2', text:'聖堂では、司祭たちが言葉を失っていた。'},
    {who:'lumina', shot:'lumina', expr:'sad', text:'（風の声が聞こえないわたしは――誰なんだろう）'},
    {who:'lumina', shot:'lumina', expr:'relaxed', text:'（……それでも、歩くしかない）'},
    {who:'narr', shot:'wide', text:'風のない道の先に、灰色の街が待っている。'}
  ]
};
export const NAMES = {lumina:'エルフィナ', ciel:'若い神官', priest:'司祭', people:'民の声', boss:'穢れし守護者', narr:''};
