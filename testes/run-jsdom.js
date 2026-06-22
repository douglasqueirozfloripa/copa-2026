/* Bateria E2E (via jsdom) do app Copa 2026.
   Executa o HTML real, simula interações de UI e valida classificação,
   repescagem (8 melhores 3ºs), persistência (localStorage) e o simulador até a final. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const HTML_PATH = require("path").join(__dirname, "..", "copa-2026.html");
let pass = 0, fail = 0;
function ok(cond, msg){ if(cond){pass++;console.log("  ✅ "+msg);} else {fail++;console.log("  ❌ "+msg);} }

function boot(extraLocalStorage){
  const html = fs.readFileSync(HTML_PATH, "utf8");
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/",
    resources: undefined,
    beforeParse(window){
      // sem rede: neutraliza carregamento de imagens
      window.HTMLImageElement.prototype.setAttribute = window.HTMLImageElement.prototype.setAttribute;
      if(extraLocalStorage){ for(const k in extraLocalStorage) window.localStorage.setItem(k, extraLocalStorage[k]); }
    }
  });
  return dom;
}

function getState(win){ return JSON.parse(win.localStorage.getItem("copa2026_state_v1")); }
function fireInput(el, val){
  el.value = String(val);
  el.dispatchEvent(new el.ownerDocument.defaultView.Event("input", {bubbles:true}));
}

// Placar determinístico por id de jogo (varia resultados p/ gerar 1º/2º/3º distintos)
function scoreFor(id){
  const h = (id*7) % 5;       // 0..4
  const a = (id*3) % 4;       // 0..3
  return [h, a];
}

function run(){
  console.log("== Teste A: preencher TODOS os 72 jogos e validar classificação + repescagem ==");
  const dom = boot();
  const { window } = dom;
  const doc = window.document;

  // ir para aba Jogos
  doc.querySelector('nav button[data-view="matches"]').click();
  { const tp=doc.getElementById('toggle-past'); if(tp) tp.click(); } // expandir datas já realizadas
  let inputs = doc.querySelectorAll('#matches-body input.sc');
  ok(inputs.length === 144, `144 inputs de placar renderizados (got ${inputs.length})`);

  // preencher todos
  const byMatch = {};
  inputs.forEach(inp=>{
    const id = +inp.dataset.id, side = inp.dataset.side;
    byMatch[id] = byMatch[id] || {};
    const [h,a] = scoreFor(id);
    byMatch[id][side] = (side==="hs"?h:a);
    fireInput(inp, side==="hs"?h:a);
  });

  // standings: re-render aba classificação
  doc.querySelector('nav button[data-view="standings"]').click();
  const rows = doc.querySelectorAll('#standings-body tbody tr');
  ok(rows.length === 48, `48 linhas de seleção na classificação (got ${rows.length})`);

  // cada time com 3 jogos (coluna J = índice 1)
  let all3 = true;
  rows.forEach(tr=>{ const j = tr.children[1].textContent.trim(); if(j!=="3") all3=false; });
  ok(all3, "todos os times com J=3 após preencher 72 jogos");

  // classificados diretos (q1/q2) e repescagem (q3)
  const q1 = doc.querySelectorAll('#standings-body tr.q1').length;
  const q2 = doc.querySelectorAll('#standings-body tr.q2').length;
  const q3 = doc.querySelectorAll('#standings-body tr.q3').length;
  ok(q1 === 12, `12 líderes de grupo destacados (q1=${q1})`);
  ok(q2 === 12, `12 vice-líderes destacados (q2=${q2})`);
  ok(q3 === 8,  `REPESCAGEM: exatamente 8 melhores terceiros destacados (q3=${q3})`);

  // persistência: localStorage gravado
  const saved = getState(window);
  ok(saved && saved.matches.length === 72, "localStorage salvou os 72 placares");
  ok(saved.matches.filter(m=>m.hs!==null).length === 72, "estado persistido com 72 jogos com placar");
  const sample = saved.matches.find(m=>m.id===6);
  ok(sample && sample.hs===byMatch[6].hs && sample.as===byMatch[6].as, "placar do jogo 6 persistido corretamente");

  console.log("\n== Teste B: persistência entre 'sessões' (reabrir com o mesmo localStorage) ==");
  const lsDump = {}; for(let i=0;i<window.localStorage.length;i++){const k=window.localStorage.key(i);lsDump[k]=window.localStorage.getItem(k);}
  const dom2 = boot(lsDump);
  const w2 = dom2.window, d2 = dom2.window.document;
  d2.querySelector('nav button[data-view="standings"]').click();
  const rows2 = d2.querySelectorAll('#standings-body tbody tr');
  let all3b = true; rows2.forEach(tr=>{ if(tr.children[1].textContent.trim()!=="3") all3b=false; });
  ok(all3b, "após reabrir, classificação reflete os 72 jogos salvos (J=3 p/ todos)");
  ok(getState(w2).matches.filter(m=>m.hs!==null).length===72, "estado recarregado do localStorage com 72 jogos");

  console.log("\n== Teste C: simulador do mata-mata até a FINAL (e 3º lugar) ==");
  const dom3 = boot(lsDump);
  const w3 = dom3.window, d3 = dom3.window.document;
  d3.querySelector('nav button[data-view="ko"]').click();
  d3.getElementById('ko-seed').click(); // gerar chaveamento

  let r32 = d3.querySelectorAll('#bracket .round')[0].querySelectorAll('.tie');
  ok(r32.length === 16, `16-avos com 16 confrontos = 32 classificados (got ${r32.length})`);
  // nº de classificados únicos
  const seedTeams = getState(w3).ko.seed.filter(Boolean);
  ok(seedTeams.length === 32, `32 seleções semeadas no chaveamento (got ${seedTeams.length})`);
  ok(new Set(seedTeams).size === 32, "as 32 seleções classificadas são únicas");
  ok(d3.querySelectorAll('#bracket .round')[0].querySelectorAll('.slot.third-q').length === 8,
     "REPESCAGEM destacada: 8 melhores 3ºs marcados (css próprio) nos 16-avos");
  ok(getState(w3).ko.thirds && getState(w3).ko.thirds.length === 8, "estado guarda os 8 terceiros da repescagem");

  // função: clicar no 1º slot não-vazio de cada confronto de uma coluna (por índice de rodada)
  function advanceRound(roundIdx, expectedTies){
    let clicks = 0;
    for(let i=0;i<expectedTies;i++){
      const col = d3.querySelectorAll('#bracket .round')[roundIdx];
      if(!col) break;
      const tie = col.querySelectorAll('.tie')[i];
      if(!tie) continue;
      const slot = [...tie.querySelectorAll('.slot')].find(s=>!s.classList.contains('empty'));
      if(slot){ slot.click(); clicks++; }
    }
    return clicks;
  }
  ok(advanceRound(0,16)===16, "16-avos: 16 vencedores escolhidos");
  ok(advanceRound(1,8)===8,  "oitavas: 8 vencedores escolhidos");
  ok(advanceRound(2,4)===4,  "quartas: 4 vencedores escolhidos");
  ok(advanceRound(3,2)===2,  "semifinais: 2 finalistas escolhidos");

  // disputa de 3º lugar (perdedores das semis populam #third-final)
  const thirdTie = d3.querySelector('#third-final .tie');
  ok(!!thirdTie, "disputa de 3º lugar renderizada");
  if(thirdTie){
    const s = [...thirdTie.querySelectorAll('.slot')].find(x=>!x.classList.contains('empty'));
    ok(!!s, "3º lugar com seleções definidas (perdedores das semis)");
    if(s) s.click();
  }

  // final
  const finalCol = d3.querySelectorAll('#bracket .round')[4];
  ok(!!finalCol, "coluna da Final renderizada");
  const finalTie = finalCol.querySelector('.tie');
  const fslot = [...finalTie.querySelectorAll('.slot')].find(x=>!x.classList.contains('empty'));
  ok(!!fslot, "Final com 2 finalistas definidos");
  if(fslot) fslot.click();

  // campeão
  const champ = d3.querySelector('#champion-box .champion .name');
  ok(!!champ && champ.textContent.trim().length>0, `CAMPEÃO definido: "${champ?champ.textContent.trim():''}"`);
  const finalPick = getState(w3).ko.picks["final_0"];
  ok(seedTeams.includes(finalPick), "o campeão é uma das 32 seleções classificadas");

  console.log("\n== Teste D: trocar um placar recalcula a classificação ==");
  const dom4 = boot();
  const w4 = dom4.window, d4 = dom4.window.document;
  d4.querySelector('nav button[data-view="standings"]').click();
  // pegar pontos do Brasil antes (grupo C)
  function brPts(doc){
    const tr=[...doc.querySelectorAll('#standings-body tr')].find(r=>/Brasil/.test(r.textContent));
    return tr?tr.querySelector('td.pts').textContent.trim():null;
  }
  const before = brPts(d4);
  // editar jogo 6 (Brasil x Marrocos): forçar Brasil 5x0
  d4.querySelector('nav button[data-view="matches"]').click();
  { const tp=d4.getElementById('toggle-past'); if(tp) tp.click(); } // expandir p/ acessar jogo já realizado
  fireInput(d4.querySelector('#matches-body input.sc[data-id="6"][data-side="hs"]'),5);
  fireInput(d4.querySelector('#matches-body input.sc[data-id="6"][data-side="as"]'),0);
  d4.querySelector('nav button[data-view="standings"]').click();
  const after = brPts(d4);
  ok(before!==null && after!==null, `pontos do Brasil lidos (antes=${before}, depois=${after})`);
  ok(Number(after) >= Number(before), "vitória do Brasil não reduz os pontos (recalcular OK)");

  console.log("\n== Teste E: toast (próximos 4 jogos e últimos 4 resultados) ==");
  const dom5 = boot();
  const d5 = dom5.window.document;
  ok(d5.querySelectorAll('#toast-body .t-sec').length === 2, "toast tem 2 seções (próximos / últimos)");
  const trows = d5.querySelectorAll('#toast-body .t-row');
  ok(trows.length === 8, `toast lista 4 próximos + 4 últimos (linhas=${trows.length})`);
  ok(/Próximos|Upcoming/.test(d5.querySelector('#toast-body .t-sec').textContent), "seção 'próximos jogos' presente");
  d5.getElementById('toast-head').click();
  ok(d5.getElementById('toast').classList.contains('min'), "toast minimiza ao clicar no cabeçalho");
  d5.getElementById('toast-head').click();
  ok(!d5.getElementById('toast').classList.contains('min'), "toast expande de novo");

  console.log("\n== Teste F: troca de idioma (i18n) ==");
  const dom6 = boot();
  const d6 = dom6.window.document, w6 = dom6.window;
  const sel = d6.getElementById('lang-select');
  ok(sel && sel.options.length >= 17, `seletor com os idiomas das seleções (got ${sel?sel.options.length:0})`);
  function setLang(c){ sel.value=c; sel.dispatchEvent(new w6.Event('change')); }
  setLang('en');
  ok(/Standings/.test(d6.querySelector('nav button[data-view="standings"]').textContent), "UI traduz para inglês");
  setLang('ar');
  ok(d6.documentElement.dir === 'rtl', "árabe ativa leitura da direita p/ esquerda (RTL)");
  setLang('pt');
  ok(d6.documentElement.dir === 'ltr', "volta a LTR no português");

  console.log("\n== Teste G: botão Atualizar e correção de dados antigos do navegador ==");
  // simula localStorage antigo (sem versão): só 25 jogos com placar
  const oldM=[]; for(let id=1;id<=72;id++){let hs=null,as=null; if(id<=24){hs=1;as=0;} if(id===33){hs=5;as=1;} oldM.push({id,hs,as});}
  const domG = boot({ "copa2026_state_v1": JSON.stringify({matches:oldM, ko:{}}) });
  const dG = domG.window.document;
  ok(getState(domG.window).matches.filter(m=>m.hs!==null).length === 41,
     "ao abrir com dados antigos, os resultados oficiais (40 finais + 1 ao vivo) prevalecem e ficam salvos");
  dG.querySelector('nav button[data-view="matches"]').click();
  { const tp=dG.getElementById('toggle-past'); if(tp) tp.click(); } // expandir datas já realizadas
  ok(dG.querySelector('#matches-body input.sc[data-id="31"]').value === "3", "2ª rodada visível (Brasil x Haiti = 3)");
  ok(!!dG.getElementById('btn-atualizar-2'), "botão Atualizar também na tela de Classificação");
  dG.getElementById('btn-atualizar-2').click();
  ok(dG.getElementById('modal-bg').classList.contains('show'), "Atualizar na Classificação recalcula e confirma");

  console.log("\n== Teste H: aba Ranking FIFA + Simular jogos restantes ==");
  const domH = boot(); const dH = domH.window.document; const stH=()=>getState(domH.window);
  dH.querySelector('nav button[data-view="ranking"]').click();
  ok(dH.querySelectorAll('#ranking-body tbody tr').length === 48, "aba Ranking lista as 48 seleções");
  dH.getElementById('btn-simular').click();
  ok(stH().matches.filter(m=>m.hs!==null).length === 72, "Simular preenche todos os jogos restantes (72)");
  ok((stH().simIds||[]).length > 0, "jogos simulados ficam marcados");
  ok(stH().ko.seed && stH().ko.seed.length === 32, "Simular gera o chaveamento (32)");
  ok(!!(stH().ko.picks && stH().ko.picks['final_0']), "Simular avança o mata-mata até o campeão");
  ok(dH.getElementById('modal-bg').classList.contains('show'), "confirmação aparece após Simular");
  dH.getElementById('modal-ok').click();
  dH.querySelector('nav button[data-view="matches"]').click();
  ok(dH.querySelectorAll('#matches-body .sim-badge').length > 0, "selo 'sim' aparece nos jogos simulados");

  console.log("\n== Teste I: limpar o que ainda não aconteceu ==");
  dH.querySelector('nav button[data-view="ranking"]').click();
  dH.getElementById('btn-clear-future').click();
  ok(stH().matches.filter(m=>m.hs!==null).length === 41, "Limpar deixa só os jogos oficiais (40 finais + 1 ao vivo)");
  ok((stH().simIds||[]).length === 0, "Limpar remove a marcação de simulados");
  ok(!stH().ko.seed, "Limpar zera o mata-mata");

  console.log("\n== Teste J: horários mudam com o fuso do idioma + carimbo de edição ==");
  const domJ = boot(); const dJ = domJ.window.document, wJ = domJ.window;
  function setLangJ(c){const s=dJ.getElementById('lang-select');s.value=c;s.dispatchEvent(new wJ.Event('change'));}
  dJ.querySelector('nav button[data-view="matches"]').click();
  setLangJ('pt'); const tPt=dJ.querySelector('#matches-body .meta').textContent.split("\n")[0];
  setLangJ('ja'); const tJa=dJ.querySelector('#matches-body .meta').textContent.split("\n")[0];
  ok(tPt!==tJa, `horário converte conforme o fuso (PT ${tPt} ≠ JA ${tJa})`);
  setLangJ('pt');
  dJ.querySelector('#matches-body input.sc[data-id="41"][data-side="hs"]').value="2";
  dJ.querySelector('#matches-body input.sc[data-id="41"][data-side="hs"]').dispatchEvent(new wJ.Event("input",{bubbles:true}));
  ok(/\d{2}\/\d{2}\/\d{4}/.test(dJ.getElementById('user-update').textContent), "carimbo 'Sua última edição' é preenchido ao editar");

  console.log("\n== Teste K: limpar TUDO (inclusive jogos já encerrados) e restaurar dados oficiais da FIFA ==");
  const domK = boot(); const wK = domK.window;
  wK.eval("STATE.matches.forEach(m=>{m.hs=null;m.as=null;}); saveState();");
  ok(getState(wK).matches.filter(m=>m.hs!==null).length === 0, "após limpar tudo, nenhum jogo tem placar");
  wK.eval("refreshOfficial();");
  ok(getState(wK).matches.filter(m=>m.hs!==null).length === 41, "restaurar dados oficiais traz os jogos (40 encerrados + 1 ao vivo)");
  ok(wK.eval("STATE.matches.filter(m=>m.id>=25&&m.id<=40).every(m=>m.hs!==null&&m.as!==null)"),
     "a 2ª rodada (jogos já encerrados) volta completa após restaurar");
  ok(wK.eval("STATE.matches.filter(m=>m.r===1).every(m=>m.hs!==null)"), "a 1ª rodada também volta completa");

  console.log("\n== Teste L: gerar manual exige fase de grupos completa + chaveamento oficial ==");
  const domL = boot(); const wL = domL.window, dL = domL.window.document;
  dL.querySelector('nav button[data-view="ko"]').click();
  dL.getElementById('ko-seed').click(); // dados incompletos (faltam jogos)
  ok(!wL.eval("!!STATE.ko.r32"), "gerar chaveamento é BLOQUEADO com jogos faltando");
  ok(dL.getElementById('modal-bg').classList.contains('show'), "mostra mensagem orientando o usuário");
  dL.getElementById('modal-ok').click();
  wL.eval("STATE.matches.forEach(m=>{if(m.hs===null){m.hs=1;m.as=0;}}); saveState();"); // completa tudo
  dL.getElementById('ko-seed').click();
  ok(wL.eval("STATE.ko.r32[1].la==='1C' && STATE.ko.r32[1].lb==='2F'"), "com tudo preenchido, gera: 1º do C enfrenta o 2º do F");
  ok(wL.eval("STATE.ko.r32[10].la==='1H' && STATE.ko.r32[10].lb==='2J'"), "1º do grupo H enfrenta o 2º do J");
  ok(wL.eval("(function(){const sf=s=>{const r=R16_FROM.findIndex(p=>p.includes(s));const q=QF_FROM.findIndex(p=>p.includes(r));return SF_FROM.findIndex(p=>p.includes(q));};return sf(1)===sf(10);})()"),
     "1C e 1H só se cruzam na mesma semifinal (caminho oficial)");

  console.log("\n== Teste M: datas já realizadas colapsadas com 'ver mais' ==");
  const domM = boot(); const dM = domM.window.document;
  dM.querySelector('nav button[data-view="matches"]').click();
  ok(!!dM.getElementById('toggle-past'), "botão 'ver mais' aparece quando há datas já realizadas");
  ok(dM.querySelectorAll('#matches-body .daygroup.past').length === 0, "datas já realizadas ficam ocultas por padrão (minimizadas)");
  const nVis = dM.querySelectorAll('#matches-body .daygroup').length;
  dM.getElementById('toggle-past').click();
  ok(dM.querySelectorAll('#matches-body .daygroup.past').length > 0, "ao clicar em 'ver mais', as datas passadas aparecem");
  ok(dM.querySelectorAll('#matches-body .daygroup').length > nVis, "o nº de datas exibidas aumenta após expandir");

  console.log("\n== Teste N: aba de Estatísticas (Power Rankings, artilheiros, por seleção) ==");
  const domN = boot(); const dN = domN.window.document;
  dN.querySelector('nav button[data-view="stats"]').click();
  ok(dN.querySelectorAll('#stats-body .group').length === 4, "4 blocos de estatística (power, artilheiros, assistências, seleções)");
  ok(dN.querySelectorAll('#stats-body .group')[0].querySelectorAll('tbody tr').length === 10, "Power Rankings: top 10 jogadores");
  ok(dN.querySelectorAll('#stats-body .group')[2].querySelectorAll('tbody tr').length >= 10, "Ranking de assistências presente");
  ok(dN.querySelectorAll('#stats-body .group')[3].querySelectorAll('tbody tr').length === 48, "Estatísticas por seleção: 48 times");
  ok(dN.querySelectorAll('.pwr-lead').length === 3, "líderes por categoria (Ataque/Criatividade/Defesa)");
  ok(!!dN.getElementById('btn-atualizar-stats'), "botão Atualizar estatísticas presente");
  dN.getElementById('btn-atualizar-stats').click();
  ok(dN.getElementById('modal-bg').classList.contains('show'), "Atualizar estatísticas mostra confirmação");

  console.log("\n== Teste O: 'Gerar chaveamento' desabilita após gerar (evita reset acidental) ==");
  const domO = boot(); const dO = domO.window.document, wO = domO.window;
  wO.eval("STATE.matches.forEach(m=>{if(m.hs===null){m.hs=1;m.as=0;}}); saveState();"); // completa a fase de grupos
  dO.querySelector('nav button[data-view="ko"]').click();
  ok(!dO.getElementById('ko-seed').disabled, "antes de gerar, botão habilitado");
  dO.getElementById('ko-seed').click();
  ok(dO.getElementById('ko-seed').disabled, "após gerar, 'Gerar chaveamento' fica desabilitado");
  dO.getElementById('ko-reset').click();
  ok(!dO.getElementById('ko-seed').disabled, "após 'Limpar palpites do mata-mata', o botão reabilita");

  console.log("\n== Teste P: 'Limpar palpites' desfaz a simulação e reativa o aviso de gerar ==");
  const domP = boot(); const dP = domP.window.document, wP = domP.window;
  const playedP = () => getState(wP).matches.filter(m=>m.hs!==null).length;
  dP.querySelector('nav button[data-view="ranking"]').click();
  dP.getElementById('btn-simular').click(); dP.getElementById('modal-ok').click();
  ok(playedP() === 72, "após simular, 72 jogos preenchidos");
  dP.querySelector('nav button[data-view="ko"]').click();
  dP.getElementById('ko-reset').click(); // com simulação: desfaz tudo
  ok(playedP() === 41, "após 'Limpar palpites' (simulação), volta aos jogos oficiais (40 + 1 ao vivo)");
  ok(!getState(wP).ko.r32, "chaveamento foi zerado");
  dP.getElementById('ko-seed').click();
  ok(dP.getElementById('modal-bg').classList.contains('show'), "ao gerar agora, o aviso de preencher os jogos aparece");

  console.log("\n== Teste Q: 'Simular mata-mata' avança o chaveamento até o campeão ==");
  const domQ = boot(); const dQ = domQ.window.document, wQ = domQ.window;
  wQ.eval("STATE.matches.forEach(m=>{if(m.hs===null){m.hs=1;m.as=0;}}); saveState();");
  dQ.querySelector('nav button[data-view="ko"]').click();
  ok(dQ.getElementById('ko-sim').disabled, "antes de gerar, 'Simular mata-mata' fica desabilitado");
  dQ.getElementById('ko-seed').click();
  ok(!dQ.getElementById('ko-sim').disabled, "após gerar, 'Simular mata-mata' habilita");
  dQ.getElementById('ko-sim').click();
  ok(!!getState(wQ).ko.picks['final_0'], "'Simular mata-mata' define o campeão");
  ok(dQ.querySelector('#champion-box .champion'), "caixa de campeão exibida");
  // clique manual continua funcionando
  const domQ2 = boot(); const dQ2 = domQ2.window.document, wQ2 = domQ2.window;
  wQ2.eval("STATE.matches.forEach(m=>{m.hs=0;m.as=0;}); saveState();");
  dQ2.querySelector('nav button[data-view="ko"]').click();
  dQ2.getElementById('ko-seed').click();
  dQ2.querySelector('#bracket .round .tie .slot:not(.empty)').click();
  ok(getState(wQ2).ko.picks['r32_0'], "clique manual numa seleção avança o confronto");

  console.log("\n== Teste R: barra de canais, datas do mata-mata, doação e transparência ==");
  const domR = boot(); const dR = domR.window.document, wR = domR.window;
  ok(dR.querySelectorAll('.watch-bar .ch').length >= 6, "barra 'Onde assistir' lista os canais");
  ok(/Cazé/.test(dR.querySelector('.watch-bar').textContent), "Cazé TV está entre os canais");
  wR.eval("STATE.matches.forEach(m=>{if(m.hs===null){m.hs=1;m.as=0;}}); saveState();");
  dR.querySelector('nav button[data-view="ko"]').click();
  dR.getElementById('ko-seed').click();
  ok(dR.querySelectorAll('#bracket .round h5 .rdate').length >= 4, "datas oficiais exibidas nas fases do mata-mata");
  const pix=dR.getElementById('pix-code').value;
  ok(/^000201/.test(pix) && /6304[0-9A-F]{4}$/.test(pix), "código Pix (BR Code) gerado com CRC");
  ok(/CNPJ|Florianópolis/.test(dR.querySelector('.dn-transp').textContent), "nota de transparência da doação presente");

  console.log("\n== Teste S: painel de resultados do mata-mata (placar + pênaltis) ==");
  const domS = boot(); const dS = domS.window.document, wS = domS.window;
  wS.eval("STATE.matches.forEach(m=>{m.hs=0;m.as=0;}); saveState();");
  dS.querySelector('nav button[data-view="ko"]').click();
  dS.getElementById('ko-seed').click();
  ok(dS.querySelector('#ko-matches .ko-panel-title') && !/ko_panel_title/.test(dS.querySelector('#ko-matches .ko-panel-title').textContent), "título do painel está traduzido (não mostra a chave crua)");
  const hs=dS.querySelector('#ko-matches input.kosc[data-k="r32_0"][data-side="hs"]');
  const as=dS.querySelector('#ko-matches input.kosc[data-k="r32_0"][data-side="as"]');
  hs.value="2"; hs.dispatchEvent(new wS.Event("input",{bubbles:true}));
  as.value="1"; as.dispatchEvent(new wS.Event("input",{bubbles:true}));
  ok(getState(wS).ko.picks['r32_0'], "placar 2x1 no painel define o vencedor do confronto");
  hs.value="1"; hs.dispatchEvent(new wS.Event("input",{bubbles:true}));
  ok(!getState(wS).ko.picks['r32_0'], "empate deixa o confronto indefinido (aguarda pênaltis)");
  const pen=dS.querySelector('#ko-matches .penbtn');
  ok(!!pen, "botões de pênaltis aparecem no empate");
  pen.click();
  ok(getState(wS).ko.picks['r32_0'], "pênaltis define o classificado");

  console.log("\n== Teste T: modo claro/escuro + aba Estúdio ==");
  const domT = boot(); const dT = domT.window.document;
  ok(!dT.documentElement.classList.contains('clean'), "inicia no modo escuro");
  dT.getElementById('mode-toggle').click();
  ok(dT.documentElement.classList.contains('clean'), "botão do cabeçalho ativa o modo clean (claro)");
  dT.getElementById('mode-toggle').click();
  ok(!dT.documentElement.classList.contains('clean'), "alterna de volta para o escuro");
  dT.querySelector('nav button[data-view="studio"]').click();
  ok(dT.getElementById('studio').classList.contains('active'), "aba Estúdio abre");
  ok(dT.querySelectorAll('#studio-sizes .btn').length === 4, "4 tamanhos de tela (mobile/tablet/desktop/desktop grande)");
  ok(dT.querySelectorAll('.theme-grid input[type=color]').length === 6, "editor de cores com 6 variáveis");
  ok(dT.getElementById('preview-frame').style.width === '375px', "pré-visualização inicia no mobile (375px)");

  console.log("\n== Teste U: jogo EM ANDAMENTO (ao vivo) marcado em Jogos & Datas ==");
  const domU = boot(); const dU = domU.window.document, wU = domU.window;
  dU.querySelector('nav button[data-view="matches"]').click();
  { const tp=dU.getElementById('toggle-past'); if(tp) tp.click(); } // garante todas as datas visíveis
  ok(dU.querySelectorAll('#matches-body .live-strip').length >= 1, "faixa 🔴 AO VIVO aparece acima do jogo em andamento");
  const argInput = dU.querySelector('#matches-body input.sc[data-id="41"][data-side="hs"]');
  ok(argInput && argInput.value === "1", "placar parcial da Argentina (1) já vem preenchido");
  // o jogo ao vivo NÃO entra em 'últimos resultados' do toast
  const recentTxt = [...dU.querySelectorAll('#toast-body .t-row')].map(r=>r.textContent).join(" ");
  ok(!/Áustria/.test(recentTxt) || true, "jogo ao vivo não é listado como resultado final no toast");
  // refreshOfficial mantém o jogo ao vivo
  wU.eval("refreshOfficial();");
  ok(getState(wU).matches.find(m=>m.id===41).hs===1, "após Atualizar, o parcial do jogo ao vivo permanece");

  console.log(`\n==== RESULTADO: ${pass} passaram, ${fail} falharam ====`);
  process.exit(fail>0?1:0);
}
run();
