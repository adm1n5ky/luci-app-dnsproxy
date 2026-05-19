'use strict'
'require view'
'require fs'
'require ui'
'require poll'

var LOG_LINES = 200
var currentFilter = 'all'

return view.extend({
    load: function () {
        return L.resolveDefault(
            fs.exec_direct('logread', ['-l', String(LOG_LINES)]),
            '',
        )
    },

    refresh: function (filter) {
        var filterVal = filter || currentFilter
        return L.resolveDefault(
            fs.exec_direct('logread', ['-l', String(LOG_LINES)]),
            '',
        ).then(function (log) {
            var out = document.getElementById('dnsproxy-log-output')
            if (out) {
                var filteredLog = self.filterLog(log, filterVal)
                out.innerHTML =
                    filteredLog || _('No dnsproxy messages found in syslog.')
                out.scrollTop = out.scrollHeight
            }
        })
    },

    filterLog: function (log, filter) {
        if (!log) return ''
        var lines = log.split('\n')
        var result = []

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i]
            if (
                line.indexOf('prefix=dnsproxy') === -1 &&
                line.indexOf('dnsproxy[') === -1
            ) {
                continue
            }

            if (filter !== 'all') {
                if (
                    filter === 'ERROR' &&
                    line.indexOf(' ERROR ') === -1 &&
                    line.indexOf(' err=') === -1
                ) {
                    continue
                } else if (filter === 'WARN' && line.indexOf(' WARN ') === -1) {
                    continue
                } else if (filter === 'INFO' && line.indexOf(' INFO ') === -1) {
                    continue
                } else if (
                    filter === 'DEBUG' &&
                    line.indexOf(' DEBUG ') === -1
                ) {
                    continue
                }
            }

            result.push(this.highlightLine(line))
        }
        return result.join('\n')
    },

    highlightLine: function (line) {
        var escaped = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')

        if (
            escaped.indexOf(' ERROR ') !== -1 ||
            escaped.indexOf(' err=') !== -1
        ) {
            return '<span style="color:#ff4444;">' + escaped + '</span>'
        } else if (escaped.indexOf(' WARN ') !== -1) {
            return '<span style="color:#ffbb33;">' + escaped + '</span>'
        } else if (escaped.indexOf(' DEBUG ') !== -1) {
            return '<span style="color:#888888;">' + escaped + '</span>'
        } else if (escaped.indexOf(' INFO ') !== -1) {
            return '<span style="color:#00C851;">' + escaped + '</span>'
        }
        return escaped
    },

    render: function (log) {
        var self = this

        poll.add(function () {
            return self.refresh()
        }, 10)

        return E('div', { class: 'cbi-map' }, [
            E('h3', {}, _('DNS Proxy - System Log')),
            E(
                'div',
                { class: 'cbi-map-descr' },
                _(
                    'Syslog messages filtered by "dnsproxy". Last %d lines.',
                ).format(LOG_LINES),
            ),

            E('div', { class: 'cbi-section' }, [
                E(
                    'div',
                    {
                        style: 'margin-bottom:.5em;display:flex;align-items:center;gap:0.5em;flex-wrap:wrap',
                    },
                    [
                        E(
                            'label',
                            { style: 'font-weight:bold' },
                            _('Log Level: '),
                            E(
                                'select',
                                {
                                    id: 'dnsproxy-log-filter',
                                    style: 'min-width:120px;padding:4px',
                                    change: function (ev) {
                                        currentFilter = ev.target.value
                                        return self.refresh(currentFilter)
                                    },
                                },
                                [
                                    E('option', { value: 'all' }, _('All')),
                                    E(
                                        'option',
                                        { value: 'ERROR' },
                                        _('Errors'),
                                    ),
                                    E(
                                        'option',
                                        { value: 'WARN' },
                                        _('Warnings'),
                                    ),
                                    E('option', { value: 'INFO' }, _('Info')),
                                    E('option', { value: 'DEBUG' }, _('Debug')),
                                ],
                            ),
                        ),
                        '\u00a0\u00a0',
                        E(
                            'button',
                            {
                                class: 'btn cbi-button',
                                click: function () {
                                    return self.refresh(currentFilter)
                                },
                            },
                            _('Refresh'),
                        ),
                        '\u00a0\u00a0',
                        E(
                            'button',
                            {
                                class: 'btn cbi-button cbi-button-reset',
                                click: function () {
                                    var out = document.getElementById(
                                        'dnsproxy-log-output',
                                    )
                                    if (out) out.innerHTML = ''
                                },
                            },
                            _('Clear'),
                        ),
                    ],
                ),
                E(
                    'div',
                    {
                        id: 'dnsproxy-log-output',
                        style: 'width:100%;font-family:monospace;font-size:.85em;white-space:pre-wrap;word-break:break-all;background:#f5f5f5;border:1px solid #ddd;padding:10px;max-height:600px;overflow-y:auto;min-height:400px;line-height:1.4',
                    },
                    [self.filterLog(log || '', 'all')],
                ),
            ]),
        ])
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
})
