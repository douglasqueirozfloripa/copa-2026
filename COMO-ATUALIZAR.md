# Atualizar os placares pelo botão (busca ao vivo na FIFA)

> ✅ **Jeito fácil (1 clique):** dê **dois cliques** em **`iniciar.command`** (Mac) ou **`iniciar.bat`**
> (Windows). Ele instala o que falta, **já faz a 1ª captura na FIFA**, aplica os placares e **abre o
> app no navegador padrão** sozinho — sem digitar nada. Deixe a janela aberta enquanto usa.
>
> ⚠️ **Jeito manual (ordem certa):** ligue o **atualizador (`node server.js`) ANTES** de abrir a
> página, e **acesse o app por `http://localhost:8787`** (não abra o `copa-2026.html` com duplo
> clique). É o servidor do crawler que serve a página E busca os placares na FIFA. Sem ele no ar,
> o botão "Atualizar" não consegue buscar ao vivo (cai nos resultados oficiais embutidos).
>
> Resumo manual: **1º** `node server.js` → **2º** abrir `http://localhost:8787` → **3º** clicar em "Atualizar".
>
> Obs.: ao abrir pelo servidor, o app **já auto-sincroniza** (aplica a última captura e segue o ao vivo
> a cada 30s). E o estado "ao vivo" agora é **100% dinâmico** — jogo encerrado (ex.: Argentina 2×0)
> **não volta** a aparecer ao vivo ao recarregar.

O botão **"Atualizar resultados"** do app dispara um crawler nos bastidores, mostra um
spinner de carregamento e, ao terminar, aplica os placares — inclusive jogos **ao vivo**,
mostrando o minuto e o placar capturados na faixa de cada jogo (atualizando sozinho a cada 30s).

Para isso funcionar, é preciso ter o **atualizador local** ligado (ele é quem abre a FIFA
num navegador de verdade — o app sozinho não consegue, por segurança do navegador/CORS).

## 1) Baixar o projeto do GitHub (só uma vez)

Repositório: **https://github.com/douglasqueirozfloripa/copa-2026**

**Opção A — sem instalar nada (ZIP):**
1. Abra o link acima no navegador.
2. Clique no botão verde **`Code`** → **`Download ZIP`**.
3. **Descompacte** o arquivo (no Windows: botão direito → "Extrair tudo"; no Mac: duplo clique).

**Opção B — com Git (se tiver instalado):**

```bash
git clone https://github.com/douglasqueirozfloripa/copa-2026.git
```

Pré-requisito (as duas opções): ter o **Node.js** instalado — baixe em https://nodejs.org (versão LTS).

## 2) Instalar as dependências (só uma vez)

Abra o **Terminal** (Mac) ou o **Prompt de Comando / PowerShell** (Windows) **dentro da pasta do projeto** e rode:

```bash
npm install playwright
npx playwright install chromium
```

> 💡 Dica para entrar na pasta certa: no **Mac**, digite `cd ` (com espaço) e arraste a pasta para o
> Terminal; no **Windows**, abra a pasta no Explorer, clique na barra de endereço, digite `cmd` e Enter.

## 3) Executar (no dia a dia)

### Jeito fácil — 1 clique

- **Mac:** dê **dois cliques** em **`iniciar.command`**.
  - (Se o Mac bloquear por ser de "desenvolvedor não identificado": botão direito → **Abrir** → **Abrir**.)
- **Windows:** dê **dois cliques** em **`iniciar.bat`**.

Ele instala o que falta, faz a 1ª captura na FIFA, aplica os placares e **abre o app no
navegador** sozinho. Deixe a janela aberta enquanto usa.

### Jeito manual — pelo terminal

1. Ligue o atualizador (na pasta do projeto):

   ```bash
   node server.js
   ```

   - **Mac:** Terminal · **Windows:** Prompt de Comando ou PowerShell.

2. Abra no navegador: **http://localhost:8787**

3. Clique em **"Atualizar resultados"**.
   - Aparece o **spinner** enquanto busca na FIFA.
   - Ao terminar, os placares são aplicados e a classificação recalculada.
   - Se houver **jogo ao vivo**, a faixa "🔴 AO VIVO" mostra o **minuto e o placar reais
     capturados** ("✅ Capturado da FIFA ao vivo") e segue atualizando sozinho a cada 30s
     até o jogo acabar.

Para desligar, feche a janela do Terminal (Mac) / do Prompt (Windows) ou pressione `Ctrl+C`.

## E se eu abrir o arquivo direto (sem o servidor)?

O app continua funcionando normalmente. Ao clicar em "Atualizar" sem o atualizador ligado,
ele aplica os **resultados oficiais embutidos** e avisa como ligar o atualizador para buscar
ao vivo. Nada quebra — o crawler ao vivo é um extra opcional.

## Como funciona (resumo técnico)

- `server.js` — servidor local (Node + Playwright). Serve o app e expõe `GET /scrape`,
  que abre o Chromium, lê a tabela de jogos da FIFA (DOM já renderizado) e devolve JSON.
- O botão do app faz `fetch("http://localhost:8787/scrape")`, casa os jogos pelo nome dos
  times (com mapa de apelidos FIFA→app) e atualiza placares + ao vivo.
- `testes/fifa-scrape.js` — versão de linha de comando do mesmo crawler (gera/aplica sem servidor).
