const auth_middleware = require('../helpers/middleware/auth_middleware');
const config = require('../../config');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
const fs_mkdirp = require('@vbarbarosh/node-helpers/src/fs_mkdirp');
const fs_path_dirname = require('@vbarbarosh/node-helpers/src/fs_path_dirname');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const fs_rm = require('@vbarbarosh/node-helpers/src/fs_rm');
const multer = require('multer');
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
            callback(new Error('Invalid file type'));
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
    // const {current_password, password, password_confirm} = req.body;
    // if (!current_password || !password || !password_confirm) {
    //     throw new Error('Missing fields');
    // }
    //
    // if (password !== password_confirm) {
    //     throw new Error('Passwords do not match');
    // }

    const update = {};

    if ('display_name' in req.body) {
        update.display_name = String(req.body.display_name).trim() || null;
    }

    const user = await db('users').where({id: req.session.user_id}).first();
    if (!user) {
        throw new Error('User not found');
    }

    if (req.file) {
        const avatar_path = fs_path_resolve(__dirname, `../../data/uploads/${user.slug}/avatar.webp`);
        await fs_mkdirp(fs_path_dirname(avatar_path));
        await sharp(req.file.path).resize(256, 256, {fit: 'cover'}).webp({quality: 90}).toFile(avatar_path);
        await fs_rm(req.file.path)
        update.avatar_url = `${config.public_url}/auth/uploads/${user.slug}/avatar.webp`;
    }

    // const ok = await bcrypt.compare(current_password, user.password_hash);
    // if (!ok) {
    //     throw new Error('Current password is incorrect');
    // }
    // const password_hash = await bcrypt.hash(password, config.password_rounds);

    const now = new Date();
    await db('users').where({id: user.id}).update({...update, updated_at: now});

    // refresh session (important after credential change)
    await replace_session(req, user);

    redirect(req, res, config.pages.profile);
}

module.exports = routes;
