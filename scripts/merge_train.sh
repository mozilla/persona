#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# merge the latest outstanding train into production and create
# a tag.

# get up to date!
echo "Getting up to date:"
git fetch origin

# first, let's identify the train
TRAIN=`git branch -a | grep remotes/origin/train | sed -e 's/^.*train-\(.*\)$/\1/' | sort -n | tail -1`
echo "Merging train ($TRAIN) into production"

git checkout -B prod remotes/origin/prod
git merge --no-ff remotes/origin/train-$TRAIN -m "integrating train $TRAIN"

# now delete the local train branch if it exists
LOCAL_TRAIN_BRANCH=`git branch | fgrep train-$TRAIN`
if [ "x${LOCAL_TRAIN_BRANCH}" == "xtrain-${TRAIN}" ] ; then
    echo "deleting local branch: train-$TRAIN"
    git branch -D train-$TRAIN
fi

git tag train-$TRAIN

echo "All done!  Now you should delete the remote train, and push your changes"
echo "git push origin :train-$TRAIN"
echo "git push --tags origin prod"

