# Copa do Mundo 2026 — Resultados, Tabela e Simulador

Aplicativo web de página única para acompanhar e **simular** toda a Copa do Mundo FIFA 2026. Permite preencher o placar dos jogos, ver a classificação dos grupos calculada em tempo real e montar o mata-mata até a final, seguindo o chaveamento oficial da FIFA (formato de 48 seleções, 12 grupos).

O projeto inteiro é um único arquivo HTML autocontido ([`copa-2026.html`](copa-2026.html)) — sem dependências, sem build. Basta abrir no navegador. (Só o botão **"Atualizar"**, que busca os placares ao vivo da FIFA, precisa do atualizador local — veja [a seção abaixo](#-atualizar-os-placares-pela-fifa-botão-atualizar).)

## ✨ Funcionalidades

- **Fase de grupos completa** — 72 jogos distribuídos em 12 grupos de 4 seleções.
- **Classificação automática** com os critérios oficiais de desempate: pontos → saldo de gols → gols pró → ordem alfabética.
- **Repescagem dos 8 melhores terceiros** colocados, como no novo formato de 48 times.
- **Simulador de mata-mata** com chaveamento oficial da FIFA: 16-avos → oitavas → quartas → semifinais → **disputa de 3º lugar** e **final**.
- **Previsão de placar** por ranking quando o jogo ainda não foi preenchido.
- **Persistência local** — os resultados ficam salvos no `localStorage` do navegador, então nada se perde ao recarregar.
- **Toast de próximos/últimos jogos**, considerando o fuso horário.
- **Multi-idioma (i18n)** — português, inglês, espanhol, francês, alemão, italiano, árabe, persa e japonês, **com suporte a RTL** (árabe e persa).

## ⬇️ Baixar o projeto

Antes de qualquer coisa, é preciso ter o projeto na sua máquina:

- **Sem instalar nada:** abra **https://github.com/douglasqueirozfloripa/copa-2026** → botão verde **`Code`** → **`Download ZIP`** → descompacte.
- **Com Git:** `git clone https://github.com/douglasqueirozfloripa/copa-2026.git`

## 🚀 Como usar

Abra o arquivo [`copa-2026.html`](copa-2026.html) diretamente no navegador (duplo clique) — não precisa instalar nada.

Como alternativa, sirva a pasta com qualquer servidor estático, por exemplo:

```bash
npx serve .
# ou
python3 -m http.server 8000
```

E acesse `http://localhost:8000/copa-2026.html`.

## 🔄 Atualizar os placares pela FIFA (botão "Atualizar")

O uso normal **não precisa de servidor**. Mas o botão **"Atualizar"** busca os placares ao vivo direto da FIFA usando um crawler (Playwright) que roda por trás dos panos — e isso exige o **atualizador local** no ar. Requer **Node.js** instalado ([nodejs.org](https://nodejs.org), versão LTS).

### Jeito fácil (1 clique)

- **Mac:** dois cliques em [`iniciar.command`](iniciar.command) _(se bloquear: botão direito → Abrir → Abrir)_.
- **Windows:** dois cliques em [`iniciar.bat`](iniciar.bat).

Instala o que falta, captura na FIFA, aplica os placares e abre o app no navegador — sozinho.

### Jeito manual (terminal)

> ⚠️ **Ordem certa:** suba o atualizador **ANTES** de abrir a página e acesse o app por `http://localhost:8787` (não abra o `copa-2026.html` por duplo clique).

```bash
npm install                       # 1ª vez (instala o playwright)
npx playwright install chromium   # 1ª vez (baixa o navegador)
node server.js                    # sobe o atualizador + serve o app
```

> No **Mac** use o **Terminal**; no **Windows**, o **Prompt de Comando** ou **PowerShell** — sempre dentro da pasta do projeto.

Depois: **2º** abra `http://localhost:8787` → **3º** clique em **"Atualizar"**. Aparece um spin de carregamento enquanto o crawler lê a FIFA; ao terminar, os placares são aplicados (e jogos ao vivo aparecem em tempo real). Sem o servidor no ar, o botão usa os resultados oficiais embutidos.

Passo a passo completo em [`COMO-ATUALIZAR.md`](COMO-ATUALIZAR.md).

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
├── server.js           # atualizador local (Node + Playwright): serve o app e expõe /scrape
├── COMO-ATUALIZAR.md   # guia do botão "Atualizar" (crawler da FIFA)
└── testes/             # suíte de testes automatizados
    ├── unit.js             # testes unitários da lógica
    ├── run-jsdom.js        # testes de fluxo/integração via jsdom
    ├── copa.spec.js        # testes E2E (Playwright)
    ├── fifa-scrape.js      # crawler da FIFA por linha de comando
    └── playwright.config.js
```
