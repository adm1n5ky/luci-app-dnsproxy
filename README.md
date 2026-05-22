# luci-app-dnsproxy

🌐 [English](#english) | 🇷🇺 [Русский](#русский)

---

<a id="english"></a>
## English

**luci-app-dnsproxy** is a platform-independent Web interface (LuCI) written in pure JavaScript and JSON for managing [AdGuard DNS Proxy](https://github.com) on OpenWrt 25.12+ routers.

> ℹ️ **Note:** This project is a configuration interface (GUI). The core routing and protocol handling are powered by the original [AdguardTeam/dnsproxy](https://github.com/AdguardTeam/dnsproxy) project. Since this app is built purely on JS/JSON, it is fully architecture-independent (architecture: `all`) and does not require compilation for specific router CPUs.

### About upstream project:
> **AdGuard DNS Proxy** is a simple DNS proxy server that supports all existing DNS protocols including DNS-over-TLS, DNS-over-HTTPS, DNSCrypt, and DNS-over-QUIC. Moreover, it can work as a DNS-over-HTTPS, DNS-over-TLS or DNS-over-QUIC server.

---

<a id="русский"></a>
## Русский

**luci-app-dnsproxy** — это платформонезависимый веб-интерфейс (LuCI), написанный на чистом JavaScript и JSON, для управления [AdGuard DNS Proxy](https://github.com) на роутерах OpenWrt 25.12+.

> ℹ️ **Примечание:** Этот проект является графической оболочкой (панелью управления). Вся логика работы с протоколами и маршрутизация выполняются оригинальным движком [AdguardTeam/dnsproxy](https://github.com/AdguardTeam/dnsproxy). Так как приложение написано исключительно на JS/JSON, оно полностью независимо от архитектуры процессора (architecture: `all`) и не требует компиляции под конкретные модели роутеров.

### Об оригинальном проекте:
> **AdGuard DNS Proxy** - это простой DNS-прокси сервер с поддержкой всех современных протоколов, включая DNS-over-TLS, DNS-over-HTTPS, DNSCrypt и DNS-over-QUIC. Также он может работать в качестве полноценного DoH, DoT или DoQ сервера.

<img width="1483" height="1078" alt="изображение" src="https://github.com/user-attachments/assets/da0d63f4-21a0-494f-a4a7-74d633c963a6" />

Скрипт синхронизации файлов на роутере. Внимание! Это пока только для тестов

```bash
apk add git
```

```bash
cat > /usr/bin/dnsproxy-update << 'EOF'
#!/bin/sh
REPO="https://github.com/adm1n5ky/luci-app-dnsproxy/archive/refs/heads/main.tar.gz"
cd /tmp && rm -rf luci-app-dnsproxy-main && \
wget -q -O dnsproxy.tar.gz "$REPO" && \
tar -xzf dnsproxy.tar.gz && \
cp -r luci-app-dnsproxy-main/luci-app-dnsproxy/www/luci-static/resources/view/dnsproxy/* \
      /www/luci-static/resources/view/dnsproxy/ && \
cp -r luci-app-dnsproxy-main/luci-app-dnsproxy/www/luci-static/resources/tools/dnsproxy/* \
      /www/luci-static/resources/tools/dnsproxy/ && \
cp luci-app-dnsproxy-main/luci-app-dnsproxy/usr/share/luci/menu.d/luci-app-dnsproxy.json \
   /usr/share/luci/menu.d/luci-app-dnsproxy.json && \
cp luci-app-dnsproxy-main/luci-app-dnsproxy/usr/share/rpcd/acl.d/luci-app-dnsproxy.json \
   /usr/share/rpcd/acl.d/luci-app-dnsproxy.json && \
rm -rf /tmp/luci-* /tmp/luci-app-dnsproxy-main /tmp/dnsproxy.tar.gz && \
echo "Done"
EOF
chmod +x /usr/bin/dnsproxy-update && dnsproxy-update
```
dnsproxy-update
