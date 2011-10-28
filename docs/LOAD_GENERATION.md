This directory contains a standalone tool that analyzes the capacity of a browserid
server.  The tool is run from the command line, applies load to the target server,
and outputs the number of "active users" it is simulating at the moment.  

## Usage

XXX: document the command line invocation and usage of the tool.

## Methodology

The following sections document how the load generation tool functions
in detail, including a description of the estimations employed by the 
tool.

### Defining an Active User

In order to understand what kind of load an "active user" imparts on
browserid servers, we must know precisely what an average active user
is.

For the sake of this discussion, an active user uses 4 sites that use
BrowserID and visits them 10 times each day.  These activities are
split across 2 different devices.  Further, the average user has two
different email addresses that they use equally, and forgets their
password about every four weeks.

The final bit of assumption is growth rate, what percentage of active
users in a unit of time are using browserid for the first time.  This
is interesting as different types of requests (with different costs)
are made during initial user signup.  We start by assuming a 20/80 split
of new to returning users per month.

The next bit of guesswork required is to explain the behaviors of these
sites (RPs) that a user visits.  The average RP will set authentication
cookies with 6 hour duration, such that a user must re-authenticate using
browserid at least every six hours.  

### Defining high-level user activities

Given these parameters we can now derive concretely the number of 
high level user activities we must support per second to support 1M
active.  This will manifest as activities per second for each of the 
following distinct activities:

 * *new user signup* - someone who has never used browserid goes through the in-dialog "sign up" flow.
 * *password recovery* - a user of browserid goes through the "i forgot my password" flow
 * *email addition* - a user of browserid adds a new email address to their existing account
 * *re-authentication* - a user of browserid re-authenticates to browserid (they have an expired session, or are using a new device for the first time)
 * *authenticated user sign-in* - a user of browserid with authentication material already on their device, and an active session to browserid, logs into a site

### From activities to HTTP requests

Having defined the activities above, each activity corresponds to 
some number of network requests.  In step three, we'll break each
activity down into its constituent network transactions in a holistic
manner, including all resources loaded from browserid servers (NOTE: we
could account for browser caching here with another factor).

The result of this is a description of each activity in terms of network
transactions that can be expressed in code.   

