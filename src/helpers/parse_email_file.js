const fs_read_utf8 = require('@vbarbarosh/node-helpers/src/fs_read_utf8');
const parse_email_template = require('./parse_email_template');

async function parse_email_file(path, placeholders = {})
{
    const templ = await fs_read_utf8(path);
    return parse_email_template(templ, placeholders);
}

module.exports = parse_email_file;
