const db = require('../../db');

after(async function () {
    await db.destroy();
});
