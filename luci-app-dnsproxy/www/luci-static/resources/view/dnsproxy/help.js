'use strict'
'require view'

return view.extend({
    render: function () {
        return E('div', { class: 'cbi-section' }, [
            E('h3', {}, _('DNS Proxy - Help & Documentation')),
            E(
                'p',
                { class: 'description' },
                _(
                    'A powerful DNS proxy with support for modern encrypted DNS protocols and advanced filtering capabilities.',
                ),
            ),
            E('p', { class: 'protocols-badge' }, [
                E('span', { class: 'badge' }, 'Plain DNS'),
                E('span', { class: 'badge badge-info' }, 'DoT'),
                E('span', { class: 'badge badge-success' }, 'DoH'),
                E('span', { class: 'badge badge-warning' }, 'DoQ'),
                E('span', { class: 'badge badge-danger' }, 'DNSCrypt'),
            ]),
            E('p', {}, [
                E(
                    'a',
                    {
                        href: 'https://github.com/AdguardTeam/dnsproxy#usage',
                        target: '_blank',
                        class: 'btn btn-small',
                    },
                    '📖 ' + _('Official Documentation'),
                ),
                ' ',
                E(
                    'a',
                    {
                        href: 'https://github.com/AdguardTeam/dnsproxy',
                        target: '_blank',
                        class: 'btn btn-small',
                    },
                    '⭐ GitHub Repository',
                ),
            ]),

            E('hr'),

            E('h4', {}, '🌐 ' + _('Upstream Server URL Formats')),
            E(
                'p',
                {},
                _(
                    'Configure your DNS upstream servers using the following formats:',
                ),
            ),
            E('table', { class: 'table' }, [
                E('tr', { class: 'row-header' }, [
                    E('th', {}, _('URL Format')),
                    E('th', {}, _('Description')),
                    E('th', {}, _('Example')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, '8.8.8.8:53')),
                    E('td', {}, _('Plain DNS (UDP/TCP auto)')),
                    E('td', {}, E('strong', {}, 'Default, simplest')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'tcp://1.1.1.1')),
                    E('td', {}, _('Plain DNS over TCP only')),
                    E('td', {}, _('Forced TCP')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'tls://dns.adguard.com')),
                    E('td', {}, _('DNS-over-TLS (DoT)')),
                    E('td', {}, _('Encrypted, port 853')),
                ]),
                E('tr', {}, [
                    E(
                        'td',
                        {},
                        E('code', {}, 'https://dns.adguard.com/dns-query'),
                    ),
                    E('td', {}, _('DNS-over-HTTPS (DoH)')),
                    E('td', {}, _('Encrypted, port 443')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'quic://dns.adguard.com')),
                    E('td', {}, _('DNS-over-QUIC (DoQ)')),
                    E('td', {}, _('Fastest encrypted')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'h3://dns.google/dns-query')),
                    E('td', {}, _('DoH with HTTP/3 forced')),
                    E('td', {}, _('HTTP/3 only')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'sdns://...')),
                    E('td', {}, _('DNSCrypt / DNS Stamp')),
                    E('td', {}, _('Full stamp string')),
                ]),
            ]),

            E('h4', {}, '🎯 ' + _('Domain-Specific Upstreams')),
            E(
                'p',
                {},
                _(
                    'Route queries for specific domains to different DNS servers:',
                ),
            ),
            E('div', { class: 'alert alert-info' }, [
                E('strong', {}, _('Syntax') + ': '),
                E('code', {}, '[/domain/]upstream'),
            ]),
            E('table', { class: 'table' }, [
                E('tr', {}, [
                    E('td', {}, E('code', {}, '[/local/]192.168.1.1')),
                    E('td', {}, _('All *.local domains → local DNS server')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, '[/corp.example.com/]10.0.0.1')),
                    E('td', {}, _('Subdomain → internal corporate DNS')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, '[//]1.1.1.1')),
                    E('td', {}, _('Unqualified (single-label) names')),
                ]),
                E('tr', {}, [
                    E(
                        'td',
                        {},
                        E('code', {}, '[/example.com/]tls://dns.example.com'),
                    ),
                    E('td', {}, _('Specific domain with encrypted DNS')),
                ]),
            ]),

            E('h4', {}, '⚙️ ' + _('Upstream Modes')),
            E('p', {}, _('Control how multiple upstream servers are used:')),
            E('table', { class: 'table' }, [
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'load_balance')),
                    E('td', {}, _('Distribute queries across all upstreams')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'parallel')),
                    E('td', {}, _('Query all upstreams, use fastest response')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'fastest_addr')),
                    E('td', {}, _('Ping upstreams, use fastest IP')),
                ]),
            ]),

            E('h4', {}, '🏢 ' + _('Popular Public DNS Servers')),
            E('p', {}, _('Ready-to-use public DNS resolvers:')),
            E('table', { class: 'table' }, [
                E('tr', { class: 'row-header' }, [
                    E('th', {}, _('Provider')),
                    E('th', {}, _('DoT')),
                    E('th', {}, _('DoH')),
                    E('th', {}, _('Notes')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('strong', {}, 'Cloudflare')),
                    E('td', {}, E('code', {}, 'tls://1.1.1.1')),
                    E('td', {}, E('code', {}, 'https://1.1.1.1/dns-query')),
                    E('td', {}, _('Fast, privacy-focused')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('strong', {}, 'Google')),
                    E('td', {}, E('code', {}, 'tls://8.8.8.8')),
                    E('td', {}, E('code', {}, 'https://8.8.8.8/dns-query')),
                    E('td', {}, _('Reliable, global')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('strong', {}, 'Quad9')),
                    E('td', {}, E('code', {}, 'tls://9.9.9.9')),
                    E('td', {}, E('code', {}, 'https://9.9.9.9/dns-query')),
                    E('td', {}, _('Security, malware blocking')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('strong', {}, 'AdGuard')),
                    E('td', {}, E('code', {}, 'tls://dns.adguard.com')),
                    E(
                        'td',
                        {},
                        E('code', {}, 'https://dns.adguard.com/dns-query'),
                    ),
                    E('td', {}, _('Ad-blocking built-in')),
                ]),
                E('tr', {}, [
                    E('td', {}, E('strong', {}, 'NextDNS')),
                    E('td', {}, E('code', {}, 'tls://<id>.dns.nextdns.io')),
                    E('td', {}, E('code', {}, 'https://dns.nextdns.io/<id>')),
                    E('td', {}, _('Customizable, requires ID')),
                ]),
            ]),

            E('h4', {}, '🔒 ' + _('Security & Privacy Features')),
            E('ul', {}, [
                E(
                    'li',
                    {},
                    _(
                        'EDNS Client Subnet (ECS) - Control subnet information sent to upstreams',
                    ),
                ),
                E(
                    'li',
                    {},
                    _(
                        'Bogus NXDomain - Convert specific responses to NXDomain',
                    ),
                ),
                E('li', {}, _('DNS64 - IPv6 translation for NAT64 networks')),
                E('li', {}, _('Hosts files - Local domain overrides')),
                E('li', {}, _('Request blocking via blocklists')),
                E('li', {}, _('DNSSEC validation support')),
            ]),

            E('h4', {}, '💾 ' + _('Caching & Performance')),
            E('ul', {}, [
                E(
                    'li',
                    {},
                    _(
                        'Optimistic cache - Return cached entries while refreshing in background',
                    ),
                ),
                E('li', {}, _('Configurable TTL - Control cache expiration')),
                E(
                    'li',
                    {},
                    _(
                        'Cache size optimization - Adjust based on available memory',
                    ),
                ),
                E(
                    'li',
                    {},
                    _('Connection pooling - Reuse connections to upstreams'),
                ),
            ]),

            E('h4', {}, '🛡️ ' + _('Server Mode Configuration')),
            E('p', {}, _('Run dnsproxy as a secure DNS server:')),
            E('ul', {}, [
                E('li', {}, _('DoT server: tls://0.0.0.0:853')),
                E('li', {}, _('DoH server: https://0.0.0.0:443')),
                E('li', {}, _('DoQ server: quic://0.0.0.0:853')),
                E(
                    'li',
                    {},
                    _('TLS certificates required for encrypted protocols'),
                ),
                E('li', {}, _('Optional authentication for private access')),
            ]),

            E('h4', {}, '🔧 ' + _('Troubleshooting Tips')),
            E('ul', {}, [
                E('li', {}, _('Check service status in Status → Diagnostics')),
                E('li', {}, _('View logs in System → Logread')),
                E(
                    'li',
                    {},
                    _('Verify upstream connectivity with dig/nslookup'),
                ),
                E('li', {}, _('Ensure correct system time for TLS/HTTPS')),
                E(
                    'li',
                    {},
                    _('Check firewall rules for DNS ports (53, 853, 443)'),
                ),
                E('li', {}, _('Test with multiple upstreams for redundancy')),
            ]),

            E('div', { class: 'alert alert-success' }, [
                E('strong', {}, '💡 Tip: '),
                _(
                    'Use at least two upstream servers for redundancy. Mix different providers for better reliability!',
                ),
            ]),
        ])
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
})
