#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
import re

from browserid.mocks.user import MockUser
from browserid.tests import restmail
from persona_server.pages.home import HomePage
from persona_server.pages.complete_registration import CompleteRegistration
from persona_server.pages.account_manager import AccountManager


class BaseTest(object):

    def clear_browser(self, mozwebqa):
        mozwebqa.selenium.execute_script('localStorage.clear()')


    # move this to BrowserID when personatestuser.org comes online
    def create_verified_user(self, mozwebqa):
        '''Create a user, verify it, and return it.'''
        user = MockUser()

        # create the user
        home = HomePage(mozwebqa)
        signup = home.click_sign_up()
        signup.sign_up(user.primary_email, user.password)

        # do email verification
        complete_registration = CompleteRegistration(mozwebqa,
            self.get_confirm_url_from_email(user.primary_email),
            expect='success')
        assert 'Thank you' in complete_registration.thank_you

        # go sign out and reload page for preconditions
        account_manager = AccountManager(mozwebqa)
        account_manager.load_page()
        account_manager.sign_out()
        self.clear_browser(mozwebqa)
        home.load_page()  # test will instantiate HomePage

        return user

    def get_confirm_url_from_email(self, email, message_count=1, regex='(https?:.*?token=.{48})'):
        '''
        Checks the restmail inbox for the specified address
        and returns the confirm url.
        Specify message_count if you expect there to be more than one message for the user.
        Specify regex if you wish to use a specific regex. By default searches for a url with a 48 char token."
        '''
        mail = restmail.get_mail(email, message_count=message_count, timeout=60)
        message_text = mail[message_count - 1]['text']
        return re.search(regex, message_text).group(0)
