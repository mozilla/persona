#!/usr/bin/env bash

sudo /sbin/chkconfig mysqld on
sudo /sbin/service mysqld start
echo "CREATE USER 'browserid'@'localhost';" | mysql -u root
echo "CREATE DATABASE browserid;" | mysql -u root
echo "GRANT ALL ON browserid.* TO 'browserid'@'localhost';" | mysql -u root
