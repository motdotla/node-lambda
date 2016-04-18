# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

## [0.8.0] - 2016-04-18
### Added
- CHANGELOG to ["make it easier for users and contributors to see precisely what notable changes have been made between each release"](http://keepachangelog.com/). Linked to from README
- LICENSE to be more explicit about what was defined in `package.json`. Linked to from README
- It is OK to not set default value for AWS Credentials so AWS can use Roles and internally set AWS credentials
- Added `context.json` so it can easily be overwritten
- Allow using a custom (and passed through) `event.json` file
- Added `package` command for easy zip creation and inspection
- Added `VpcConfig` support, see [this PR](https://github.com/motdotla/node-lambda/pull/64) for more information
- Updated the AWS API version used to `2015-03-31`
- Make sure we throw errors on unrecoverable failures so other programs can listen on that
- Added support for nodejs4.3 runtime ([introducted to AWS](https://aws.amazon.com/blogs/compute/node-js-4-3-2-runtime-now-available-on-lambda/) Apr 7 2016)
- Added support for `post install scripts`, this `post_install.sh` file will be triggered after `npm install --production` in case you want to run any code on your application before zipping
- Added `-x` / `--excludeGlobs` to allow custom file exclusion
- Excluding `*.swp`, `deploy.env` by default now
