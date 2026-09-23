'use strict';

const plugin = {};

// Force anonymous visitors to the login page (NodeBB v4 compatible rewrite).
//
// A single `response:router.page` guard. This hook fires for both full page
// loads AND SPA client-side navigation (the client fetches /api/<route>); an
// unauthenticated hit is redirected to /login immediately, so there is no
// "must refresh" gap.
//
// The allowlist also permits the public page APIs (/api/login, /api/register,
// /api/reset) so the SPA can fetch the login / registration / password-reset
// page JSON without being bounced to /login. Every other /api/* route stays
// guarded, so forum content is never exposed to guests.
const allowed = /\/(assets\/|api\/(login|register|reset)|login|logout|register|reset|auth|confirm|email|sitemap|plugins\/).*|.*(\.css|\.js|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.ico|\.woff2?|\.ttf|\.eot|\.map)$/;

plugin.privateforum = function (data) {
    const req = data && data.req;
    const res = data && data.res;
    if (!req || !res) {
        return;
    }

    const url = req.url || '';
    const authed = req.loggedIn || (typeof req.uid === 'number' && req.uid > 0);
    if (authed || allowed.test(url)) {
        return;
    }

    const helpers = require.main.require('./src/controllers/helpers');
    helpers.notAllowed(req, res);
};

module.exports = plugin;
