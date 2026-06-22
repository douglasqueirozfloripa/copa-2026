// Testes E2E (Playwright) do app Copa 2026.
// Rodar: cd testes && npm install && npx playwright install chromium && npx playwright test
const { test, expect } = require('@playwright/test');

const getState = async (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('copa2026_state_v1') || 'null'));

// placar determinístico por id de jogo
function scoreFor(id){ return [(id*7)%5, (id*3)%4]; }

async function abrir(page){ await page.goto('/copa-2026.html'); await page.evaluate(()=>localStorage.clear()); await page.reload(); }

async function preencherTodos(page){
  await page.click('nav button[data-view="matches"]');
  const tp = page.locator('#toggle-past'); // expandir datas já realizadas (colapsadas por padrão)
  if (await tp.count()) await tp.click();
  const inputs = page.locator('#matches-body input.sc');
  const n = await inputs.count();
  for(let i=0;i<n;i++){
    const inp = inputs.nth(i);
    const id = Number(await inp.getAttribute('data-id'));
    const side = await inp.getAttribute('data-side');
    const [h,a] = scoreFor(id);
    await inp.fill(String(side==='hs'?h:a));
  }
}

test('A — classificação e repescagem (8 melhores terceiros)', async ({ page }) => {
  await abrir(page);
  await preencherTodos(page);
  await expect(page.locator('#matches-body input.sc')).toHaveCount(144);

  await page.click('nav button[data-view="standings"]');
  await expect(page.locator('#standings-body tbody tr')).toHaveCount(48);
  await expect(page.locator('#standings-body tr.q1')).toHaveCount(12); // 12 líderes
  await expect(page.locator('#standings-body tr.q2')).toHaveCount(12); // 12 vices
  await expect(page.locator('#standings-body tr.q3')).toHaveCount(8);  // repescagem: 8 terceiros

  // todos os times com 3 jogos
  const js = await page.locator('#standings-body tbody tr td:nth-child(2)').allTextContents();
  expect(js.every(v => v.trim() === '3')).toBeTruthy();

  // persistência
  const st = await getState(page);
  expect(st.matches.length).toBe(72);
  expect(st.matches.filter(m => m.hs !== null).length).toBe(72);
});

test('B — persistência entre recarregamentos', async ({ page }) => {
  await abrir(page);
  await preencherTodos(page);
  await page.reload();
  await page.click('nav button[data-view="standings"]');
  const js = await page.locator('#standings-body tbody tr td:nth-child(2)').allTextContents();
  expect(js.every(v => v.trim() === '3')).toBeTruthy();
});

test('C — simulador do mata-mata até a final e 3º lugar', async ({ page }) => {
  await abrir(page);
  await preencherTodos(page);

  await page.click('nav button[data-view="ko"]');
  await page.click('#ko-seed');

  await expect(page.locator('#bracket .round').first().locator('.tie')).toHaveCount(16);
  const st = await getState(page);
  const seed = st.ko.seed.filter(Boolean);
  expect(seed.length).toBe(32);
  expect(new Set(seed).size).toBe(32);
  // repescagem destacada: 8 melhores 3ºs marcados nos 16-avos
  await expect(page.locator('#bracket .round').first().locator('.slot.third-q')).toHaveCount(8);
  expect(st.ko.thirds.length).toBe(8);

  async function avancar(roundIdx, ties){
    for(let i=0;i<ties;i++){
      const tie = page.locator('#bracket .round').nth(roundIdx).locator('.tie').nth(i);
      await tie.locator('.slot:not(.empty)').first().click();
    }
  }
  await avancar(0,16); // 16-avos
  await avancar(1,8);  // oitavas
  await avancar(2,4);  // quartas
  await avancar(3,2);  // semis

  // 3º lugar
  await page.locator('#third-final .tie .slot:not(.empty)').first().click();
  // final
  await page.locator('#bracket .round').nth(4).locator('.tie .slot:not(.empty)').first().click();

  const champ = page.locator('#champion-box .champion .name');
  await expect(champ).toBeVisible();
  expect((await champ.textContent()).trim().length).toBeGreaterThan(0);

  const st2 = await getState(page);
  expect(seed).toContain(st2.ko.picks['final_0']);
});

test('E — toast com próximos 4 e últimos 4 jogos', async ({ page }) => {
  await abrir(page);
  await expect(page.locator('#toast-body .t-sec')).toHaveCount(2);
  await expect(page.locator('#toast-body .t-row')).toHaveCount(8);
  // minimizar e expandir
  await page.click('#toast-head');
  await expect(page.locator('#toast')).toHaveClass(/min/);
  await page.click('#toast-head');
  await expect(page.locator('#toast')).not.toHaveClass(/min/);
});

test('F — troca de idioma e RTL', async ({ page }) => {
  await abrir(page);
  await expect(page.locator('#lang-select option')).toHaveCount(18);
  await page.selectOption('#lang-select', 'en');
  await expect(page.locator('nav button[data-view="standings"]')).toContainText('Standings');
  await page.selectOption('#lang-select', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.selectOption('#lang-select', 'pt');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('G — Atualizar corrige dados antigos e existe na Classificação', async ({ page }) => {
  await page.goto('/copa-2026.html');
  // injeta um localStorage "antigo" (sem versão), com só 25 jogos preenchidos
  await page.evaluate(() => {
    const m = []; for (let id=1; id<=72; id++){ let hs=null,as=null; if(id<=24){hs=1;as=0;} if(id===33){hs=5;as=1;} m.push({id,hs,as}); }
    localStorage.setItem('copa2026_state_v1', JSON.stringify({ matches:m, ko:{} }));
  });
  await page.reload();
  const st = await getState(page);
  expect(st.matches.filter(m => m.hs !== null).length).toBe(41); // 40 finais + 1 ao vivo
  await expect(page.locator('#btn-atualizar-2')).toBeVisible();   // botão na Classificação
  await page.click('#btn-atualizar-2');
  await expect(page.locator('#modal-bg')).toHaveClass(/show/);
});

test('H — aba Ranking FIFA + Simular jogos restantes', async ({ page }) => {
  await abrir(page);
  await page.click('nav button[data-view="ranking"]');
  await expect(page.locator('#ranking-body tbody tr')).toHaveCount(48);
  await page.click('#btn-simular');
  const st = await getState(page);
  expect(st.matches.filter(m => m.hs !== null).length).toBe(72); // preencheu o que faltava
  expect(st.simIds.length).toBeGreaterThan(0);
  expect(st.ko.seed.length).toBe(32);
  expect(st.ko.picks['final_0']).toBeTruthy();              // mata-mata avançado até o campeão
  await expect(page.locator('#modal-bg')).toHaveClass(/show/);
  await page.click('#modal-ok');
  await page.click('nav button[data-view="matches"]');
  await expect(page.locator('#matches-body .sim-badge').first()).toBeVisible();
});

test('I — limpar o que ainda não aconteceu', async ({ page }) => {
  await abrir(page);
  await page.click('nav button[data-view="ranking"]');
  await page.click('#btn-simular');
  await page.click('#modal-ok');
  await page.click('#btn-clear-future');
  const st = await getState(page);
  expect(st.matches.filter(m => m.hs !== null).length).toBe(41); // 40 finais + 1 ao vivo
  expect(st.simIds.length).toBe(0);
  expect(st.ko.seed).toBeFalsy();
});

test('J — horários convertem conforme o fuso do idioma', async ({ page }) => {
  await abrir(page);
  await page.click('nav button[data-view="matches"]');
  await page.selectOption('#lang-select', 'pt');
  const tPt = (await page.locator('#matches-body .meta').first().innerText()).split('\n')[0];
  await page.selectOption('#lang-select', 'ja');
  const tJa = (await page.locator('#matches-body .meta').first().innerText()).split('\n')[0];
  expect(tPt).not.toBe(tJa);
});

test('K — gerar manual exige tudo preenchido + chaveamento oficial', async ({ page }) => {
  await abrir(page);
  await page.click('nav button[data-view="ko"]');
  await page.click('#ko-seed'); // incompleto -> bloqueia
  expect(await page.evaluate(() => !!STATE.ko.r32)).toBe(false);
  await expect(page.locator('#modal-bg')).toHaveClass(/show/);
  await page.click('#modal-ok');
  await page.evaluate(() => { STATE.matches.forEach(m => { if (m.hs === null) { m.hs = 1; m.as = 0; } }); saveState(); });
  await page.click('#ko-seed');
  const info = await page.evaluate(() => ({
    m74: STATE.ko.r32[1].la + ' x ' + STATE.ko.r32[1].lb,
    m83: STATE.ko.r32[10].la + ' x ' + STATE.ko.r32[10].lb,
    sameSF: (() => { const sf = s => { const r = R16_FROM.findIndex(p => p.includes(s)); const q = QF_FROM.findIndex(p => p.includes(r)); return SF_FROM.findIndex(p => p.includes(q)); }; return sf(1) === sf(10); })()
  }));
  expect(info.m74).toBe('1C x 2F');
  expect(info.m83).toBe('1H x 2J');
  expect(info.sameSF).toBe(true);
  // rótulos posicionais visíveis no 1º confronto dos 16-avos
  await expect(page.locator('#bracket .round').first().locator('.tie').nth(1).locator('.seed').first()).toHaveText('1C');
});

test('M — Simular mata-mata e clique manual avançam o chaveamento', async ({ page }) => {
  await abrir(page);
  await preencherTodos(page); // todos os jogos com placar
  await page.click('nav button[data-view="ko"]');
  await expect(page.locator('#ko-sim')).toBeDisabled();
  await page.click('#ko-seed');
  await expect(page.locator('#ko-sim')).toBeEnabled();
  // clique manual avança um confronto
  await page.locator('#bracket .round').first().locator('.tie').first().locator('.slot:not(.empty)').first().click();
  expect((await getState(page)).ko.picks['r32_0']).toBeTruthy();
  // simular o resto
  await page.click('#ko-sim');
  expect((await getState(page)).ko.picks['final_0']).toBeTruthy();
  await expect(page.locator('#champion-box .champion')).toBeVisible();
});

test('L — limpar tudo e restaurar dados oficiais da FIFA', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => { STATE.matches.forEach(m => { m.hs = null; m.as = null; }); saveState(); });
  expect((await getState(page)).matches.filter(m => m.hs !== null).length).toBe(0);
  await page.evaluate(() => refreshOfficial());
  const st = await getState(page);
  expect(st.matches.filter(m => m.hs !== null).length).toBe(41);
  // 2ª rodada (jogos encerrados, ids 25..40) completos
  expect(st.matches.filter(m => m.id >= 25 && m.id <= 40).every(m => m.hs !== null && m.as !== null)).toBe(true);
});

test('D — editar placar recalcula a classificação', async ({ page }) => {
  await abrir(page);
  await preencherTodos(page);
  await page.click('nav button[data-view="standings"]');
  const brAntes = await page.locator('#standings-body tr', { hasText: 'Brasil' }).locator('td.pts').textContent();

  await page.click('nav button[data-view="matches"]');
  await page.locator('#matches-body input.sc[data-id="6"][data-side="hs"]').fill('5');
  await page.locator('#matches-body input.sc[data-id="6"][data-side="as"]').fill('0');

  await page.click('nav button[data-view="standings"]');
  const brDepois = await page.locator('#standings-body tr', { hasText: 'Brasil' }).locator('td.pts').textContent();
  expect(Number(brDepois)).toBeGreaterThanOrEqual(Number(brAntes));
});
