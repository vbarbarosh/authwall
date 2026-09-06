const {test, expect} = require('@playwright/test');

// The search input lives in the sticky header. Focusing it, clicking it, and
// typing in it must leave the page where it was: the header is always in
// view, so there is never anything to scroll into view. Anchors and Enter
// must still land below the header. Measured, not eyeballed — see the
// scroll-margin comment in .docs/static/docs.css for what went wrong before.
const DOCS = 'http://127.0.0.1:3100';
const START = 1500;

const modes = [
    {name: 'single-page', url: `${DOCS}/single/index.html`, anchor: 'config'},
    {name: 'classic', url: `${DOCS}/config.html`, anchor: 'server'},
];

for (const mode of modes) {
    test.describe(`docs search keeps the scroll position (${mode.name})`, function () {

        test.beforeEach(async function ({page}) {
            // Mermaid renders from a CDN after load and re-flows everything
            // below each diagram; keep the layout still (the page shows the
            // diagram source when the import fails, which is fine here).
            await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
            await page.goto(mode.url);
            await page.evaluate(y => window.scrollTo(0, y), START);
            await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(START);
        });

        async function scroll_y(page)
        {
            await page.waitForTimeout(150);
            return page.evaluate(() => Math.round(window.scrollY));
        }

        test('a key pressed on the page focuses the search box without scrolling', async function ({page}) {
            await page.keyboard.press('Space');
            expect(await scroll_y(page)).toBe(START);
            await expect(page.locator('.search-input')).toBeFocused();
            await expect(page.locator('.search-input')).toHaveValue(' ');
        });

        test('focusing the search box from script does not scroll', async function ({page}) {
            await page.evaluate(() => document.querySelector('.search-input').focus());
            expect(await scroll_y(page)).toBe(START);
        });

        test('clicking the search box does not scroll', async function ({page}) {
            await page.click('.search-input');
            expect(await scroll_y(page)).toBe(START);
        });

        test('typing that changes nothing does not scroll', async function ({page}) {
            await page.click('.search-input');
            await page.keyboard.type(' ');
            expect(await scroll_y(page)).toBe(START);
            await page.keyboard.type('a');
            await page.keyboard.press('Backspace');
            expect(await scroll_y(page)).toBe(START);
        });

        test('an anchor still lands below the header', async function ({page}) {
            // Fragment navigation and scrollIntoView both honour scroll-margin;
            // jump once the page is settled so nothing above the target moves
            // after the jump, and allow sub-pixel rounding either way.
            await page.goto(`${mode.url}#${mode.anchor}`);
            await page.waitForLoadState('load');
            await page.evaluate(anchor => document.getElementById(anchor).scrollIntoView(), mode.anchor);
            await expect.poll(() => page.evaluate(anchor => {
                const header = document.querySelector('.site-header').getBoundingClientRect().height;
                return document.getElementById(anchor).getBoundingClientRect().top - header;
            }, mode.anchor)).toBeGreaterThanOrEqual(18);
            expect(await page.evaluate(anchor => {
                const header = document.querySelector('.site-header').getBoundingClientRect().height;
                return document.getElementById(anchor).getBoundingClientRect().top - header;
            }, mode.anchor)).toBeLessThanOrEqual(22);
        });
    });
}

test('Enter in single-page mode scrolls the first match below the header', async function ({page}) {
    await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
    await page.goto(`${DOCS}/single/index.html`);
    await page.evaluate(y => window.scrollTo(0, y), START);
    await page.click('.search-input');
    await page.keyboard.type('sess');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => {
        const first = Array.from(document.querySelectorAll('.doc-section')).find(v => !v.hidden);
        const header = document.querySelector('.site-header').getBoundingClientRect().height;
        return Math.abs(first.getBoundingClientRect().top - header - 20) <= 2;
    }), {timeout: 3000}).toBe(true);
});
