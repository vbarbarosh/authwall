const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const bcrypt = require('bcrypt');
const complete_password_change = require('../actions/complete_password_change');
const config = require('../../config');
const const_user_identity = require('../helpers/const/const_user_identity');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
const fs_mkdirp = require('@vbarbarosh/node-helpers/src/fs_mkdirp');
const fs_path_dirname = require('@vbarbarosh/node-helpers/src/fs_path_dirname');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const fs_rm = require('@vbarbarosh/node-helpers/src/fs_rm');
const multer = require('multer');
const plural = require('@vbarbarosh/node-helpers/src/plural');
const redirect = require('../helpers/redirect');
const replace_session = require('../helpers/replace_session');
const sharp = require('sharp');

const upload_avatar = multer({
    dest: fs_path_resolve(__dirname, '../../data/temp-uploads'),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: function (req, file, callback) {
        if (!file.mimetype.startsWith('image/')) {
            callback(new UserFriendlyError('Invalid file type'));
            return;
        }
        callback(null, true);
    }
});

const routes = [
    {prepend: [auth_middleware], routes: [
        // ⚠️ upload_avatar must run before csrf_middleware:
        // multer parses the multipart body and populates req.body,
        // which csrf_middleware reads
        {req: 'POST /auth/profile', fn: [upload_avatar.single('avatar'), csrf_middleware, profile_post]},
    ]},
];

// POST /auth/profile
async function profile_post(req, res)
{
    const {current_password, password, password_confirm} = req.body;
    const is_password_change = current_password || password || password_confirm;

    if (is_password_change) {
        if (!current_password || !password || !password_confirm) {
            throw new UserFriendlyError('Missing fields');
        }
        if (password !== password_confirm) {
            throw new UserFriendlyError('Passwords do not match');
        }
        if (password.length < config.flows.password.min_password_length) {
            throw new UserFriendlyError(plural(config.flows.password.min_password_length, 'Password must be at least # character', 'Password must be at least # characters'));
        }
    }

    const update = {};

    if ('display_name' in req.body) {
        update.display_name = String(req.body.display_name).trim() || null;
    }

    const user = await db('users').where({id: req.session.user_id}).first();
    if (!user) {
        throw new UserFriendlyError('User not found');
    }

    if (req.file) {
        const avatar_path = fs_path_resolve(__dirname, `../../data/uploads/${user.slug}/avatar.webp`);
        await fs_mkdirp(fs_path_dirname(avatar_path));
        await sharp(req.file.path).resize(256, 256, {fit: 'cover'}).webp({quality: 90}).toFile(avatar_path);
        await fs_rm(req.file.path);
        update.avatar_url = `${config.public_url}/auth/uploads/${user.slug}/avatar.webp`;
    }

    if (is_password_change) {
        const ident = await db('user_identities')
            .where({user_id: req.session.user_id})
            .whereIn('type', [const_user_identity.email, const_user_identity.username])
            .whereNotNull('verified_at')
            .first();
        if (!ident) {
            throw new UserFriendlyError('Cannot set or change password without a verified email or username');
        }
        const ok = await bcrypt.compare(current_password, user.password_hash);
        if (!ok) {
            throw new UserFriendlyError('Current password is incorrect');
        }
        update.password_hash = await bcrypt.hash(password, config.bcrypt_rounds);
    }

    const now = new Date();
    await db('users').where({id: user.id}).update({...update, updated_at: now});

    if (is_password_change) {
        await complete_password_change(req, res, user.id);
    }
    else {
        await replace_session(req, user);
        redirect(req, res, config.pages.profile);
    }
}

module.exports = routes;
