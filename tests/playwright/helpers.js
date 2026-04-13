async function sign_in_as_seeded_user(page, options = {})
{
    const path = options.path || '/auth/sign-in';
    await page.goto(path);
    await page.getByTestId('signin-username').fill('foo');
    await page.getByTestId('signin-password').fill('foo');
    await page.getByTestId('signin-submit').click();
}

module.exports = {
    sign_in_as_seeded_user,
};
