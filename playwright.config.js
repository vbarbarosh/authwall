require('dotenv/config');

const {defineConfig, devices} = require('@playwright/test');

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

// see https://playwright.dev/docs/test-configuration
module.exports = defineConfig({
    testDir: './tests/playwright',

    // Run tests in files in parallel
    fullyParallel: true,

    // Fail the build on CI if you accidentally left test.only in the source code
    forbidOnly: !!process.env.CI,

    // Retry on CI only
    retries: process.env.CI ? 2 : 0,

    // Opt out of parallel tests on CI.
    workers: process.env.CI ? 1 : undefined,

    // Reporter to use. See https://playwright.dev/docs/test-reporters
    reporter: 'html',

    // Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions
    use: {
        // Base URL to use in actions like `await page.goto('')`
        baseURL: 'http://localhost:3000',

        // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
        trace: 'on-first-retry',
    },

    // Configure projects for major browsers
    projects: [
        {
            name: 'chromium',
            use: {...devices['Desktop Chrome']},
        },

        {
            name: 'firefox',
            use: {...devices['Desktop Firefox']},
        },

        {
            name: 'webkit',
            use: {...devices['Desktop Safari']},
        },

        // Test against mobile viewports
        // {
        //   name: 'Mobile Chrome',
        //   use: { ...devices['Pixel 5'] },
        // },
        // {
        //   name: 'Mobile Safari',
        //   use: { ...devices['iPhone 12'] },
        // },

        // Test against branded browsers
        // {
        //   name: 'Microsoft Edge',
        //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
        // },
        // {
        //   name: 'Google Chrome',
        //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
        // },
    ],

    // Run your local dev server before starting the tests
    webServer: {
        command: 'node tests/playwright/start_server.js',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
            AUTHWALL_LOGGER: 'daily',
            AUTHWALL_PUBLIC_URL: 'http://localhost:3000',
            AUTHWALL_UPSTREAM_URL: 'http://127.0.0.1:38080',
            AUTHWALL_WEBSOCKETS: 'on',
            AUTHWALL_CONFIRM_EMAIL_REQUIRED: 'false',
            AUTHWALL_SENTRY_DSN: '',
            AUTHWALL_SECRET: require('crypto').randomBytes(32).toString('hex'),
            AUTHWALL_RATE_LIMITING: '0',
            AUTHWALL_MAILER: 'fake',
            AUTHWALL_FLOWS: 'username,email,magic_link_and_code,google,github,discord',
            AUTHWALL_SEED: 'foo:foo',
            AUTHWALL_GOOGLE_CLIENT_ID: 'playwright_google_client_id',
            AUTHWALL_GOOGLE_CLIENT_SECRET: 'playwright_google_client_secret',
            AUTHWALL_GOOGLE_REDIRECT_URL: 'http://localhost:3000/auth/google/callback',
            AUTHWALL_GITHUB_CLIENT_ID: 'playwright_github_client_id',
            AUTHWALL_GITHUB_CLIENT_SECRET: 'playwright_github_client_secret',
            AUTHWALL_GITHUB_REDIRECT_URL: 'http://localhost:3000/auth/github/callback',
            AUTHWALL_DISCORD_CLIENT_ID: 'playwright_discord_client_id',
            AUTHWALL_DISCORD_CLIENT_SECRET: 'playwright_discord_client_secret',
            AUTHWALL_DISCORD_REDIRECT_URL: 'http://localhost:3000/auth/discord/callback',
        },
    },
});
