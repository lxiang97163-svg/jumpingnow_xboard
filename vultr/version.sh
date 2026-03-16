#!/bin/bash
set -euo pipefail

. /etc/os-release
os_version="${VERSION:-${VERSION_ID:-$(uname -r)}}"

echo "'OS: ${os_version}'"
