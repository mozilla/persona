#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest
from selenium.webdriver.support.ui import WebDriverWait

from .. import BrowserID
from base import BaseTest


@pytest.mark.nondestructive
class TestSignIn(BaseTest):

    @pytest.mark.travis
    def test_change_password(self, mozwebqa):
        user = self.create_verified_user(mozwebqa.selenium, mozwebqa.timeout)

        mozwebqa.selenium.get(self.browserid_url(mozwebqa.base_url))
        from .. pages.account_manager import AccountManager
        account_manager = AccountManager(mozwebqa.selenium, mozwebqa.timeout)

        assert user.primary_email in account_manager.emails

        account_manager.click_edit_password()
        account_manager.old_password = user.password
        user.password += '_new'
        account_manager.new_password = user.password
        account_manager.click_password_done()
        account_manager.click_sign_out()

        mozwebqa.selenium.get('%s/' % mozwebqa.base_url)

        login_locator = '#loggedout button'
        WebDriverWait(mozwebqa.selenium, mozwebqa.timeout).until(
            lambda s: s.find_element_by_css_selector(login_locator).is_displayed())
        mozwebqa.selenium.find_element_by_css_selector(login_locator).click()

        browser_id = BrowserID(mozwebqa.selenium, mozwebqa.timeout)
        browser_id.sign_in(user.primary_email, user.password)

        WebDriverWait(mozwebqa.selenium, mozwebqa.timeout).until(
            lambda s: s.find_element_by_id('loggedin').is_displayed())
