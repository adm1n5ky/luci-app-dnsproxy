# luci-app-dnsproxy
OpenWrt веб панелька для Adguard DNS Proxy

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
chmod +x /usr/bin/dnsproxy-update && dnsproxy-update```
dnsproxy-update
