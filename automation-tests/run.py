#!/usr/bin/python

import optparse
import os
import platform
import subprocess
import sys


# used to check for existence of virtualenv and pip.
# lifted from: http://stackoverflow.com/questions/377017
def which(program):
    def is_exe(fpath):
        return os.path.isfile(fpath) and os.access(fpath, os.X_OK)
    fpath, fname = os.path.split(program)
    if fpath:
        if is_exe(program):
            return program
    else:
        for path in os.environ["PATH"].split(os.pathsep):
            exe_file = os.path.join(path, program)
            if is_exe(exe_file):
                return exe_file
    return None


def main():
    # get path to python: virtualenv location differs on windows
    # TODO platform detection is brittle. is there a better way?
    if platform.system() == 'Windows':
        env_path = 'bid_selenium\Scripts\\'
    else:
        env_path = 'bid_selenium/bin/'
    env_py = env_path + 'python'

    # parse command line options
    parser = optparse.OptionParser()
    parser.add_option('--install', '-i', dest='install', action="store_true",
                      help='install python dependencies inside a virtualenv')
    parser.add_option('--all', '-a', dest='run_all', action="store_true",
                      help='run all tests. requires test account credentials' +
                           ' to be created and added to credentials.yaml')
    parser.add_option('--target', '-t', dest='target_hostname', 
                      default="dev", help='run tests against an ephemeral' +
                      ' instance. Specify your instance\'s hostname ("foo"),' +
                      ' not the full domain name ("foo.123done.org")')
    parser.add_option('--everywhere', '-e', dest='run_everywhere', action='store_true',
                      help='like --all, but run all tests on all supported' +
                           ' browsers using sauce labs credentials either' +
                           ' specified in sauce.yaml or in environment' +
                           ' variables PERSONA_SAUCE_USER, PERSONA_SAUCE_PASSWORD,' +
                           ' and PERSONA_SAUCE_APIKEY.')
    options, arguments = parser.parse_args()

    # you can't specify both --all and --everywhere
    if options.run_everywhere and options.run_all:
            sys.stderr.write("either use --all or --everywhere, not both")
            exit(1)

    # 1. check that python is the right version 
    # TODO: would 2.6 actually work?
    if sys.version_info < (2,7,0):
        sys.stderr.write('python 2.7 or later is required to run the tests\n')
        exit(1)

    # 2. check that virtualenv and pip exist. if not, bail.
    if not which('pip'):
        sys.stderr.write('pip must be installed; do "easy_install pip", ' +
                         ' then try again\n')
        exit(1)
    if not which('virtualenv'):
        sys.stderr.write('virtualenv must be installed; do "pip install ' +
                         'virtualenv", then try again\n')
        exit(1)

    # 3. create the virtualenv if they asked you to install it or it's missing
    if options.install or not os.path.exists(env_py):
        subprocess.call('virtualenv bid_selenium', shell=True)
        # 4. pip install requirements (or verify they're installed).
        subprocess.call(env_path + 'pip install -Ur requirements.txt', 
                        shell=True)

    # 4. check the ephemeral instance to hit.
    host = options.target_hostname

    # 5. check for/create sauce.yaml, if necessary
    if options.run_everywhere:
        # if sauce.yaml does not exist,
        if not os.path.isfile('sauce.yaml'):
            # look for environmental variables PERSONA_SAUCE_*
            try:
                username = os.environ['PERSONA_SAUCE_USER']
                password = os.environ['PERSONA_SAUCE_PASSWORD']
                api_key  = os.environ['PERSONA_SAUCE_APIKEY']
            # if they are missing, bail
            except KeyError:
                sys.stderr.write('Sauce labs credentials are needed to run' +
                    ' tests everywhere. Add credentials to sauce.yaml or, if' +
                    ' you have access to persona dev secrets, check that' +
                    ' the PERSONA_SAUCE_USER, PERSONA_SAUCE_PASSWORD, and' +
                    ' PERSONA_SAUCE_APIKEY environmental variables are set.\n')
                exit(1)
            # if they are present, write them out to sauce.yaml
            try:
                saucefile = open('sauce.yaml', 'w')
                saucefile.write('username: ' + username + '\n')
                saucefile.write('password: ' + password + '\n')
                saucefile.write('api-key: ' + api_key + '\n')
                saucefile.close()
            # if you can't open the file for editing, bail
            except IOError:
                sys.stderr.write('Unable to open sauce.yaml to write out' +
                    ' credentials. Either create sauce.yaml manually, or' +
                    ' ensure the test process has permission to create the file.\n')
                exit(1)

    # 6. run the tests

    # TODO move the run_everywhere list into a config file?
    if options.run_everywhere:
        browsers = ['--platform=LINUX --browsername=firefox --browserver=13 ',
            '--platform=LINUX --browsername=opera   --browserver=12 ',
            '--platform=MAC   --browsername=firefox --browserver=14 ',
            '--platform=VISTA --browsername=chrome ',
            '--platform=VISTA --browsername=firefox --browserver=13 ',
            '--platform=VISTA --browsername="internet explorer" --browserver=9 ',
            '--platform=XP    --browsername="internet explorer" --browserver=8 ']
        sauce = '--saucelabs=sauce.yaml '
    else:
        browsers = ['--driver=firefox ']
        sauce = ''

    for browser in browsers:
        if options.run_everywhere or options.run_all:
            subprocess.call(env_py + ' -m py.test --destructive ' +
                '--credentials=credentials.yaml ' + sauce + browser + 
                ' --baseurl=http://' + host + '.123done.org -q browserid', shell=True)
            subprocess.call(env_py + ' -m py.test --destructive ' +
                '--credentials=credentials.yaml ' + sauce + browser + 
                ' --baseurl=http://' + host + '.123done.org -q 123done', shell=True)
            subprocess.call(env_py + ' -m py.test --destructive ' +
                '--credentials=credentials.yaml ' + sauce + browser + 
                ' --baseurl=http://' + host + '.myfavoritebeer.org -q myfavoritebeer', shell=True)
        # only run one test in the default case
        else:
            subprocess.call(env_py + ' -m py.test --destructive ' +
                '--credentials=credentials.yaml ' + sauce + browser +
                ' --baseurl=http://' + host + '.123done.org ' +
                '-q 123done/tests/test_new_user.py', shell=True)

    # 7. TODO deactivate/destroy virtualenv?? maybe '--cleanup' argument?


if __name__ == '__main__':
    main()
