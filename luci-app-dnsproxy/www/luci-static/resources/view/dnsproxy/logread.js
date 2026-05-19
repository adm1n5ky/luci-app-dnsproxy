'use strict'
'require view'
'require ui'
'require dom'
'require fs'
'require poll'

return view.extend({
    logLines: [],
    filterLevel: 'all',

    load: function () {
        return L.resolveDefault(fs.read('/etc/config/dnsproxy'), '')
    },

    render: function (data) {
        var self = this

        // Создаем контейнер для управления
        var controls = E('div', { class: 'cbi-map-descr' }, [
            E('h3', {}, _('System Log')),
            E(
                'div',
                {
                    class: 'flex-row',
                    style: 'display:flex; gap:10px; margin-bottom:10px; align-items:center;',
                },
                [
                    E(
                        'label',
                        {
                            class: 'cbi-value-title',
                            style: 'width:auto; min-width:80px;',
                        },
                        _('Filter Level:'),
                    ),
                    E(
                        'select',
                        {
                            id: 'logLevelFilter',
                            class: 'cbi-input-select',
                            style: 'width:auto; min-width:150px;',
                            change: ui.createHandlerFn(this, 'onFilterChange'),
                        },
                        [
                            E('option', { value: 'all' }, _('All Messages')),
                            E('option', { value: 'error' }, _('Errors Only')),
                            E(
                                'option',
                                { value: 'warn' },
                                _('Warnings & Errors'),
                            ),
                            E('option', { value: 'info' }, _('Info & Above')),
                            E('option', { value: 'debug' }, _('Debug & Above')),
                        ],
                    ),
                ],
            ),
            E('div', { class: 'right' }, [
                E(
                    'button',
                    {
                        class: 'btn cbi-button cbi-button-action',
                        click: ui.createHandlerFn(this, 'handleRefresh'),
                    },
                    _('Refresh'),
                ),
                ' ',
                E(
                    'button',
                    {
                        class: 'btn cbi-button cbi-button-negative',
                        click: ui.createHandlerFn(this, 'handleClear'),
                    },
                    _('Clear Log'),
                ),
            ]),
        ])

        // Контейнер для логов с прокруткой
        var logContainer = E(
            'div',
            {
                id: 'log-output',
                style: 'font-family: monospace; white-space: pre-wrap; background: #f5f5f5; border: 1px solid #ccc; padding: 10px; height: 500px; overflow-y: scroll; color: #333;',
            },
            [E('div', { style: 'color:#666;' }, _('Loading log...'))],
        )

        // Запускаем первоначальную загрузку
        this.refreshLog()

        // Настраиваем автообновление
        poll.add(L.bind(this.refreshLog, this), 5)

        return E([controls, logContainer])
    },

    onFilterChange: function (ev) {
        this.filterLevel = ev.target.value
        this.renderLogLines()
    },

    handleRefresh: function (ev) {
        this.refreshLog()
    },

    handleClear: function (ev) {
        ui.showModal(_('Clear System Log'), [
            E('p', {}, _('Are you sure you want to clear the system log?')),
            E('div', { class: 'right' }, [
                E(
                    'button',
                    {
                        class: 'btn cbi-button cbi-button-neutral',
                        click: ui.hideModal,
                    },
                    _('Cancel'),
                ),
                ' ',
                E(
                    'button',
                    {
                        class: 'btn cbi-button cbi-button-negative',
                        click: ui.createHandlerFn(this, 'confirmClear'),
                    },
                    _('Clear'),
                ),
            ]),
        ])
    },

    confirmClear: function () {
        fs.exec('/sbin/logread', ['-c'])
        ui.hideModal()
        this.refreshLog()
    },

    refreshLog: function () {
        var self = this
        // Исправленная команда: читаем последние 200 строк и фильтруем по dnsproxy
        fs.exec('/bin/sh', [
            '-c',
            'logread | grep -E "dnsproxy\\[|prefix=dnsproxy" | tail -n 200',
        ])
            .then(function (res) {
                if (res.stdout) {
                    self.logLines = res.stdout.trim().split('\n')
                } else {
                    self.logLines = []
                }
                self.renderLogLines()
            })
            .catch(function (err) {
                console.error('Failed to read log:', err)
            })
    },

    renderLogLines: function () {
        var output = document.getElementById('log-output')
        if (!output) return

        if (this.logLines.length === 0) {
            output.innerHTML =
                '<div style="color:#666;">' +
                _('No log entries found') +
                '</div>'
            return
        }

        var fragment = document.createDocumentFragment()
        var level = this.filterLevel

        this.logLines.forEach(function (line) {
            if (!line) return

            // Определение уровня логирования
            var logLevel = 'info' // по умолчанию
            if (line.indexOf('ERROR') !== -1 || line.indexOf('err=') !== -1)
                logLevel = 'error'
            else if (line.indexOf('WARN') !== -1) logLevel = 'warn'
            else if (line.indexOf('DEBUG') !== -1) logLevel = 'debug'

            // Фильтрация по уровню
            var show = true
            if (level === 'error' && logLevel !== 'error') show = false
            else if (
                level === 'warn' &&
                logLevel !== 'error' &&
                logLevel !== 'warn'
            )
                show = false
            else if (level === 'info' && logLevel === 'debug') show = false
            else if (level === 'debug') show = true // показывать все

            if (!show) return

            // Цветовая подсветка
            var color = '#333'
            var bg = 'transparent'
            var prefix = ''

            if (logLevel === 'error') {
                color = '#d9534f' // Красный
                prefix = '[ERROR] '
                // Можно добавить жирность
            } else if (logLevel === 'warn') {
                color = '#f0ad4e' // Оранжевый
                prefix = '[WARN] '
            } else if (logLevel === 'info') {
                color = '#5cb85c' // Зеленый
                prefix = '[INFO] '
            } else if (logLevel === 'debug') {
                color = '#777' // Серый
                prefix = '[DEBUG] '
            }

            var div = document.createElement('div')
            div.style.color = color
            div.style.marginBottom = '2px'
            div.style.borderBottom = '1px solid rgba(0,0,0,0.05)'

            // Форматируем текст: добавляем префикс для наглядности, но оставляем оригинал
            // Для лучшего вида можно разбить дату и сообщение, но пока оставим строкой
            div.textContent = line

            fragment.appendChild(div)
        })

        output.innerHTML = ''
        output.appendChild(fragment)

        // Автопрокрутка вниз, если фильтр не активен или мы внизу
        if (level === 'all') {
            output.scrollTop = output.scrollHeight
        }
    },
})
