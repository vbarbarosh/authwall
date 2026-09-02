const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const als = require('../helpers/als');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const bcrypt = require('bcrypt');
const complete_password_change = require('../actions/complete_password_change');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_user_identity = require('../helpers/const/const_user_identity');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
const fs_mkdirp = require('@vbarbarosh/node-helpers/src/fs_mkdirp');
const fs_path_dirname = require('@vbarbarosh/node-helpers/src/fs_path_dirname');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const fs_rm = require('@vbarbarosh/node-helpers/src/fs_rm');
const insert_auth_event = require('../helpers/insert_auth_event');
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
        {req: 'POST /auth/profile', fn: [upload_avatar.single('avatar'), remove_temp_upload, csrf_middleware, profile_post]},
    ]},
];

// Because multer has to run first (see above), the temp file already exists by
// the time anything downstream can reject the request. A failed CSRF check or
// an image sharp cannot decode would otherwise leave up to 5 MB behind on every
// attempt, and nothing in the codebase ever sweeps that directory. Registering
// the cleanup on the response covers every outcome, including the paths where
// profile_post never runs at all.
function remove_temp_upload(req, res, next)
{
    if (req.file) {
        const path = req.file.path;
        res.on('close', function () {
            fs_rm(path).catch(function (error) {
                if (error.code !== 'ENOENT') {
                    als.logger.write(`[avatar_temp_cleanup_error] ⚠️ ${path}: ${error.message}`);
                }
            });
        });
    }
    next();
}

// POST /auth/profile
async function profile_post(req, res)
{
    const {current_password, password, password_confirm} = req.body;
    const is_password_change = current_password || password || password_confirm;

    if (is_password_change) {
        // current_password is checked further down, once the user row tells us
        // whether there is an existing password to verify against.
        if (!password || !password_confirm) {
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
        const display_name = String(req.body.display_name).replace(/[\u0000-\u001f\u007f]/g, '').trim();
        if (display_name.length > 100) {
            throw new UserFriendlyError('Display name must be at most 100 characters');
        }
        update.display_name = display_name || null;
    }

    const user = await db('users').where({id: req.session.user_id}).first();
    if (!user) {
        throw new UserFriendlyError('User not found');
    }

    if (req.file) {
        const avatar_path = fs_path_resolve(__dirname, `../../data/uploads/${user.slug}/avatar.webp`);
        await fs_mkdirp(fs_path_dirname(avatar_path));
        try {
            await sharp(req.file.path).resize(256, 256, {fit: 'cover'}).webp({quality: 90}).toFile(avatar_path);
        }
        catch (error) {
            // The multer fileFilter only sees the content type the client
            // declared, so a non-image first actually fails here. Keep the real
            // cause in the log and give the user something they can act on.
            als.logger.write(`[avatar_process_error] ⚠️ ${error.message}`);
            throw new UserFriendlyError('Invalid image');
        }
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

        // A user who signed up through an OAuth provider has no password yet.
        // Setting the first one has nothing to verify against, so
        // current_password is not required — and must not be compared either,
        // since bcrypt.compare(x, null) throws rather than returning false.
        const has_password = user.password_hash !== null;

        if (has_password && !current_password) {
            throw new UserFriendlyError('Missing fields');
        }
        if (has_password && !await bcrypt.compare(current_password, user.password_hash)) {
            throw new UserFriendlyError('Current password is incorrect');
        }
        update.password_hash = await bcrypt.hash(password, config.bcrypt_rounds);
    }

    const now = new Date();
    await db('users').where({id: user.id}).update({...update, updated_at: now});

    if ('display_name' in update) {
        await insert_auth_event({
            req,
            event_type: const_auth_event.profile_updated,
            custom: {fields: ['display_name']},
        });
    }

    if ('avatar_url' in update) {
        await insert_auth_event({
            req,
            event_type: const_auth_event.avatar_updated,
            custom: {avatar_url: update.avatar_url},
        });
    }

    if (is_password_change) {
        await complete_password_change(req, res, user.id);
    }
    else {
        await replace_session(req, user);
        redirect(req, res, config.pages.profile);
    }
}

module.exports = routes;
