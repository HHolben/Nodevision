# Nodevision Ubuntu Installer

This folder contains first-party install/uninstall scripts for Ubuntu and Ubuntu-based Linux distributions.

## Install

Run from the Nodevision repository root:

```bash
bash Installers/Linux/install-nodevision-ubuntu.sh
```

Common options:

```bash
# Preview actions only
bash Installers/Linux/install-nodevision-ubuntu.sh --dry-run

# Install to a custom location
bash Installers/Linux/install-nodevision-ubuntu.sh --prefix "$HOME/.local/share/nodevision-dev"

# Skip apt dependency installation (still verifies dependencies)
bash Installers/Linux/install-nodevision-ubuntu.sh --skip-deps

# Install systemd user service file
bash Installers/Linux/install-nodevision-ubuntu.sh --install-service

# Install + enable/start service
bash Installers/Linux/install-nodevision-ubuntu.sh --enable-service
```

## Uninstall

```bash
bash Installers/Linux/uninstall-nodevision-ubuntu.sh
```

Common options:

```bash
# Preview uninstall actions only
bash Installers/Linux/uninstall-nodevision-ubuntu.sh --dry-run

# Target custom install location
bash Installers/Linux/uninstall-nodevision-ubuntu.sh --prefix "$HOME/.local/share/nodevision-dev"

# Also delete user data directories
bash Installers/Linux/uninstall-nodevision-ubuntu.sh --purge-user-data
```

## Dependencies

The installer installs or verifies:

- `nodejs`
- `npm`
- `php-cli`
- `git`
- `curl`
- `build-essential`
- `python3`
- `ca-certificates`

Dependency install commands used by the installer:

```bash
sudo apt update
sudo apt install -y nodejs npm php-cli git curl build-essential python3 ca-certificates
```

## Install Location

Default application install directory:

- `~/.local/share/nodevision`

Override with:

- `--prefix PATH`

Launcher path:

- `~/.local/bin/nodevision`

Desktop entry path:

- `~/.local/share/applications/nodevision.desktop`

Systemd user service path (optional):

- `~/.config/systemd/user/nodevision.service`

## User Data Location

Nodevision user data directories are kept in the install directory:

- `~/.local/share/nodevision/Notebook`
- `~/.local/share/nodevision/UserData`
- `~/.local/share/nodevision/UserSettings`
- `~/.local/share/nodevision/ServerData`
- `~/.local/share/nodevision/ServerSettings`

During install updates, existing user-data folders are preserved and backed up with timestamps under:

- `~/.local/share/nodevision/.nodevision-userdata-backups/`

During uninstall, these folders are preserved unless `--purge-user-data` is explicitly passed.

## Launch Nodevision

After install, launch with:

```bash
nodevision
```

If `~/.local/bin` is not in your `PATH`, add:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Enable/Disable User Service

If service file was installed:

```bash
systemctl --user daemon-reload
systemctl --user enable --now nodevision.service
```

Disable and stop:

```bash
systemctl --user disable --now nodevision.service
```

## Troubleshooting

Check required runtime tools:

```bash
node --version
npm --version
php --version
```

If missing, install dependencies with apt:

```bash
sudo apt update
sudo apt install -y nodejs npm php-cli git curl build-essential python3 ca-certificates
```

If `nodevision` command is not found, ensure `~/.local/bin` is in `PATH` and open a new shell.

## Important Warning

Do not run the installer with `sudo`.  
Run as your normal user. The script only uses `sudo` for apt dependency commands.
