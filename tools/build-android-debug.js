#!/usr/bin/env node

const { main } = require("./build-android-artifact");

main(["--type=apk", "--variant=debug"]);
