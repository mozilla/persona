#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import re

import requests
from selenium.webdriver.support.ui import WebDriverWait

from .. import BrowserID
from .. mocks.user import MockUser
import restmail


class BaseTest(object):

    def browserid_url(self, base_url):
        response = requests.get('%s/' % base_url, verify=False)
        match = re.search(BrowserID.INCLUDE_URL_REGEX, response.content)
        if match:
            return match.group(1)
        else:
            raise Exception('Unable to determine BrowserID URL from %s.' % base_url)

    def log_out(self, selenium, timeout):
        WebDriverWait(selenium, timeout).until(
            lambda s: s.find_element_by_id('loggedin').is_displayed())
        selenium.find_element_by_css_selector('#loggedin a').click()
        WebDriverWait(selenium, timeout).until(
            lambda s: s.find_element_by_css_selector('#loggedout button').is_displayed())

    def create_verified_user(self, selenium, timeout):
        user = MockUser()
        from .. pages.sign_in import SignIn
        signin = SignIn(selenium, timeout, expect='new')
        signin.sign_in_new_user(user.primary_email, user.password)
        mail = restmail.get_mail(user.primary_email, timeout=timeout)
        verify_url = re.search(BrowserID.VERIFY_URL_REGEX,
                               mail[0]['text']).group(0)

        selenium.get(verify_url)
        from .. pages.complete_registration import CompleteRegistration
        complete_registration = CompleteRegistration(selenium,
                                                     timeout,
                                                     expect='success')
        assert 'Thank you' in complete_registration.thank_you
        return user
