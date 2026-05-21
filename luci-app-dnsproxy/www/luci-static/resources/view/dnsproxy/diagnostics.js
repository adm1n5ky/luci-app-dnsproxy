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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse /etc/passwd to get uid for a given username.
 * Line format: username:x:uid:gid:...
 */
function uidFromPasswd(passwd, username) {
    if (!passwd) return null
    var m = passwd.match(new RegExp('^' + username + ':[^:]+:([0-9]+):', 'm'))
    return m ? m[1] : null
}

/**
 * Find the real dnsproxy process from getProcessList.
 * Matches USER === 'dnsproxy' and COMMAND starting with '/' (not ujail wrapper).
 */
function findDnsproxyProc(procs) {
    if (!procs || !procs.length) return null
    var found = null
    procs.forEach(function (p) {
        if (found) return
        if (
            p.USER === 'dnsproxy' &&
            typeof p.COMMAND === 'string' &&
            p.COMMAND.charAt(0) === '/'
        ) {
            found = p
        }
    })
    if (!found) return null

    var cmd = found.COMMAND
    var ports = [],
        listens = [],
        m,
        re

    re = /--port\s+(\d+)/g
    while ((m = re.exec(cmd)) !== null) ports.push(m[1])

    re = /--listen\s+(\S+)/g
    while ((m = re.exec(cmd)) !== null) listens.push(m[1])

    return {
        pid: found.PID,
        command: cmd,
        ports: ports.length ? ports : ['53'],
        listens: listens.length ? listens : ['0.0.0.0'],
    }
}

// ── Data fetch ────────────────────────────────────────────────────────────────

function fetchAll() {
    return Promise.all([
        L.resolveDefault(callGetProcessList(), []),
        L.resolveDefault(fs.read('/etc/passwd'), ''),
        L.resolveDefault(fs.read('/proc/net/tcp'), ''),
        L.resolveDefault(fs.read('/proc/net/udp'), ''),
        L.resolveDefault(fs.read('/proc/net/tcp6'), ''),
        L.resolveDefault(fs.read('/proc/net/udp6'), ''),
    ]).then(function (r) {
        var procs = r[0]
        var passwd = r[1]
        var proc = findDnsproxyProc(procs)
        var uid = uidFromPasswd(passwd, 'dnsproxy')
        var entries = []

        if (uid) {
            ;[
                { content: r[2], isV6: false, isUDP: false, proto: 'TCP' },
                { content: r[3], isV6: false, isUDP: true, proto: 'UDP' },
                { content: r[4], isV6: true, isUDP: false, proto: 'TCP6' },
                { content: r[5], isV6: true, isUDP: true, proto: 'UDP6' },
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

        return { proc: proc, uid: uid, entries: entries }
    })
}

// ── DOM ───────────────────────────────────────────────────────────────────────

function buildStatusBlock(data) {
    var proc = data.proc
    var uid = data.uid
    var entries = data.entries

    var nodes = []

    // ── Process info ──────────────────────────────────────────────────────
    if (!proc) {
        nodes.push(
            E(
                'p',
                { class: 'alert-message warning' },
                _('dnsproxy process not found — service may be stopped.'),
            ),
        )
    } else {
        var procTable = E('table', { class: 'table' }, [
            E('tr', { class: 'tr table-titles' }, [
                E('th', { class: 'th', style: 'width:10em' }, _('Field')),
                E('th', { class: 'th' }, _('Value')),
            ]),
        ])
        cbi_update_table(
            procTable,
            [
                [_('PID'), E('code', {}, proc.pid)],
                [_('UID'), E('code', {}, uid || '?')],
                [_('Listen ports'), E('code', {}, proc.ports.join(', '))],
                [_('Listen addresses'), E('code', {}, proc.listens.join(', '))],
                [
                    _('Command'),
                    E(
                        'code',
                        {
                            style: 'font-size:11px;word-break:break-all;white-space:normal',
                        },
                        proc.command,
                    ),
                ],
            ],
            E('em', {}, _('No data.')),
        )

        nodes.push(E('h3', {}, _('Process')))
        nodes.push(procTable)
    }

    // ── Sockets ───────────────────────────────────────────────────────────
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
                ? _('No listening sockets found for uid %s.').format(uid)
                : _('Could not determine dnsproxy uid from /etc/passwd.'),
        ),
    )

    nodes.push(E('h3', { style: 'margin-top:1em' }, _('Active Sockets')))
    nodes.push(sockTable)

    return E('div', { id: 'dnsproxy-status-block' }, nodes)
}

// ── View ─────────────────────────────────────────────────────────────────────

return view.extend({
    load: function () {
        return Promise.all([uci.load('dnsproxy'), fetchAll()])
    },

    _getUciPort: function () {
        var p = uci.get('dnsproxy', 'global', 'listen_port')
        p = Array.isArray(p) ? p[0] : p
        return p && /^\d+$/.test(String(p).trim()) ? String(p).trim() : '53'
    },

    // ── Commands ──────────────────────────────────────────────────────────

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
        var portEl = document.getElementById('dnsproxy-live-port')
        var port = (portEl && portEl.textContent.trim()) || this._getUciPort()
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

    // ── Poll ──────────────────────────────────────────────────────────────

    _refresh: function () {
        return fetchAll().then(function (data) {
            var old = document.getElementById('dnsproxy-status-block')
            if (!old) return
            old.parentNode.replaceChild(buildStatusBlock(data), old)
            // Sync live port label
            if (data.proc) {
                var el = document.getElementById('dnsproxy-live-port')
                if (el) el.textContent = data.proc.ports[0]
            }
        })
    },

    // ── Render ────────────────────────────────────────────────────────────

    render: function (loaded) {
        var self = this
        var data = loaded[1]
        var livePort = (data.proc && data.proc.ports[0]) || self._getUciPort()

        poll.add(function () {
            return self._refresh()
        }, 8)

        return E('div', {}, [
            // Section 1 — Status
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('DNS Proxy — Status')),
                E(
                    'p',
                    { class: 'cbi-section-descr' },
                    _(
                        'Live data from /proc/net and /etc/passwd. Auto-refreshes every 8 s.',
                    ),
                ),
                buildStatusBlock(data),
            ]),

            // Section 2 — Diagnostics
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('DNS Proxy — Diagnostics')),
                E('p', { class: 'cbi-section-descr' }, [
                    _('DNS Lookup queries 127.0.0.1:'),
                    E('strong', { id: 'dnsproxy-live-port' }, livePort),
                    _(' (live port from running process).'),
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
