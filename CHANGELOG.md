# Changelog

## [0.4.0](https://github.com/pokujs/coverage/compare/v0.3.0...v0.4.0) (2026-04-21)


### Features

* improve support for monorepos ([3c15818](https://github.com/pokujs/coverage/commit/3c15818246358ba13ff2943a7660d014825b482d))
* support `c8` and `nyc` config files ([2fcd430](https://github.com/pokujs/coverage/commit/2fcd4309dd11a96e5a5324aa2991b1bcafe50506))
* support filter by extensions ([8e13d60](https://github.com/pokujs/coverage/commit/8e13d606503308f019f455b3feca4998326e3ef5))


### Bug Fixes

* ensure check coverage for branches ([189b793](https://github.com/pokujs/coverage/commit/189b793e49b2a1cb65b6585da7ee2a6918a418ac))
* truncate line:branches in `text` reporter ([5b86f86](https://github.com/pokujs/coverage/commit/5b86f868edabb2d39ef18fe8f746c73a58cfd01e))

## [0.3.0](https://github.com/pokujs/coverage/compare/v0.2.1...v0.3.0) (2026-04-21)


### Features

* add `"jsc"` reporter ([#10](https://github.com/pokujs/coverage/issues/10)) ([2d4c045](https://github.com/pokujs/coverage/commit/2d4c0450d2900d36f53db197d559b1ceb2548a42))


### Bug Fixes

* **jsc:** prevent zero-out of executed class method bodies ([ec4b45f](https://github.com/pokujs/coverage/commit/ec4b45fc57d5c0fd2402a773b44b38a7b1cf00a1))

## [0.2.1](https://github.com/pokujs/coverage/compare/v0.2.0...v0.2.1) (2026-04-19)


### Bug Fixes

* enhance AST for `Functions` metric ([#7](https://github.com/pokujs/coverage/issues/7)) ([8c09ac3](https://github.com/pokujs/coverage/commit/8c09ac378d966d683438c3b86dfb8a24d57f62f1))
* improve branches consistency via AST ([#5](https://github.com/pokujs/coverage/issues/5)) ([5546f27](https://github.com/pokujs/coverage/commit/5546f272b973e3acb561529a9fb8473c66c3e59e))
* prevent undefined branch map entries when merging V8 scripts ([7d9729e](https://github.com/pokujs/coverage/commit/7d9729e6e75401763d6054bff3f591d5e7cd73e4))

## [0.2.0](https://github.com/pokujs/coverage/compare/v0.1.9...v0.2.0) (2026-04-19)


### Features

* support "html" and "html-spa" reporter with Bun ([#2](https://github.com/pokujs/coverage/issues/2)) ([67c0307](https://github.com/pokujs/coverage/commit/67c030785b3ff25676080db8ab3eef35f0da0928))

## 0.1.9 (2026-04-18)


### Features

* @pokujs/coverage's birth ([89fd3e9](https://github.com/pokujs/coverage/commit/89fd3e9f9b79ec20fa1eec63c78be53c2f95cbd2))


### Miscellaneous Chores

* release 0.1.9 ([89736ad](https://github.com/pokujs/coverage/commit/89736adabae9380ebfb83241d92808bc2bfac780))
