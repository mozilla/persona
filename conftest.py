#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import py


def pytest_runtest_setup(item):
    pytest_mozwebqa = py.test.config.pluginmanager.getplugin('mozwebqa')
    pytest_mozwebqa.TestSetup.email = item.config.option.email
    pytest_mozwebqa.TestSetup.password = item.config.option.password


def pytest_addoption(parser):
    group = parser.getgroup('persona', 'persona')
    group._addoption('--email',
                     action='store',
                     metavar='str',
                     help='email address for persona account')
    group._addoption('--password',
                     action='store',
                     metavar='str',
                     help='password for persona account')


def pytest_funcarg__mozwebqa(request):
    return request.getfuncargvalue('mozwebqa')
