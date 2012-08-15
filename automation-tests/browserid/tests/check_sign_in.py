#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest
from selenium.webdriver.support.ui import WebDriverWait

from .. import BrowserID
from .. mocks.user import MockUser
from base import BaseTest
import restmail


@pytest.mark.nondestructive
class TestSignIn(BaseTest):

    def test_sign_in_helper(self, mozwebqa):
        if mozwebqa.email == None:
            pytest.skip("no --email supplied")
        browser_id = BrowserID(mozwebqa.selenium, mozwebqa.timeout)
        browser_id.sign_in(mozwebqa.email, mozwebqa.password)

        WebDriverWait(mozwebqa.selenium, mozwebqa.timeout).until(
            lambda s: s.find_element_by_id('loggedin').is_displayed())

    def test_sign_in(self, mozwebqa):
        if mozwebqa.email == None:
            pytest.skip("no --email supplied")
        from .. pages.sign_in import SignIn
        signin = SignIn(mozwebqa.selenium, mozwebqa.timeout, expect='new')
        signin.email = mozwebqa.email
        signin.click_next(expect='password')
        signin.password = mozwebqa.password
        signin.click_sign_in()

        WebDriverWait(mozwebqa.selenium, mozwebqa.timeout).until(
            lambda s: s.find_element_by_id('loggedin').is_displayed())

    @pytest.mark.travis
    def test_sign_in_new_user_helper(self, mozwebqa):
        user = MockUser()
        from .. pages.sign_in import SignIn
        signin = SignIn(mozwebqa.selenium, mozwebqa.timeout, expect='new')
        print 'signing in as %s' % user.primary_email
        signin.sign_in_new_user(user.primary_email, 'password')
        mail = restmail.get_mail(user.primary_email, timeout=mozwebqa.timeout)
        assert 'Click to confirm this email address' in mail[0]['text']

    @pytest.mark.travis
    def test_sign_in_new_user(self, mozwebqa):
        user = MockUser()
        from .. pages.sign_in import SignIn
        signin = SignIn(mozwebqa.selenium, mozwebqa.timeout, expect='new')
        print 'signing in as %s' % user.primary_email
        signin.email = user.primary_email
        signin.click_next(expect='verify')
        signin.password = user.password
        signin.verify_password = user.password
        signin.click_verify_email()
        assert signin.check_email_at_address == user.primary_email

        signin.close_window()
        signin.switch_to_main_window()
        mail = restmail.get_mail(user.primary_email, timeout=mozwebqa.timeout)
        assert 'Click to confirm this email address' in mail[0]['text']

    @pytest.mark.travis
    def test_sign_in_returning_user(self, mozwebqa):
        self.create_verified_user(mozwebqa.selenium, mozwebqa.timeout)
        mozwebqa.selenium.get('%s/' % mozwebqa.base_url)
        WebDriverWait(mozwebqa.selenium, mozwebqa.timeout).until(
            lambda s: s.find_element_by_id('loggedin').is_displayed())
