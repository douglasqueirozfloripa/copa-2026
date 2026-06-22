#!/bin/bash
# ============================================================
# iniciar.command — Mac: clique 2x para subir o app da Copa 2026.
# Faz: (1) instala dependências se faltarem, (2) sobe o server.js
# (que captura na FIFA, aplica os placares e abre o navegador).
# ============================================================
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js não encontrado. Instale em https://nodejs.org e tente de novo."
  read -r -p "Pressione Enter para fechar." _; exit 1
fi

# dependências (uma vez)
if [ ! -d node_modules/playwright ]; then
  echo "📦 Instalando dependências (primeira vez)…"
  npm install playwright || { echo "❌ Falha no npm install"; read -r -p "Enter para fechar." _; exit 1; }
fi
if [ ! -d node_modules/playwright-core/.local-browsers ] && [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
  echo "📦 Baixando o Chromium do Playwright (primeira vez)…"
  npx playwright install chromium
fi

echo "🚀 Subindo o atualizador… (deixe esta janela aberta enquanto usa o app)"
echo "   Para desligar: feche esta janela ou pressione Ctrl+C."
node server.js
