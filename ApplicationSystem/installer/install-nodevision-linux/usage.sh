# Nodevision/ApplicationSystem/installer/install-nodevision-linux/usage.sh
# This file defines the usage module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.

nv_usage() {
  cat <<'EOF'
Nodevision Linux installer

Downloads a Nodevision Linux bundle, installs it to a chosen directory, and (optionally)
creates a Nodevision.desktop launcher based on your selections.

Usage:
  ApplicationSystem/installer/install-nodevision-linux.sh [options]

Options:
  --install-dir DIR        Install location (default: $HOME/Nodevision)
  --url URL                Bundle URL to download (default: GitHub latest release asset for --repo)
  --repo OWNER/REPO        GitHub repo for default download URL (default: HHolben/Nodevision)
  --force                  Replace existing app files (backs up existing ApplicationSystem)
  --non-interactive        Do not prompt; use defaults + provided flags

Desktop entry options (Linux):
  --desktop                Create/update a desktop entry (default in interactive mode: ask)
  --no-desktop             Skip desktop entry creation
  --desktop-path PATH      Desktop entry path (default: ~/.local/share/applications/Nodevision.desktop)
  --exec PATH              Exec target for desktop entry (default: wrapper ~/.local/bin/nodevision)
  --name NAME              Desktop Name= (default: Nodevision)
  --comment TEXT           Desktop Comment= (default: Launch Nodevision Notebook Environment)
  --icon ICON              Desktop Icon= (default: utilities-terminal)
  --terminal true|false    Desktop Terminal= (default: false)
  --categories CATS        Desktop Categories= (default: Development;)

Notes:
  - The bundle must contain a 'nodevision-linux' binary and an 'ApplicationSystem/' folder.
  - The installer also creates a wrapper script at ~/.local/bin/nodevision and uses it by default for Exec=.
EOF
}
