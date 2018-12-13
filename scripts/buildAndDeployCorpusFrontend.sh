#!/bin/bash

# Information for building project
SCRIPTS_DIR=/vol1/scripts
PROJECT_NAME=corpus-frontend
PROJECT_DIR=$SCRIPTS_DIR/$PROJECT_NAME
BRANCH_NAME=webpack

# Copy targets
LOCAL_TARGET_DIR=/vol1/webapps
REMOTE_IP=172.16.4.24  # svotmc10.ivdnt.loc, CHN testserver
REMOTE_TARGET_DIR=/vol1/webapps

set -e   # Exit on error

# Clone/update project from git
cd $SCRIPTS_DIR
if [ ! -d $PROJECT_DIR ]; then
    git clone git@git.inl.loc:/git/$PROJECT_NAME
    cd $PROJECT_DIR
    git checkout $BRANCH_NAME
else
    cd $PROJECT_DIR
    git pull -f origin $BRANCH_NAME  # -f in case of force push
fi

# Build and copy
mvn -e clean install

# Copy locally
cp target/$PROJECT_NAME*.war $LOCAL_TARGET_DIR/$PROJECT_NAME.war

# Copy to test server
#scp $TARGET_DIR/$PROJECT_NAME.war root@$REMOTE_IP:$REMOTE_TARGET_DIR/
