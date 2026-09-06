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
            await page.goto(`${mode.url}#${mode.anchor}`);
            await page.waitForTimeout(200);
            const {header, top} = await page.evaluate(anchor => ({
                header: document.querySelector('.site-header').getBoundingClientRect().height,
                top: document.getElementById(anchor).getBoundingClientRect().top,
            }), mode.anchor);
            expect(Math.round(top - header)).toBe(20);
        });
    });
}

test('Enter in single-page mode scrolls the first match below the header', async function ({page}) {
    await page.goto(`${DOCS}/single/index.html`);
    await page.evaluate(y => window.scrollTo(0, y), START);
    await page.click('.search-input');
    await page.keyboard.type('sess');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => {
        const first = Array.from(document.querySelectorAll('.doc-section')).find(v => !v.hidden);
        const header = document.querySelector('.site-header').getBoundingClientRect().height;
        return Math.round(first.getBoundingClientRect().top - header);
    }), {timeout: 3000}).toBe(20);
});
