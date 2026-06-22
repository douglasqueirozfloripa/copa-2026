# Testes do app Copa 2026

Dois conjuntos de testes que exercitam o app de ponta a ponta: preenchem o placar dos 72 jogos, conferem a classificação e a **repescagem (8 melhores terceiros)**, validam a persistência (localStorage), simulam o mata-mata **até a final e a disputa de 3º lugar**, e ainda checam o **toast de próximos/últimos jogos** e a **troca de idioma (incl. RTL)**.

## 1) Testes rápidos (jsdom — só Node, sem navegador)

```bash
cd testes
npm install
npm run test:unit     # testes UNITÁRIOS da lógica (pontos, desempate, repescagem, previsão, chaveamento oficial)
npm run test:jsdom    # testes de fluxo/integração (classificação, simulador, toast, idiomas, fuso, etc.)
```

Esperado: `31 passaram` (unitários) e `106 passaram` (fluxo), `0 falharam`.

Os **unitários** (`unit.js`) cobrem vários cenários de resultados isoladamente: vitória/empate/derrota, gols e saldo, critérios de desempate (pontos → saldo → gols pró → ordem alfabética), grupo completo, empate geral, os 8 melhores terceiros, previsão de placar por ranking e o **chaveamento oficial da FIFA** (1C×2F, Brasil e Espanha na mesma semifinal).

## 2) Teste E2E completo (Playwright — navegador real)

```bash
cd testes
npm install
npx playwright install chromium
npm run test:e2e
```

Sobe um servidor local na pasta do app e roda os testes (A: classificação/repescagem, B: persistência, C: simulador até a final, D: recálculo ao editar placar, E: toast, F: idiomas, G: correção de dados antigos) no Chromium.

### Ver rodando (modo visual)

Para **assistir** o navegador preenchendo a fase de grupos e montando o mata-mata (16-avos → oitavas → quartas → semis → final):

```bash
cd testes
npm run test:e2e:ui        # melhor opção: abre o Playwright UI, dá pra avançar passo a passo e "voltar no tempo"
npm run test:e2e:headed    # roda com o navegador visível
npm run test:simulador     # roda só o teste do simulador (grupos + mata-mata), com navegador visível
```

No modo `--ui` você clica em cada teste e vê cada ação (preencher placar, clicar nos vencedores) acontecendo na tela, com screenshots de cada etapa.

> Observação: a suíte Playwright foi escrita aqui, mas executada de fato via jsdom no ambiente de desenvolvimento (o sandbox não tinha as bibliotecas de sistema para abrir o Chromium). Na sua máquina, o comando acima roda os mesmos cenários no navegador real.
