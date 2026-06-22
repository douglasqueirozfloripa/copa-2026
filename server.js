// ============================================================
// server.js — ATUALIZADOR LOCAL do app Copa 2026
// ------------------------------------------------------------
// O botão "Atualizar" e a auto-sincronização do app chamam GET /scrape
// neste servidor. Ele abre um Chromium REAL (Playwright), lê os placares
// na página da FIFA e devolve JSON. Não há CORS porque é um navegador
// navegando — não é a página file:// chamando outro site.
//
// AO INICIAR (node server.js) ele:
//   1) faz a 1ª captura na FIFA,
//   2) aplica os placares no copa-2026.html (assim já abre atualizado),
//   3) sobe o servidor e ABRE o app no navegador padrão.
//
// Instalar (uma vez):
//   npm install playwright && npx playwright install chromium
// Rodar:
//   node server.js
// (Feche a janela do terminal para desligar o atualizador.)
// ============================================================
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const PORT = 8787;
const HTML = path.join(__dirname, "copa-2026.html");
const FIFA_URL = "https://www.fifa.com/pt/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=BR&wtw-filter=ALL";

// nomes da FIFA -> nomes usados no app (para casar os jogos ao aplicar no HTML)
const FIFA2APP = {
  "republica da coreia":"Coreia do Sul","tchequia":"República Tcheca","bosnia e herzegovina":"Bósnia-Herzegovina",
  "eua":"Estados Unidos","holanda":"Países Baixos","ri do ira":"Irã","turkiye":"Turquia","rd do congo":"RD Congo",
  "curacau":"Curaçao"
};
const norm = s => (s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();

let browser = null;
async function getBrowser(){ if(!browser) browser = await chromium.launch(); return browser; }

async function scrape(){
  const b = await getBrowser();
  const page = await b.newPage();
  try{
    await page.goto(FIFA_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('a[href*="/match-centre/"]', { timeout: 30000 });
    return await page.evaluate(() => {
      const rows = [...document.querySelectorAll('a[href*="/match-centre/"]')];
      return rows.map(a => {
        const names  = [...a.querySelectorAll('.match-row_team__y5Rva span.d-none.d-md-block')].map(s => s.textContent.trim());
        const scores = [...a.querySelectorAll('.match-row_score__wfcQP')].map(s => s.textContent.trim());
        const status = (a.querySelector('.match-row_statusLabel__AiSA3') || {}).textContent || "";
        const time   = (a.querySelector('.match-row_matchTime__9QJXJ')  || {}).textContent || "";
        const s = status.trim();
        return {
          home: names[0] || null, away: names[1] || null,
          hs: scores[0] != null && scores[0] !== "" ? Number(scores[0]) : null,
          as: scores[1] != null && scores[1] !== "" ? Number(scores[1]) : null,
          status: (s || time.trim()),
          encerrado: s === "FIM",
          aoVivo: /['’]|INT|Intervalo|HT/.test(s),
        };
      }).filter(m => m.home && m.away);
    });
  } finally { await page.close(); }
}

// grava no copa-2026.html os placares dos jogos ENCERRADOS (casando pelo nome dos times) e sobe DATA_VERSION
function applyToHtml(jogos){
  let html = fs.readFileSync(HTML, "utf8");
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let aplicados = 0;
  for (const j of jogos.filter(x => x.encerrado && x.hs!=null && x.as!=null)) {
    const home = FIFA2APP[norm(j.home)] || j.home;
    const away = FIFA2APP[norm(j.away)] || j.away;
    const re = new RegExp('(m\\(\\d+\\s*,[^\\n]*?"' + esc(home) + '"\\s*,\\s*"' + esc(away) + '"\\s*,\\s*)(?:null|\\d+)(\\s*,\\s*)(?:null|\\d+)');
    if (re.test(html)) { html = html.replace(re, `$1${j.hs}$2${j.as}`); aplicados++; }
  }
  html = html.replace(/(const DATA_VERSION\s*=\s*)(\d+)/, (m,p,v)=>p+(Number(v)+1));
  fs.writeFileSync(HTML, html);
  return aplicados;
}

function openBrowser(url){
  const cmd = process.platform === "darwin" ? "open"
            : process.platform === "win32"  ? "cmd"
            : "xdg-open";
  const args = process.platform === "win32" ? ["/c","start","",url] : [url];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch(e){}
}

http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = (req.url || "").split("?")[0];
  if (url === "/scrape") {
    try {
      const jogos = await scrape();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true, capturadoEm: new Date().toISOString(), jogos }));
      console.log(new Date().toLocaleTimeString(), "scrape:", jogos.length, "jogos,",
                  jogos.filter(j => j.encerrado).length, "encerrados,",
                  jogos.filter(j => j.aoVivo && !j.encerrado).length, "ao vivo");
    } catch (e) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, erro: e.message }));
      console.error("erro no scrape:", e.message);
    }
    return;
  }
  if (url === "/" || url === "/copa-2026.html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(fs.readFileSync(HTML));
    return;
  }
  res.statusCode = 404; res.end("not found");
}).listen(PORT, async () => {
  console.log("✔ Atualizador Copa 2026 iniciando…");
  // 1) primeira captura + 2) aplica no HTML, ANTES de abrir o navegador
  try {
    const jogos = await scrape();
    const n = applyToHtml(jogos);
    console.log(`✔ 1ª captura: ${jogos.length} jogos · ${jogos.filter(j=>j.encerrado).length} encerrados · ${jogos.filter(j=>j.aoVivo&&!j.encerrado).length} ao vivo · ${n} placares aplicados no HTML`);
  } catch (e) {
    console.error("⚠ não consegui capturar agora (sem internet/FIFA fora do ar?):", e.message, "— abrindo com os dados embutidos.");
  }
  // 3) abre o app no navegador padrão
  const url = "http://localhost:" + PORT;
  console.log("✔ Servidor no ar em " + url + " — abrindo no navegador padrão…");
  openBrowser(url);
});
