const ms_per_day = 24 * 60 * 60 * 1000;

function date_diff_days_float(future, now = new Date())
{
    const a = (future instanceof Date) ? future.getTime() : new Date(future).getTime();
    const b = (now instanceof Date) ? now.getTime() : new Date(now).getTime();
    return (a - b) / ms_per_day;
}

module.exports = date_diff_days_float;
