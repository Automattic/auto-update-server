#!/bin/sh

if test $# -lt 1
then
  echo "Usage: ./deploy.sh <deployment-server-address>"
  exit 1
fi

scp app.js package.json ubuntu@$1:/home/ubuntu/auto-update-server
scp updates/*.json ubuntu@$1:/home/ubuntu/auto-update-server/updates
