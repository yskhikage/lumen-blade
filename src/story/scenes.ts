// Chapter 1 dialogue. shot: lumina | ciel | two | boss | wide | wide2, expr: VRM expression name.
// @ts-nocheck
export const SCENES = {
  prologue:[
    {who:'narr', shot:'wide', text:'――月の光が、結晶に喰われていく夜。'},
    {who:'narr', shot:'wide2', text:'かつて世界を照らした〈光の剣〉は、ひとりの少女に託された。'},
    {who:'ciel', shot:'ciel', expr:'happy', text:'ルミナ！ よかった……目を覚ましたのね。'},
    {who:'lumina', shot:'lumina', expr:'surprised', text:'……シエル？ ここは……月の祭壇？'},
    {who:'ciel', shot:'ciel', expr:'sad', text:'結晶体が祭壇を侵しているの。\nこのままじゃ、最後の月光まで消えてしまう。'},
    {who:'lumina', shot:'lumina', expr:'angry', text:'わかった。この剣で、全部斬り払う。'},
    {who:'ciel', shot:'two', expr:'happy', text:'わたしは祭壇で祈りを続ける。\n……お願い、気をつけて！'}
  ],
  bossIntro:[
    {who:'ciel', shot:'ciel', expr:'surprised', text:'待って……地面が震えてる！'},
    {who:'narr', shot:'boss', text:'祭壇の奥から、巨大な影が姿を現した。'},
    {who:'boss', shot:'boss', text:'……還レ。光ノ器ヨ。'},
    {who:'lumina', shot:'lumina', expr:'surprised', text:'しゃべった……!? 守護者が、どうして……'},
    {who:'ciel', shot:'ciel', expr:'sad', text:'あれは祭壇の守護者……\n結晶に穢されてしまったんだわ！'},
    {who:'lumina', shot:'lumina', expr:'angry', text:'だったら――わたしが解き放つ！'}
  ],
  ending:[
    {who:'narr', shot:'wide', text:'守護者の結晶が砕け、やわらかな月光が祭壇に戻っていく。'},
    {who:'ciel', shot:'ciel', expr:'happy', text:'やった……！ 月の光が、戻ってきた！'},
    {who:'lumina', shot:'lumina', expr:'relaxed', text:'……でも、あいつ。わたしを「器」って呼んだ。'},
    {who:'ciel', shot:'ciel', expr:'sad', text:'ルミナ……あなたが記憶をなくしたことと、\n関係があるのかな。'},
    {who:'lumina', shot:'two', expr:'happy', text:'わからない。でも、確かめに行こう。\n――光が、消えてしまう前に。'}
  ]
};
export const NAMES = {lumina:'ルミナ', ciel:'シエル', boss:'穢れし守護者', narr:''};
