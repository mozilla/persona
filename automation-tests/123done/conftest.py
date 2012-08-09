#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import py

def pytest_runtest_setup(item):
    pytest_mozwebqa = py.test.config.pluginmanager.getplugin("mozwebqa")
    pytest_mozwebqa.TestSetup.server_base_url = item.config.option.server_base_url


def pytest_addoption(parser):
    parser.addoption("--serverbaseurl",
                     action="store",
                     dest='server_base_url',
                     metavar='str',
                     default="https://login.dev.anosrep.org",
                     help="specify the server base url")


def pytest_funcarg__mozwebqa(request):
    pytest_mozwebqa = py.test.config.pluginmanager.getplugin("mozwebqa")
    return pytest_mozwebqa.TestSetup(request)
