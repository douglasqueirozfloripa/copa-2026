# Atualizar os placares pelo botão (busca ao vivo na FIFA)

> ⚠️ **IMPORTANTE — ordem certa:** ligue o **atualizador (`node server.js`) ANTES** de abrir a
> página, e **acesse o app por `http://localhost:8787`** (não abra o `copa-2026.html` com duplo
> clique). É o servidor do crawler que serve a página E busca os placares na FIFA. Sem ele no ar,
> o botão "Atualizar" não consegue buscar ao vivo (cai nos resultados oficiais embutidos).
>
> Resumo: **1º** `node server.js` → **2º** abrir `http://localhost:8787` → **3º** clicar em "Atualizar".

O botão **"Atualizar resultados"** do app dispara um crawler nos bastidores, mostra um
spinner de carregamento e, ao terminar, aplica os placares — inclusive jogos **ao vivo**,
mostrando o minuto e o placar capturados na faixa de cada jogo (atualizando sozinho a cada 30s).

Para isso funcionar, é preciso ter o **atualizador local** ligado (ele é quem abre a FIFA
num navegador de verdade — o app sozinho não consegue, por segurança do navegador/CORS).

## Instalar (só uma vez)

Abra o Terminal na pasta do projeto e rode:

```bash
cd "Aplicativo resultados jogos da copa 2026"
npm install playwright
npx playwright install chromium
```

## Usar no dia a dia

1. Ligue o atualizador:

   ```bash
   node server.js
   ```

2. Abra no navegador: **http://localhost:8787**

3. Clique em **"Atualizar resultados"**.
   - Aparece o **spinner** enquanto busca na FIFA.
   - Ao terminar, os placares são aplicados e a classificação recalculada.
   - Se houver **jogo ao vivo**, a faixa "🔴 AO VIVO" mostra o **minuto e o placar reais
     capturados** ("✅ Capturado da FIFA ao vivo") e segue atualizando sozinho a cada 30s
     até o jogo acabar.

Para desligar, feche a janela do Terminal.

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
