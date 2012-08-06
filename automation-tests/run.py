#!/usr/bin/python

import optparse
import os
import platform
import subprocess


def main():
    # virtualenv location differs on windows
    # TODO platform detection is brittle. is there a better way?
    if platform.system() == 'Windows':
        env_path = 'bid_selenium\Scripts\\'
    else:
        env_path = 'bid_selenium/bin/'

    env_py = env_path + 'python'

    # parse command line options
    # TODO actually parse and use options
    p = optparse.OptionParser()
    # p.add_option('--person', '-p', default='world', help='some helpful text')
    # ... add other options
    options, arguments = p.parse_args()

    # 1. TODO check that python exists and is the right version.
    # 2. TODO check that virtualenv and pip exist. if not, have to install as sudo.
    # 3. if the virtualenv isn't found, create it
    if not os.path.exists(env_py):
        # TODO: will this work?
        subprocess.call('virtualenv bid_selenium', shell=True)
    # 4. pip install requirements (or verify they're installed).
    # TODO make this an optional '--first-run' arg?
    subprocess.call(env_path + 'pip install -Ur requirements.txt', shell=True)

    # 5. run the tests
    # TODO the user has to create test credentials. tell them this and pause
    #      to give them time to do it manually. or we have to have credentials
    #      in a public repo, which is an awful idea.
    # TODO here's where you parse arguments to know which tests to run
    subprocess.call(env_py + ' -m py.test --destructive --credentials=credentials.yaml --baseurl=http://dev.123done.org --driver=firefox -q 123done', shell=True);
    subprocess.call(env_py + ' -m py.test --destructive --credentials=credentials.yaml --baseurl=http://dev.123done.org --driver=firefox -q browserid', shell=True);
    subprocess.call(env_py + ' -m py.test --destructive --credentials=credentials.yaml --baseurl=http://dev.myfavoritebeer.org --driver=firefox -q myfavoritebeer', shell=True);
    # 6. TODO deactivate/destroy virtualenv?? maybe '--cleanup' argument or something?


if __name__ == '__main__':
    main()
