
# Changelog Snippets

This directory contains snippets of text that should be added to the Changelogs for various audiences. For details, please see:

 https://github.com/mozilla/browserid/wiki/Changelog-Maintenance

Each branch submitted for merging should contain snippets aimed at any audiences that need to learn about the significant changes in that branch/

Each pull-request should add files to this `docs/changes/` directory. The files should be named `$issuenumber.$type`, e.g. `1234.idp` or `6543.ops`. Patches which don't have specific issue numbers should use some other probably-unique identifier (a few words that summarize the issue) instead of the Issue number.

These snippets should contain a few sentences explaining what specific audiences need to know about the effects of the patch. If an audience doesn't need to know about the changes, then the patch should not include a snippet for that audience. Many bugfixes will have no snippets at all.

The various audiences, type suffixes, and what they care about, are:

 * IdPs (`123.idp`): Identity Providers care about format changes to the `/.well-known/browserid` file and the public keys inside it, changes to the certificate-signing process that they must implement, and the `navigator.id` APIs used by their authentication and provisioning pages.
 * RPs (`123.rp`): Relying Parties care about changes to the URLs of `include.js` and the verifier service, API changes of `navigator.id` and the verifier service, and new features their users may be able to take advantage of.
 * devops/prodops (`123.ops`): Operations personnel care about changes to the way the browserid services are deployed on Mozilla servers: new processes (like the "router" and "keysigner"), new outbound network requests (firewall rules), dependencies on third-party libraries and tools (including node.js), database schema changes, significant changes to expected load or database access patterns. They should also review code that adds new database queries for efficiency.
 * QA (`123.qa`): QA staff care about new features that need test coverage, behavioral changes which affect QA methodology, and dialog/UI changes that require "bidpom" model updates (e.g. CSS selectors).

We may add other audiences in the future.

Reviewers should check for snippets in the pull-requests they review, and should feel free to ask patch authors to write them when necessary.

These snippets should be addressed to the audience in question, and cite published documentation (if available), like this:

    RPs can now include a `siteLogo` URL in their `navigator.id.request()`
    call, which should point to a site-relative path of a .png image file
    that will be displayed in the sign-in dialog. See XYZ for details.

## The Release Process

Periodically, just before a train is branched, the Release Manager (i.e. Lloyd) will land a commit which deletes all the snippet files and merges their contents into more-nicely-formatted NEWS or ChangeLog file. The RM will exercise editorial judgement on what needs to be visible (sometimes an IdP-oriented change needs to be announced to RPs too), and gets to add detail or delete low-level entries entirely.

If the prose quality of the snippets is high enough, this process may be done mechanically some day.
