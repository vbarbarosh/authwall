const assert = require('assert');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const ROOT = path.resolve(__dirname, '../../..');

// See the_app_never_reaches_the_database.md.
describe('The app never reaches the database | stories', function () {

    it('gives the database a network only Authwall joins, in every stack (AW-171)', function () {
        const checked = [];
        for (const [file, stack] of stacks_read()) {
            for (const [name, service] of Object.entries(stack.services)) {
                if (!/^(mysql|postgres)\b/.test(service.image)) {
                    continue;
                }
                const db_networks = service_networks(service);
                const others = Object.entries(stack.services).filter(v => v[0] !== name);
                const sharing = others.filter(v => service_networks(v[1]).some(vv => db_networks.includes(vv)));
                assert.deepStrictEqual(sharing.map(v => v[0]).filter(v => !v.startsWith('authwall')), [], `${file}: ${name}`);
                assert.ok(db_networks.every(v => stack.networks?.[v]?.internal), `${file}: ${name} on ${db_networks}`);
                checked.push(`${file}: ${name}`);
            }
        }
        assert.strictEqual(checked.length, 4, checked.join('\n'));
    });

});

// The repository's docker-compose.yaml and every stack of the recipes.
function stacks_read()
{
    const out = [['docker-compose.yaml', yaml.parse(fs.readFileSync(path.join(ROOT, 'docker-compose.yaml'), 'utf8'))]];
    const recipes = fs.readFileSync(path.join(ROOT, 'docs/recipes.md'), 'utf8');
    for (const match of recipes.matchAll(/```yaml\n([\s\S]*?)```/g)) {
        const stack = yaml.parse(match[1]);
        if (stack?.services) {
            out.push(['docs/recipes.md', stack]);
        }
    }
    return out;
}

function service_networks(service)
{
    const networks = service.networks ?? ['default'];
    return Array.isArray(networks) ? networks : Object.keys(networks);
}
