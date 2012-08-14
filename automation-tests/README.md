getting started
===============

# I'm super impatient. Let's get going in 10 sec or less.

TL;DR: just execute ```./run.py``` from inside the automation-tests directory.

If you're missing pip or virtualenv, it'll tell you what to do.

If you're missing test dependencies, it'll install them for you.

If all that is OK, it'll connect to dev.123done.org and try to create a fake user, login, and logout.

If you want to run that single test against your ephemeral instance called 'foo', just do ```run.py --target=foo```.

If you want to run all the tests, create a dummy user, put its info in credentials.yaml, then do ```run.py --all``` to run all the tests, including 123done and myfavoritebeer tests.

If you want to run all the tests against all the browsers, using sauce labs credentials, then do ```run.py --everywhere```.

# I've got time. Tell me more!

OK, sure...

## how to run selenium tests inside the automation-tests directory against ephemeral, stage, or prod environments

Node bindings aren't as mature as python for Selenium 2 API (webdriver), so we're using python bindings instead. This requires some python-centric setup, but it shouldn't take more than 15 minutes or so to get up and running.

These tests currently only hit myfavoritebeers and 123done domains. For example, to test an ephemeral install named foo.personatest.org, you can pass 'foo.123done.org' into the py.test baseurl parameter (this is covered again in the examples section).

### check system-wide python requirements

You should have python 2.7 on your system (check python --version).

We have to install a bunch of python libraries. pip fetches packages; virtualenv sandboxes them. If pip and virtualenv aren't on your system already, you'll need to do this once (once per computer, not once per repo):

    # only do this if pip and virtualenv aren't on your computer already
    # might need to use sudo
    easy_install pip
    pip install virtualenv

### build a sandboxed python test environment

From the automated-tests directory, create a sandboxed python environment to install python dependencies (only need to do this once per clone):

    # only do this once per clone
    virtualenv bid_selenium 

Be sure you do not accidentally add the virtualenv directory (here, bid_selenium) to git.

You can activate the sandbox, meaning link installed programs, via:

    . bid_selenium/bin/activate

And when you want to stop using the sandbox, you can exit via ```deactivate```. Deactivating the virtualenv doesn't destroy it.

In order to install python dependencies into the sandbox, activate the virtualenv, then install the python requirements in requirements.txt:

    pip install -Ur requirements.txt

Sweet. Your environment is now ready.

### create a test user in credentials.yaml

Some of the automation tests verify that existing accounts work, so create a test account, and put the info into credentials.yaml.

### run the tests

When you want to run the tests, make sure the virtualenv is active:

    . bid_selenium/bin/activate

Then, run the tests by calling py.test on the command line with some options. [Here](https://github.com/davehunt/pytest-mozwebqa) is the most relevant documentation: command-line options added to py.test by the mozwebqa plugin, which is awesome. [Here](http://pytest.org/latest/usage.html) is the documentation for the upstream pytest project.

#### examples

Use local Firefox to run the 123done tests (in the 123done directory) against dev.123done.org:

    python -m py.test --destructive --credentials=credentials.yaml \
        --baseurl=http://dev.123done.org \
        --driver=firefox \
        -q 123done

Use local Chrome (assuming you've downloaded [Chromedriver](http://code.google.com/p/selenium/wiki/ChromeDriver) to /usr/local/bin/chromedriver) to run just one of the the myfavoritebeer tests against myfavoritebeer.org:

    python -m py.test --destructive --credentials=credentials.yaml \
        --baseurl=http://www.myfavoritebeer.org \
        --driver=chrome --chromepath=/usr/local/bin/chromedriver \
        -q myfavoritebeer/tests/test_logout.py

Use Sauce Labs (assuming you've got credentials in saucelabs.yaml) to run IE 8 against an ephemeral instance called 'foo':

    python -m py.test --destructive --credentials=credentials.yaml \
        --baseurl=http://foo.123done.org \
        --platform=XP --browsername="internet explorer" --browserver=8 \
        --saucelabs=saucelabs.yaml \
        -q 123done

note, your saucelabs.yaml file should be of the form:

        # example sauce_labs.yaml config file
        username: <username>
        password: <password>
        api-key: <api-key>

#### Check out your results
    
The tests create a /results directory, which contains an index.html file with test results, screenshots, and videos if you used sauce labs. In case of a failure, you'll also see the backtrace. Totally sweet.

## writing automation tests

TODO: some idioms from the existing test code to help people quickly express "find this" and "click this" idiomatically.

Refer to [mozilla's pytest_mozwebqa](https://github.com/davehunt/pytest-mozwebqa#writing-tests-for-pytest_mozwebqa) documentation on writing tests for the time being.

A note about upstreaming bidpom changes: this codebase contains [mozilla's bidpom](https://github.com/mozilla/bidpom) as [git-subtree](https://github.com/apenwarr/git-subtree/blob/master/git-subtree.txt). This allows us to pull in changes from upstream, while easily tracking the bidpom code to branches. It's unlikely that we'll need to push or pull to upstream frequently, but for details on doing so, see also apenwarr's [blog post](http://apenwarr.ca/log/?m=200904#30).

