#!/usr/bin/env bash

sudo /sbin/chkconfig mysqld on
sudo /sbin/service mysqld start
sudo mysql -u root < $(dirname "${BASH_SOURCE[0]}")/create_browserid_user.sql
echo "CREATE USER 'browserid'@'localhost';" | mysql -u root 
echo "CREATE DATABASE browserid;" | mysql -u root
echo "GRANT ALL ON browserid.* TO 'browserid'@'localhost';" | mysql -u root

