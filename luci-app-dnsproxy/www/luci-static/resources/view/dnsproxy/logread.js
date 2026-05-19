'use strict'
'require view'
'require fs'
'require ui'
'require poll'

var LOG_LINES = 200

return view.extend({
    load: function () {
        return L.resolveDefault(
            fs.exec_direct('logread', [
                '-e',
                'dnsproxy',
                '-l',
                String(LOG_LINES),
            ]),
            '',
        )
    },

    refresh: function () {
        return L.resolveDefault(
            fs.exec_direct('logread', [
                '-e',
                'dnsproxy',
                '-l',
                String(LOG_LINES),
            ]),
            '',
        ).then(function (log) {
            var out = document.getElementById('dnsproxy-log-output')
            if (out) {
                out.textContent =
                    log || _('No dnsproxy messages found in syslog.')
                out.scrollTop = out.scrollHeight
            }
        })
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
                E('div', { style: 'margin-bottom:.5em' }, [
                    E(
                        'button',
                        {
                            class: 'btn cbi-button',
                            click: function () {
                                return self.refresh()
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
                                if (out) out.textContent = ''
                            },
                        },
                        _('Clear'),
                    ),
                ]),
                E(
                    'textarea',
                    {
                        id: 'dnsproxy-log-output',
                        style: 'width:100%;font-family:monospace;font-size:.85em;white-space:pre',
                        readonly: true,
                        wrap: 'off',
                        rows: '25',
                    },
                    [log || _('No dnsproxy messages found in syslog.')],
                ),
            ]),
        ])
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
})
