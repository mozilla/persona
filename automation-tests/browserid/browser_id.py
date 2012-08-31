#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import urllib2
import json

import selenium


class BrowserID(object):

    VERIFY_URL_REGEX = 'https?:\/\/(\S+)\/verify_email_address\?token=(.{48})'
    CONFIRM_URL_REGEX = 'https?:\/\/(\S+)\/confirm\?token=(.{48})'
    RESET_URL_REGEX = 'https?:\/\/(\S+)\/reset_password\?token=(.{48})'
    INCLUDE_URL_REGEX = '(https?:\/\/(\S+))\/include\.js'

    def __init__(self, selenium, timeout=60):
        self.selenium = selenium
        self.timeout = timeout

    def sign_in(self, email, password):
        """Signs in using the specified email address and password."""
        from pages.sign_in import SignIn
        sign_in = SignIn(self.selenium, timeout=self.timeout, expect='new')
        sign_in.sign_in(email, password)

    def persona_test_user(self, verified=True, env='prod'):
        '''
        Create a test user.

        ::Args::
        - verified - boolean True/False should the user be verified
        - env      - string dev/stage/prod instance of persona.org used by 
                     the system under test(default prod)

        ::Returns::
        A dictionary that combines the values returned by the personatestuser API
        and the values returned by browserid.mocks.MockUser.

        {
            'email': 'lopez401@personatestuser.org'
            'primary_email': 'lopez401@personatestuser.org', 
            'pass': 'SOaUo9qJqYyBl1sN', 
            'password': 'SOaUo9qJqYyBl1sN', 
            'expires': '1346445745', 
            'verifier': 'https://verifier.dev.anosrep.org',
            'browserid': 'https://login.dev.anosrep.org', 
            'token': 'U6bFrRZJrZggwkJ0gkpvC9tuNNaIXpvEZM11gzLnw9l4o4UK', # for verified=False only
            'env': 'dev', 
        }

        '''
        command = ''
        if verified:
            command = 'email'
        else:
            command = 'unverified_email'

        response = urllib2.urlopen(
            'http://personatestuser.org/%s/%s' %
            (command, env), timeout=self.timeout)

        user = json.loads(response.read())
        user['password'] = user['pass']
        user['primary_email'] = user['email']
        user.pop('events')
        print user
        return user
