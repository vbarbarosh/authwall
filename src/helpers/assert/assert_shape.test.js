const assert_shape = require('./assert_shape');

describe('assert_shape', function () {

    it('validates array of objects with enum field', function () {
        const input = [
            {
                email: 'jack@domain1.com',
                primary: true,
                verified: true,
                visibility: 'public'
            },
            {
                email: 'jack.m@domain2.com',
                primary: false,
                verified: true,
                visibility: null
            },
            {
                email: 'jj@domain3.com',
                primary: false,
                verified: true,
                visibility: null
            }
        ];
        assert_shape(input, assert_shape.array_of({
            email: String,
            primary: Boolean,
            verified: Boolean,
            visibility: assert_shape.enum(null, 'public'),
        }));
    });

    it('enum with objects', function () {
        const input = {a: {x: 1}};

        assert_shape(input, {
            a: assert_shape.enum({x: 1}),
        });
    });

    it('enum with arrays', function () {
        const input = {a: [1, 2]};

        assert_shape(input, {
            a: assert_shape.enum([1, 2]),
        });
    });

    it('empty array should be allowed', function () {
        const input = [];

        assert_shape(input, assert_shape.array_of({
            a: Number,
        }));
    });

    it('enum inside array_of with object values', function () {
        const input = [
            {config: {mode: 'a'}}
        ];

        assert_shape(input, assert_shape.array_of({
            config: assert_shape.enum({mode: 'a'}),
        }));
    });
});
