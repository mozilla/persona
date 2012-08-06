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
    # virtualenv location differs on windows
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
    # TODO add other options
    options, arguments = parser.parse_args()

    # 1. check that python is the right version TODO: would 2.6 actually work?
    if sys.version_info < (2,7,0):
        sys.stderr.write('python 2.7 or later is required to run this script\n')
        exit(1)
    # 2. TODO check that virtualenv and pip exist. if not, bail.
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

    # 5. run the tests
    # TODO parse arguments to know which tests to run
    # TODO right now we only run one 123done test in the default case
    if options.run_all:
        subprocess.call(env_py + ' -m py.test --destructive ' +
                        '--credentials=credentials.yaml ' +
                        '--baseurl=http://dev.123done.org --driver=firefox ' +
                        '-q browserid', shell=True);
        subprocess.call(env_py + ' -m py.test --destructive ' +
                        '--credentials=credentials.yaml ' +
                        '--baseurl=http://dev.myfavoritebeer.org ' +
                        '--driver=firefox -q myfavoritebeer', shell=True);
        tests_123 = '123done'
    else:
        tests_123 = '123done/tests/test_new_user.py'
    # the 123done tests always run
    subprocess.call(env_py + ' -m py.test --destructive ' + 
                    '--credentials=credentials.yaml ' +
                    '--baseurl=http://dev.123done.org --driver=firefox ' +
                    '-q ' + tests_123, shell=True);

    # 6. TODO deactivate/destroy virtualenv?? maybe '--cleanup' argument?


if __name__ == '__main__':
    main()
