# Copa do Mundo 2026 — Resultados, Tabela e Simulador

Aplicativo web de página única para acompanhar e **simular** toda a Copa do Mundo FIFA 2026. Permite preencher o placar dos jogos, ver a classificação dos grupos calculada em tempo real e montar o mata-mata até a final, seguindo o chaveamento oficial da FIFA (formato de 48 seleções, 12 grupos).

O projeto inteiro é um único arquivo HTML autocontido ([`copa-2026.html`](copa-2026.html)) — sem dependências, sem build, sem servidor. Basta abrir no navegador.

## ✨ Funcionalidades

- **Fase de grupos completa** — 72 jogos distribuídos em 12 grupos de 4 seleções.
- **Classificação automática** com os critérios oficiais de desempate: pontos → saldo de gols → gols pró → ordem alfabética.
- **Repescagem dos 8 melhores terceiros** colocados, como no novo formato de 48 times.
- **Simulador de mata-mata** com chaveamento oficial da FIFA: 16-avos → oitavas → quartas → semifinais → **disputa de 3º lugar** e **final**.
- **Previsão de placar** por ranking quando o jogo ainda não foi preenchido.
- **Persistência local** — os resultados ficam salvos no `localStorage` do navegador, então nada se perde ao recarregar.
- **Toast de próximos/últimos jogos**, considerando o fuso horário.
- **Multi-idioma (i18n)** — português, inglês, espanhol, francês, alemão, italiano, árabe, persa e japonês, **com suporte a RTL** (árabe e persa).

## 🚀 Como usar

Abra o arquivo [`copa-2026.html`](copa-2026.html) diretamente no navegador (duplo clique) — não precisa instalar nada.

Como alternativa, sirva a pasta com qualquer servidor estático, por exemplo:

```bash
npx serve .
# ou
python3 -m http.server 8000
```

E acesse `http://localhost:8000/copa-2026.html`.

## 🧪 Testes

A pasta [`testes/`](testes/) contém uma suíte automatizada que exercita o app de ponta a ponta. São três níveis:

```bash
cd testes
npm install

npm run test:unit     # unitários da lógica (pontos, desempate, repescagem, previsão, chaveamento)
npm run test:jsdom    # fluxo/integração (classificação, simulador, toast, idiomas, fuso)
```

Para o **E2E em navegador real** com Playwright:

```bash
cd testes
npx playwright install chromium
npm run test:e2e            # roda os cenários no Chromium
npm run test:e2e:ui         # abre o Playwright UI (passo a passo, time-travel)
npm run test:e2e:headed     # navegador visível
```

Mais detalhes sobre cada cenário em [`testes/README.md`](testes/README.md).

## 🛠️ Stack

- **Frontend:** HTML + CSS + JavaScript puro (vanilla), em um único arquivo, sem frameworks nem build.
- **Persistência:** `localStorage`.
- **Testes:** [jsdom](https://github.com/jsdom/jsdom) (unit/integração) e [Playwright](https://playwright.dev/) (E2E).

## 📁 Estrutura

```
.
├── copa-2026.html      # o app inteiro (HTML + CSS + JS)
└── testes/             # suíte de testes automatizados
    ├── unit.js             # testes unitários da lógica
    ├── run-jsdom.js        # testes de fluxo/integração via jsdom
    ├── copa.spec.js        # testes E2E (Playwright)
    └── playwright.config.js
```
