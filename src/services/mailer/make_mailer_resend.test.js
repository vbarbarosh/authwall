const assert = require('assert');
const config = require('../../../config');
const make_mailer_resend = require('./make_mailer_resend');
const nock = require('nock');
const pkg = require('../../../package.json');

describe('make_mailer_resend', function () {

    beforeEach(function () {
        nock.cleanAll();
        config.mailer.resend.key = 'resend-key';
        config.mailer.resend.from = 'Authwall <authwall@example.com>';
    });

    it('sends expected payload', async function () {
        nock('https://api.resend.com', {
            reqheaders: {
                accept: 'application/json',
                authorization: 'Bearer resend-key',
                'user-agent': `vbarbarosh/authwall:${pkg.version}`,
            },
        })
            .post('/emails', {
                from: 'Authwall <authwall@example.com>',
                to: 'Jane Doe <jane@example.com>',
                subject: 'Subject',
                text: 'Hello',
            })
            .reply(200, {id: 'resend-message-id'});

        using mailer = make_mailer_resend();

        const out = await mailer.send({
            to: 'Jane Doe <jane@example.com>',
            subject: 'Subject',
            text: 'Hello',
        });

        assert.deepStrictEqual(out, {id: 'resend-message-id'});
        assert.equal(nock.isDone(), true);
    });

    it('throws a helpful error when provider rejects the request', async function () {

        nock('https://api.resend.com').post('/emails').reply(422, {message: 'Invalid `to` field'});

        using mailer = make_mailer_resend();

        await assert.rejects(
            () => mailer.send({to: 'bad@example.com', subject: 'Subject', text: 'Hello'}),
            function (error) {
                assert.match(error.message, /Email delivery failed: Invalid `to` field/);
                return true;
            }
        );
    });
});
