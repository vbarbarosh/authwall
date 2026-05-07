const assert = require('assert');
const edge_values = require('@vbarbarosh/type-helpers/src/edge_values');
const urlparts = require('./urlparts');

const extra_edge_values = [
    // whitespace strings
    {label: '" "', value: ' '},
    {label: '"\\t"', value: '\t'},
    {label: '"\\n"', value: '\n'},
    {label: '"\\r\\n"', value: '\r\n'},

    // numeric strings
    {label: '"0"', value: '0'},
    {label: '"1"', value: '1'},
    {label: '"NaN"', value: 'NaN'},
    {label: '"Infinity"', value: 'Infinity'},

    // weird unicode
    {label: '"💩"', value: '💩'},
    {label: '"😀"', value: '😀'},
    {label: '"привет"', value: 'привет'},
    {label: '"こんにちは"', value: 'こんにちは'},

    // dangerous chars
    {label: '"<script>"', value: '<script>'},
    {label: '"../"', value: '../'},
    {label: '"%20"', value: '%20'},
    {label: '"a?b=c"', value: 'a?b=c'},
    {label: '"a#b"', value: 'a#b'},

    // arrays
    {label: '[1,2,3]', value: [1, 2, 3]},
    {label: '[null]', value: [null]},
    {label: '[undefined]', value: [undefined]},
    {label: 'new Array(5)', value: new Array(5)},

    // typed arrays
    {label: 'Uint8Array', value: new Uint8Array([1, 2, 3])},
    {label: 'Buffer', value: Buffer.from('abc')},

    // objects
    {label: '{a:1}', value: {a: 1}},
    {label: 'Object.create(null)', value: Object.create(null)},

    // custom coercion
    {label: 'toString() => x', value: {toString() {return 'x';}}},
    {label: 'valueOf() => 123', value: {valueOf() {return 123;}}},

    // dates
    {label: 'new Date()', value: new Date()},
    {label: 'Invalid Date', value: new Date('invalid')},

    // regexp
    {label: '/foo/g', value: /foo/g},

    // maps/sets
    {label: 'Map', value: new Map()},
    {label: 'Set', value: new Set()},
    {label: 'WeakMap', value: new WeakMap()},
    {label: 'WeakSet', value: new WeakSet()},

    // promises
    {label: 'Promise.resolve(1)', value: Promise.resolve(1)},

    // errors
    {label: 'Error', value: new Error('boom')},
    {label: 'TypeError', value: new TypeError('boom')},

    // wrappers
    {label: 'new String()', value: new String('abc')},
    {label: 'new Number()', value: new Number(123)},
    {label: 'new Boolean()', value: new Boolean(false)},

    // url-like
    {label: 'new URL("https://example.com")', value: new URL('https://example.com')},

    // bigint
    {label: '1n', value: 1n},
    {label: '-1n', value: -1n},

    // special numbers
    {label: 'Number.EPSILON', value: Number.EPSILON},

    // proxy
    {label: 'Proxy', value: new Proxy({}, {})},
];

const happy_paths = [
    {
        label: 'parses full https url',
        input: 'https://john:secret@example.com:8080/users/15?page=2#top',
        expected: {
            href: 'https://john:secret@example.com:8080/users/15?page=2#top',
            protocol: 'https:',
            hostname: 'example.com',
            username: 'john',
            password: 'secret',
            host: 'example.com:8080',
            port: '8080',
            path: '/users/15',
            search: '?page=2',
            hash: '#top',
        },
    },
    {
        label: 'parses https url without auth',
        input: 'https://example.com/users',
        expected: {
            href: 'https://example.com/users',
            protocol: 'https:',
            hostname: 'example.com',
            username: '',
            password: '',
            host: 'example.com',
            port: '',
            path: '/users',
            search: '',
            hash: '',
        },
    },
    {
        label: 'parses root url',
        input: 'https://example.com',
        expected: {
            href: 'https://example.com/',
            protocol: 'https:',
            hostname: 'example.com',
            username: '',
            password: '',
            host: 'example.com',
            port: '',
            path: '/',
            search: '',
            hash: '',
        },
    },
    {
        label: 'parses relative path',
        input: '/users?page=5',
        expected: {
            href: 'fake://fake/users?page=5',
            protocol: 'fake:',
            hostname: 'fake',
            username: '',
            password: '',
            host: 'fake',
            port: '',
            path: '/users',
            search: '?page=5',
            hash: '',
        },
    },
    {
        label: 'parses hash',
        input: 'https://example.com/docs#intro',
        expected: {
            href: 'https://example.com/docs#intro',
            protocol: 'https:',
            hostname: 'example.com',
            username: '',
            password: '',
            host: 'example.com',
            port: '',
            path: '/docs',
            search: '',
            hash: '#intro',
        },
    },
    {
        label: 'parses query string',
        input: 'https://example.com?a=1&b=2',
        expected: {
            href: 'https://example.com/?a=1&b=2',
            protocol: 'https:',
            hostname: 'example.com',
            username: '',
            password: '',
            host: 'example.com',
            port: '',
            path: '/',
            search: '?a=1&b=2',
            hash: '',
        },
    },
    {
        label: 'parses localhost with port',
        input: 'http://localhost:3000/foo',
        expected: {
            href: 'http://localhost:3000/foo',
            protocol: 'http:',
            hostname: 'localhost',
            username: '',
            password: '',
            host: 'localhost:3000',
            port: '3000',
            path: '/foo',
            search: '',
            hash: '',
        },
    },
    {
        label: 'parses ftp url',
        input: 'ftp://example.com/file.txt',
        expected: {
            href: 'ftp://example.com/file.txt',
            protocol: 'ftp:',
            hostname: 'example.com',
            username: '',
            password: '',
            host: 'example.com',
            port: '',
            path: '/file.txt',
            search: '',
            hash: '',
        },
    },
];

describe('urlparts', function () {
    it('no args', function () {
        assert.deepStrictEqual(urlparts(), {
            href: 'fake://fake/',
            protocol: 'fake:',
            hostname: 'fake',
            username: '',
            password: '',
            host: 'fake',
            port: '',
            path: '/',
            search: '',
            hash: '',
        });
    });

    describe('happy paths', function () {
        for (const item of happy_paths) {
            it(item.label, function () {
                const actual = urlparts(item.input);
                assert.deepStrictEqual(actual, item.expected);
            });
        }
    });

    describe('edge values', function () {
        for (const item of [...edge_values, ...extra_edge_values]) {
            it(item.label, function () {
                if (typeof item.value === 'string') {
                    const tmp = new URL(item.value, 'fake://fake/');
                    assert.deepStrictEqual(urlparts(item.value), {
                        href: tmp.href,
                        protocol: tmp.protocol,
                        hostname: tmp.hostname,
                        username: tmp.username,
                        password: tmp.password,
                        host: tmp.host,
                        port: tmp.port,
                        path: tmp.pathname,
                        search: tmp.search,
                        hash: tmp.hash,
                    });
                }
                else if (item.value instanceof URL) {
                    const tmp = item.value;
                    assert.deepStrictEqual(urlparts(item.value), {
                        href: tmp.href,
                        protocol: tmp.protocol,
                        hostname: tmp.hostname,
                        username: tmp.username,
                        password: tmp.password,
                        host: tmp.host,
                        port: tmp.port,
                        path: tmp.pathname,
                        search: tmp.search,
                        hash: tmp.hash,
                    });
                }
                else {
                    assert.deepStrictEqual(urlparts(item.value), {
                        href: 'fake://fake/',
                        protocol: 'fake:',
                        hostname: 'fake',
                        username: '',
                        password: '',
                        host: 'fake',
                        port: '',
                        path: '/',
                        search: '',
                        hash: '',
                    });
                }
            });
        }
    });
});
