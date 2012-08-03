How do you build an environment where you can allow translators to preview their l10n changes?

Glad you asked!  It's easy!

1. checkout the git branch you want to deploy (current train in testing probably)
2. build a fast vm: scripts/deploy.js create translate -t c1.medium
3. cherry pick the magic commit that patches your config and turns it into a preview env,
   `git cp origin l10n_preview_builder`
4. (if that don't patch cleanly, yer gonna need to update it)
5. push it up to your vm: `git push translate HEAD:master
6. now add a cron job with `crontab -e`:

    PATH=/usr/local/bin:/bin:/usr/bin:/usr/local/sbin:/usr/sbin:/sbin:/opt/aws/bin:/usr/local/bin:/home/app/node_modules/.bin:/home/app/bin
    MAILTO=<YOU>@mozilla.com
    */5 * * * * $HOME/code/scripts/update_translations.sh | tee $HOME/last_translation_update.txt 2>&1
