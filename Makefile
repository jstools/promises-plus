# --- parole

git_branch := $(shell git rev-parse --abbrev-ref HEAD)

install:
	npm install

build:
	@$(shell npm bin)/rollup parole.js --file dist/parole.js --format cjs
	@$(shell npm bin)/rollup parole.js --file dist/parole.umd.js --format umd --name "Parole"

min:
	@echo "minified version"
	@$(shell npm bin)/uglifyjs dist/parole.umd.js -o dist/parole.min.js -c -m

lint:
	@echo "checking syntax"
	@$(shell npm bin)/eslint lib

custom-tests:
	@echo "passing es6 methods tests"
	@$(shell npm bin)/mocha tests/*-test.js --exit

test-new:
	@$(shell npm bin)/promises-aplus-tests tests/promises-aplus-adapter-new.js

test-defer:
	@$(shell npm bin)/eslint src/defer.js
	@$(shell npm bin)/promises-aplus-tests tests/promises-aplus-adapter-defer.js

test-future:
	@$(shell npm bin)/eslint src/future.js
	@$(shell npm bin)/promises-aplus-tests tests/promises-aplus-adapter-future.js

promises-aplus-tests: export TEST_JS = normal
promises-aplus-tests:
	@echo "passing promises-aplus tests"
	@$(shell npm bin)/promises-aplus-tests tests/promises-aplus-adapter.js

promises-aplus-tests.min: export TEST_JS = min
promises-aplus-tests.min:
	@echo "passing promises-aplus tests"
	@$(shell npm bin)/promises-aplus-tests tests/promises-aplus-adapter.js

karma: export TEST_JS = normal
karma:
	@echo "passing browser tests (karma)"
	@$(shell npm bin)/karma start karma.conf.js

karma.min: export TEST_JS = min
karma.min:
	@echo "passing browser tests (karma)"
	@$(shell npm bin)/karma start karma.conf.js

test: install lint build min custom-tests promises-aplus-tests promises-aplus-tests.min karma karma.min

npm.publish:
	npm version patch
	git push origin $(git_branch) && git push --tags
	npm publish
	@echo "published ${PKG_VERSION}"

github.release: export PKG_NAME=$(shell node -e "console.log(require('./package.json').name);")
github.release: export PKG_VERSION=$(shell node -e "console.log('v'+require('./package.json').version);")
github.release: export RELEASE_URL=$(shell curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${GITHUB_TOKEN}" \
	-d '{"tag_name": "${PKG_VERSION}", "target_commitish": "$(git_branch)", "name": "${PKG_VERSION}", "body": "", "draft": false, "prerelease": false}' \
	-w '%{url_effective}' "https://api.github.com/repos/kiltjs/${PKG_NAME}/releases" )
github.release:
	@echo ${RELEASE_URL}
	@true

release: test npm.publish github.release

# DEFAULT TASKS

.DEFAULT_GOAL := test
