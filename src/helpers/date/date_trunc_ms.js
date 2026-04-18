// https://dev.mysql.com/doc/refman/8.0/en/fractional-seconds.html
// By default, '2026-04-18T00:53:28.724Z' will be stored as '2026-04-18T00:53:29'
// To store '2026-04-18T00:53:28.724Z' as '2026-04-18T00:53:28' TIME_TRUNCATE_FRACTIONAL
// mode should be used, or manual removal of milliseconds.
function date_trunc_ms(d = new Date())
{
    d.setMilliseconds(0);
    return d;
}

module.exports = date_trunc_ms;
