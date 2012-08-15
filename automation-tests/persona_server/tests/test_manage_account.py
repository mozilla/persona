#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest
from unittestzero import Assert

from persona_server.pages.home import HomePage
from persona_server.pages.complete_registration import CompleteRegistration
from persona_server.pages.account_manager import AccountManager
from browserid.mocks.user import MockUser
from browserid.tests import restmail

from base import BaseTest


class TestManageAccount(BaseTest):

    @pytest.mark.moztrap(272)
    def test_can_create_new_user_account(self, mozwebqa):
        user = MockUser()
        home = HomePage(mozwebqa)

        # sign up
        signup = home.click_sign_up()
        signup.sign_up(user.primary_email, user.password)
        Assert.equal(signup.check_your_email_title_text, 'Confirm your email address')

        # do email verification
        CompleteRegistration(mozwebqa,
            self.get_confirm_url_from_email(user.primary_email),
            expect='success')

        # verify now logged in
        account_manager = AccountManager(mozwebqa)
        account_manager.load_page()
        Assert.true(account_manager.signed_in)

    @pytest.mark.moztrap(273)
    @pytest.mark.nondestructive
    def test_that_user_can_sign_in_and_out(self, mozwebqa):
        # the dev server is being continually wiped, verified user must be fresh
        user = self.create_verified_user(mozwebqa)
        home = HomePage(mozwebqa)

        # sign in
        signin = home.click_sign_in()
        account_manager = signin.sign_in(user.primary_email, user.password)
        Assert.true(account_manager.signed_in)

        # sign out
        home = account_manager.sign_out()
        Assert.false(home.signed_in)

    @pytest.mark.moztrap(274)
    def test_that_user_can_change_password(self, mozwebqa):
        user = self.create_verified_user(mozwebqa)

        # sign in with old password
        home = HomePage(mozwebqa)
        signin = home.click_sign_in()
        account_manager = signin.sign_in(user.primary_email, user.password)
        Assert.contains(user.primary_email, account_manager.emails)

        # change password
        old_password = user.password
        user.password += '_new'
        account_manager.change_password(old_password, user.password)

        # sign out
        home = account_manager.sign_out()

        # sign in with new password
        signin = home.click_sign_in()
        account_manager = signin.sign_in(user.primary_email, user.password)
        Assert.true(account_manager.signed_in)
        Assert.contains(user.primary_email, account_manager.emails)

    @pytest.mark.moztrap(275)
    def test_that_user_can_cancel_account_with_one_email(self, mozwebqa):
        user = self.create_verified_user(mozwebqa)

        # sign in
        home = HomePage(mozwebqa)
        signin = home.click_sign_in()
        account_manager = signin.sign_in(user.primary_email, user.password)

        # cancel account
        home = account_manager.cancel_account()

        # verify email not recognized
        signin = home.click_sign_in()
        signin.email = user.primary_email
        signin.click_next()
        Assert.true(signin.is_sign_up_flow)

    def test_that_user_can_reset_password(self, mozwebqa):
        user = self.create_verified_user(mozwebqa)

        # start to sign in
        home = HomePage(mozwebqa)
        signin = home.click_sign_in()

        # forgot password
        user.password += '_new'
        signin.forgot_password(user.primary_email, user.password)
        Assert.equal(signin.check_your_email_title_text, 'Confirm your email address')

        # confirm email
        CompleteRegistration(mozwebqa,
            self.get_confirm_url_from_email(user.primary_email, message_count=2),
            expect='reset')

        # sign out
        account_manager = AccountManager(mozwebqa)
        account_manager.load_page()
        home = account_manager.sign_out()

        # sign in with new password
        signin = home.click_sign_in()
        account_manager = signin.sign_in(user.primary_email, user.password)
        Assert.true(account_manager.signed_in)
