const assert = require('assert');
const authorize_email = require('./authorize_email');
const config = require('../../config');

describe('authorize_email', function () {

    beforeEach(function () {
        config.access.denied_emails = [];
        config.access.allowed_emails = [];
        config.access.denied_domains = [];
        config.access.allowed_domains = [];
    });

    it('allows email when no allowlists or denylists apply', async function () {
        await assert.doesNotReject(() => authorize_email('person@example.com'));
    });

    it('rejects explicitly denied email', async function () {
        config.access.denied_emails = ['person@example.com'];
        await assert.rejects(
            () => authorize_email('person@example.com'),
            /Email is not allowed/
        );
    });

    it('allows explicitly allowed email', async function () {
        config.access.allowed_emails = ['person@example.com'];
        await assert.doesNotReject(() => authorize_email('person@example.com'));
    });

    it('rejects denied email even when also explicitly allowed', async function () {
        config.access.denied_emails = ['person@example.com'];
        config.access.allowed_emails = ['person@example.com'];
        await assert.rejects(
            () => authorize_email('person@example.com'),
            /Email is not allowed/
        );
    });

    it('rejects denied domain', async function () {
        config.access.denied_domains = ['blocked.test'];
        await assert.rejects(
            () => authorize_email('person@blocked.test'),
            /Email domain is not allowed/
        );
    });

    it('allows allowed domain', async function () {
        config.access.allowed_domains = ['authwall.test'];
        await assert.doesNotReject(() => authorize_email('person@authwall.test'));
    });

    it('rejects email outside allowed domains when domain allowlist is configured', async function () {
        config.access.allowed_domains = ['authwall.test'];
        await assert.rejects(
            () => authorize_email('person@example.com'),
            /Email domain is not allowed/
        );
    });

    it('rejects email outside allowed emails when email allowlist is configured', async function () {
        config.access.allowed_emails = ['jonny@gmail.com'];
        await assert.rejects(
            () => authorize_email('bobby@gmail.com'),
            /Email is not allowed/
        );
    });

    it('allows explicitly allowed email even when its domain is not in allowed domains', async function () {
        config.access.allowed_emails = ['jonny@gmail.com'];
        config.access.allowed_domains = ['authwall.test'];
        await assert.doesNotReject(() => authorize_email('jonny@gmail.com'));
    });
});
