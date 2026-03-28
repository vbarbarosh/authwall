const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function format_date_pretty_24(date)
{
    const d = !date ? new Date() : (date instanceof Date ? date : new Date(date));

    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${month} ${day}, ${year} · ${hours}:${minutes}`;
}

module.exports = format_date_pretty_24;
