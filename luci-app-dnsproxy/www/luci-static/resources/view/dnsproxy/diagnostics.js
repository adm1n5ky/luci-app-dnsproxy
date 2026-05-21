'use strict'
'require view'
'require fs'
'require ui'
'require uci'
'require poll'
'require rpc'

// ── RPC ───────────────────────────────────────────────────────────────────────

var callGetProcessList = rpc.declare({
    object: 'luci',
    method: 'getProcessList',
    expect: { processes: [] },
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

    // Compress longest run of zero groups
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

/**
 * Parse /proc/net/{tcp,udp,tcp6,udp6}.
 * Filters rows by uid (column index 7) to get only dnsproxy sockets.
 * TCP LISTEN = state 0A, UDP UNCONN = state 07.
 */
function parseProcNet(content, isV6, isUDP, uid) {
    if (!content) return []
    var rows = []
    content.split('\n').forEach(function (line) {
        var cols = line.trim().split(/\s+/)
        if (cols.length < 10) return
        var state = cols[3]
        var rowUid = cols[7]
        if (rowUid !== uid) return
        if (!isUDP && state !== '0A') return // TCP: LISTEN only
        if (isUDP && state !== '07') return // UDP: UNCONN only

        var parts = cols[1].split(':')
        var addr = isV6 ? parseIPv6(parts[0]) : parseIPv4(parts[0])
        var port = parseInt(parts[1], 16)
        rows.push({ addr: addr, port: port })
    })
    return rows
}

// ── Process info from getProcessList ─────────────────────────────────────────

/**
 * Find the real dnsproxy process (USER === 'dnsproxy', not the ujail wrapper).
 * Returns { pid, uid, command, ports[], listens[] } or null.
 */
function findDnsproxyProc(procs) {
    var found = null
    ;(procs || []).forEach(function (p) {
        if (
            p.USER === 'dnsproxy' &&
            p.COMMAND &&
            p.COMMAND.indexOf('/usr/bin/dnsproxy') === 0
        )
            found = p
    })
    if (!found) return null

    var cmd = found.COMMAND
    var ports = (cmd.match(/--port\s+(\d+)/g) || []).map(function (s) {
        return s.split(/\s+/)[1]
    })
    var listens = (cmd.match(/--listen\s+(\S+)/g) || []).map(function (s) {
        return s.split(/\s+/)[1]
    })

    return {
        pid: found.PID,
        command: cmd,
        ports: ports.length ? ports : ['53'],
        listens: listens.length ? listens : ['0.0.0.0'],
    }
}

// ── Fetch all port data ───────────────────────────────────────────────────────

var DNSPROXY_UID = '411' // uid of system user 'dnsproxy' on OpenWrt

function fetchPortData() {
    return Promise.all([
        L.resolveDefault(callGetProcessList(), []),
        L.resolveDefault(fs.read('/proc/net/tcp'), ''),
        L.resolveDefault(fs.read('/proc/net/udp'), ''),
        L.resolveDefault(fs.read('/proc/net/tcp6'), ''),
        L.resolveDefault(fs.read('/proc/net/udp6'), ''),
    ]).then(function (results) {
        var procs = results[0]
        var proc = findDnsproxyProc(procs)

        var entries = []
        ;[
            { content: results[1], isV6: false, isUDP: false, proto: 'TCP' },
            { content: results[2], isV6: false, isUDP: true, proto: 'UDP' },
            { content: results[3], isV6: true, isUDP: false, proto: 'TCP6' },
            { content: results[4], isV6: true, isUDP: true, proto: 'UDP6' },
        ].forEach(function (src) {
            parseProcNet(
                src.content,
                src.isV6,
                src.isUDP,
                DNSPROXY_UID,
            ).forEach(function (r) {
                entries.push({ proto: src.proto, addr: r.addr, port: r.port })
            })
        })

        // Sort by port, then proto
        entries.sort(function (a, b) {
            return a.port !== b.port
                ? a.port - b.port
                : a.proto.localeCompare(b.proto)
        })

        return { proc: proc, entries: entries }
    })
}

// ── DOM builders ─────────────────────────────────────────────────────────────

function buildPortsTable(data) {
    var proc = data.proc
    var entries = data.entries

    var children = []

    // ── Process info card ──
    if (proc) {
        children.push(
            E(
                'div',
                {
                    style: 'background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;padding:8px 12px;margin-bottom:12px;font-size:13px',
                },
                [
                    E('div', { style: 'margin-bottom:4px' }, [
                        E('strong', {}, 'PID: '),
                        E('code', {}, proc.pid),
                        E('span', { style: 'margin-left:16px' }, [
                            E('strong', {}, _('Ports') + ': '),
                            E('code', {}, proc.ports.join(', ')),
                        ]),
                        E('span', { style: 'margin-left:16px' }, [
                            E('strong', {}, _('Listen addresses') + ': '),
                            E('code', {}, proc.listens.join(', ')),
                        ]),
                    ]),
                    E('div', { style: 'color:#6c757d;word-break:break-all' }, [
                        E('strong', {}, _('Command') + ': '),
                        E('code', { style: 'font-size:11px' }, proc.command),
                    ]),
                ],
            ),
        )
    } else {
        children.push(
            E(
                'div',
                {
                    style: 'color:#dc3545;padding:6px 0;font-style:italic',
                },
                _('dnsproxy process not found — service may be stopped.'),
            ),
        )
    }

    // ── Sockets table ──
    if (entries.length) {
        children.push(
            E(
                'table',
                { class: 'table', style: 'margin-top:8px' },
                [
                    E('tr', { class: 'row-header' }, [
                        E('th', { style: 'width:6em' }, _('Protocol')),
                        E('th', {}, _('Local Address')),
                        E(
                            'th',
                            { style: 'width:5em;text-align:right' },
                            _('Port'),
                        ),
                    ]),
                ].concat(
                    entries.map(function (e) {
                        var display =
                            e.addr.indexOf(':') >= 0
                                ? '[' + e.addr + ']'
                                : e.addr
                        return E('tr', {}, [
                            E('td', {}, E('code', {}, e.proto)),
                            E('td', {}, E('code', {}, display)),
                            E(
                                'td',
                                { style: 'text-align:right' },
                                E('code', {}, String(e.port)),
                            ),
                        ])
                    }),
                ),
            ),
        )
    } else if (proc) {
        children.push(
            E(
                'div',
                {
                    style: 'color:#6c757d;font-style:italic;margin-top:8px',
                },
                _('No listening sockets found for uid %s.').format(
                    DNSPROXY_UID,
                ),
            ),
        )
    }

    return E('div', { id: 'dnsproxy-ports-inner' }, children)
}

// ── View ─────────────────────────────────────────────────────────────────────

return view.extend({
    load: function () {
        return Promise.all([uci.load('dnsproxy'), fetchPortData()])
    },

    // Read first listen port from UCI — fallback if process is stopped
    _getListenPort: function () {
        var ports = uci.get('dnsproxy', 'global', 'listen_port')
        var port = Array.isArray(ports) ? ports[0] : ports
        return port && /^\d+$/.test(String(port).trim())
            ? String(port).trim()
            : '53'
    },

    // ── command runner ─────────────────────────────────────────────────────

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

    handleDig: function () {
        var host = document.getElementById('dnsproxy-diag-host').value.trim()
        if (!host) return
        // Use real port from running process, fall back to UCI
        var portEl = document.getElementById('dnsproxy-active-port')
        var port = (portEl && portEl.textContent) || this._getListenPort()
        return this.handleCommand('nslookup', [host, '127.0.0.1:' + port])
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

    // ── ports refresh ──────────────────────────────────────────────────────

    _refreshPorts: function () {
        return fetchPortData().then(function (data) {
            var container = document.getElementById('dnsproxy-ports-inner')
            if (!container) return
            var newEl = buildPortsTable(data)
            container.parentNode.replaceChild(newEl, container)
        })
    },

    // ── render ─────────────────────────────────────────────────────────────

    render: function (data) {
        var self = this
        var portData = data[1]
        var uciPort = self._getListenPort()
        var livePort = portData.proc ? portData.proc.ports[0] : uciPort

        poll.add(function () {
            return self._refreshPorts()
        }, 8)

        // ── Section 1: Active ports ────────────────────────────────────────
        var portsSection = E('div', { class: 'cbi-section' }, [
            E('h3', {}, _('DNS Proxy — Active Listening Ports')),
            E(
                'div',
                { class: 'cbi-map-descr' },
                _(
                    'Live process info and sockets from /proc/net. Filtered by uid %s (dnsproxy). Auto-refreshes every 8 s.',
                ).format(DNSPROXY_UID),
            ),
            buildPortsTable(portData),
        ])

        // ── Section 2: Diagnostics tools ──────────────────────────────────
        var toolsSection = E('div', { class: 'cbi-map' }, [
            E('h3', {}, _('DNS Proxy — Diagnostics')),
            E('div', { class: 'cbi-map-descr' }, [
                _('DNS Lookup queries 127.0.0.1:'),
                E('span', { id: 'dnsproxy-active-port' }, livePort),
                _(' (live port from running process).'),
            ]),

            E('div', { class: 'cbi-section' }, [
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

        return E('div', {}, [portsSection, toolsSection])
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
})
