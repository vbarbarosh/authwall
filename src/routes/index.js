const NotImplemented = require('@vbarbarosh/node-helpers/src/errors/NotImplemented');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const promisify = require('../helpers/promisify');

const routes = [
    {req: 'GET /auth/me', fn: me_get},
    {req: 'GET /auth/sign-in', fn: sign_in_get},
    {req: 'GET /auth/sign-out', fn: sign_out_get},
    {req: 'GET /auth/sign-up', fn: sign_up_get},
    {req: 'GET /auth/forgot-password', fn: forgot_password_get},
    {req: 'GET /auth/reset-password', fn: reset_password_get},
    {req: 'GET /auth/change-password', fn: change_password_get},
    {req: 'POST /auth/sign-in', fn: sign_in_post},
    {req: 'POST /auth/sign-out', fn: sign_out_post},
    {req: 'POST /auth/sign-up', fn: sign_up_post},
    {req: 'POST /auth/forgot-password', fn: forgot_password_post},
    {req: 'POST /auth/reset-password', fn: reset_password_post},
    {req: 'POST /auth/change-password', fn: change_password_post},
];

// GET /auth/me
async function me_get(req, res)
{
    res.send({username: req.session.username});
}

// GET /auth/sign-in
async function sign_in_get(req, res)
{
    res.sendFile(fs_path_resolve(__dirname, '../static/sign-in.html'));
}

// POST /auth/sign-in
async function sign_in_post(req, res)
{
    await promisify(v => req.session.regenerate(v));
    req.session.username = req.body.username;
    await promisify(v => req.session.save(v));

    if (typeof req.query.return === 'string' && req.query.return.startsWith('/')) {
        res.redirect(req.query.return);
    }
    else {
        res.redirect('/');
    }
}

// GET /auth/sign-out
async function sign_out_get(req, res)
{
    throw new NotImplemented();
}

// POST /auth/sign-out
async function sign_out_post(req, res)
{
    await promisify(v => req.session.destroy(v));
    res.redirect('/auth/sign-in');
}

// GET /auth/sign-up
async function sign_up_get(req, res)
{
    throw new NotImplemented();
}

// POST /auth/sign-up
async function sign_up_post(req, res)
{
    throw new NotImplemented();
}

// GET /auth/forgot-password
async function forgot_password_get(req, res)
{
    throw new NotImplemented();
}

// POST /auth/forgot-password
async function forgot_password_post(req, res)
{
    throw new NotImplemented();
}

// GET /auth/reset-password
async function reset_password_get(req, res)
{
    throw new NotImplemented();
}

// POST /auth/reset-password
async function reset_password_post(req, res)
{
    throw new NotImplemented();
}

// GET /auth/change-password
async function change_password_get(req, res)
{
    throw new NotImplemented();
}

// POST /auth/change-password
async function change_password_post(req, res)
{
    throw new NotImplemented();
}

module.exports = routes;
