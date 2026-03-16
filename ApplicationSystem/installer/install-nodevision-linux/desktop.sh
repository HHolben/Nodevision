# Nodevision/ApplicationSystem/installer/install-nodevision-linux/desktop.sh
# This file writes the Nodevision wrapper script and desktop entry so that installations can launch Nodevision reliably from both terminals and desktop menus.

nv_escape_desktop_exec() {
  local s="$1"
  printf '%s' "$s" | sed 's/ /\\ /g'
}

nv_write_wrapper() {
  local wrapper_path="$1"
  local install_dir="$2"

  mkdir -p "$(dirname "$wrapper_path")"
  cat >"$wrapper_path" <<EOF
#!/usr/bin/env sh
export NODEVISION_ROOT="$(printf '%s' "$install_dir")"
exec "$(printf '%s' "$install_dir")/nodevision-linux" "\$@"
EOF
  chmod 755 "$wrapper_path" || true
}

nv_write_desktop_entry() {
  local desktop_path="$1"
  local exec_path="$2"
  local name="$3"
  local comment="$4"
  local icon="$5"
  local terminal="$6"
  local categories="$7"

  mkdir -p "$(dirname "$desktop_path")"
  local exec_escaped
  exec_escaped="$(nv_escape_desktop_exec "$exec_path")"
  cat >"$desktop_path" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=${name}
Comment=${comment}
Exec=${exec_escaped}
Icon=${icon}
Terminal=${terminal}
Categories=${categories}
EOF
  chmod 644 "$desktop_path" || true

  if nv_have update-desktop-database; then
    update-desktop-database "$(dirname "$desktop_path")" >/dev/null 2>&1 || true
  fi
}

