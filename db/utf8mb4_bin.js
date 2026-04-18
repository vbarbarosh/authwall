function utf8mb4_bin(column)
{
    if (column.client.config.custom.name === 'mysql') {
        return column.collate('utf8mb4_bin');
    }
    return column;
}

module.exports = utf8mb4_bin;
