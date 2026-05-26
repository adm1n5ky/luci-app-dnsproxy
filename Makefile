include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-dnsproxy
PKG_VERSION:=0.1.0
PKG_RELEASE:=r1

PKG_MAINTAINER:=NumLock
PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-dnsproxy
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI support for AdGuard DNS Proxy
  DEPENDS:=+luci-base +dnsproxy +luci-mod-status
  PKGARCH:=all
endef

define Package/luci-app-dnsproxy/description
  LuCI web interface for AdGuard DNS Proxy.
  Supports DoT, DoH, DoQ, DNSCrypt.
endef

define Build/Compile
endef

define Package/luci-app-dnsproxy/install
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./usr/share/luci/menu.d/luci-app-dnsproxy.json \
		$(1)/usr/share/luci/menu.d/

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./usr/share/rpcd/acl.d/luci-app-dnsproxy.json \
		$(1)/usr/share/rpcd/acl.d/

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/dnsproxy
	$(INSTALL_DATA) ./www/luci-static/resources/view/dnsproxy/*.js \
		$(1)/www/luci-static/resources/view/dnsproxy/

	$(INSTALL_DIR) $(1)/www/luci-static/resources/tools/dnsproxy
	$(INSTALL_DATA) ./www/luci-static/resources/tools/dnsproxy/*.js \
		$(1)/www/luci-static/resources/tools/dnsproxy/
endef

$(eval $(call BuildPackage,luci-app-dnsproxy))
