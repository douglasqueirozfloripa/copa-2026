const { defineConfig } = require('@playwright/test');

// Sobe um servidor estático na pasta do app (um nível acima) e roda os testes no Chromium.
module.exports = defineConfig({
  testDir: '.',
  timeout: 60000,
  use: { baseURL: 'http://localhost:8099' },
  webServer: {
    command: 'python3 -m http.server 8099 --directory ..',
    url: 'http://localhost:8099/copa-2026.html',
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
