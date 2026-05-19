'use strict'
'require view'
'require fs'
'require ui'
'require poll'

var LOG_LINES = 500

var LEVELS = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']

var LEVEL_COLORS = {
    DEBUG: '#6c757d',
    INFO: '#17a2b8',
    WARN: '#ffc107',
    ERROR: '#dc3545',
    FATAL: '#6f42c1',
}

// Правильная команда: logread читает весь syslog, фильтруем на клиенте
function fetchLog() {
    return L.resolveDefault(
        fs.exec_direct('logread', ['-l', String(LOG_LINES)]),
        '',
    ).then(function (raw) {
        if (!raw) return ''
        // Фильтруем строки, содержащие "dnsproxy"
        return raw
            .split('\n')
            .filter(function (line) {
                return line.indexOf('dnsproxy') !== -1
            })
            .join('\n')
    })
}

// Разбирает уровень из строки лога
// Формат: "... daemon.info dnsproxy[...]: 2026/05/19 17:02:09.xxx LEVEL ..."
function getLineLevel(line) {
    // Ищем уровень после внутреннего timestamp
    var m = line.match(
        /\]\s*:\s*[\d/]+ [\d:.]+\s+(DEBUG|INFO|WARN|ERROR|FATAL)\b/,
    )
    if (m) return m[1]

    // Запасной вариант — по syslog facility
    if (line.indexOf('daemon.warn') !== -1) return 'WARN'
    if (line.indexOf('daemon.err') !== -1) return 'ERROR'
    if (line.indexOf('daemon.debug') !== -1) return 'DEBUG'
    if (line.indexOf(' err=') !== -1) return 'ERROR'

    return 'INFO'
}

// Рендерит строки лога с подсветкой синтаксиса
function renderLines(text, levelFilter) {
    var container = E('div', {
        id: 'dnsproxy-log-output',
        style: [
            'width:100%',
            'font-family:"JetBrains Mono",Consolas,Monaco,monospace',
            'font-size:12px',
            'line-height:1.4',
            'white-space:pre-wrap',
            'word-break:break-all',
            'background:#0d1117',
            'color:#c9d1d9',
            'padding:12px',
            'border-radius:6px',
            'border:1px solid #30363d',
            'height:500px',
            'overflow-y:auto',
            'box-sizing:border-box',
        ].join(';'),
    })

    var lines = text ? text.split('\n') : []
    var filtered = lines.filter(function (line) {
        if (!line.trim()) return false
        if (levelFilter === 'ALL') return true
        return getLineLevel(line) === levelFilter
    })

    if (!filtered.length) {
        container.appendChild(
            E(
                'div',
                { style: 'color:#8b949e;text-align:center;padding:20px' },
                _('No messages found.') +
                    (levelFilter !== 'ALL'
                        ? ' (' + _('Filter') + ': ' + levelFilter + ')'
                        : ''),
            ),
        )
        return container
    }

    filtered.forEach(function (line, idx) {
        var level = getLineLevel(line)
        var color = LEVEL_COLORS[level] || '#c9d1d9'

        var lineDiv = E('div', {
            style: 'margin-bottom:1px;padding:2px 0;border-left:3px solid transparent',
        })

        // Regex для разбора структуры:
        // Tue May 19 20:02:09 2026 daemon.info dnsproxy[30267]: 2026/05/19 17:02:09.786592 INFO message
        var m = line.match(
            /^(\w{3} \w{3} +\d+ [\d:]+ \d{4})\s+([\w.]+)\s+(dnsproxy\[\d+\]):\s+([\d/]+ [\d:.]+)\s+(DEBUG|INFO|WARN|ERROR|FATAL)\s(.*)$/,
        )

        if (m) {
            // Подсветка по частям
            lineDiv.appendChild(
                E('span', { style: 'color:#484f58' }, m[1] + ' '),
            ) // syslog timestamp
            lineDiv.appendChild(
                E('span', { style: 'color:#6e7681' }, m[2] + ' '),
            ) // facility
            lineDiv.appendChild(
                E('span', { style: 'color:#8b949e' }, m[3] + ': '),
            ) // process[pid]
            lineDiv.appendChild(
                E('span', { style: 'color:#6e7681' }, m[4] + ' '),
            ) // inner timestamp
            lineDiv.appendChild(
                E(
                    'span',
                    {
                        style:
                            'color:' +
                            color +
                            ';font-weight:600;padding:1px 4px;border-radius:2px;background:' +
                            color +
                            '22',
                    },
                    m[5] + ' ',
                ),
            ) // LEVEL

            // Сообщение — красим key=value пары
            var msg = m[6]
            var highlighted = msg.replace(/(\w+)=/g, function (match, key) {
                return '<span style="color:#79c0ff">' + key + '</span>='
            })

            var msgSpan = E('span', { style: 'color:#c9d1d9' })
            msgSpan.innerHTML = highlighted
            lineDiv.appendChild(msgSpan)

            // Подсветка левой границы для ERROR/FATAL
            if (level === 'ERROR' || level === 'FATAL') {
                lineDiv.style.borderLeftColor = color
                lineDiv.style.backgroundColor = color + '11'
            }
        } else {
            // Fallback — просто красим всю строку по уровню
            lineDiv.appendChild(E('span', { style: 'color:' + color }, line))
        }

        container.appendChild(lineDiv)
    })

    return container
}

return view.extend({
    _currentFilter: 'ALL',
    _lastRaw: '',

    load: function () {
        return fetchLog()
    },

    _rebuildOutput: function () {
        var old = document.getElementById('dnsproxy-log-output')
        if (!old) return
        var newEl = renderLines(this._lastRaw, this._currentFilter)
        old.parentNode.replaceChild(newEl, old)
        // Автоскролл вниз
        setTimeout(function () {
            newEl.scrollTop = newEl.scrollHeight
        }, 50)
    },

    refresh: function () {
        var self = this
        return fetchLog().then(function (log) {
            self._lastRaw = log
            self._rebuildOutput()
        })
    },

    render: function (log) {
        var self = this
        self._lastRaw = log

        // Поллинг каждые 10 секунд
        poll.add(function () {
            return self.refresh()
        }, 10)

        // Кнопки фильтра по уровням
        var filterBtns = LEVELS.map(function (lvl) {
            var isActive = lvl === self._currentFilter
            return E(
                'button',
                {
                    class:
                        'btn cbi-button' +
                        (isActive ? ' cbi-button-action' : ''),
                    'data-level': lvl,
                    style: 'margin-right:6px;margin-bottom:4px;min-width:70px;font-size:11px;text-transform:uppercase',
                    click: function (ev) {
                        self._currentFilter = lvl
                        // Обновляем стили кнопок
                        document
                            .querySelectorAll('[data-level]')
                            .forEach(function (btn) {
                                var active =
                                    btn.getAttribute('data-level') === lvl
                                btn.className =
                                    'btn cbi-button' +
                                    (active ? ' cbi-button-action' : '')
                            })
                        self._rebuildOutput()
                    },
                },
                lvl,
            )
        })

        var outputEl = renderLines(log, 'ALL')

        // Автоскролл при первом рендере
        setTimeout(function () {
            var el = document.getElementById('dnsproxy-log-output')
            if (el) el.scrollTop = el.scrollHeight
        }, 100)

        return E('div', { class: 'cbi-map' }, [
            E('h3', {}, _('DNS Proxy — System Log')),
            E(
                'div',
                { class: 'cbi-map-descr' },
                _(
                    'Real-time syslog filtered by "dnsproxy". Last %d lines with syntax highlighting.',
                ).format(LOG_LINES),
            ),

            E('div', { class: 'cbi-section' }, [
                // Панель управления
                E(
                    'div',
                    {
                        style: 'margin-bottom:12px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px;background:#f8f9fa;border-radius:4px',
                    },
                    [
                        E(
                            'strong',
                            { style: 'margin-right:4px;font-size:13px' },
                            _('Filter') + ':',
                        ),
                    ]
                        .concat(filterBtns)
                        .concat([
                            E('div', { style: 'flex:1' }),
                            E(
                                'button',
                                {
                                    class: 'btn cbi-button cbi-button-apply',
                                    style: 'font-size:12px',
                                    click: function () {
                                        return self.refresh()
                                    },
                                },
                                '↻ ' + _('Refresh'),
                            ),
                            E(
                                'button',
                                {
                                    class: 'btn cbi-button cbi-button-reset',
                                    style: 'font-size:12px',
                                    click: function () {
                                        self._lastRaw = ''
                                        self._rebuildOutput()
                                    },
                                },
                                '✕ ' + _('Clear'),
                            ),
                        ]),
                ),

                // Легенда уровней
                E(
                    'div',
                    {
                        style: 'margin-bottom:10px;font-size:11px;display:flex;flex-wrap:wrap;gap:12px;padding:6px;background:#f8f9fa;border-radius:4px',
                    },
                    Object.keys(LEVEL_COLORS).map(function (lvl) {
                        return E(
                            'span',
                            {
                                style: 'display:flex;align-items:center;gap:4px',
                            },
                            [
                                E('span', {
                                    style:
                                        'display:inline-block;width:12px;height:12px;background:' +
                                        LEVEL_COLORS[lvl] +
                                        ';border-radius:2px',
                                }),
                                E(
                                    'span',
                                    { style: 'color:#495057;font-weight:500' },
                                    lvl,
                                ),
                            ],
                        )
                    }),
                ),

                // Контейнер логов
                outputEl,
            ]),
        ])
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
})
