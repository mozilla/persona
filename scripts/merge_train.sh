#!/bin/bash

# merge the latest outstanding train into production and create
# a tag.

# get up to date!
echo "Getting up to date:"
git fetch origin

# first, let's identify the train
TRAIN=`git branch -a | grep remotes/origin/train | sed -e 's/^.*train-\(.*\)$/\1/' | sort -n | tail -1`
echo "Merging train ($TRAIN) into production" 

git checkout remotes/origin/prod
git merge --no-ff remotes/origin/train-$TRAIN -m "integrating train $TRAIN"
git branch -D train-$TRAIN
git tag train-$TRAIN

echo "All done!  Now you should delete the remote train, and push your changes"
echo "git push origin :train-$TRAIN"
echo "git push --tags origin prod"

