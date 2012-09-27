#!/usr/bin/python

import optparse
import os
import platform
import subprocess
import sys
import pkg_resources


# used to check for existence of virtualenv and pip.
# lifted from: http://stackoverflow.com/questions/377017
def which(program):
    if platform.system() == 'Windows':
        program += '.exe'

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
                           ' browsers available locally.')
    options, arguments = parser.parse_args()

    # 1. check that python is the right version 
    if sys.version_info < (2,6,0):
        sys.stderr.write('python 2.6 or later is required to run the tests\n')
        exit(1)

    # 2. check that virtualenv and pip exist. if not, bail.
    try:
        pkg_resources.WorkingSet().require('pip', 'virtualenv')
    except pkg_resources.DistributionNotFound as e:
        sys.stderr.write('{package} must be installed\n'.format(package=e.message))
        exit(1)

    # 3. create the virtualenv if they asked you to install it or it's missing
    if options.install or not os.path.exists(env_py):
        subprocess.call('virtualenv bid_selenium', shell=True)
        # 4. pip install requirements (or verify they're installed).
        subprocess.call(env_path + 'pip install -Ur requirements.txt', 
                        shell=True)

    # 4. check the ephemeral instance to hit.
    host = options.target_hostname

    # 5 check for and/or create credentials.yaml
    if not os.path.isfile('credentials.yaml'):
        # look for env variables
        try:
            email = os.environ['PERSONA_EMAIL']
            password = os.environ['PERSONA_PASSWORD']
        # if they are missing, bail
        except KeyError:
            sys.stderr.write('Existing validated user credentials are needed to run' +
                ' tests for 123done and myfavoritebeer. Please set them in the' +
                ' PERSONA_EMAIL and PERSONA_PASSWORD environmental variables.\n')
            exit(1)
        # if they are present, write them out to credentials.yaml
        try:
            credentialsfile = open('credentials.yaml', 'w')
            credentialsfile.write('default:\n')
            credentialsfile.write('    email: ' + email + '\n')
            credentialsfile.write('    password: ' + password + '\n')
            credentialsfile.close()
        #if you can't open the file for editing, bail
        except IOError:
            sys.stderr.write('Unable to open credentials.yaml to write out' +
                ' credentials. Either create credentials.yaml manually or' +
                ' ensure the test process has permission to create the file.\n')
            exit(1)

    # 5.5 determine the browsers to use
    # if the person is working for mozilla and doesn't have firefox installed, something is wrong
    browsers = [('--driver=firefox ', 'local_firefox')]
    if options.run_everywhere:
        # Chrome
        if not which('chromedriver'):
            sys.stderr.write('In order to run tests with chrome, you must download the driver from' +
                ' https://code.google.com/p/chromedriver/downloads/list' +
                ' and put it on the PATH.')
            exit(1)
        browsers.append(('--driver=chrome ', 'local_chrome'))
        # XXX IEDriver does not provide a clean environment for tests when run on a non-VM
        # XXX Opera does not have a WebDriver implementation, can only be run
        # via a selenium server
                
    # 6. run the tests
    for browser in browsers:
        no_proxy_json = '--capabilities={\"avoid-proxy\":true}'
        if options.run_all:
            subprocess.call(env_py + ' -m py.test --destructive' +
                ' --credentials=credentials.yaml ' + browser[0] + 
                ' --webqatimeout=90 -m travis ' + no_proxy_json +
                ' --webqareport=results/browserid/' + browser[1] + '.html' +
                ' --baseurl=http://%s.123done.org -q browserid' % host, shell=True)
            subprocess.call(env_py + ' -m py.test --destructive' +
                ' --credentials=credentials.yaml ' + browser[0] + 
                ' --webqatimeout=90 ' + no_proxy_json +
                ' --webqareport=results/123done/' + browser[1] + '.html' +
                ' --baseurl=http://%s.123done.org -q 123done' % host, shell=True)
            subprocess.call(env_py + ' -m py.test --destructive' +
                ' --credentials=credentials.yaml ' + browser[0] + 
                ' --webqatimeout=90 ' + no_proxy_json +
                ' --webqareport=results/myfavoritebeer/' + browser[1] + '.html' +
                ' --baseurl=http://%s.myfavoritebeer.org -q myfavoritebeer' % host, shell=True)
        # only run one test in the default case
        else:
            subprocess.call(env_py + ' -m py.test --destructive' +
                ' --credentials=credentials.yaml ' + browser[0] +
                ' --webqatimeout=90 ' + no_proxy_json +
                ' --baseurl=http://%s.123done.org' % host +
                ' --webqareport=results/test_new_user/' + browser[1] + '.html' +
                ' -q 123done/tests/test_new_user.py', 
                shell=True)

    # 7. TODO deactivate/destroy virtualenv?? maybe '--cleanup' argument?
      # clean up credentials.yaml


if __name__ == '__main__':
    main()
