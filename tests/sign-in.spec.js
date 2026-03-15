const {test, expect} = require('@playwright/test');

test('sign-in page loads', async function ({page}) {
    await page.goto('http://localhost:3000/auth/sign-in');
    await expect(page.locator('form')).toBeVisible();
});
