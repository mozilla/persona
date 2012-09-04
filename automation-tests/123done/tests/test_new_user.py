#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from pages.home import HomePage
from restmail.restmail import RestmailInbox
from mocks.mock_user import MockUser
from unittestzero import Assert

import pytest


class TestNewAccount:

    def test_can_create_new_user_account(self, mozwebqa):
        user = MockUser()
        home_pg = HomePage(mozwebqa)

        home_pg.go_to_home_page()
        bid_login = home_pg.click_sign_in()
        bid_login.sign_in_new_user(user['email'], user['password'])

        # Open restmail inbox, find the email
        inbox = RestmailInbox(user['email'])
        email = inbox.find_by_index(0)

        # Load the BrowserID link from the email in the browser
        from browserid.pages.complete_registration import CompleteRegistration
        complete_registration = CompleteRegistration(mozwebqa.selenium, mozwebqa.timeout, email.verify_user_link)

        Assert.equal(home_pg.logged_in_user_email, user['email'])
