// ============================================================
// server.js — ATUALIZADOR LOCAL do app Copa 2026
// ------------------------------------------------------------
// O botão "Atualizar resultados" do app chama GET /scrape neste
// servidor. Ele abre um Chromium REAL (Playwright), lê os placares
// na página da FIFA e devolve JSON. Não há CORS porque é um
// navegador navegando — não é a página file:// chamando outro site.
//
// Como usar (uma vez):
//   cd "Aplicativo resultados jogos da copa 2026"
//   npm install playwright
//   npx playwright install chromium
//
// Para usar no dia a dia:
//   node server.js
//   abra no navegador:  http://localhost:8787
//   clique em "Atualizar resultados" -> spinner -> placares + ao vivo
//
// (Feche a janela do terminal para desligar o atualizador.)
// ============================================================
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PORT = 8787;
const HTML = path.join(__dirname, "copa-2026.html");
const FIFA_URL = "https://www.fifa.com/pt/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=BR&wtw-filter=ALL";

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

http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");   // permite chamar mesmo abrindo o app como arquivo
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
}).listen(PORT, () => {
  console.log("✔ Atualizador Copa 2026 rodando.");
  console.log("  Abra:  http://localhost:" + PORT);
  console.log("  O botão \"Atualizar resultados\" vai buscar os placares na FIFA por trás dos panos.");
});
