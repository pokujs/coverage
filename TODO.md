### Node.js

- ✨

---

### Bun

- ✨

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

### General

**1)** Allow isolating configurations between runtimes, for example:

- `bunfig.toml` applies settings only for Bun.
- All others that mirror `.c8rc`, `.nycrc`, and `.coveragerc` remain global.

Configuration example:

```jsonc
{
  "isolate": {
    "configs": true, // default: false
  },
}
```

---

**2)** Allow isolating behaviors between different runtimes, for example:

> - Blocked until finishing the Deno TODO.
> - Complex.

- "jsc" directive ignores only for Bun
- Deno native directives ignore only for Deno
- "v8" directive ignores only for Deno and Node.js
- "coverage" directive ignores for all?
- Should there be an autonomous way to ignore by runtime? Example: `deno-coverage-ignore`, `node-coverage-ignore`, `bun-coverage-ignore`.

Configuration example:

```jsonc
{
  "isolate": {
    "specialComments": true, // default: false
  },
}
```

---

**3)** Distinguishing Statements from Lines
