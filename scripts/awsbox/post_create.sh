#!/usr/bin/env bash

echo $(dirname "${BASH_SOURCE[0]}")/create_browserid_user.sql
exit 1

sudo /sbin/chkconfig mysqld on
sudo /sbin/service mysqld start
sudo mysql -u root < $(dirname "${BASH_SOURCE[0]}")/create_browserid_user.sql
