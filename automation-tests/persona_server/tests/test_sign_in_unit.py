#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest
from unittestzero import Assert

from persona_server.pages.home import HomePage
from browserid.mocks.user import MockUser

from base import BaseTest


class TestSignInUnit(BaseTest):

    def test_getters_sign_in(self, mozwebqa):
        user = self.create_verified_user(mozwebqa)
        home = HomePage(mozwebqa)

        # sign in
        signin = home.click_sign_in()
        signin.email = user.primary_email
        Assert.equal(signin.email, user.primary_email)
        signin.click_next()
        signin.password = user.password
        Assert.equal(signin.password, user.password)

    def test_getters_sign_up(self, mozwebqa):
        user = MockUser()
        home = HomePage(mozwebqa)

        # sign up
        signup = home.click_sign_up()
        signup.email = user.primary_email
        Assert.equal(signup.email, user.primary_email)
        signup.click_next()
        signup.password = user.password
        signup.verify_password = user.password
        Assert.equal(signup.password, user.password)
        Assert.equal(signup.verify_password, user.password)
