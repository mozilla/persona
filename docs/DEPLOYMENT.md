<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

**NOTE:** this document is outdated and should be updated, it's left here
because there is *some* still some potentially useful information.  
Reader beware.

# How to deploy BrowserID

This describes how to take the code here, put it on a server, and build
a service like browserid.org.  

So what are we deploying, anyway?

  * *the browserid server* - a node.js server which implements a web services
    api, stores a record of users, the email addresses they've verified, a
    bcrypted password, outstanding verification tokens, etc.
  * *the verifier* - a stateless node.js server which does cryptographic
    verification of assertions. This thing is hosted on browserid.org as a
    convenience, but people using browserid can choose to relocated it if they
    want to their own servers.
  * *the browserid.org website* - the templates, css, and javascript that make
    up the visible part of browserid.org
  * *the javascript/HTML dialog & include library* - this is include.js and the
    code that it includes, the bit that someone using browserid will include.

## Overview

### Software in use

This document assumes we're deploying on an **Ubuntu 10.04.1 LTS** box,
and using the following software:

  * **nginx** - frontend web server that handles static content and
    serves as a reverse proxy for node.js servers running on localhost

    config: `/etc/nginx/conf/nginx.conf`

  * **node.js** - all non-static servers run with node.  modules are installed
    using npm in `/home/http/node_modules`

  * **monit** - provides monitoring and automatic restarting of node.js servers
    when they go down (by accident or upon code publishing).

    config files are: `/etc/monitrc`, and `/etc/monit.d/*`

    helper script that starts node servers: `/etc/monit.d/start_node_server`

  * **gitolite** - installed under the git user to provide multi-user ssh based
    git access.  post-update hook handles updating code and restarting servers.

    hook: `/home/git/.gitolite/hooks/common/post-update`

### Permissions conventions

  * *nginx* runs as user 'www-data'
  * *node.js* servers run as user 'www-data'
  * when *git* pushing, all publishing and restarting runs as user 'git'

## Setup

### 1. Install gitolite

*This step is optional*.  gitlite turns a normal unix machine into a
"git server".  All that gitolite does is provide some utilities and
the infrastructure required to make it possible for multiple users to
authenticate to a particular user on the box using ssh keys for the
purposes of updating code.  While requiring a bit of setup, in practice
this is a fabulously lightweight way to make the releases process sing.

Let's get started:

  1. create a "git" user: `sudo adduser git`
  2. install git if required: `sudo apt-get install git-core`
  3. become user git: `sudo su -s /bin/bash git`
  4. hop into your home directory: `cd`
  5. install gitolite: [This.](http://sitaramc.github.com/gitolite/nonroot.html)
  6. add a browserid repo: [This.](http://sitaramc.github.com/gitolite/add.html)

At this point you've morphed your servers into git servers.  Go ahead and
add a remote to your local copy of the browserid repo and push to it:
`git remote add shortaliasforthenewvm git@myserver:browserid.git && git push --all shortaliasforthenewvm` 

Now you have a clone of your browserid repository that's trivial to update.
You can use ssh keys with passphrases and ssh-agent if security is a concern.

### 2. Install node.js

At present we're running node.js 0.4.10.  Lastest along the 4 line should
work:

  1. install dev tools, required to build node: `apt-get install g++ libssl-dev`
  2. build and install node: `./configure && make && sudo make install`
  3. install npm, required to install uglify-js: `git clone https://github.com/isaacs/npm.git && cd npm && sudo make install`
  4. intstall uglify-js, required to create production resources: `npm install -g uglify-js`

### 3. Install software prerequisites

Subsequent steps use different software which you might need to install.

  * **curl** - used to initiate http requests from the command line (to kick the browserid server)
  * **java** - used to minify css
  * **mysql 5.1+** - the preferred persistence backend

### 4. Set up mysql

  0. ensure you can connect via TCP - localhost:3306 (like, make sure skip-networking is off in my.cnf)
  1. connect to the database as user root - `mysql -u root`
  2. `CREATE USER 'browserid'@'localhost' IDENTIFIED BY 'browserid';`
  3. `CREATE DATABASE browserid;`
  4. `GRANT CREATE, DELETE, INDEX, INSERT, LOCK TABLES, SELECT, UPDATE ON browserid.* TO 'browserid'@'localhost';`

### 5. Set up git post-update hook

*This step is optional* - if you want to manually update code, then you
probably skipped step #1; you can skip this one as well.  All you need
to do is check out the code from github and run node.

Given that we've now got a simple way to push updates to the server, and
we've got npm and node running, let's get the software running!  The task
here is to create a git `post-update` hook to have the server update its
code and restart the server when code is pushed.

To get this done, we'll configure a hook which will live on your server
in the git user's git directory:

First, [do this] to add a blank executable post-update hook.

  [do this]: http://sitaramc.github.com/gitolite/hooks.html

Now, here's a full sample script that you can start with for that
post-update hook, annotated to help you follow along:

<pre>
#!/bin/bash

# only run these commands if it's the browserid repo bein' pushed
if [ "x$GL_REPO" == 'xbrowserid' ] ; then
    # create a temporary directory where we'll stage new code
    NEWCODE=`mktemp -d`
    echo "staging code to $NEWCODE"
    mkdir -p $NEWCODE
    git archive --format=tar dev | tar -x -C $NEWCODE

    echo "generating production resources"
    cd $NEWCODE/browserid && ./compress.sh && cd -

    # XXX: stop the servers!  you should deliver SIGINT to each
    # process

    # now move code into place, and keep a backup of the last code
    # that was in production in .old
    echo "moving updated code into place"
    rm -rf /home/browserid/code.old
    mv /home/browserid/code{,.old}
    mv $NEWCODE /home/browserid/code

    echo "fixing permissions"
    find /home/browserid/code -exec chgrp www-data {} \; > /dev/null 2>&1
    find /home/browserid/code -type d -exec chmod 0775 {} \; > /dev/null 2>&1
    find /home/browserid/code -type f -exec chmod ga+r {} \; > /dev/null 2>&1
    find /home/browserid/code -type f -perm /u+x -exec chmod g+x {} \; > /dev/null 2>&1

    echo "updating dependencies"
    ln -s /home/browserid/node_modules /home/browserid/code/node_modules
    cd /home/browserid/code && npm install && cd -
fi
</pre>

### 6. Get node servers running

At this point, pushing code to gitolite will cause /home/browserid/code to be updated.  Now
we need to get the servers running!  First, verify that the servers will run manually.
For the browserid server:

    cd /home/browserid/code/browserid && sudo -u www-data ./run.js

And for the verifier:

    cd /home/browserid/code/verifier && sudo -u www-data ./run.js

Now let's set up [monit] to restart the node.js servers:

  1. install monit: `sudo apt-get install monit`
  2. enable monit by editing `/etc/default/monit`
  3. configure monit.  make `/etc/monit/monitrc` look like this:

<pre>
set daemon 10
set logfile /var/log/monit.log
include /etc/monit.d/*
</pre>

  4. Add a little utility script (`chmod +x`) to run the node servers at
     `/etc/monit/start_node_server`:

<pre>
#!/bin/bash
/usr/local/bin/node $1 > $(dirname $1)/error.log 2>&1 &
</pre>

  5. create a file to run the verifier at `/etc/monit.d/verifier`:

<pre>
check host verifier with address 127.0.0.1
    start program = "/etc/monit/start_node_server /home/browserid/code/verifier/run.js"
        as uid "www-data" and gid "www-data"
    stop program  = "/usr/bin/pkill -f '/usr/local/bin/node /home/browserid/code/verifier/run.js'"
    if failed port 62800 protocol HTTP
        request /__heartbeat__
        with timeout 10 seconds
        then restart
</pre>

  5. create a file to run the browserid server at `/etc/monit.d/browserid`:

<pre>
check host browserid.org with address 127.0.0.1
    start program = "/etc/monit/start_node_server /home/browserid/code/browserid/run.js"
        as uid "www-data" and gid "www-data"
    stop program  = "/usr/bin/pkill -f '/usr/local/bin/node /home/browserid/code/browserid/run.js'"
    if failed port 62700 protocol HTTP
        request /__heartbeat__
        with timeout 10 seconds
        then restart
</pre>

  6. verify servers are running!  check `/var/log/monit.log`, curl ports 62700
     and 62800, and verify servers are restarted after 10 seconds if you kill em!

### 7. Install nginx

At this point we've got automatic server restart, simple git based code
publishing, and all of the software prerequisites installed on the box.  The
final bit of work is to set up nginx in such a way that it will properly proxy
requests to the external interface to the proper node server:

  1. remove any other webservers that come with your vm (like apache)
  2. install nginx: `sudo apt-get install nginx`
  3. configure nginx, make `/etc/nginx/nginx.conf` look like this:

<pre>
user www-data;
worker_processes  1;

error_log  /var/log/nginx/error.log;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
    # multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    access_log    /var/log/nginx/access.log;
    sendfile        on;

    keepalive_timeout  65;
    tcp_nodelay        on;

    gzip  on;
    gzip_disable "MSIE [1-6]\.(?!.*SV1)";
    gzip_proxied any;
    gzip_types text/html application/json application/javascript text/css application/x-font-ttf application/atom+xml;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
} 
</pre>

  4. configure the webserver for browserid:

<pre>
server {
    listen       80 default;
    server_name  browserid.org;

    # pass /verify invocations to the verifier
    location /verify {
        proxy_pass        http://127.0.0.1:62800;
        proxy_set_header  X-Real-IP  $remote_addr;
    }

    # pass everything else the browserid server
    location / {
        proxy_pass        http://127.0.0.1:62700;
        proxy_set_header  X-Real-IP  $remote_addr;
    }
}
</pre>

  5. restart your webserver: `sudo /etc/init.d/nginx restart`

     confirm that it's accepting requests: `curl -I -H 'Host: browserid.org' http://localhost:80/`

### 8. Set up log rotation

create a file as root at `/etc/logrotate.d/browserid`:

    /home/browserid/var/log/browserid.log /home/browserid/var/log/browserid-metrics.json /home/browserid/var/log/verifier.log /home/browserid/var/log/verifier-metrics.json {
        daily
        rotate 30
        copytruncate
        dateext
        compress
        dateformat -%Y-%m-%d
    }

Now your logfiles will be automatically rotated.

Easy, right?
