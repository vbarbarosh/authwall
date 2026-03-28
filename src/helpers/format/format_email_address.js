function format_email_address(input)
{
    if (!input) {
        throw new Error('Missing email input');
    }

    if (Array.isArray(input)) {
        return input.map(format_email_address).join(', ');
    }

    if (typeof input === 'string') {
        return input;
    }

    if (typeof input === 'object') {
        if (!input.email) {
            throw new Error('Missing email');
        }

        if (!input.name) {
            return input.email;
        }

        const name = format_email_name(input.name);
        return `${name} <${input.email}>`;
    }

    throw new Error('Invalid email input');
}

function format_email_name(name)
{
    // escape quotes
    let safe = String(name).replace(/"/g, '\\"');

    // quote if contains special chars
    if (/[",<>]/.test(safe)) {
        safe = `"${safe}"`;
    }

    return safe;
}

module.exports = format_email_address;
