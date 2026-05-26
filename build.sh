#!/bin/sh
set -e

PKG_NAME="luci-app-dnsproxy"
PKG_VERSION="${1:-0.1.0}"
PKG_RELEASE="r1"
PKG_ARCH="all"
PKG_DESCRIPTION="LuCI web interface for AdGuard DNS Proxy. Supports DoT, DoH, DoQ, DNSCrypt."
PKG_MAINTAINER="NumLock"
PKG_LICENSE="Apache-2.0"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/.build"
PKG_DIR="${BUILD_DIR}/pkg"
OUT_DIR="${SCRIPT_DIR}/dist"

echo "==> Building ${PKG_NAME}-${PKG_VERSION}-r${PKG_RELEASE}-${PKG_ARCH}.apk"

rm -rf "${BUILD_DIR}"
mkdir -p "${PKG_DIR}"
mkdir -p "${OUT_DIR}"

# Копируем файлы пакета
cp -r "${SCRIPT_DIR}/usr" "${PKG_DIR}/"
cp -r "${SCRIPT_DIR}/www" "${PKG_DIR}/"

# Считаем размер в байтах
PKG_SIZE=$(du -sb "${PKG_DIR}" 2>/dev/null | cut -f1 || du -sk "${PKG_DIR}" | awk '{print $1*1024}')

# Создаём .PKGINFO
cat > "${PKG_DIR}/.PKGINFO" << PKGINFO
pkgname = ${PKG_NAME}
pkgver = ${PKG_VERSION}-r${PKG_RELEASE}
arch = ${PKG_ARCH}
size = ${PKG_SIZE}
pkgdesc = ${PKG_DESCRIPTION}
url = https://github.com/adm1n5ky/${PKG_NAME}
builddate = $(date +%s)
packager = ${PKG_MAINTAINER}
license = ${PKG_LICENSE}
depend = luci-base
depend = dnsproxy
depend = luci-mod-status
PKGINFO

# Собираем apk: .PKGINFO первым, затем все файлы — всё в одном tar.gz
cd "${PKG_DIR}"
tar -czf "${OUT_DIR}/${PKG_NAME}-${PKG_VERSION}-r${PKG_RELEASE}-${PKG_ARCH}.apk" \
    .PKGINFO \
    usr/ \
    www/

echo "==> Done: dist/${PKG_NAME}-${PKG_VERSION}-r${PKG_RELEASE}-${PKG_ARCH}.apk"
