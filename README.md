Here lives the [BrowserID] implementation.  BrowserID is an implementation of the 
[verified email protocol].

  [BrowserID]:https://browserid.org
  [verified email protocol]:https://wiki.mozilla.org/Labs/Identity/VerifiedEmailProtocol

This repository contains several distinct things related to BrowserID:

  * **the browserid server** - a node.js server which implements a web services api, stores a record of users, the email addresses they've verified, a bcrypted password, outstanding verification tokens, etc
  * **the verifier** - a stateless node.js server which does cryptographic verification of assertions. This thing is hosted on browserid.org as a convenience, but people using browserid can choose to relocated it if they want to their own servers.
  * **sample and test code** - to test the above
  * **the browserid.org website** - the templates, css, and javascript that make up the visible part of browserid.org
  * **the javascript/HTML dialog & include library** - this is include.js and the code that it includes, the bit that someone using browserid will include.

## Dependencies

Here's the software you'll need installed:

* node.js (>= 0.4.5): http://nodejs.org/
* npm: http://npmjs.org/
* Several node.js 3rd party libraries - see `package.json` for details

## Getting started:

1. install node
2. run `npm install` to installed 3rd party libraries into `node_modules`
3. run the top level *run.js* script: `node ./run.js`
4. visit the demo application ('rp') in your web browser (url output on the console at runtime)

## Testing

Unit tests can be run by invoking `test.sh` at the top level, and you
should run them often.  Like before committing code.  To fully test
the code you should install mysql and have a well permissions `test`
user (can create and drop databases).  If you don't have mysql installed,
code testing is still possible (it just uses a little json database).

## Development model

**branching & release model** - You'll notice some funky branching conventions, like the default branch is named `dev` rather than `master` as you might expect.  We're using gitflow: the approach is described in a [blog post](http://lloyd.io/applying-gitflow).

**contributions** - please issue pull requests targeted at the `dev` branch


