# Nodevision/ApplicationSystem/installer/install-nodevision-linux/download.sh
# This file implements bundle naming and download logic for the Nodevision Linux installer so that network fetch behavior is centralized and easy to test.

nv_detect_default_asset() {
  local arch
  arch="$(uname -m 2>/dev/null || echo unknown)"
  case "$arch" in
    x86_64|amd64) printf 'nodevision-linux-x64.tar.gz\n' ;;
    aarch64|arm64) printf 'nodevision-linux-arm64.tar.gz\n' ;;
    *)
      nv_warn "Unknown architecture '$arch' (defaulting to x64 asset name)."
      printf 'nodevision-linux-x64.tar.gz\n'
      ;;
  esac
}

nv_download_file() {
  local url="$1"
  local out="$2"

  if nv_have curl; then
    curl -fL --retry 3 --connect-timeout 15 --max-time 0 -o "$out" "$url"
    return
  fi
  if nv_have wget; then
    wget -O "$out" "$url"
    return
  fi
  nv_die "Need 'curl' or 'wget' to download: $url"
}

