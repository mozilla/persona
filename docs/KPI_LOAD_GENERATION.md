Test Using load_gen
-------------------

To use load_gen to test kpi, you have 3 pieces to worry about/setup:
* the load_gen script (run locally or on aws)
* the browserid instance you're going to test (local or ephemeral)
* the kpiggybank server that browserid is going to hit (local or ephemeral)

The dashboard is a fourth piece, but we can worry about that separately, as the script that updates the dashboard is currenty run manually.

### Setting up kpiggybank

You can run it locally, set up an ephemeral instance, or point at a staging instance:
* kpiggybank.hacksign.in (the old staging instance, still up and running)
* kpiggybank-stage.personatest.org (the staging instance we're moving to, currently I bring it up and down as I'm working on it)
To get the full picture we'll need to test against an instance that is configured properly with security groups and volumes. I'm working on making that configuration more easily repeatable.

### Configuring browserid

To configure browserid for load_gen, you'll need to:
* Create test users (there are a couple of ways to do this, see examples)
* Enable fake verification (in a config file or environment)
```
  BROWSERID_FAKE_VERIFICATION=1
```

* Set KPI related configuration settings (in a config file or environment)
```
  KPI_BACKEND_SAMPLE_RATE=1.0
  KPI_BACKEND_DB_URL="https://kpiggybank-stage.personatest.org/wsapi/interaction_data"
```

### Example 1: local load_gen and browserid, kpiggybank-stage

Run browserid:
```
  $ CREATE_TEST_USERS=2000 BROWSERID_FAKE_VERIFICATION=1 KPI_BACKEND_DB_URL="https://kpiggybank-stage.personatest.org/wsapi/interaction_data" MYSQL_USER=browserid MYSQL_PASSWORD=browserid npm start
```

Run load_gen:
```
  $ bin/load_gen -u 1/20 -m 20000 -o -s http://127.0.0.1:10002
```

### Example 2: local load_gen, ephemeral browserid, kpiggybank-stage

Deploy browserid using awsbox
* By default the awsbox deployment is already configured for dashboard-stage (you can ssh in and edit config files to point somewhere else)
* Create users and enable fake email verification by following the instructions in lloyd's gist: https://gist.github.com/lloyd/4489337

Run load_gen locally:
```
  $ bin/load_gen -u 1/20 -m 20000 -o -s https://persona-kpitest.personatest.org
```

### Tips

* You can watch new data show up in kpiggybank
  * Web UX: https://kpiggybank.hacksign.in/ (or the url to your ephemeral instance)
  * See # of blobs: https://kpiggybank.hacksign.in/wsapi/interaction_data/count
* You can also poke around couchdb. This comes in handy when kpiggybank's web ui is inaccessible due to the security settings. For example, to see the # of blobs, ssh in to ephemeral kpiggybank (also works locally) and try:
```
  $ curl -X GET http://127.0.0.1:5984/bid_kpi/_design/data/_view/count
```
* Take a look at browserid's proxy.log to see that the forwarding happens correctly
* load_gen doesn't look at KPI_BACKEND_SAMPLE_RATE, if you want to tweak the rate for the load testing you'll need to tweak the interaction_data activity's probability
* To get a 503 error, change the kpi blob (make it a random json blob with no "data" field, for example). You can tweak this in the interaction_data activity.
* You can also run selenium tests to hit the browserid kpi/interaction_data functionality (and generate load). As long as the browserid instance is configured with the KPI related settings, it should exercise kpi/interaction_data. Ephemeral instances are probably configured to hit one of the staging instances (depending on which version of aws.config they are using).
* Follow lloyd's instructions to use aws for the load_gen script.

References:
* https://gist.github.com/lloyd/4489337
* https://wiki.mozilla.org/QA/BrowserID/BrowserID_Basic_Install#The_load_gen_Application
