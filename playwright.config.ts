import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/visual',
    fullyParallel: false,
    retries: 0,
    reporter: [['list']],
    outputDir: 'storage/logs/playwright-results',
    use: {
        baseURL: process.env.VISUAL_BASE_URL ?? 'http://127.0.0.1:8000',
        browserName: 'chromium',
        locale: 'es-MX',
        timezoneId: 'America/Mexico_City',
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
