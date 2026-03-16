# Nodevision/ApplicationSystem/installer/install-nodevision-linux/install.sh
# This file performs bundle extraction and filesystem installation steps so that the Nodevision Linux installer can keep its main script focused on configuration and prompts.

nv_is_tar_url() {
  case "$1" in
    *.tar.gz|*.tgz|*.tar) return 0 ;;
    *) return 1 ;;
  esac
}

nv_extract_tarball() {
  local url="$1"
  local bundle_path="$2"
  local extract_dir="$3"

  mkdir -p "$extract_dir"
  if [[ "$url" == *.tar.gz || "$url" == *.tgz ]]; then
    tar -xzf "$bundle_path" -C "$extract_dir"
  else
    tar -xf "$bundle_path" -C "$extract_dir"
  fi
}

nv_find_bundle_root() {
  local extract_dir="$1"
  local nodevision_bin_path
  nodevision_bin_path="$(find "$extract_dir" -maxdepth 4 -type f -name 'nodevision-linux' -print -quit || true)"
  [[ -n "$nodevision_bin_path" ]] || nv_die "Bundle did not contain 'nodevision-linux'"
  local bundle_root
  bundle_root="$(cd "$(dirname "$nodevision_bin_path")" && pwd)"
  [[ -d "${bundle_root}/ApplicationSystem" ]] || nv_die "Bundle root missing ApplicationSystem/: $bundle_root"
  printf '%s\n' "$bundle_root"
}

nv_backup_existing_appsystem() {
  local install_dir="$1"
  local force="$2"
  local existing_appsystem="${install_dir}/ApplicationSystem"

  if [[ -d "$existing_appsystem" ]]; then
    if [[ "$force" != "true" ]]; then
      nv_die "Existing install detected at '$install_dir' (has ApplicationSystem/). Re-run with --force to replace app files."
    fi
    local backup_path="${install_dir}/ApplicationSystem.bak.$(nv_timestamp)"
    nv_say "Backing up existing ApplicationSystem to:"
    nv_say "  $backup_path"
    mv "$existing_appsystem" "$backup_path"
  fi
}

nv_install_from_bundle_root() {
  local bundle_root="$1"
  local install_dir="$2"

  mkdir -p "$install_dir"
  cp -a "${bundle_root}/ApplicationSystem" "${install_dir}/ApplicationSystem"
  cp -a "${bundle_root}/nodevision-linux" "${install_dir}/nodevision-linux"
  chmod 755 "${install_dir}/nodevision-linux" || true

  if [[ -f "${bundle_root}/xdg-open" ]]; then
    cp -a "${bundle_root}/xdg-open" "${install_dir}/xdg-open"
    chmod 755 "${install_dir}/xdg-open" || true
  fi
}

