<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Here lives the [Persona][] login implementation. This is an implementation of the
[BrowserID protocol][].

  [Persona]: https://browserid.org
  [BrowserID protocol]: https://github.com/mozilla/id-specs

This repository contains several distinct things related to BrowserID:

  * **the browserid server** - a node.js server which implements a web services api, stores a record of users, the email addresses they've verified, a bcrypted password, outstanding verification tokens, etc
  * **the verifier** - a stateless node.js server which does cryptographic verification of assertions. This thing is hosted on login.persona.org as a convenience, but people using browserid can choose to host their own version if they wish to.
  * **sample and test code** - to test the above
  * **the login.persona.org website** - the templates, css, and javascript that make up the visible part of login.persona.org
  * **the javascript/HTML dialog & include library** - this is include.js and the code that it includes, the bit that someone using browserid will include.

## Getting Started

If you want to work on the core BrowserID service, follow these instructions:

### Install Dependencies

BrowserID needs the following dependencies before it can run:

* node.js (>= 0.6.2): http://nodejs.org
* npm: http://npmjs.org/ (or bundled with node in 0.6.3+)
* libgmp3
* git
* g++

For detailed instructions for your particular operating system, check out the `SETUP` docs in the `docs/` folder.

### Configure Git

The BrowserID team uses Git and GitHub for all of our collaboration, code hosting, and bug tracking. If you want to help out with core development, you'll need to sign up for a GitHub account and configure Git:

1. Sign up for a GitHub account at https://github.com/
2. Learn how to configure Git at http://help.github.com/articles/set-up-git
3. Learn how to fork and clone a repository at https://help.github.com/articles/fork-a-repo

If you'd like to use SSH keys instead of a password when you authenticate with GitHub, refer to https://help.github.com/articles/generating-ssh-keys

If you'd like to contribute code back to us, please do so using a GitHub Pull Request, as we follow the "Fork and Pull" collaborative development model. You can learn about pull requests at https://help.github.com/articles/using-pull-requests

### Running BrowserID Locally

To run the BrowserID service locally, you must first:

1. Clone the repository to your local machine.
2. Run `npm install` from the root of your local clone.

You can then start the BrowserID suite of services by running `npm start` from the root of your local clone.

When you run `npm start`, it will print several URLs to your terminal. You can test that everything is working by visiting the URL for the `example` (RP) site. Look for a line like this in the terminal: `example (10361): running on http://127.0.0.1:10001`.

You can stop the services by typing Control-C in the terminal.

### Staying Up to Date

To stay up to date with BrowserID:

1. Use `git pull` to retrieve new changes.
2. Delete both the `var` and `node_modules` folders in the root of your local clone.
3. Run `npm install` from the root of your local clone.

## Testing

### Local testing:
Unit tests can be run by invoking `npm test` at the top level.  At present,
there are three classes of unit tests to be run:

  * Backend unit tests against a custom, zero-dependency JSON database
  * Backend unit tests against MySQL, what we use in production
  * Frontend unit tests run headlessly against PhantomJS

You can control which tests are run using the `WHAT_TESTS` env var, see
`scripts/test` for details.

### Continuous Integration Testing:
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

## Development Model

**branching & release model** - You'll notice some funky branching conventions, like the default branch is named `dev` rather than `master` as you might expect.  We're using gitflow: the approach is described in a [blog post](http://lloyd.io/applying-gitflow).

**contributions** - please issue pull requests targeted at the `dev` branch

## LICENSE

All source code here is available under the [MPL 2.0][] license, unless
otherwise indicated.

  [MPL 2.0]: https://mozilla.org/MPL/2.0/
