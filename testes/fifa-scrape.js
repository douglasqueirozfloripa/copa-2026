// ============================================================
// fifa-scrape.js — captura os placares da FIFA com um NAVEGADOR REAL
// ------------------------------------------------------------
// Por que isto funciona (e o fetch do app file:// não):
//   - O Playwright abre um Chromium DE VERDADE, executa o JavaScript
//     da página da FIFA e lê o DOM já renderizado (onde os placares
//     aparecem). Não há restrição de CORS porque NÃO é uma página
//     file:// chamando outro domínio — é um navegador navegando.
//   - Comprovado: a página scores-fixtures renderiza cada partida em
//     <a href="/pt/match-centre/...">, com:
//        .match-row_team__y5Rva span.d-none.d-md-block  -> nomes dos times
//        .match-row_score__wfcQP                         -> placar (2 spans)
//        .match-row_statusLabel__AiSA3                   -> "FIM" / "90'+8'" etc.
//        .match-row_matchTime__9QJXJ                     -> horário (se não começou)
//
// Uso:
//   cd testes
//   npm install
//   npx playwright install chromium
//   node fifa-scrape.js                 # gera resultados-fifa.json
//   node fifa-scrape.js --aplicar       # também grava os placares no copa-2026.html
//
// Rode 1x por dia (cron/agendador) para manter o app atualizado.
// ============================================================
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const URL = "https://www.fifa.com/pt/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=BR&wtw-filter=ALL";
const OUT_JSON = path.join(__dirname, "resultados-fifa.json");
const HTML = path.join(__dirname, "..", "copa-2026.html");

async function scrape(){
  const browser = await chromium.launch();           // headless por padrão
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  // espera as linhas de jogo renderizarem (conteúdo vem via JS)
  await page.waitForSelector('a[href*="/match-centre/"]', { timeout: 30000 });

  const jogos = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('a[href*="/match-centre/"]')];
    return rows.map(a => {
      const names  = [...a.querySelectorAll('.match-row_team__y5Rva span.d-none.d-md-block')].map(s => s.textContent.trim());
      const scores = [...a.querySelectorAll('.match-row_score__wfcQP')].map(s => s.textContent.trim());
      const status = (a.querySelector('.match-row_statusLabel__AiSA3') || {}).textContent || "";
      const time   = (a.querySelector('.match-row_matchTime__9QJXJ')  || {}).textContent || "";
      const grp    = (a.querySelector('.match-row_bottomLabel__ni63b')|| {}).textContent || "";
      const idMatch = (a.getAttribute('href') || "").match(/\/(\d+)(?:\?|$)/);
      return {
        fifaId: idMatch ? idMatch[1] : null,
        home: names[0] || null, away: names[1] || null,
        hs: scores[0] != null ? Number(scores[0]) : null,
        as: scores[1] != null ? Number(scores[1]) : null,
        status: (status || time || "").trim(),
        fase: grp.trim(),
         aoVivo: /'|INT|Intervalo/.test(status),
        encerrado: status.trim() === "FIM",
      };
    }).filter(m => m.home && m.away);
  });

  await browser.close();
  return jogos;
}

(async () => {
  const jogos = await scrape();
  const finais = jogos.filter(j => j.encerrado);
  const aoVivo = jogos.filter(j => j.aoVivo);
  fs.writeFileSync(OUT_JSON, JSON.stringify({ capturadoEm: new Date().toISOString(), jogos }, null, 2));
  console.log(`✔ ${jogos.length} jogos lidos · ${finais.length} encerrados · ${aoVivo.length} ao vivo`);
  console.log(`✔ salvo em ${OUT_JSON}`);
  finais.slice(-5).forEach(j => console.log(`   ${j.home} ${j.hs}x${j.as} ${j.away}`));
  aoVivo.forEach(j => console.log(`   AO VIVO: ${j.home} ${j.hs}x${j.as} ${j.away} (${j.status})`));

  // --aplicar: grava os placares (por nome dos times) no BASE_MATCHES do copa-2026.html
  if (process.argv.includes("--aplicar")) {
    let html = fs.readFileSync(HTML, "utf8");
    const norm = s => (s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
    // apelidos: nome na FIFA -> nome usado no app
    const apelido = { "holanda":"países baixos", "ri do irã":"irã", "república da coreia":"coreia do sul", "türkiye":"turquia", "rd do congo":"rd congo", "grã bretanha":"inglaterra" };
    const eq = (a,b)=>{ a=norm(a); b=norm(b); a=norm(apelido[a]||a); return a===b || a===norm(b); };
    let aplicados = 0;
    for (const j of finais) {
      // localiza a linha m(<id>,..,"Home","Away",hs,as) e substitui os 2 últimos números
      const re = new RegExp('(m\\(\\d+\\s*,[^\\n]*?"' + j.home.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '"\\s*,\\s*"' + j.away.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '"\\s*,\\s*)(?:null|\\d+)(\\s*,\\s*)(?:null|\\d+)');
      if (re.test(html)) { html = html.replace(re, `$1${j.hs}$2${j.as}`); aplicados++; }
    }
    // sobe a versão dos dados (DATA_VERSION) para os placares prevalecerem no navegador
    html = html.replace(/(const DATA_VERSION\s*=\s*)(\d+)/, (m,p,v)=>p+(Number(v)+1));
    fs.writeFileSync(HTML, html);
    console.log(`✔ ${aplicados} placares aplicados no copa-2026.html (DATA_VERSION incrementada)`);
  }
})().catch(e => { console.error("ERRO:", e.message); process.exit(1); });
