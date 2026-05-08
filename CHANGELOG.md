# Changelog

## [0.10.0](https://github.com/pokujs/coverage/compare/v0.9.0...v0.10.0) (2026-05-08)


### Features

* support Jest ([#43](https://github.com/pokujs/coverage/issues/43)) ([39275e6](https://github.com/pokujs/coverage/commit/39275e66609c2d068bc9c3c81beddc729ae0113b))

## [0.9.0](https://github.com/pokujs/coverage/compare/v0.8.1...v0.9.0) (2026-05-01)


### Features

* support CLI usage (without Poku) ([#36](https://github.com/pokujs/coverage/issues/36)) ([f85865c](https://github.com/pokujs/coverage/commit/f85865cfc5a1397fc1bb2b38d602ea7d0c2a1ca6))
* support Vitest ([#40](https://github.com/pokujs/coverage/issues/40)) ([faa00c5](https://github.com/pokujs/coverage/commit/faa00c5fe9b779812f03266f240cc4e9baaae449))

## [0.8.1](https://github.com/pokujs/coverage/compare/v0.8.0...v0.8.1) (2026-04-28)


### Bug Fixes

* build external packages ([#34](https://github.com/pokujs/coverage/issues/34)) ([59fe46d](https://github.com/pokujs/coverage/commit/59fe46d33b03d2aa467784738f4db6603c6aa97d))

## [0.8.0](https://github.com/pokujs/coverage/compare/v0.7.1...v0.8.0) (2026-04-28)


### Features

* support for Typings coverage ([#31](https://github.com/pokujs/coverage/issues/31)) ([4128d62](https://github.com/pokujs/coverage/commit/4128d623880646d04796715df8f46babb9e3ad07))

## [0.7.1](https://github.com/pokujs/coverage/compare/v0.7.0...v0.7.1) (2026-04-27)


### Bug Fixes

* improve distinction between executable and non-executable lines ([f6528f5](https://github.com/pokujs/coverage/commit/f6528f5cf7b51f179b22a77a67c6b1290e1cf547))
* **ts:** improve distinction between executable and non-executable lines ([#30](https://github.com/pokujs/coverage/issues/30)) ([f6528f5](https://github.com/pokujs/coverage/commit/f6528f5cf7b51f179b22a77a67c6b1290e1cf547))
* **v8:** use a "Nodefy" approach ([#27](https://github.com/pokujs/coverage/issues/27)) ([3aab671](https://github.com/pokujs/coverage/commit/3aab67134eb8e5f928b8be66f01119c041ed3524))

## [0.7.0](https://github.com/pokujs/coverage/compare/v0.6.1...v0.7.0) (2026-04-26)


### Features

* support for JSX and TSX ([#26](https://github.com/pokujs/coverage/issues/26)) ([dbfa3e2](https://github.com/pokujs/coverage/commit/dbfa3e2c6d09c6f82ede5dd991ce6c640568f09f))


### Bug Fixes

* **bun:** improve Lines and Functions metrics ([#23](https://github.com/pokujs/coverage/issues/23)) ([7f51942](https://github.com/pokujs/coverage/commit/7f5194277b2471d28afae8b63012356d9de5a538))
* **v8:** catch boundary lines ([#25](https://github.com/pokujs/coverage/issues/25)) ([4f2d0b9](https://github.com/pokujs/coverage/commit/4f2d0b9b18036712349254b07ec05f21aa13f66b))

## [0.6.1](https://github.com/pokujs/coverage/compare/v0.6.0...v0.6.1) (2026-04-26)


### Bug Fixes

* **bun:** improve precision in auto-executable lines ([#17](https://github.com/pokujs/coverage/issues/17)) ([ab31038](https://github.com/pokujs/coverage/commit/ab310382fce7ce748b635a98d4b5537127fd1188))
* **v8:** distinguish lines and branches metrics ([#19](https://github.com/pokujs/coverage/issues/19)) ([a45bb2a](https://github.com/pokujs/coverage/commit/a45bb2aef993b4630eceb11e44860c4ec354d532))
* **v8:** merge ranges per file before line extraction ([#20](https://github.com/pokujs/coverage/issues/20)) ([5ce51cc](https://github.com/pokujs/coverage/commit/5ce51cc3e8e1c7d4bffaf50b863951135c4b61e9))

## [0.6.0](https://github.com/pokujs/coverage/compare/v0.5.0...v0.6.0) (2026-04-22)


### Features

* export both `.mjs` and `.cjs` ([#15](https://github.com/pokujs/coverage/issues/15)) ([5eb25c6](https://github.com/pokujs/coverage/commit/5eb25c64a18ae03bc944599ebc6b4b6cab71dbad))

## [0.5.0](https://github.com/pokujs/coverage/compare/v0.4.0...v0.5.0) (2026-04-22)


### Features

* support `bunfig.toml` ([0aa5ca8](https://github.com/pokujs/coverage/commit/0aa5ca8c2892ec95dda11a080fad491828fc5dff))


### Bug Fixes

* **build:** ship only what is really necessary ([#13](https://github.com/pokujs/coverage/issues/13)) ([2923edc](https://github.com/pokujs/coverage/commit/2923edc6c47bf9b92034edf82c9ddb5f39a0576f))

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
