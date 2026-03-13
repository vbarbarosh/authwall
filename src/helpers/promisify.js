async function promisify(callback)
{
    return new Promise(function (resolve, reject) {
        callback(function (error, out) {
            error ? reject(error) : resolve(out);
        });
    });
}

module.exports = promisify;
