<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Here lives the [BrowserID][] implementation.  BrowserID is an implementation of the
[verified email protocol][VEP].

  [BrowserID]:https://browserid.org
  [VEP]:https://wiki.mozilla.org/Labs/Identity/VerifiedEmailProtocol

This repository contains several distinct things related to BrowserID:

  * **the browserid server** - a node.js server which implements a web services api, stores a record of users, the email addresses they've verified, a bcrypted password, outstanding verification tokens, etc
  * **the verifier** - a stateless node.js server which does cryptographic verification of assertions. This thing is hosted on browserid.org as a convenience, but people using browserid can choose to host their own version if they wish to.
  * **sample and test code** - to test the above
  * **the browserid.org website** - the templates, css, and javascript that make up the visible part of browserid.org
  * **the javascript/HTML dialog & include library** - this is include.js and the code that it includes, the bit that someone using browserid will include.

## Dependencies

Here's the software you'll need installed:

* node.js (>= 0.6.2): http://nodejs.org/
* npm: http://npmjs.org/ (or bundled with node in 0.6.3+)
* libgmp3
* git
* g++

## Getting started:

1. install node and npm
3. run `npm install` to install 3rd party libraries and generate keys
3. run `npm start` to start the servers locally
4. visit the demo application ('rp') in your web browser (url output on the console at runtime)

You can stop the servers with a Cntl-C in the terminal.

## Staying up to date:

1. `rm -Rf var node_modules`
2. `npm install`

## Testing

### Local Testing
Unit tests can be run by invoking `npm test` at the top level.  At present,
there are three classes of unit tests to be run:

  * Backend unit tests against a custom, zero-dependency JSON database
  * Backend unit tests against MySQL, what we use in production
  * Frontend unit tests run headlessly against PhantomJS

You can control which tests are run using the `WHAT_TESTS` env var, see
`scripts/test` for details.

### Continuous Integration Testing
Integration tests are done with [Travis-CI][]. It is recommended that you setup [Travis-CI][] for your BrowserID fork so that tests are automatically run when you push changes. This will give the BrowserID team confidence that your changes both function correctly and do not cause regressions in other parts of the code.  Configuration files are already included in the repo but some setup is necessary.

1. Sign in to [GitHub][]
2. Open [Travis-CI][]
3. Click "Sign in with GitHub" if you are not signed in. If you are signed in, click on your username then "Profile" and go to step 5.
4. Click "Allow" if this is your first time signing in.
5. Find "browserid" in "Your Repositories"
6. Move the switch from "OFF" to "ON"
7. Open your fork of BrowserID on [GitHub][]
8. Click the "Admin" button
9. Click "Service Hooks"
10. Ensure that "Travis" has a green radio button
11. Push to your fork and return to [Travis-CI][]. Watch the tests run.

  [Travis-CI]: http://travis-ci.org
  [GitHub]: https://github.com

## Development model

**branching & release model** - You'll notice some funky branching conventions, like the default branch is named `dev` rather than `master` as you might expect.  We're using gitflow: the approach is described in a [blog post](http://lloyd.io/applying-gitflow).

**contributions** - please issue pull requests targeted at the `dev` branch

## LICENSE

All source code here is available under the [MPL 2.0][] license, unless
otherwise indicated.

  [MPL 2.0]: https://mozilla.org/MPL/2.0/

