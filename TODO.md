### Node.js

- ✨

---

### Bun

1. Support remapped `bunfig.toml`:

```toml
[test]
coverageDir = "coverage-reports"  # default "coverage"
coverageReporter = ["text", "lcov"]
coveragePathIgnorePatterns = [ # Exclude large directories you don't need coverage for
  "node_modules/**",
  "vendor/**",
  "generated/**"
]
```

---

### Deno

**1)** Extend ignoring directive patterns:

```ts
// deno-coverage-ignore-file

// all code in this file is ignored
```

```ts
// deno-coverage-ignore
console.log('this line is ignored');
```

```ts
// deno-coverage-ignore-start
if (condition) {
  console.log('both the branch and lines are ignored');
}
// deno-coverage-ignore-stop
```
