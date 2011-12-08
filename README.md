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

## Quick Start Virtual Machine

We've prepared a VM so you can test/hack/have fun with BrowserID without modifying your local computer (too much). Skip to the next section "Dependencies", for detailed instructions to install this codebase locally, instead of using Vagrant.

1. Install [Vagrant](http://vagrantup.com/docs/getting-started/index.html).

This does add ruby, ruby-gems, and VirtualBox to your local desktop computer. No other software 
or changes will be made.

2. Boot up the VM:

```
cd browserid
vagrant up
vagrant ssh vagrant@lucid32:browserid
node ./run.js
```

`vagrant up` will take a while. Go get a cup of coffee. This is because it downloads the 500MB VM.

You can now browse to http://localhost:10001 and http://localhost:10002.

Any changes to the source code on your local computer are immediately mirrored in the VM.

Handy for dev and QA tasks, but if you want to install from scratch...

## Dependencies

Here's the software you'll need installed:

* node.js (>= 0.6.2): http://nodejs.org/
* npm: http://npmjs.org/ (or bundled with node in 0.6.3+)
* git
* g++

## Getting started:

1. install node and npm
3. run `npm install` to install 3rd party libraries and generate keys
3. run `npm start` to start the servers locally
4. visit the demo application ('rp') in your web browser (url output on the console at runtime)

## Testing

Unit tests can be run by invoking `npm test` at the top level, and you
should run them often.  Like before committing code.  To fully test
the code you should install mysql and have a well permissions `test`
user (can create and drop databases).  If you don't have mysql installed,
code testing is still possible (it just uses a little json database).

## Development model

**branching & release model** - You'll notice some funky branching conventions, like the default branch is named `dev` rather than `master` as you might expect.  We're using gitflow: the approach is described in a [blog post](http://lloyd.io/applying-gitflow).

**contributions** - please issue pull requests targeted at the `dev` branch


