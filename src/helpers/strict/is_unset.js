// Empty string counts as unset: .env.example ships many variables with no
// value, and a blank one means "use the default", not "reject my config".
function is_unset(value)
{
    return value === undefined || value === null || value === '';
}

module.exports = is_unset;
