const assert = require('assert');
const config = require('../../../config');
const make_mailer_ses = require('./make_mailer_ses');
const nock = require('nock');

describe('make_mailer_ses', function () {

    beforeEach(function () {
        nock.cleanAll();
        config.mailer.ses.region = 'us-east-1';
        config.mailer.ses.key = 'AKIDEXAMPLE';
        config.mailer.ses.secret = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY';
        config.mailer.ses.session_token = 'session-token';
        config.mailer.ses.from = 'Authwall <authwall@example.com>';
    });

    it('sends expected payload and signs request', async function () {
        nock('https://email.us-east-1.amazonaws.com', {
            reqheaders: {
                accept: 'application/json',
                authorization: 'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20240102/us-east-1/ses/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token, Signature=8b2f24ed84e9317f472b08a6fe8b46bfb132384e09b7e6483956cbcd4f7222c5',
                'content-type': 'application/json',
                'x-amz-content-sha256': '705fa263e908db6dc4a0bd4d26d35c7a83fc03143bd2344cc1715d4081033e80',
                'x-amz-date': '20240102T030405Z',
                'x-amz-security-token': 'session-token',
            },
        })
            .post('/v2/email/outbound-emails', {
                FromEmailAddress: 'Authwall <authwall@example.com>',
                Destination: {
                    ToAddresses: ['jane@example.com', 'john@example.com'],
                },
                Content: {
                    Simple: {
                        Subject: {
                            Charset: 'UTF-8',
                            Data: 'Subject',
                        },
                        Body: {
                            Text: {
                                Charset: 'UTF-8',
                                Data: 'Hello',
                            },
                        },
                    },
                },
            })
            .reply(200, {MessageId: 'ses-message-id'});

        using mailer = make_mailer_ses({now: () => new Date('2024-01-02T03:04:05Z')});
        const out = await mailer.send({
            to: '"Jane, Jr." <jane@example.com>, John <john@example.com>',
            subject: 'Subject',
            text: 'Hello',
        });

        assert.deepStrictEqual(out, {MessageId: 'ses-message-id'});
        assert.equal(nock.isDone(), true);
    });

    it('throws a helpful error when SES rejects the request', async function () {
        nock('https://email.us-east-1.amazonaws.com')
            .post('/v2/email/outbound-emails')
            .reply(400, {message: 'Email address is not verified', __type: 'MessageRejected'});

        using mailer = make_mailer_ses({now: () => new Date('2024-01-02T03:04:05Z')});

        await assert.rejects(
            () => mailer.send({to: 'bad@example.com', subject: 'Subject', text: 'Hello'}),
            function (error) {
                assert.match(error.message, /Email delivery failed: MessageRejected: Email address is not verified/);
                return true;
            }
        );
    });
});
