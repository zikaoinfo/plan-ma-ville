import { defineConfig, devices } from '@playwright/test';

/**
 * Le lanceur (`npx`, `npm run`) préfixe le PATH avec tous les `node_modules/.bin`
 * ancêtres ; si l'un d'eux expose un binaire `node` trop vieux, c'est LUI qui
 * démarrerait `ng serve` — et le CLI ng22 refuse tout Node < 22.22.3.
 * On rend au serveur de dev un PATH sans ces répertoires.
 */
const PATH_SANS_BIN_LOCAUX = (process.env['PATH'] ?? '')
  .split(':')
  .filter((repertoire) => !repertoire.includes('node_modules/.bin'))
  .join(':');

/**
 * Vérification du rendu par manipulation du DOM (pas par capture d'écran) :
 * les tests lisent les valeurs calculées par le navigateur — tokens, contrastes,
 * anneau de focus, débordement — donc ils sont déterministes et rejouables en CI.
 *
 * Prérequis données : `npm run data:sample` (départements 69 et 75) au moins une fois,
 * sinon les pages commune n'ont rien à charger.
 */
const PORT = 4210;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: process.env['CI'] ? [['github'], ['list']] : [['list']],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },

  projects: [
    // Les tokens ne dépendent pas de la largeur : une seule passe suffit.
    {
      name: 'tokens',
      testMatch: /tokens\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    // a11y et débordement se jouent aux trois ruptures du design system.
    {
      name: 'large-360',
      testIgnore: /tokens\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } },
    },
    {
      name: 'large-920',
      testIgnore: /tokens\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 920, height: 900 } },
    },
    {
      name: 'large-1280',
      testIgnore: /tokens\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],

  webServer: {
    command: `node node_modules/@angular/cli/bin/ng.js serve --port ${PORT}`,
    env: { PATH: PATH_SANS_BIN_LOCAUX },
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
