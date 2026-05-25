'use strict'
'require view'
'require fs'
'require ui'
'require uci'
'require poll'
'require rpc'

var callGetProcessList = rpc.declare({
    object: 'luci',
    method: 'getProcessList',
    expect: { result: [] }, // ← было processes, надо result
})

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

function parseProcNetRaw(content, isV6) {
    if (!content) return []
    var rows = []
    content.split('\n').forEach(function (line) {
        var cols = line.trim().split(/\s+/)
        if (cols.length < 10) return
        var state = cols[3]
        if (state !== '0A' && state !== '07') return
        var parts = cols[1].split(':')
        rows.push({
            addr: isV6 ? parseIPv6(parts[0]) : parseIPv4(parts[0]),
            port: parseInt(parts[1], 16),
            uid: cols[7],
            proto: state === '0A' ? 'TCP' : 'UDP',
            isV6: isV6,
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
        L.resolveDefault(callGetProcessList(), []),
    ]).then(function (r) {
        var passwd = r[0]
        var procs = r[5]

        function uidOf(name) {
            var m = passwd.match(
                new RegExp('^' + name + ':[^:]+:([0-9]+):', 'm'),
            )
            return m ? m[1] : null
        }

        var dnsproxyUid = uidOf('dnsproxy')

        // All sockets
        var allRows = []
        ;[
            { content: r[1], isV6: false },
            { content: r[2], isV6: false },
            { content: r[3], isV6: true },
            { content: r[4], isV6: true },
        ].forEach(function (src) {
            parseProcNetRaw(src.content, src.isV6).forEach(function (row) {
                allRows.push(row)
            })
        })

        // dnsproxy sockets by uid
        var dnsproxyRows = allRows.filter(function (e) {
            return e.uid === dnsproxyUid
        })

        // Group dnsproxy sockets by addr
        var byAddr = {}
        dnsproxyRows.forEach(function (e) {
            if (!byAddr[e.addr])
                byAddr[e.addr] = {
                    addr: e.addr,
                    ports: {},
                    protos: {},
                    count: 0,
                    isV6: e.isV6,
                }
            byAddr[e.addr].ports[e.port] = true
            byAddr[e.addr].protos[e.isV6 ? e.proto + '6' : e.proto] = true
            byAddr[e.addr].count++
        })
        var groupedEntries = Object.keys(byAddr).map(function (k) {
            return byAddr[k]
        })
        groupedEntries.sort(function (a, b) {
            var aLoop = a.addr === '127.0.0.1' || a.addr === '::1' ? 0 : 1
            var bLoop = b.addr === '127.0.0.1' || b.addr === '::1' ? 0 : 1
            return aLoop !== bLoop
                ? aLoop - bLoop
                : a.addr.localeCompare(b.addr)
        })

        // Determine who owns port 53:
        // ujail opens sockets as root (uid=0) before dropping privileges,
        // so we CANNOT rely on uid in /proc/net. Instead check process list.
        var port53any = allRows.some(function (e) {
            return e.port === 53
        })

        // Is dnsmasq running? (real process, not ujail wrapper)
        var dnsmasqRunning = procs.some(function (p) {
            return (
                p.USER === 'dnsmasq' &&
                typeof p.COMMAND === 'string' &&
                p.COMMAND.charAt(0) === '/'
            )
        })

        // Is dnsproxy on port 53? Check by its uid which IS set correctly
        var dnsproxyOn53 = dnsproxyRows.some(function (e) {
            return e.port === 53
        })

        // port53owner: 'dnsproxy' | 'dnsmasq' | 'unknown' | null
        var port53owner = null
        if (port53any) {
            if (dnsproxyOn53) port53owner = 'dnsproxy'
            else if (dnsmasqRunning) port53owner = 'dnsmasq'
            else port53owner = 'unknown'
        }

        // dnsmasq ports (from its running command: -p option or default 53)
        var dnsmasqPorts = []
        if (dnsmasqRunning) {
            var dmProc = procs.find(function (p) {
                return (
                    p.USER === 'dnsmasq' &&
                    typeof p.COMMAND === 'string' &&
                    p.COMMAND.charAt(0) === '/'
                )
            })
            if (dmProc) {
                var pm = dmProc.COMMAND.match(/\s-p\s+(\d+)/)
                dnsmasqPorts = pm ? [parseInt(pm[1])] : [53]
            }
        }

        // dnsmasq redirect check via uci dhcp
        var dnsproxPorts = {}
        dnsproxyRows.forEach(function (e) {
            dnsproxPorts[e.port] = true
        })

        var dnsmasqRedirect = null
        try {
            var sections = uci.sections('dhcp', 'dnsmasq')
            if (sections && sections.length) {
                var servers = uci.get('dhcp', sections[0]['.name'], 'server')
                if (!Array.isArray(servers)) servers = servers ? [servers] : []
                servers.forEach(function (s) {
                    if (dnsmasqRedirect) return
                    var m = s.match(/#(\d+)$/)
                    if (m && dnsproxPorts[parseInt(m[1])]) dnsmasqRedirect = s
                })
            }
        } catch (e) {
            /* ignore */
        }

        // select options: unique IPv4 TCP addr:port for dnsproxy
        var selectOpts = [],
            seenOpts = {}
        dnsproxyRows.forEach(function (e) {
            if (e.proto !== 'TCP' || e.isV6) return
            var key = e.addr + ':' + e.port
            if (!seenOpts[key]) {
                seenOpts[key] = true
                selectOpts.push(key)
            }
        })
        selectOpts.sort()

        return {
            dnsproxyUid: dnsproxyUid,
            groupedEntries: groupedEntries,
            port53owner: port53owner,
            dnsmasqRunning: dnsmasqRunning,
            dnsmasqPorts: dnsmasqPorts,
            dnsmasqRedirect: dnsmasqRedirect,
            selectOpts: selectOpts,
        }
    })
}

// ── Port 53 info block ────────────────────────────────────────────────────────

function buildPort53Block(data) {
    var owner = data.port53owner
    var redirect = data.dnsmasqRedirect
    var dmRun = data.dnsmasqRunning
    var dmPorts = data.dnsmasqPorts
    var rows = []

    if (!owner) {
        // Nothing on 53 at all
        rows.push(
            E('div', {}, [
                E('span', { class: 'ifacebadge' }, 'Port 53'),
                ' ',
                _('not in use.'),
            ]),
        )
    } else if (owner === 'dnsmasq') {
        rows.push(
            E('div', {}, [
                E('span', { class: 'ifacebadge' }, 'Port 53'),
                ' ',
                _('handled by'),
                ' ',
                E('strong', {}, 'dnsmasq'),
            ]),
        )
        if (redirect) {
            rows.push(
                E(
                    'div',
                    { class: 'alert-message success', style: 'margin-top:6px' },
                    [
                        '✔ ',
                        _('Forwarding to dnsproxy via '),
                        E('code', {}, redirect),
                    ],
                ),
            )
        } else {
            rows.push(
                E(
                    'div',
                    { class: 'alert-message warning', style: 'margin-top:6px' },
                    [
                        '⚠ ',
                        _('No forwarding to dnsproxy. See the '),
                        E(
                            'a',
                            { href: L.url('admin/services/dnsproxy/help') },
                            _('Help page'),
                        ),
                        _(' for setup instructions.'),
                    ],
                ),
            )
        }
    } else if (owner === 'dnsproxy') {
        rows.push(
            E('div', { class: 'alert-message success' }, [
                '✔ ',
                _('dnsproxy listens directly on port 53.'),
            ]),
        )
        // dnsmasq status
        rows.push(
            E('div', { style: 'margin-top:8px' }, [
                E('strong', {}, 'dnsmasq: '),
                dmRun
                    ? E('span', {}, [
                          _('running, port(s) '),
                          E('code', {}, dmPorts.join(', ')),
                      ])
                    : E('span', { style: 'color:#6c757d' }, _('not running')),
            ]),
        )
    } else {
        // Something on 53 but we can't identify it
        rows.push(
            E('div', {}, [
                E('span', { class: 'ifacebadge' }, 'Port 53'),
                ' ',
                _('in use by an unknown process.'),
            ]),
        )
    }

    return E(
        'div',
        {
            style: 'padding:10px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;font-size:13px;line-height:1.8',
        },
        rows,
    )
}

// ── Status block ──────────────────────────────────────────────────────────────

function buildStatusBlock(data) {
    var sockTable = E('table', { class: 'table' }, [
        E('tr', { class: 'tr table-titles' }, [
            E('th', { class: 'th' }, _('Local Address')),
            E('th', { class: 'th' }, _('Ports')),
            E('th', { class: 'th' }, _('Protocols')),
            E(
                'th',
                { class: 'th', style: 'width:5em;text-align:center' },
                _('Sockets'),
            ),
        ]),
    ])

    cbi_update_table(
        sockTable,
        data.groupedEntries.map(function (e) {
            var display = e.isV6 ? '[' + e.addr + ']' : e.addr
            var ports = Object.keys(e.ports)
                .sort(function (a, b) {
                    return a - b
                })
                .join(', ')
            var protos = Object.keys(e.protos).sort().join(', ')
            return [
                E('span', { class: 'ifacebadge' }, display),
                E('span', { class: 'ifacebadge' }, ports),
                E('span', { class: 'ifacebadge' }, protos),
                E(
                    'span',
                    { style: 'text-align:center;display:block' },
                    String(e.count),
                ),
            ]
        }),
        E(
            'em',
            {},
            data.dnsproxyUid
                ? _('No listening sockets — service may be stopped.')
                : _('Cannot determine dnsproxy uid from /etc/passwd.'),
        ),
    )

    return E('div', { id: 'dnsproxy-status-block' }, [
        E(
            'div',
            {
                style: 'display:flex;gap:1.5em;align-items:flex-start;flex-wrap:wrap',
            },
            [
                E('div', { style: 'flex:2;min-width:300px' }, [sockTable]),
                E('div', { style: 'flex:1;min-width:220px' }, [
                    E(
                        'strong',
                        {
                            style: 'display:block;margin-bottom:6px;font-size:13px',
                        },
                        _('Port 53 status'),
                    ),
                    buildPort53Block(data),
                ]),
            ],
        ),
    ])
}

// ── View ─────────────────────────────────────────────────────────────────────

return view.extend({
    load: function () {
        return Promise.all([uci.load('dhcp'), fetchAll()])
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
            var sel = document.getElementById('dnsproxy-server-select')
            if (sel) {
                var cur = sel.value
                var opts = data.selectOpts.length
                    ? data.selectOpts
                    : ['127.0.0.1:53']
                sel.innerHTML = ''
                opts.forEach(function (o) {
                    var opt = document.createElement('option')
                    opt.value = o
                    opt.textContent = o
                    if (o === cur) opt.selected = true
                    sel.appendChild(opt)
                })
            }
        })
    },

    render: function (loaded) {
        var self = this
        var data = loaded[1]
        var opts = data.selectOpts.length ? data.selectOpts : ['127.0.0.1:53']

        poll.add(function () {
            return self._refresh()
        }, 8)

        return E('div', {}, [
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('DNS Proxy — Status')),
                E(
                    'p',
                    { class: 'cbi-section-descr' },
                    _(
                        'Live sockets grouped by address. Auto-refreshes every 8 s.',
                    ),
                ),
                buildStatusBlock(data),
            ]),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('DNS Proxy — Diagnostics')),

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
                            opts.map(function (o) {
                                return E('option', { value: o }, o)
                            }),
                        ),
                        E(
                            'span',
                            { class: 'cbi-value-description' },
                            _('Live dnsproxy listeners. Used for DNS Lookup.'),
                        ),
                    ]),
                ]),

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
