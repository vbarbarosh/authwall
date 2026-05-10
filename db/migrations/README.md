Rules for naming migrations:

{timestamp}_{table}
    Use when creating a new table.

{timestamp}_{table}__{column}
    Use when adding a new column to an existing table.
    Also use this format when adding several related columns,
    but one column is clearly the main one and the others only
    store metadata for it.

{timestamp}_{table}__{short_description}
    Use when adding several columns to a table and there is no single
    obvious "main" column.

Related columns should be kept together. In most cases, added columns
should explicitly specify which existing column they should be added after.
