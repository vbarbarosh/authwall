function parse_email_template(template, placeholders = {})
{
    if (typeof template !== 'string') {
        throw new Error('Template must be a string');
    }

    const text = template.replace(/\r\n/g, '\n');

    const i = text.indexOf('\n\n');
    if (i === -1) {
        throw new Error('Invalid template: missing blank line after subject');
    }

    const header = text.slice(0, i);
    const body = text.slice(i + 2).trim();

    const match = header.match(/^Subject:\s*(.+)$/m);
    if (!match) {
        throw new Error('Invalid template: missing Subject');
    }

    const subject = match[1].trim();
    return {
        subject: render(subject, placeholders),
        body: render(body, placeholders).replace(/Hi\s*,/, 'Hi,'),
    };
}

function render(str, placeholders)
{
    return str.replace(/\{\{(\w+)}}/g, function (_, key) {
        if (!(key in placeholders)) {
            throw new Error(`Missing placeholder: ${key}`);
        }
        return String(placeholders[key] ?? '');
    });
}

module.exports = parse_email_template;
