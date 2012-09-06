#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


class Base(object):

    def __init__(self, selenium, timeout=60):
        self.selenium = selenium
        self.timeout = timeout
        self._main_window_handle = self.selenium.current_window_handle

    def switch_to_main_window(self):
        self.selenium.switch_to_window(self._main_window_handle)
