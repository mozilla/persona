#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from selenium.webdriver.support.ui import WebDriverWait


def pytest_runtest_setup(item):
    item.config.option.api = 'webdriver'


def pytest_funcarg__mozwebqa(request):
    mozwebqa = request.getfuncargvalue('mozwebqa')
    mozwebqa.selenium.get('%s/' % mozwebqa.base_url)
    WebDriverWait(mozwebqa.selenium, mozwebqa.timeout).until(
        lambda s: s.find_element_by_css_selector('#loggedout button').is_displayed())
    mozwebqa.selenium.find_element_by_css_selector('#loggedout button').click()
    return mozwebqa
