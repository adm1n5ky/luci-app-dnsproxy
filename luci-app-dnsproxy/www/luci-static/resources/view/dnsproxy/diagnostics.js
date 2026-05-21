'use strict'
'require view'
'require fs'
'require ui'
'require uci'
'require poll'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse `ss -tupln` output and return rows that belong to dnsproxy.
 * Returns array of { proto, local, pid } objects.
 *
 * ss -tupln sample line (iproute2 ≥ 5.x):
 *   tcp  LISTEN 0  128  127.0.0.1:5353  0.0.0.0:*  users:(("dnsproxy",pid=1234,fd=7))
 */
function parseSsOutput(raw) {
    if (!raw) return []
    var rows = []
    raw.split('\n').forEach(function (line) {
        if (line.indexOf('dnsproxy') === -1) return
        // proto
        var proto = ''
        if (/^tcp/.test(line)) proto = 'TCP'
        else if (/^udp/.test(line)) proto = 'UDP'
        else return

        // local address — 3rd or 4th whitespace-token depending on ss version
        // Format: "proto  STATE  Recv-Q  Send-Q  Local  Peer  Process"
        var cols = line.trim().split(/\s+/)
        // col[0]=proto col[1]=state col[2]=recv col[3]=send col[4]=local col[5]=peer col[6]=process
        var local = cols[4] || ''

        // pid
        var pidm = line.match(/pid=(\d+)/)
        var pid = pidm ? pidm[1] : '?'

        rows.push({ proto: proto, local: local, pid: pid })
    })
    return rows
}

/**
 * Render the "Listening Ports" section.
 * Called both on initial render and on each poll tick.
 */
function buildPortsTable(rows) {
    if (!rows || !rows.length) {
        return E(
            'div',
            {
                style: 'color:#6c757d;font-style:italic;padding:4px 0',
            },
            _('dnsproxy is not listening on any ports (service stopped?)'),
        )
    }

    return E(
        'table',
        { class: 'table' },
        [
            E('tr', { class: 'row-header' }, [
                E('th', { style: 'width:6em' }, _('Protocol')),
                E('th', {}, _('Local Address : Port')),
                E('th', { style: 'width:6em' }, _('PID')),
            ]),
        ].concat(
            rows.map(function (r) {
                return E('tr', {}, [
                    E('td', {}, E('code', {}, r.proto)),
                    E('td', {}, E('code', {}, r.local)),
                    E('td', {}, r.pid),
                ])
            }),
        ),
    )
}

// ── View ─────────────────────────────────────────────────────────────────────

return view.extend({
    // ── data loading ────────────────────────────────────────────────────────

    load: function () {
        return Promise.all([
            uci.load('dnsproxy'),
            L.resolveDefault(fs.exec_direct('ss', ['-tupln']), ''),
        ])
    },

    // ── command runner ───────────────────────────────────────────────────────

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

    // ── Read the first configured listen port from UCI.
    //    Falls back to 53 if nothing is set.
    _getListenPort: function () {
        var ports = uci.get('dnsproxy', 'global', 'listen_port')
        var port = Array.isArray(ports) ? ports[0] : ports
        return port && /^\d+$/.test(String(port).trim())
            ? String(port).trim()
            : '53'
    },

    // ── action handlers ─────────────────────────────────────────────────────

    handleDig: function (ev) {
        var host = document.getElementById('dnsproxy-diag-host').value.trim()
        if (!host) return
        var port = this._getListenPort()
        // nslookup <host> <resolver:port>
        return this.handleCommand('nslookup', [host, '127.0.0.1:' + port])
    },

    handlePing: function (ev) {
        var host = document.getElementById('dnsproxy-diag-host').value.trim()
        if (!host) return
        return this.handleCommand('ping', ['-c', '4', '-W', '2', host])
    },

    handleTraceroute: function (ev) {
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

    // ── refresh ports block ──────────────────────────────────────────────────

    _refreshPorts: function () {
        return L.resolveDefault(fs.exec_direct('ss', ['-tupln']), '').then(
            function (raw) {
                var rows = parseSsOutput(raw)
                var container = document.getElementById('dnsproxy-ports-table')
                if (!container) return
                var newTable = buildPortsTable(rows)
                newTable.id = 'dnsproxy-ports-table'
                container.parentNode.replaceChild(newTable, container)
            },
        )
    },

    // ── render ───────────────────────────────────────────────────────────────

    render: function (data) {
        var self = this
        var ssRaw = data[1] || ''
        var portRows = parseSsOutput(ssRaw)

        // Poll ports every 8 seconds
        poll.add(function () {
            return self._refreshPorts()
        }, 8)

        // ── Section 1: Listening ports ─────────────────────────────────────
        var portsTable = buildPortsTable(portRows)
        portsTable.id = 'dnsproxy-ports-table'

        var portsSection = E('div', { class: 'cbi-section' }, [
            E('h3', {}, _('DNS Proxy — Active Listening Ports')),
            E(
                'div',
                { class: 'cbi-map-descr' },
                _(
                    'Sockets currently opened by dnsproxy. Auto-refreshes every 8 seconds.',
                ),
            ),
            portsTable,
        ])

        // ── Section 2: Network tools ───────────────────────────────────────
        var port = self._getListenPort()

        var toolsSection = E('div', { class: 'cbi-map' }, [
            E('h3', {}, _('DNS Proxy — Diagnostics')),
            E(
                'div',
                { class: 'cbi-map-descr' },
                _(
                    'Test DNS resolution through DNSproxy (port %s) and network connectivity.',
                ).format(port),
            ),

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
