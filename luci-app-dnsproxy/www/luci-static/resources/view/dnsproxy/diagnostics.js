'use strict'
'require view'
'require fs'
'require ui'
'require uci'
'require poll'

// ── /proc/net parsers ─────────────────────────────────────────────────────────

function parseIPv4(hex) {
    var bytes = []
    for (var i = 0; i < 8; i += 2)
        bytes.unshift(parseInt(hex.slice(i, i + 2), 16))
    return bytes.join('.')
}

function parseIPv6(hex) {
    var bytes = []
    for (var chunk = 0; chunk < 4; chunk++) {
        var part = hex.slice(chunk * 8, chunk * 8 + 8)
        for (var i = 6; i >= 0; i -= 2)
            bytes.push(parseInt(part.slice(i, i + 2), 16))
    }
    var groups = []
    for (var i = 0; i < 16; i += 2)
        groups.push(((bytes[i] << 8) | bytes[i + 1]).toString(16))
    var best = { start: -1, len: 0 },
        cur = { start: -1, len: 0 }
    for (var i = 0; i < groups.length; i++) {
        if (groups[i] === '0') {
            if (cur.start < 0) cur = { start: i, len: 0 }
            cur.len++
            if (cur.len > best.len) best = { start: cur.start, len: cur.len }
        } else {
            cur = { start: -1, len: 0 }
        }
    }
    if (best.len > 1) {
        var left = groups.slice(0, best.start)
        var right = groups.slice(best.start + best.len)
        return (
            (left.length ? left.join(':') : '') +
            '::' +
            (right.length ? right.join(':') : '')
        )
    }
    return groups.join(':')
}

function parseProcNet(content, isV6, isUDP, uid) {
    if (!content) return []
    var rows = []
    content.split('\n').forEach(function (line) {
        var cols = line.trim().split(/\s+/)
        if (cols.length < 10) return
        if (cols[7] !== uid) return
        if (!isUDP && cols[3] !== '0A') return
        if (isUDP && cols[3] !== '07') return
        var parts = cols[1].split(':')
        rows.push({
            addr: isV6 ? parseIPv6(parts[0]) : parseIPv4(parts[0]),
            port: parseInt(parts[1], 16),
        })
    })
    return rows
}

// ── Data fetch ────────────────────────────────────────────────────────────────

function fetchAll() {
    return Promise.all([
        L.resolveDefault(fs.read('/etc/passwd'), ''),
        L.resolveDefault(fs.read('/proc/net/tcp'), ''),
        L.resolveDefault(fs.read('/proc/net/udp'), ''),
        L.resolveDefault(fs.read('/proc/net/tcp6'), ''),
        L.resolveDefault(fs.read('/proc/net/udp6'), ''),
    ]).then(function (r) {
        var m = r[0].match(/^dnsproxy:[^:]+:([0-9]+):/m)
        var uid = m ? m[1] : null

        var entries = []
        if (uid) {
            ;[
                { content: r[1], isV6: false, isUDP: false, proto: 'TCP' },
                { content: r[2], isV6: false, isUDP: true, proto: 'UDP' },
                { content: r[3], isV6: true, isUDP: false, proto: 'TCP6' },
                { content: r[4], isV6: true, isUDP: true, proto: 'UDP6' },
            ].forEach(function (src) {
                parseProcNet(src.content, src.isV6, src.isUDP, uid).forEach(
                    function (row) {
                        entries.push({
                            proto: src.proto,
                            addr: row.addr,
                            port: row.port,
                        })
                    },
                )
            })
            entries.sort(function (a, b) {
                return a.port !== b.port
                    ? a.port - b.port
                    : a.proto.localeCompare(b.proto)
            })
        }

        return { uid: uid, entries: entries }
    })
}

/**
 * Build unique list of IPv4 addr:port pairs for the DNS server selector.
 * Only TCP entries, no IPv6 (nslookup support varies).
 * Sorted by port, then addr.
 */
function buildServerOptions(entries) {
    var seen = {}
    var opts = []
    entries.forEach(function (e) {
        if (e.proto !== 'TCP') return // UDP duplicates TCP ports
        if (e.addr.indexOf(':') >= 0) return // skip IPv6 for nslookup
        var key = e.addr + ':' + e.port
        if (seen[key]) return
        seen[key] = true
        opts.push(key)
    })
    return opts
}

// ── DOM ───────────────────────────────────────────────────────────────────────

function buildStatusBlock(data) {
    var uid = data.uid
    var entries = data.entries

    var sockTable = E('table', { class: 'table' }, [
        E('tr', { class: 'tr table-titles' }, [
            E('th', { class: 'th', style: 'width:6em' }, _('Protocol')),
            E('th', { class: 'th' }, _('Local Address')),
            E('th', { class: 'th', style: 'width:5em' }, _('Port')),
        ]),
    ])

    cbi_update_table(
        sockTable,
        entries.map(function (e) {
            var display = e.addr.indexOf(':') >= 0 ? '[' + e.addr + ']' : e.addr
            return [
                E('code', {}, e.proto),
                E('code', {}, display),
                E('code', {}, String(e.port)),
            ]
        }),
        E(
            'em',
            {},
            uid
                ? _('No listening sockets found — service may be stopped.')
                : _('Could not determine dnsproxy uid from /etc/passwd.'),
        ),
    )

    // Rebuild server selector options if it exists
    var sel = document.getElementById('dnsproxy-server-select')
    if (sel) {
        var opts = buildServerOptions(entries)
        var curVal = sel.value
        sel.innerHTML = ''
        opts.forEach(function (o) {
            var opt = document.createElement('option')
            opt.value = o
            opt.textContent = o
            if (o === curVal) opt.selected = true
            sel.appendChild(opt)
        })
        if (!sel.value && opts.length) sel.value = opts[0]
    }

    return E('div', { id: 'dnsproxy-status-block' }, [sockTable])
}

// ── View ─────────────────────────────────────────────────────────────────────

return view.extend({
    load: function () {
        return Promise.all([uci.load('dnsproxy'), fetchAll()])
    },

    handleCommand: function (exec, args) {
        var buttons = document.querySelectorAll('.diag-action > .cbi-button')
        var out = document.getElementById('dnsproxy-diag-output')
        buttons.forEach(function (b) {
            b.disabled = true
        })
        out.textContent = ''
        return fs
            .exec_direct(exec, args, 'text', false, true, function (ev) {
                out.textContent = ev.target.response
            })
            .then(function (res) {
                out.textContent = res
            })
            .catch(function (err) {
                ui.addNotification(null, E('p', String(err)))
            })
            .finally(function () {
                buttons.forEach(function (b) {
                    b.disabled = false
                })
            })
    },

    _getSelectedServer: function () {
        var sel = document.getElementById('dnsproxy-server-select')
        return sel && sel.value ? sel.value : '127.0.0.1:53'
    },

    handleDig: function () {
        var host = document.getElementById('dnsproxy-diag-host').value.trim()
        if (!host) return
        return this.handleCommand('nslookup', [host, this._getSelectedServer()])
    },

    handlePing: function () {
        var host = document.getElementById('dnsproxy-diag-host').value.trim()
        if (!host) return
        return this.handleCommand('ping', ['-c', '4', '-W', '2', host])
    },

    handleTraceroute: function () {
        var host = document.getElementById('dnsproxy-diag-host').value.trim()
        if (!host) return
        return this.handleCommand('traceroute', [
            '-q',
            '1',
            '-w',
            '2',
            '-n',
            '-m',
            '20',
            host,
        ])
    },

    _refresh: function () {
        return fetchAll().then(function (data) {
            var old = document.getElementById('dnsproxy-status-block')
            if (!old) return
            old.parentNode.replaceChild(buildStatusBlock(data), old)
        })
    },

    render: function (loaded) {
        var self = this
        var data = loaded[1]
        var opts = buildServerOptions(data.entries)
        var selOpts = opts.map(function (o) {
            return E('option', { value: o }, o)
        })

        poll.add(function () {
            return self._refresh()
        }, 8)

        return E('div', {}, [
            // Section 1 — Active sockets
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('DNS Proxy — Active Listening Ports')),
                E(
                    'p',
                    { class: 'cbi-section-descr' },
                    _(
                        'Live sockets filtered by dnsproxy uid from /etc/passwd. Auto-refreshes every 8 s.',
                    ),
                ),
                buildStatusBlock(data),
            ]),

            // Section 2 — Diagnostics
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('DNS Proxy — Diagnostics')),

                // DNS server selector
                E('div', { class: 'cbi-value' }, [
                    E(
                        'label',
                        {
                            class: 'cbi-value-title',
                            for: 'dnsproxy-server-select',
                        },
                        _('DNS Server'),
                    ),
                    E('div', { class: 'cbi-value-field' }, [
                        E(
                            'select',
                            {
                                id: 'dnsproxy-server-select',
                                class: 'cbi-input-select',
                                style: 'margin-right:.5em',
                            },
                            selOpts.length
                                ? selOpts
                                : [
                                      E(
                                          'option',
                                          { value: '127.0.0.1:53' },
                                          '127.0.0.1:53',
                                      ),
                                  ],
                        ),
                        E(
                            'span',
                            { class: 'cbi-value-description' },
                            _(
                                'Address and port of the dnsproxy listener to test against.',
                            ),
                        ),
                    ]),
                ]),

                // Target host + action buttons
                E('div', { class: 'cbi-value' }, [
                    E('label', { class: 'cbi-value-title' }, _('Target Host')),
                    E('div', { class: 'cbi-value-field' }, [
                        E('input', {
                            id: 'dnsproxy-diag-host',
                            type: 'text',
                            class: 'cbi-input-text',
                            style: 'width:20em;margin-right:.5em',
                            placeholder: 'example.com',
                            value: 'example.com',
                        }),
                        E('span', { class: 'diag-action' }, [
                            E(
                                'button',
                                {
                                    class: 'btn cbi-button cbi-button-action',
                                    click: ui.createHandlerFn(
                                        self,
                                        'handleDig',
                                    ),
                                },
                                _('DNS Lookup'),
                            ),
                            '\u00a0',
                            E(
                                'button',
                                {
                                    class: 'btn cbi-button cbi-button-action',
                                    click: ui.createHandlerFn(
                                        self,
                                        'handlePing',
                                    ),
                                },
                                _('Ping'),
                            ),
                            '\u00a0',
                            E(
                                'button',
                                {
                                    class: 'btn cbi-button cbi-button-action',
                                    click: ui.createHandlerFn(
                                        self,
                                        'handleTraceroute',
                                    ),
                                },
                                _('Traceroute'),
                            ),
                        ]),
                    ]),
                ]),

                // Output
                E('div', { class: 'cbi-value' }, [
                    E('label', { class: 'cbi-value-title' }, _('Output')),
                    E('div', { class: 'cbi-value-field' }, [
                        E('textarea', {
                            id: 'dnsproxy-diag-output',
                            style: 'width:58.5em;font-family:monospace;white-space:pre',
                            readonly: true,
                            wrap: 'off',
                            rows: '16',
                        }),
                    ]),
                ]),
            ]),
        ])
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
})
