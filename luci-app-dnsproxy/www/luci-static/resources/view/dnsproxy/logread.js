'use strict'
'require view'
'require ui'
'require poll'
'require dom'

return view.extend({
    logContent: '',
    filterLevel: 'all',

    render: function () {
        var contentDiv = E('div', {
            id: 'log_content',
            style: 'width: 100%; height: 500px; overflow-y: scroll; background: #fff; border: 1px solid #ccc; padding: 10px; font-family: monospace; font-size: 12px; white-space: pre-wrap;',
        })

        var filterSelect = E(
            'select',
            {
                id: 'log_filter',
                change: ui.createHandlerFn(this, 'onFilterChange'),
            },
            [
                E('option', { value: 'all' }, 'All'),
                E('option', { value: 'error' }, 'Errors'),
                E('option', { value: 'warn' }, 'Warnings'),
                E('option', { value: 'info' }, 'Info'),
                E('option', { value: 'debug' }, 'Debug'),
            ],
        )

        var refreshBtn = E(
            'button',
            {
                class: 'btn cbi-button',
                click: ui.createHandlerFn(this, 'handleRefresh'),
            },
            _('Refresh'),
        )

        var clearBtn = E(
            'button',
            {
                class: 'btn cbi-button',
                click: ui.createHandlerFn(this, 'handleClear'),
            },
            _('Clear Log'),
        )

        var controls = E('div', { style: 'margin-bottom: 10px;' }, [
            E('span', { style: 'margin-right: 15px;' }, [
                _('Filter: '),
                filterSelect,
            ]),
            refreshBtn,
            ' ',
            clearBtn,
        ])

        return E([E('h3', _('System Log - DNSProxy')), controls, contentDiv])
    },

    onFilterChange: function (ev) {
        this.filterLevel = ev.target.value
        this.renderLog(this.logContent)
    },

    handleRefresh: function (ev) {
        this.loadLogs()
    },

    handleClear: function (ev) {
        ui.showModal(_('Clear Log'), [
            E('p', _('Are you sure you want to clear the system log?')),
            E('div', { class: 'right' }, [
                E(
                    'button',
                    {
                        class: 'btn cbi-button',
                        click: ui.hideModal,
                    },
                    _('Cancel'),
                ),
                ' ',
                E(
                    'button',
                    {
                        class: 'btn cbi-button negative',
                        click: ui.createHandlerFn(this, 'confirmClear'),
                    },
                    _('Clear'),
                ),
            ]),
        ])
    },

    confirmClear: function (ev) {
        ui.hideModal()
        return L.resolveDefault(fs.exec('/sbin/logread', ['-c']), {}).then(
            () => {
                this.logContent = ''
                this.renderLog('')
            },
        )
    },

    loadLogs: function () {
        var self = this
        // Исправлено: убираем grep, берем последние 200 строк и фильтруем в JS
        return fs
            .exec('/sbin/logread', ['-e', 'dnsproxy'])
            .then(function (res) {
                self.logContent = res.stdout || ''
                self.renderLog(self.logContent)
            })
            .catch(function (err) {
                console.error('Failed to load logs:', err)
            })
    },

    renderLog: function (rawLog) {
        var container = document.getElementById('log_content')
        if (!container) return

        if (!rawLog) {
            container.innerHTML = '<em>No logs found</em>'
            return
        }

        var lines = rawLog.split('\n')
        var filteredLines = []
        var level = this.filterLevel

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i]
            if (!line.trim()) continue

            // Базовая фильтрация по dnsproxy (на случай если logread вернул лишнее)
            if (
                line.indexOf('dnsproxy') === -1 &&
                line.indexOf('prefix=dnsproxy') === -1
            ) {
                continue
            }

            var showLine = false
            var colorClass = ''
            var icon = ''

            if (level === 'all') {
                showLine = true
            } else if (level === 'error') {
                if (line.indexOf('ERROR') !== -1 || line.indexOf('err=') !== -1)
                    showLine = true
            } else if (level === 'warn') {
                if (line.indexOf('WARN') !== -1 || line.indexOf('warn=') !== -1)
                    showLine = true
            } else if (level === 'info') {
                if (
                    line.indexOf('INFO') !== -1 &&
                    line.indexOf('WARN') === -1 &&
                    line.indexOf('ERROR') === -1
                )
                    showLine = true
            } else if (level === 'debug') {
                if (line.indexOf('DEBUG') !== -1) showLine = true
            }

            if (showLine) {
                // Определение цвета и иконки
                if (
                    line.indexOf('ERROR') !== -1 ||
                    line.indexOf('err=') !== -1
                ) {
                    colorClass = 'color: #d9534f; font-weight: bold;' // Красный
                    icon = '🔴 '
                } else if (line.indexOf('WARN') !== -1) {
                    colorClass = 'color: #f0ad4e; font-weight: bold;' // Оранжевый
                    icon = '🟠 '
                } else if (line.indexOf('DEBUG') !== -1) {
                    colorClass = 'color: #777;' // Серый
                    icon = '⚪ '
                } else {
                    colorClass = 'color: #5cb85c;' // Зеленый (INFO)
                    icon = '🟢 '
                }

                // Экранирование HTML
                var safeLine = line
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                filteredLines.push(
                    '<div style="' +
                        colorClass +
                        '">' +
                        icon +
                        safeLine +
                        '</div>',
                )
            }
        }

        if (filteredLines.length === 0) {
            container.innerHTML = '<em>No logs match the selected filter</em>'
        } else {
            container.innerHTML = filteredLines.join('')
            // Автопрокрутка вниз
            container.scrollTop = container.scrollHeight
        }
    },

    handlePollApply: function () {
        // Перезапуск поллинга при применении изменений (если бы они были)
        return this.loadLogs()
    },

    resumePoll: function () {
        poll.add(L.bind(this.loadLogs, this), 5)
    },

    startPoll: function () {
        this.loadLogs()
        poll.add(L.bind(this.loadLogs, this), 5)
    },
})
