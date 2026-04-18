const assert = require('assert');
const config = require('../../../config');
const make_mailer_mailjet = require('./make_mailer_mailjet');
const nock = require('nock');

describe('make_mailer_mailjet', function () {

    beforeEach(function () {
        nock.cleanAll();
        config.mailer.mailjet.key = 'mailjet-key';
        config.mailer.mailjet.secret = 'mailjet-secret';
        config.mailer.mailjet.from = 'Authwall <authwall@example.com>';
    });

    it('sends expected payload', async function () {

        nock('https://api.mailjet.com', {reqheaders: {accept: 'application/json'}})
            .post('/v3.1/send', {
                Messages: [
                    {
                        From: {Email: 'authwall@example.com', Name: 'Authwall'},
                        To: [{Email: 'jane@example.com', Name: 'Jane Doe'}],
                        Subject: 'Subject',
                        TextPart: 'Hello',
                    },
                ],
            })
            .basicAuth({user: 'mailjet-key', pass: 'mailjet-secret'})
            .reply(200, {Messages: [{Status: 'success', To: [{MessageID: 123}]}]});

        using mailer = make_mailer_mailjet();
        const out = await mailer.send({
            to: 'Jane Doe <jane@example.com>',
            subject: 'Subject',
            text: 'Hello',
        });

        assert.deepStrictEqual(out, {
            Messages: [{Status: 'success', To: [{MessageID: 123}]}],
        });

        assert.equal(nock.isDone(), true);
    });

    it('throws a helpful error when provider rejects the request', async function () {

        nock('https://api.mailjet.com')
            .post('/v3.1/send')
            .basicAuth({user: 'mailjet-key', pass: 'mailjet-secret'})
            .reply(400, {ErrorMessage: 'Invalid email'});

        using mailer = make_mailer_mailjet();

        await assert.rejects(() => mailer.send({to: 'bad@example.com', subject: 'Subject', text: 'Hello'}),
            function (error) {
                assert.match(error.message, /Email delivery failed: Invalid email/);
                return true;
            }
        );
    });
});
