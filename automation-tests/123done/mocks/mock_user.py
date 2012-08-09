#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


class MockUser(dict):

    def __init__(self, **kwargs):
        # set your default values
        import time

        self['email'] = '123donetest_%s@restmail.net' % repr(time.time())
        self['password'] = 'Password12345'

        # update with any keyword arguments passed
        self.update(**kwargs)

    # allow getting items as if they were attributes
    def __getattr__(self, attr):
        return self[attr]
