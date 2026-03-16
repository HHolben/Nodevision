<!-- Nodevision/ApplicationSystem/installer/README.md -->
<!-- This file documents how to run the Nodevision Linux installer and how to build a compatible bundle so that releases can be distributed consistently. -->

# Nodevision Installer (Linux)

This folder contains a Linux installer script that:

- Downloads a Nodevision Linux bundle (a `.tar.gz`)
- Installs it to a chosen directory (default: `~/Nodevision`)
- Optionally creates a `Nodevision.desktop` launcher based on your selections

## Quick start

```sh
bash ApplicationSystem/installer/install-nodevision-linux.sh
```

## Non-interactive example

```sh
bash ApplicationSystem/installer/install-nodevision-linux.sh \
  --non-interactive \
  --install-dir "$HOME/Nodevision" \
  --desktop \
  --desktop-path "$HOME/.local/share/applications/Nodevision.desktop"
```

## Bundle format expected by the installer

The downloaded tarball must contain (at its root, or inside a single top-level directory):

- `nodevision-linux`
- `ApplicationSystem/`
- optionally `xdg-open`

The `.desktop` file defaults to using a wrapper script at `~/.local/bin/nodevision` which sets `NODEVISION_ROOT` and launches the installed binary.

## Creating a bundle (for maintainers)

From the repo root:

```sh
bash ApplicationSystem/scripts/build-linux-bundle.sh
```

This produces `dist/nodevision-linux-x64.tar.gz`, which matches the installer's default expected asset name.
