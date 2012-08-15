#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait


class Base(object):

    _body_locator = (By.TAG_NAME, 'body')

    def __init__(self, mozwebqa):
        self.mozwebqa = mozwebqa
        self.selenium = mozwebqa.selenium
        self.timeout = mozwebqa.timeout
        self.base_url = mozwebqa.base_url

    @property
    def signed_in(self):
        """Returns True/False whether a user is signed in."""
        return 'not_authenticated' not in self.selenium.find_element(*self._body_locator).get_attribute('class')

    def load_page(self):
        if self._page_url:
            self.selenium.get(self.base_url + self._page_url)
            self.wait_for_ajax()

    def wait_for_ajax(self):
        """Waits for the script 'jQuery.active == 0'."""
        WebDriverWait(self.selenium, self.timeout).until(
            lambda s: s.execute_script("return jQuery.active == 0"),
            "Wait for AJAX timed out after %s seconds" % self.timeout)
