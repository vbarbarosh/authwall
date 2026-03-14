const NotImplemented = require('@vbarbarosh/node-helpers/src/errors/NotImplemented');
const bcrypt = require('bcrypt');
const config = require('../config');
const db = require('../../db');
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
    const {username, password} = req.body;

    if (!username || !password) {
        throw new Error('Missing fields');
    }

    const user = await db('users').where({username}).first();
    if (!user) {
        throw new Error('Invalid username or password');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
        throw new Error('Invalid username or password');
    }

    await promisify(v => req.session.regenerate(v));
    req.session.username = user.username;
    await promisify(v => req.session.save(v));
    redirect(req, res);
}

// GET /auth/sign-out
async function sign_out_get(req, res)
{
    res.sendFile(fs_path_resolve(__dirname, '../static/sign-out.html'));
}

// POST /auth/sign-out
async function sign_out_post(req, res)
{
    await promisify(v => req.session.destroy(v));
    redirect(req, res, '/auth/sign-in');
}

// GET /auth/sign-up
async function sign_up_get(req, res)
{
    res.sendFile(fs_path_resolve(__dirname, '../static/sign-up.html'));
}

// POST /auth/sign-up
async function sign_up_post(req, res)
{
    const {username, password, password_confirm} = req.body;

    if (!username || !password) {
        throw new Error('Missing fields');
    }

    if (password !== password_confirm) {
        throw new Error('Passwords do not match')
    }

    try {
        const password_hash = await bcrypt.hash(password, config.password_rounds);
        const now = db.fn.now();
        await db('users').insert({username, password_hash, created_at: now, updated_at: now});
        await promisify(v => req.session.regenerate(v));
        req.session.username = username;
        await promisify(v => req.session.save(v));
        redirect(req, res);
    }
    catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT') {
            throw new Error('Username already exists')
        }
    }
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

function redirect(req, res, default_url = '/')
{
    if (typeof req.query.return === 'string' && req.query.return.startsWith('/')) {
        res.redirect(req.query.return);
    }
    else {
        res.redirect(default_url);
    }
}

module.exports = routes;
