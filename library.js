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

    // This hook also fires inside nested routers. The REST API mounts one
    // router per resource, so a request to /api/v3/groups/alice reaches us
    // with `req.url` already stripped down to `/alice`.
    //
    // helpers.notAllowed() saves `req.url.replace(/^\/api/, '')` as
    // `session.returnTo`, so a partial path makes the username look like a
    // page the visitor asked for. Registration/login then ends with a redirect
    // to `/alice` (a 404) instead of the forum. Such calls are therefore
    // refused on the spot — same 401 as before, but without touching the
    // session, so only real page destinations are ever remembered.
    const originalUrl = req.originalUrl || '';
    const isApiRequest = /^\/api(\/|$)/.test(originalUrl);
    const partialApiPath = isApiRequest && !/^\/api(\/|$)/.test(url);
    if (partialApiPath) {
        return helpers.formatApiResponse(401, res);
    }

    // jQuery appends a cache buster (?_=1699… / &_=1699…) to XHR urls. That
    // belongs to the request, not to the page we want to come back to, so drop
    // it before core stores the destination.
    const cleanUrl = url
        .replace(/([?&])_=\d+(&|$)/, (match, separator, tail) => (tail === '&' ? separator : ''))
        .replace(/[?&]$/, '');
    if (cleanUrl) {
        req.url = cleanUrl;
    }

    helpers.notAllowed(req, res);
};

module.exports = plugin;
