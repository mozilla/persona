<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

This repository contains the core [Mozilla Persona][] services.
Persona is a login system based on the [BrowserID protocol][].

To learn about using Persona on your site, check out [our documentation][Persona Docs] on MDN.

[Mozilla Persona]: https://login.persona.org
[BrowserID protocol]: https://github.com/mozilla/id-specs
[Persona Docs]: https://developer.mozilla.org/docs/persona

## Repository Contents

This repository contains several projects related to Persona:

* __The Persona Fallback IdP__:
  A fallback Identity Provider (IdP) for users without native support for Persona via their email provider. Written in node.js, hosted at https://login.persona.org.

* __The Persona Remote Verification Service__:
  A stateless node.js server which handles cryptographic verification of identity assertions. Hosted at verifier.login.persona.org, but easy to run locally.

* __The Cross-Browser Persona Support Library__:
  The `include.js` file that provides the `navigator.id` API for browsers without native support for Persona. This also includes the code for the dialog shown to users of those browsers.

* __Sample and Test Code__:
  For all of the above.

## Getting Started

The Persona team uses Git and GitHub for all of our development and issue tracking.
If you'd like to contribute code back to us, please do so using a [Pull Request][].
If you get stuck and need help, you can find the core team on our [public mailing list][dev-identity] or in #identity on irc.mozilla.org.

[Pull Request]: https://help.github.com/articles/using-pull-requests
[dev-identity]: https://lists.mozilla.org/listinfo/dev-identity

### Install Dependencies

BrowserID needs the following dependencies before it can run:

* node.js (>= 0.8.11)
* libgmp3
* g++

For detailed instructions for your specific operating system, check out the `SETUP` docs in the `docs/` folder.

### Running BrowserID Locally

To run the BrowserID service locally:

1. Clone the repository to your machine.
2. Run `npm install` from the root of your clone.
3. Run `npm start` from the root of your clone.

When you run `npm start`, it will print several URLs to your terminal.
You can test that everything is working by visiting the URL for the `example` (RP) site.
Look for a line like this in the terminal:

    example (10361): running on http://127.0.0.1:10001

You can stop the services by typing Control-C in the terminal.

### Staying Up to Date

To stay up to date with BrowserID:

1. Use `git pull` to retrieve new changes.
2. Delete both the `var` and `node_modules` folders in the root of your local clone.
3. Run `npm install` from the root of your local clone.

## Testing

### Local testing:
Unit tests can be run by invoking `npm test` at the top level.
At present, there are three classes of unit tests to be run:

* Backend unit tests against a custom, zero-dependency JSON database.
* Backend unit tests against MySQL, what we use in production.
* Frontend unit tests run headlessly against PhantomJS.

You can control which tests are run using the `WHAT_TESTS` env var, see `scripts/test` for details.

### Continuous Integration Testing:

Integration tests are done with [Travis-CI][].
It is recommended that you setup [Travis-CI][] for your BrowserID fork so that tests are automatically run when you push changes.
This will give the BrowserID team confidence that your changes both function correctly and do not cause regressions in other parts of the code.
Configuration files are already included in the repo but some setup is necessary.

1. Sign in to [GitHub][]
2. Open [Travis-CI][]
3. Click "Sign in with GitHub" if you are not signed in. If you are signed in, click on your username then "Profile" and go to step 5.
4. Click "Allow" if this is your first time signing in.
5. Find "browserid" in "Your Repositories"
6. Move the switch from "OFF" to "ON"
7. Open your fork of BrowserID on [GitHub][]
8. Click the "Settings" button
9. Click "Service Hooks" and find the "Travis" Service Hook
10. Paste in your "Token" which you can find it on your [Travis-CI Profile][].
11. Ensure that "Travis" has a green radio button
12. Push to your fork and return to [Travis-CI][]. Watch the tests run.

[Travis-CI]: http://travis-ci.org
[GitHub]: https://github.com
[Travis-CI Profile]: https://travis-ci.org/profile

## LICENSE

All source code here is available under the [MPL 2.0][] license, unless otherwise indicated.

[MPL 2.0]: https://mozilla.org/MPL/2.0/

