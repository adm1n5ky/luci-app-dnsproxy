'use strict'
'require view'

return view.extend({
    render: function () {
        var help_content = [
            E('h3', {}, _('DNS Proxy - Help & Documentation')),
            E(
                'p',
                { class: 'description' },
                _(
                    'A powerful DNS proxy with support for modern encrypted DNS protocols and advanced filtering capabilities.',
                ),
            ),

            E('div', { class: 'alert alert-info' }, [
                E('p', {}, _('Supported Protocols:')),
                E('div', { style: 'margin-top:5px;' }, [
                    E('span', { class: 'badge' }, 'Plain DNS'),
                    E('span', { class: 'badge badge-info' }, 'DoT'),
                    E('span', { class: 'badge badge-success' }, 'DoH'),
                    E('span', { class: 'badge badge-warning' }, 'DoQ'),
                    E('span', { class: 'badge badge-danger' }, 'DNSCrypt'),
                ]),
            ]),

            E('div', { style: 'margin-bottom: 1em;' }, [
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

            // --- Upstream Server URL Formats ---
            E('h4', {}, '🌐 ' + _('Upstream Server URL Formats')),
            E(
                'p',
                {},
                _(
                    'Configure your DNS upstream servers using the following formats:',
                ),
            ),
            E('table', { class: 'table' }, [
                E('tr', { class: 'tr table-titles' }, [
                    E('th', { class: 'th' }, _('URL Format')),
                    E('th', { class: 'th' }, _('Description')),
                    E('th', { class: 'th' }, _('Example / Notes')),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('code', {}, '8.8.8.8:53')),
                    E('td', { class: 'td' }, _('Plain DNS (UDP/TCP auto)')),
                    E(
                        'td',
                        { class: 'td' },
                        E('em', {}, _('Default, simplest')),
                    ),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('code', {}, 'tcp://1.1.1.1')),
                    E('td', { class: 'td' }, _('Plain DNS over TCP only')),
                    E('td', { class: 'td' }, _('Forced TCP connection')),
                ]),
                E('tr', { class: 'tr' }, [
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, 'tls://dns.adguard.com'),
                    ),
                    E('td', { class: 'td' }, _('DNS-over-TLS (DoT)')),
                    E('td', { class: 'td' }, _('Encrypted, default port 853')),
                ]),
                E('tr', { class: 'tr' }, [
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, 'https://dns.adguard.com/dns-query'),
                    ),
                    E('td', { class: 'td' }, _('DNS-over-HTTPS (DoH)')),
                    E('td', { class: 'td' }, _('Encrypted, default port 443')),
                ]),
                E('tr', { class: 'tr' }, [
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, 'quic://dns.adguard.com'),
                    ),
                    E('td', { class: 'td' }, _('DNS-over-QUIC (DoQ)')),
                    E('td', { class: 'td' }, _('Fastest encrypted protocol')),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('code', {}, 'sdns://...')),
                    E('td', { class: 'td' }, _('DNSCrypt / DNS Stamp')),
                    E('td', { class: 'td' }, _('Full stamp string required')),
                ]),
            ]),

            // --- Domain-Specific Upstreams ---
            E('h4', {}, '🎯 ' + _('Domain-Specific Upstreams')),
            E(
                'p',
                {},
                _(
                    'Route queries for specific domains to different DNS servers using the syntax: ',
                ),
                E('code', {}, '[/domain/]upstream'),
            ),
            E('table', { class: 'table' }, [
                E('tr', { class: 'tr table-titles' }, [
                    E('th', { class: 'th' }, _('Pattern')),
                    E('th', { class: 'th' }, _('Behavior')),
                ]),
                E('tr', { class: 'tr' }, [
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, '[/local/]192.168.1.1'),
                    ),
                    E(
                        'td',
                        { class: 'td' },
                        _('All *.local domains → local DNS server'),
                    ),
                ]),
                E('tr', { class: 'tr' }, [
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, '[/corp.example.com/]10.0.0.1'),
                    ),
                    E(
                        'td',
                        { class: 'td' },
                        _('Subdomain → internal corporate DNS'),
                    ),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('code', {}, '[//]1.1.1.1')),
                    E(
                        'td',
                        { class: 'td' },
                        _('Unqualified (single-label) names'),
                    ),
                ]),
                E('tr', { class: 'tr' }, [
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, '[/example.com/]tls://dns.example.com'),
                    ),
                    E(
                        'td',
                        { class: 'td' },
                        _('Specific domain with encrypted DNS'),
                    ),
                ]),
            ]),

            // --- Upstream Modes ---
            E('h4', {}, '⚙️ ' + _('Upstream Modes')),
            E(
                'p',
                {},
                _('Control how multiple upstream servers are utilized:'),
            ),
            E('table', { class: 'table' }, [
                E('tr', { class: 'tr table-titles' }, [
                    E('th', { class: 'th' }, _('Mode')),
                    E('th', { class: 'th' }, _('Description')),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('code', {}, 'load_balance')),
                    E(
                        'td',
                        { class: 'td' },
                        _('Distribute queries across all upstreams evenly'),
                    ),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('code', {}, 'parallel')),
                    E(
                        'td',
                        { class: 'td' },
                        _(
                            'Query all upstreams simultaneously, use fastest response',
                        ),
                    ),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('code', {}, 'fastest_addr')),
                    E(
                        'td',
                        { class: 'td' },
                        _(
                            'Ping upstreams periodically, use the IP with lowest latency',
                        ),
                    ),
                ]),
            ]),

            // --- Popular Public DNS ---
            E('h4', {}, '🏢 ' + _('Popular Public DNS Servers')),
            E('p', {}, _('Ready-to-use public DNS resolvers:')),
            E('table', { class: 'table' }, [
                E('tr', { class: 'tr table-titles' }, [
                    E('th', { class: 'th' }, _('Provider')),
                    E('th', { class: 'th' }, _('DoT Upstream')),
                    E('th', { class: 'th' }, _('DoH Upstream')),
                    E('th', { class: 'th' }, _('Notes')),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('strong', {}, 'Cloudflare')),
                    E('td', { class: 'td' }, E('code', {}, 'tls://1.1.1.1')),
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, 'https://1.1.1.1/dns-query'),
                    ),
                    E('td', { class: 'td' }, _('Fast, privacy-focused')),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('strong', {}, 'Google')),
                    E('td', { class: 'td' }, E('code', {}, 'tls://8.8.8.8')),
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, 'https://8.8.8.8/dns-query'),
                    ),
                    E(
                        'td',
                        { class: 'td' },
                        _('Reliable, global infrastructure'),
                    ),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('strong', {}, 'Quad9')),
                    E('td', { class: 'td' }, E('code', {}, 'tls://9.9.9.9')),
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, 'https://9.9.9.9/dns-query'),
                    ),
                    E(
                        'td',
                        { class: 'td' },
                        _('Security focused, malware blocking'),
                    ),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('strong', {}, 'AdGuard')),
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, 'tls://dns.adguard.com'),
                    ),
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, 'https://dns.adguard.com/dns-query'),
                    ),
                    E('td', { class: 'td' }, _('Built-in ad-blocking filters')),
                ]),
                E('tr', { class: 'tr' }, [
                    E('td', { class: 'td' }, E('strong', {}, 'NextDNS')),
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, 'tls://<id>.dns.nextdns.io'),
                    ),
                    E(
                        'td',
                        { class: 'td' },
                        E('code', {}, 'https://dns.nextdns.io/<id>'),
                    ),
                    E(
                        'td',
                        { class: 'td' },
                        _('Customizable, requires Account ID'),
                    ),
                ]),
            ]),

            // --- Security & Features ---
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
                E(
                    'li',
                    {},
                    _('Ensure correct system time for TLS/HTTPS validation'),
                ),
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
                    'Use at least two upstream servers from different providers for better reliability!',
                ),
            ]),
        ]

        return E('div', { class: 'cbi-section' }, help_content)
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null,
})
