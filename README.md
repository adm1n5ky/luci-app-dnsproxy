# luci-app-dnsproxy

🌐 [English](#english) | 🇷🇺 [Русский](#русский)
https://img.shields.io/github/v/release/adm1n5ky/luci-app-dnsproxy
---

<a id="english"></a>
## English

**luci-app-dnsproxy** is a platform-independent Web interface (LuCI) written in pure JavaScript and JSON for managing [AdGuard DNS Proxy](https://github.com) on OpenWrt 25.12+ routers.

> ℹ️ **Note:** This project is a configuration interface (GUI). The core routing and protocol handling are powered by the original [AdguardTeam/dnsproxy](https://github.com/AdguardTeam/dnsproxy) project. Since this app is built purely on JS/JSON, it is fully architecture-independent (architecture: `all`) and does not require compilation for specific router CPUs.

### About upstream project:
> **AdGuard DNS Proxy** is a simple DNS proxy server that supports all existing DNS protocols including DNS-over-TLS, DNS-over-HTTPS, DNSCrypt, and DNS-over-QUIC. Moreover, it can work as a DNS-over-HTTPS, DNS-over-TLS or DNS-over-QUIC server.

### Install via SSH

```sh
wget -O /tmp/luci-app-dnsproxy.apk \
  https://github.com/adm1n5ky/luci-app-dnsproxy/releases/download/v0.1.0/luci-app-dnsproxy-0.1.0-r1.apk
apk add --allow-untrusted /tmp/luci-app-dnsproxy.apk
service rpcd restart
```
---

<a id="русский"></a>
## Русский

**luci-app-dnsproxy** - это платформонезависимый веб-интерфейс (LuCI), написанный на чистом JavaScript и JSON, для управления [AdGuard DNS Proxy](https://github.com) на роутерах OpenWrt 25.12+.

> ℹ️ **Примечание:** Этот проект является графической оболочкой (панелью управления). Вся логика работы с протоколами и маршрутизация выполняются оригинальным движком [AdguardTeam/dnsproxy](https://github.com/AdguardTeam/dnsproxy). Так как приложение написано исключительно на JS/JSON, оно полностью независимо от архитектуры процессора (architecture: `all`) и не требует компиляции под конкретные модели роутеров.

### Об оригинальном проекте:
> **AdGuard DNS Proxy** - это простой DNS-прокси сервер с поддержкой всех современных протоколов, включая DNS-over-TLS, DNS-over-HTTPS, DNSCrypt и DNS-over-QUIC. Также он может работать в качестве полноценного DoH, DoT или DoQ сервера.

<img width="1543" height="942" alt="изображение" src="https://github.com/user-attachments/assets/5cd4672f-9bd5-4e1e-88f4-8d20a6f3623a" />
