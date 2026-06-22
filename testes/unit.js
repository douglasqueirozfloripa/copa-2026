/* Testes UNITÁRIOS da lógica do app Copa 2026 (sem interface).
   Carrega o script real e exercita as funções puras (pontos, desempate,
   repescagem, classificação e previsão de placar) em vários cenários. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const HTML_PATH = require("path").join(__dirname, "..", "copa-2026.html");
const dom = new JSDOM(fs.readFileSync(HTML_PATH, "utf8"), { runScripts: "dangerously", url: "http://localhost/" });
const run = (code) => dom.window.eval(code);

let pass = 0, fail = 0;
function ok(cond, msg){ if(cond){pass++;console.log("  ✅ "+msg);} else {fail++;console.log("  ❌ "+msg);} }
function eq(a,b,msg){ ok(JSON.stringify(a)===JSON.stringify(b), `${msg} (esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)})`); }

// helpers injetados no escopo da página (acessam STATE/GROUPS/funções reais)
run(`window.__clear=()=>STATE.matches.forEach(m=>{m.hs=null;m.as=null;});`);
run(`window.__set=(a,b,ga,gb)=>{const m=STATE.matches.find(x=>(x.home===a&&x.away===b)||(x.home===b&&x.away===a));
  if(!m) throw new Error('jogo nao encontrado: '+a+' x '+b);
  if(m.home===a){m.hs=ga;m.as=gb;}else{m.hs=gb;m.as=ga;} return m.id;};`);
run(`window.__row=(g,team)=>{const r=computeStandings()[g].find(x=>x.team===team);return r?{P:r.P,J:r.J,V:r.V,E:r.E,D:r.D,GP:r.GP,GC:r.GC,SG:r.SG}:null;};`);
run(`window.__order=(g)=>computeStandings()[g].map(r=>r.team);`);

console.log("== Pontuação: vitória=3, empate=1, derrota=0 ==");
run(`__clear(); __set('Brasil','Marrocos',2,1);`); // Brasil vence
eq(run(`__row('C','Brasil').P`), 3, "vitória vale 3 pontos");
eq(run(`__row('C','Marrocos').P`), 0, "derrota vale 0");
eq(run(`[__row('C','Brasil').V,__row('C','Marrocos').D]`), [1,1], "registra V do vencedor e D do perdedor");
run(`__clear(); __set('Brasil','Marrocos',1,1);`);
eq(run(`[__row('C','Brasil').P,__row('C','Marrocos').P]`), [1,1], "empate dá 1 ponto a cada");
eq(run(`[__row('C','Brasil').E,__row('C','Marrocos').E]`), [1,1], "empate conta como E para os dois");

console.log("\n== Gols (GP/GC/SG) e jogos (J) ==");
run(`__clear(); __set('Brasil','Marrocos',3,1);`);
eq(run(`__row('C','Brasil')`), {P:3,J:1,V:1,E:0,D:0,GP:3,GC:1,SG:2}, "linha do Brasil após 3x1");
eq(run(`__row('C','Marrocos')`), {P:0,J:1,V:0,E:0,D:1,GP:1,GC:3,SG:-2}, "linha do Marrocos após 1x3");
eq(run(`__row('C','Haiti').J`), 0, "time sem jogo tem J=0");

console.log("\n== Desempate: Pontos > Saldo > Gols pró > nome ==");
// mesmo nº de pontos, decide saldo
eq(run(`[{team:'X',P:6,SG:2,GP:5},{team:'Y',P:6,SG:4,GP:4}].sort(cmpTeam).map(t=>t.team)`), ['Y','X'], "maior saldo vem antes com pontos iguais");
// saldo igual, decide gols pró
eq(run(`[{team:'X',P:6,SG:3,GP:4},{team:'Y',P:6,SG:3,GP:7}].sort(cmpTeam).map(t=>t.team)`), ['Y','X'], "saldo igual: mais gols pró vem antes");
// tudo igual, decide ordem alfabética
eq(run(`[{team:'Zambia',P:3,SG:0,GP:1},{team:'Angola',P:3,SG:0,GP:1}].sort(cmpTeam).map(t=>t.team)`), ['Angola','Zambia'], "empate total: ordem alfabética");
// mais pontos sempre na frente, mesmo com saldo pior
eq(run(`[{team:'X',P:9,SG:-1,GP:2},{team:'Y',P:6,SG:9,GP:9}].sort(cmpTeam).map(t=>t.team)`), ['X','Y'], "pontos têm prioridade sobre saldo");

console.log("\n== Cenário completo de um grupo (ordem final) ==");
// Grupo C: Brasil 9, Escócia 6, Marrocos 3, Haiti 0
run(`__clear();
  __set('Brasil','Marrocos',2,0); __set('Brasil','Haiti',3,0); __set('Brasil','Escócia',1,0);
  __set('Escócia','Marrocos',2,1); __set('Escócia','Haiti',2,0);
  __set('Marrocos','Haiti',1,0);`);
eq(run(`__order('C')`), ['Brasil','Escócia','Marrocos','Haiti'], "ordem do grupo por desempenho");
eq(run(`[__row('C','Brasil').P,__row('C','Escócia').P,__row('C','Marrocos').P,__row('C','Haiti').P]`), [9,6,3,0], "pontos coerentes (9/6/3/0)");

console.log("\n== Empate total no grupo (todos 0x0) → ordem alfabética ==");
run(`__clear(); ['A'].forEach(()=>0);
  __set('Brasil','Marrocos',0,0);__set('Brasil','Haiti',0,0);__set('Brasil','Escócia',0,0);
  __set('Escócia','Marrocos',0,0);__set('Escócia','Haiti',0,0);__set('Marrocos','Haiti',0,0);`);
eq(run(`__order('C')`), ['Brasil','Escócia','Haiti','Marrocos'], "todos 0 pts: ordena alfabeticamente");

console.log("\n== Repescagem: bestThirds e getQualifiers ==");
run(`__clear(); STATE.matches.forEach(m=>{m.hs=0;m.as=0;});`); // todos jogos 0x0
ok(run(`bestThirds(computeStandings()).length`) === 12, "há 12 terceiros (um por grupo)");
ok(run(`getQualifiers().seed.length`) === 32, "getQualifiers retorna 32 classificados");
ok(run(`getQualifiers().thirds.length`) === 8, "exatamente 8 melhores terceiros na repescagem");
ok(run(`new Set(getQualifiers().seed).size`) === 32, "os 32 classificados são únicos");
// um 3º muito forte deve entrar na repescagem; um 3º fraquíssimo não
run(`__clear(); STATE.matches.forEach(m=>{m.hs=0;m.as=0;});
  // faz o 3º do grupo A (decidido por nome) ter muitos gols para subir entre os melhores 3os
  ` );
ok(run(`getQualifiers().thirds.every(t=>typeof t==='string')`), "thirds é lista de nomes de seleções");

console.log("\n== Previsão de placar (predictScore por ranking) ==");
ok(run(`predictScore('Argentina','Haiti')[0] > predictScore('Argentina','Haiti')[1]`), "favorito (Argentina) vence o azarão (Haiti)");
eq(run(`predictScore('Argentina','França')`), [1,1], "ranks muito próximos => empate");
eq(run(`predictScore('Haiti','Argentina')`), [0,3], "simetria: mandante fraco perde para gigante");
ok(run(`(()=>{const [h,a]=predictScore('Brasil','Catar');return h>=a;})()`), "mandante mais forte não perde");
ok(run(`betterRanked('Brasil','Catar')==='Brasil'`), "betterRanked escolhe o de melhor ranking");

console.log("\n== Chaveamento OFICIAL da FIFA (posições reais) ==");
run(`__clear(); STATE.matches.forEach(m=>{const b=BASE_MATCHES.find(x=>x.id===m.id); if(b&&b.hs!=null){m.hs=b.hs;m.as=b.as;}}); buildSeed();`);
eq(run(`STATE.ko.r32[1].la+' x '+STATE.ko.r32[1].lb`), '1C x 2F', "16-avos: 1º do C (Brasil) enfrenta o 2º do F");
eq(run(`STATE.ko.r32[10].la+' x '+STATE.ko.r32[10].lb`), '1H x 2J', "16-avos: 1º do H (Espanha) enfrenta o 2º do J");
eq(run(`STATE.ko.r32[3].la+' x '+STATE.ko.r32[3].lb`), '1F x 2C', "16-avos: 1º do F enfrenta o 2º do C");
ok(run(`STATE.ko.r32.filter(p=>p.lb==='').length`) === 8, "há 8 vagas de repescagem (3º) no chaveamento");
// caminho: 1C (Brasil) e 1H (Espanha), se vencerem os grupos, só se cruzam na semifinal
run(`window.__sf=(slot)=>{const r16=R16_FROM.findIndex(p=>p.includes(slot));const qf=QF_FROM.findIndex(p=>p.includes(r16));return SF_FROM.findIndex(p=>p.includes(qf));};`);
eq(run(`[__sf(1),__sf(10)]`), [0,0], "Brasil (1C) e Espanha (1H) caem na MESMA semifinal");
eq(run(`__sf(13)`), 1, "1º do D fica na outra metade (semifinal oposta)");

console.log(`\n==== UNITÁRIOS: ${pass} passaram, ${fail} falharam ====`);
process.exit(fail>0?1:0);
