#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from page import Page


class HomePage(Page):

    _page_title = 'My Favorite Beer, a BrowserID example'

    _sign_in_locator = (By.CSS_SELECTOR, '#loginInfo .login')
    _logout_locator = (By.ID, 'logout')

    def go_to_home_page(self):
        self.selenium.get(self.base_url + '/')
        self.is_the_current_page

    def sign_in(self, user='default'):
        credentials = self.testsetup.credentials[user]
        self.click_sign_in()
        from browserid import BrowserID
        browserid = BrowserID(self.selenium, self.timeout)
        browserid.sign_in(credentials['email'], credentials['password'])

    def logout(self):
        self.click_logout()
        WebDriverWait(self.selenium, self.timeout).until(
            lambda s: not self.is_element_present(*self._logout_locator))

    def click_sign_in(self):
        self.selenium.find_element(*self._sign_in_locator).click()

    def click_logout(self):
        self.selenium.find_element(*self._logout_locator).click()

    @property
    def is_logged_in(self):
        return self.is_element_visible(*self._logout_locator)
