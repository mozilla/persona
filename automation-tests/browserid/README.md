**B**rowser**ID** **P**age **O**bject **M**odel
===============================================
Selenium compatible page object model for Mozilla's BrowserID.

Documentation
-------------
See the project's [wiki](https://github.com/mozilla/bidpom/wiki).

Running BIDPOM's Tests
----------------------
* two tests in check_sign_in.py require --email and --password flags. they can be skipped by using the "-m travis" flag
* if running against a remote selenium server, add --capabilities={"avoid-proxy":true} to the command line
* if experiencing TimeoutErrors from WebDriverWait, add the --webqatimeout=90 to the command line

License
-------
This software is licensed under the [MPL](http://www.mozilla.org/MPL/2.0/) 2.0:

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
