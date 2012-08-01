#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from base import Base

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait


class CompleteRegistration(Base):

    _email_locator = (By.ID, 'email')
    _password_locator = (By.ID, 'password')
    _finish_locator = (By.CSS_SELECTOR, 'div.submit > button')
    _thank_you_locator = (By.ID, 'congrats')

    def __init__(self, selenium, timeout, expect='success'):
        Base.__init__(self, selenium, timeout)

        if expect == 'success':
            WebDriverWait(self.selenium, self.timeout).until(
                lambda s: s.find_element(*self._thank_you_locator).is_displayed())
        elif expect == 'verify':
            WebDriverWait(self.selenium, self.timeout).until(
                lambda s: s.find_element(*self._password_locator).is_displayed())
        else:
            raise Exception('Unknown expect value: %s' % expect)

    @property
    def email(self):
        """Get the value of the email field."""
        return self.selenium.find_element(*self._email_locator).text

    @property
    def password(self):
        """Get the value of the password field."""
        return self.selenium.find_element(*self._password_locator).text

    @password.setter
    def password(self, value):
        """Set the value of the password field."""
        password = self.selenium.find_element(*self._password_locator)
        password.clear()
        password.send_keys(value)

    def click_finish(self):
        """Clicks the 'finish' button."""
        self.selenium.find_element(*self._finish_locator).click()
        WebDriverWait(self.selenium, self.timeout).until(
            lambda s: s.find_element(*self._thank_you_locator).is_displayed())

    @property
    def thank_you(self):
        """Returns the 'thank you' message."""
        return self.selenium.find_element(*self._thank_you_locator).text
