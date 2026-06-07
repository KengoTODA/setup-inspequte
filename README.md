# setup-inspequte

GitHub Action to install [`inspequte`](https://github.com/KengoTODA/inspequte),
add it to `PATH`, and cache the installed binary via the GitHub Actions tool
cache.

## Usage

```yaml
steps:
  - uses: actions/checkout@v6

  - name: Setup inspequte
    uses: KengoTODA/setup-inspequte@v1

  - name: Check version
    run: inspequte --version
```

Install a specific version:

```yaml
steps:
  - uses: KengoTODA/setup-inspequte@v1
    with:
      version: 1.0.0
```

`version` also accepts tags like `v1.0.0` or `inspequte-v1.0.0`.

## Inputs

- `version` (optional): Version to install. If omitted, the action selects the
  newest stable release that contains an asset for the current runner platform.

## Outputs

- `version`: Installed release tag (for example, `inspequte-v1.0.0`).

## Supported Runners

- `linux/x64`
- `darwin/arm64`
- `win32/x64`

## Caching Behavior

The action uses the GitHub Actions tool cache (`@actions/tool-cache`):

- If the requested version is already cached, it reuses the cached binary.
- Otherwise, it downloads and extracts the release asset, caches it, and reuses
  it in later jobs on the same runner image.
