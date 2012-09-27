#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from base import Base


class AccountManager(Base):
    '''AccountManager is used when logged in. Use HomePage page if not logged in.'''

    _page_url = '/'
    _emails_locator = (By.CSS_SELECTOR, '#emailList .email')
    _edit_password_button_locator = (By.CSS_SELECTOR, '#edit_password button.edit')
    _old_password_field_locator = (By.ID, 'old_password')
    _new_password_field_locator = (By.ID, 'new_password')
    _change_password_done_locator = (By.ID, 'changePassword')
    _sign_in_locator = (By.CSS_SELECTOR, 'a.signIn')
    _sign_out_locator = (By.CSS_SELECTOR, 'a.signOut')
    _cancel_account_locator = (By.ID, 'cancelAccount')

    def load_page(self):
        Base.load_page(self)
        self.wait_for_page_to_load()

    def wait_for_page_to_load(self):
        WebDriverWait(self.selenium, self.timeout).until(
            lambda s: s.find_element(*self._emails_locator).is_displayed())

    @property
    def emails(self):
        """Returns a textual list of email addresses associated with the currently signed in user."""
        return [element.text for element in self.selenium.find_elements(*self._emails_locator)]

    def click_edit_password(self):
        """Click edit password to show the new/old password fields"""
        self.selenium.find_element(*self._edit_password_button_locator).click()
        WebDriverWait(self.selenium, self.timeout).until(
            lambda s: s.find_element(*self._old_password_field_locator).is_displayed())

    @property
    def old_password(self):
        """Get the value of the old password field."""
        return self.selenium.find_element(*self._old_password_field_locator).text

    @old_password.setter
    def old_password(self, value):
        """Set the value of the old password field."""
        password = self.selenium.find_element(*self._old_password_field_locator)
        password.clear()
        password.send_keys(value)

    @property
    def new_password(self):
        """Get the value of the new password field."""
        return self.selenium.find_element(*self._new_password_field_locator).text

    @new_password.setter
    def new_password(self, value):
        """Set the value of the new password field."""
        password = self.selenium.find_element(*self._new_password_field_locator)
        password.clear()
        password.send_keys(value)

    def click_password_done(self):
        """Click password done to save the new password."""
        self.selenium.find_element(*self._change_password_done_locator).click()
        WebDriverWait(self.selenium, self.timeout).until(
            lambda s: s.find_element(*self._edit_password_button_locator).is_displayed())

    def click_sign_out(self):
        """Click the Sign Out button"""
        self.selenium.find_element(*self._sign_out_locator).click()
        WebDriverWait(self.selenium, self.timeout).until(
            lambda s: not self.signed_in)

    def click_cancel_account(self):
        """Click the cancel account link."""
        self.selenium.find_element(*self._cancel_account_locator).click()

    def change_password(self, old_password, new_password):
        """
        Helper function change_password(old_password, new_password) performs the
        series of actions necessary to change the password.
        """

        self.click_edit_password()
        self.old_password = old_password
        self.new_password = new_password
        self.click_password_done()

    def sign_out(self):
        """
        Helper function sign_out() performs the series of actions necessary to
        sign out.
        """

        self.click_sign_out()
        from home import HomePage  # circular reference
        return HomePage(self.mozwebqa)

    def cancel_account(self):
        """
        Helper function cancel_account() performs the series of actions necessary
        to cancel the account of the currently signed in user.
        """

        self.click_cancel_account()
        self.selenium.switch_to_alert().accept()
        from home import HomePage  # circular reference
        return HomePage(self.mozwebqa)
