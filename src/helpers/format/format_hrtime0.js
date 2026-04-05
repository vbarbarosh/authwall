function format_hrtime0(hrtime0, digits = 4)
{
    const [u, v] = process.hrtime(hrtime0);
    return (u + v/1E9).toFixed(digits) + 's';
}

module.exports = format_hrtime0;
