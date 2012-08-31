#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from page import Page


class HomePage(Page):

    _page_title = '123done - your tasks, simplified'

    _sign_in_locator = (By.CSS_SELECTOR, '#loggedout > button')
    _logout_locator = (By.CSS_SELECTOR, '#loggedin > a')
    _logged_in_user_email_locator = (By.CSS_SELECTOR, '#loggedin > span')
    _loading_spinner_locator = (By.CSS_SELECTOR, "li.loading img")

    def go_to_home_page(self):
        self.selenium.get(self.base_url + '/')
        WebDriverWait(self.selenium, self.timeout).until(
            lambda s: not self.is_element_visible(*self._loading_spinner_locator),
            'Timeout waiting for sign-in button to appear.')
        self.is_the_current_page

    def sign_in(self, user='default'):
        credentials = self.testsetup.credentials[user]
        browserid = self.click_sign_in()
        browserid.sign_in(credentials['email'], credentials['password'])
        self.wait_for_user_login()

    def logout(self):
        self.click_logout()
        WebDriverWait(self.selenium, self.timeout).until(
            lambda s: self.is_element_visible(*self._sign_in_locator) and not \
                      self.is_element_visible(*self._loading_spinner_locator),
            'Timeout waiting for user to log out.')

    def click_sign_in(self, expect='new'):
        """Click the 'sign in' button.

        Keyword arguments:
        expect -- the expected resulting page
                  'new' for user that is not currently signed in (default)
                  'returning' for users already signed in or recently verified

        """
        self.selenium.find_element(*self._sign_in_locator).click()
        from browserid.pages.sign_in import SignIn
        return SignIn(self.selenium, self.timeout, expect=expect)

    def click_logout(self):
        self.selenium.find_element(*self._logout_locator).click()

    @property
    def is_logged_in(self):
        return self.is_element_visible(*self._logout_locator)

    @property
    def logged_in_user_email(self):
        WebDriverWait(self.selenium, self.timeout).until(
            lambda s: self.is_element_visible(*self._logged_in_user_email_locator)and not \
                      self.is_element_visible(*self._loading_spinner_locator),
            "Timeout waiting for user's email to appear.")
        return self.selenium.find_element(*self._logged_in_user_email_locator).text

    def wait_for_user_login(self):
        WebDriverWait(self.selenium, self.timeout).until(
            lambda s: self.is_element_visible(*self._logout_locator) and not \
                      self.is_element_visible(*self._loading_spinner_locator),
            'Timeout waiting for user to login.')
