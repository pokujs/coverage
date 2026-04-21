# Contributing

If you're thinking of contributing, thank you, and _naturally_, please **be respectful** 🙋🏻‍♂️

## Issues

By opening an **Issue**, please describe the problem.<br />
If you can share a basic repro, it will be great.

---

## Pull Requests

By opening a **Pull Request**, please describe the proposed solution and what it solves.<br />
The final commit message will be generated from the _PR_ title by using "**Squash and Merge**".

---

## Developing

### ⚙️ Environment

You will need these tools installed on your system:

- [**Node.js**](https://nodejs.org)
- [**Bun**](https://bun.com/)
- [**Deno**](https://deno.com/)

---

Fork this project, download your forked repository locally and create a new branch from `main`.<br />
Then run `npm ci` to clean install the _node_modules_:

```sh
npm ci
```

> Please, do not change the _package-lock.json_ manually.

### 🔧 Fixes

Where possible, provide an error test case that the fix covers.

### ❇️ Features

It's better to discuss an **API** before actually start implementing it. You can open an [**Issue on Github**](https://github.com/pokujs/coverage/issues/new), so we can discuss the **API** design implementation ideas.

> Please ensure test cases to cover new features.

### 📘 Documentation

The documentation is held within the main [**Poku**](https://github.com/wellwelwel/poku/tree/main/website) repository.

---

## Testing

### 👩🏻‍🏭 General

```sh
npm run build
```

Then:

```sh
npm test             # runs all tests for each runtime
npm run test:node    # runs all tests for Node.js
npm run test:deno    # runs all tests for Deno
npm run test:bun     # runs all tests for Bun
```

- Run the test suite.

### Generating snapshots

› **Locally**

```sh
npm run build:snapshots
```

› **GitHub Actions**

Enable the **Actions** for your fork, then dispatch:

- **macOS:** [.github/workflows/build-snapshots-macos.yml](.github/workflows/build-snapshots-macos.yml)
- **Linux:** [.github/workflows/build-snapshots-linux.yml](.github/workflows/build-snapshots-linux.yml)
- **Windows:** [.github/workflows/build-snapshots-windows.yml](.github/workflows/build-snapshots-windows.yml)

Then, download the `.zip` generated from each workflow, paste the `.zip` into the root workspace (`./`) and run:

- **macOS:** `bash scripts/snapshots-darwin.sh`
- **Linux:** `bash scripts/snapshots-linux.sh`
- **Windows:** `bash scripts/snapshots-windows.sh`

This will extract and overwrite all changed snapshots, then delete the related `.zip`.

> [!TIP]
>
> You can set a custom branch when dispatching a workflow to generate the new snapshots. By default, **GitHub Actions** shows the `main` branch.

---

### 👔 Types & Lint

```sh
npm run typecheck
npm run lint
```

> Also
>
> ```sh
> npm run lint:fix
> ```
>
> - Automatically repairs most lint errors.
