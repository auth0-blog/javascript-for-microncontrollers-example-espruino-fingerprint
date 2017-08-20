#!/bin/sh

echo 'Are npm packages installed?'
if [ ! -d node_modules ]; then
    echo 'Nope, installing npm packages.'
    npm install
fi
echo 'Yes, building JavaScript bundle using Rollup.'
node_modules/rollup/bin/rollup -c rollup-enroll.config.js
node_modules/rollup/bin/rollup -c rollup-read.config.js

echo 'Done. Built files are in the dist directory.'
echo
