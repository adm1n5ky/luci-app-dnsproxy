'use strict'
'require view'

return view.extend({
    render: function () {
        return E('div', { class: 'cbi-section' }, [
            E('h3', 'DNS Proxy'),
            E('p', _('Supports: Plain DNS · DoT · DoH · DoQ · DNSCrypt')),
            E('p', {}, [
                E(
                    'a',
                    {
                        href: 'https://github.com/AdguardTeam/dnsproxy#usage',
                        target: '_blank',
                    },
                    '→ ' + _('Official documentation on GitHub'),
                ),
            ]),
            E('h4', _('Upstream URL formats')),
            E('table', { class: 'table' }, [
                E('tr', {}, [
                    E('td', {}, E('code', {}, '8.8.8.8:53')),
                    E('td', {}, 'Plain DNS (UDP/TCP)'),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'tcp://1.1.1.1')),
                    E('td', {}, 'Plain DNS over TCP'),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'tls://dns.adguard.com')),
                    E('td', {}, 'DNS-over-TLS'),
                ]),
                E('tr', {}, [
                    E(
                        'td',
                        {},
                        E('code', {}, 'https://dns.adguard.com/dns-query'),
                    ),
                    E('td', {}, 'DNS-over-HTTPS'),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'quic://dns.adguard.com')),
                    E('td', {}, 'DNS-over-QUIC'),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'h3://dns.google/dns-query')),
                    E('td', {}, 'DoH forced HTTP/3'),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, 'sdns://...')),
                    E('td', {}, 'DNSCrypt / DNS Stamp'),
                ]),
            ]),
            E('h4', _('Domain-specific upstreams')),
            E('p', {}, [
                _('Syntax') + ': ',
                E('code', {}, '[/domain/]upstream'),
            ]),
            E('table', { class: 'table' }, [
                E('tr', {}, [
                    E('td', {}, E('code', {}, '[/local/]192.168.1.1')),
                    E('td', {}, '*.local → local server'),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, '[/corp.example.com/]10.0.0.1')),
                    E('td', {}, 'corp subdomain → internal'),
                ]),
                E('tr', {}, [
                    E('td', {}, E('code', {}, '[//]1.1.1.1')),
                    E('td', {}, 'unqualified (single-label) names'),
                ]),
            ]),
        ])
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
})
