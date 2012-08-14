#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from base import Base
from sign_in import SignIn


class HomePage(Base):
    '''HomePage is used when not logged in. Use AccountManager page if logged in.'''

    _page_title = 'Mozilla Persona: A Better Way to Sign In'
    _page_url = '/'
    _sign_in_locator = (By.CSS_SELECTOR, 'a.signIn')
    _sign_up_locator = (By.CSS_SELECTOR, 'a.button.create')
    _manage_section_locator = (By.ID, 'manage')
    _sign_out_locator = (By.CSS_SELECTOR, 'a.signOut')

    def __init__(self, mozwebqa):
        Base.__init__(self, mozwebqa)
        longer_timeout = self.timeout * 2
        WebDriverWait(self.selenium, longer_timeout).until(
                lambda s: s.find_element(*self._sign_in_locator) and \
                s.find_element(*self._sign_in_locator).is_displayed(),
                "the sign in button has not appeared within %s" % longer_timeout)

    def click_sign_up(self):
        """Clicks the Sign Up button."""
        self.selenium.find_element(*self._sign_up_locator).click()
        return SignIn(self.mozwebqa)

    def click_sign_in(self):
        """Clicks the Sign In button."""
        self.selenium.find_element(*self._sign_in_locator).click()
        return SignIn(self.mozwebqa)
