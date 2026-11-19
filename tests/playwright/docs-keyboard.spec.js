const {test, expect} = require('@playwright/test');

// The docs work from the keyboard (AW-34): a character typed outside a field
// starts a search (UIM-11), and every other key does what the browser does
// with it.
const DOCS = 'http://127.0.0.1:3100';

const modes = [
    {name: 'classic', url: `${DOCS}/config.html`, link: '.sidebar a[href="cli.html"]', opened: /\/cli\.html$/},
    {name: 'single-page', url: `${DOCS}/single/index.html`, link: '.sidebar a[href="#cli"]', opened: /\/single\/index\.html#cli$/},
];

for (const mode of modes) {
    test.describe(`docs from the keyboard (${mode.name})`, function () {

        test.beforeEach(async function ({page}) {
            // Mermaid renders from a CDN after load and re-flows the page;
            // its source stays on the page when the import fails.
            await page.route('https://cdn.jsdelivr.net/**', v => v.abort());
            await page.goto(mode.url);
        });

        test('Enter and Space on the theme switch change the theme', async function ({page}) {
            const html = page.locator('html');
            const theme = await html.getAttribute('data-theme');
            const other = (theme === 'dark') ? 'light' : 'dark';
            await page.focus('.theme-toggle');
            await page.keyboard.press('Enter');
            await expect(html).toHaveAttribute('data-theme', other);
            await expect(page.locator('.theme-toggle')).toBeFocused();
            await page.keyboard.press('Space');
            await expect(html).toHaveAttribute('data-theme', theme);
        });

        test('Enter on a sidebar link opens it', async function ({page}) {
            await page.focus(mode.link);
            await page.keyboard.press('Enter');
            await expect(page).toHaveURL(mode.opened);
        });

        test('Enter on Copy copies the code', async function ({page}) {
            await page.evaluate(clipboard_stub);
            const block = page.locator('.code-block').first();
            const code = await block.locator('pre').textContent();
            await block.locator('.code-copy').focus();
            await page.keyboard.press('Enter');
            await expect(block.locator('.code-copy')).toHaveText('Copied');
            expect(await page.evaluate(() => window.copied_text)).toBe(code);
        });

        test('Shift+Tab goes back, not into the search', async function ({page}) {
            await page.focus('.mode-link');
            await page.keyboard.press('Tab');
            await expect(page.locator('.theme-toggle')).toBeFocused();
            await page.keyboard.press('Shift+Tab');
            await expect(page.locator('.mode-link')).toBeFocused();
        });

        test('Space, the arrows and End scroll the page', async function ({page}) {
            for (const key of ['Space', 'ArrowDown', 'End']) {
                const y = await page.evaluate(() => window.scrollY);
                await page.keyboard.press(key);
                await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y);
            }
            await expect(page.locator('.search-input')).not.toBeFocused();
            await expect(page.locator('.search-input')).toHaveValue('');
        });

        test('a character typed on a link starts a search with it', async function ({page}) {
            await page.focus(mode.link);
            await page.keyboard.press('Shift+S');
            await expect(page.locator('.search-input')).toBeFocused();
            await expect(page.locator('.search-input')).toHaveValue('S');
        });

        test('Shift+Tab up the page keeps each focused link below the header', async function ({page}) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.locator('.content a').last().focus();
            for (let i = 0; i < 40; i++) {
                await page.keyboard.press('Shift+Tab');
                await expect.poll(() => page.evaluate(focus_offset_from_header)).toBeGreaterThanOrEqual(0);
            }
        });
    });
}

test.describe('docs search results from the keyboard (classic)', function () {

    test.beforeEach(async function ({page}) {
        await page.route('https://cdn.jsdelivr.net/**', v => v.abort());
        await page.goto(`${DOCS}/config.html`);
        await page.click('.search-input');
        await page.keyboard.type('sess');
        await expect(page.locator('.search-result').first()).toBeVisible();
    });

    test('Escape on a result closes the results and goes back to the input', async function ({page}) {
        await page.locator('.search-result').first().focus();
        await page.keyboard.press('Escape');
        await expect(page.locator('.search-results')).toBeHidden();
        await expect(page.locator('.search-input')).toBeFocused();
        await expect(page.locator('.search-input')).toHaveValue('sess');
    });

    test('Tab out of the results closes them', async function ({page}) {
        await page.locator('.search-result').last().focus();
        await page.keyboard.press('Tab');
        await expect(page.locator('.mode-link')).toBeFocused();
        await expect(page.locator('.search-results')).toBeHidden();
    });
});

// How far the focused element sits below the sticky header: negative when
// part of it is under the header, or when focus has left the content.
function focus_offset_from_header()
{
    const element = document.activeElement;
    if (!element.closest('.content')) {
        return -1;
    }
    const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
    return Math.round(element.getBoundingClientRect().top - header);
}

// The page's clipboard keeps what it is given in window.copied_text: a
// headless browser may refuse the real one.
function clipboard_stub()
{
    const clipboard = {
        writeText: function (text) {
            window.copied_text = text;
            return Promise.resolve();
        },
    };
    Object.defineProperty(navigator, 'clipboard', {value: clipboard, configurable: true});
}
