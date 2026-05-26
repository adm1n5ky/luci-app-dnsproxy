#!/bin/sh
set -e

PKG_NAME="luci-app-dnsproxy"
PKG_VERSION="${1:-0.1.0}"

# Укажите путь к SDK или создайте симлинк:
# ln -s ~/openwrt-sdk-25.12.4-x86-64_gcc-14.3.0_musl.Linux-x86_64 ~/openwrt-sdk
SDK_DIR="$HOME/openwrt-sdk"

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$SDK_DIR/package/$PKG_NAME"
OUT_DIR="$REPO_DIR/dist"

echo "==> Pulling latest changes..."
cd "$REPO_DIR" && git pull

echo "==> Syncing files to SDK..."
rm -rf "$PKG_DIR"
cp -r "$REPO_DIR" "$PKG_DIR"

echo "==> Building $PKG_NAME-$PKG_VERSION..."
cd "$SDK_DIR"
make package/$PKG_NAME/compile V=s 2>&1 | tail -10

echo "==> Copying result to dist/..."
mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/*.apk
cp "$SDK_DIR/bin/packages/x86_64/base/$PKG_NAME"*.apk "$OUT_DIR/"

echo "==> Done:"
ls "$OUT_DIR/$PKG_NAME"*.apk
