# Deploying BrowserID on Amazon Web Services

This document will show you how to use the in-tree scripts to deploy
different versions of BrowserID onto Amazon's cloud infrastructure.

This is useful for testing changes in an environment similar to
production, or for sharing experimental changes with other people.

## Prerequisites

In order to use these deploy scripts, you need the following:

  1. have built and locally run browserid
  2. an ssh key in `~/.ssh/id_rsa.pub`
  3. an AWS account that is "signed up" for EC2
  4. the "DNS secret" that you get from lloyd

Once you have these things, you'll need to relay them to deployment
scripts via your environment.  you might put something like this
in your .bashrc:

    # This is your Access Key ID from your AWS Security Credentials
    export AWS_ID=<your id>
    # This is your Secret Access Key from your AWS Security Credentials
    export AWS_SECRET=<your secret>
    # This is a magic credential you get from lloyd
    export BROWSERID_DEPLOY_DNS_KEY=98...33

## Verify the credentials

You can verify that your credentials are properly configured, try:

    $ scripts/deploy.js test
    Checking DNS management access: good
    Checking AWS access: good

## Deploying your first VM

Let's get started.  To deploy your first vm, all you have to do is pick a 
hostname.  This might be something like `feature385` or `issue1000`, or 
you can use a different name that is short but meaningful to what you're
going to deploy.  Once chosen, invoke deploy.js like this:

    $ scripts/deploy.js deploy some_name_i_chose
    attempting to set up some_name_i_chose.hacksign.in
       ... VM launched, waiting for startup (should take about 20s)
       ... Instance ready, setting up DNS
       ... DNS set up, setting human readable name in aws
       ... name set, waiting for ssh access and configuring
       ... nope.  not yet.  retrying.
       ... nope.  not yet.  retrying.
       ... nope.  not yet.  retrying.
       ... nope.  not yet.  retrying.
       ... nope.  not yet.  retrying.
       ... victory!  server is accessible and configured
       ... and your git remote is all set up
    
    Yay!  You have your very own deployment.  Here's the basics:
    
     1. deploy your code:  git push some_name_i_chose <mybranch>:master
     2. visit your server on the web: https://some_name_i_chose.hacksign.in
     3. test via a website: http://some_name_i_chose.myfavoritebeer.org
     4. ssh in with sudo: ssh ec2-user@some_name_i_chose.hacksign.in
     5. ssh as the deployment user: ssh app@some_name_i_chose.hacksign.in
    
    enjoy!  Here's your server details {
        "instanceId": "i-8f4beeea",
        "imageId": "ami-6900d100",
        "instanceState": {
            "code": "16",
            "name": "running"
        },
        "dnsName": "ec2-184-73-84-132.compute-1.amazonaws.com",
        "keyName": "browserid deploy key (4736caec113ccb53aa62bb165c58c17d)",
        "instanceType": "t1.micro",
        "ipAddress": "184.73.84.132"
    }

The output contains instructions for use.  Note that every occurance of 
`some_name_i_chose` will be replaced with the name *YOU* chose.

IMPORTANT: Amazon charges money by the hour for running instances.  Destroy
instances when they are no longer needed to avoid unexpected charges.

## Deploying code to your server

The deployment process sets up a 'git remote', which just means it runs
the following command for you:

    $ git remote add some_name_i_chose app@<ipAddress>:git

This allows you to more conveniently push code to your server.  Say 
you wanted to now deploy code from `mybranch` on this new VM:

    $ git push some_name_i_chose mybranch:master

IMPORTANT: you are pushing *from* the local `mybranch`, to the remote 
`master` branch.  The VM will always deploy what's on its master branch.

Say you want to go push new changes from mybranch:

    $ git push some_name_i_chose mybranch:master

Yeah.  Same thing.

Say you want to push changes to this server from a completely different
branch:

    $ git push -f some_name_i_chose myotherbranch:master

You are pushing *from* the local `myotherbranch`, to the remote `master`.

## Seeing what VMs you have running

    $ scripts/deploy.js list
    ...

## Destroying your first VM

These things cost money by the hour, not a lot, but money.  So when you want to
decommission a VM and release your hold on the DNS name, simply:

    $ scripts/deploy.js destroy some_name_i_chose
    trying to destroy VM for some_name_i_chose.hacksign.in: done
    trying to remove DNS for some_name_i_chose.hacksign.in: done

## An overview of deployments

Deploying code in this fashion spins up a pre-configured VM template.
There are several things that are pre-configured for your pleasure:

  1. ssh keys: your public key is copied up to the server for passphraseless
     ssh access.
  2. Git support: an 'app' user is created with a repository under `~app/git`
     on the server, that you can push to.
  3. `post-update` hook: when you push to the `master` branch of the server's
     git repository, this code restarts your services to pick up the changes.
  4. nginx with SSL and 503 support - you'll get SSL for free and will see
     a reasonable message when your servers aren't running
  5. a mysql database with a browserid user without any password

### User Accounts

VMs have two pre-configured users, both which you have passphraseless SSH
access to:

  * `ec2-user` is an acct with full sudo access
  * `app` is an acct that has no sudo and is the user who recieves and
    builds code, and starts the servers.

Feel free to start a new server, and ssh in as `app` to explore all of the
configuration.  An attempt has been made to isolate as much configuration 
under this user's account as possible.
