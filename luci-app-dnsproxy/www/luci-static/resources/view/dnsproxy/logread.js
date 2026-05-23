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

function fetchLog() {
    return L.resolveDefault(
        fs.exec_direct('/usr/libexec/syslog-wrapper', [
            '-l',
            String(LOG_LINES),
        ]),
        '',
    ).then(function (raw) {
        if (!raw) return ''
        return raw
            .split('\n')
            .filter(function (line) {
                return line.indexOf('dnsproxy') !== -1
            })
            .join('\n')
    })
}

function getLineLevel(line) {
    var m = line.match(
        /\]\s*:\s*[\d/]+ [\d:.]+\s+(DEBUG|INFO|WARN|ERROR|FATAL)\b/,
    )
    if (m) return m[1]

    if (line.indexOf('daemon.warn') !== -1) return 'WARN'
    if (line.indexOf('daemon.err') !== -1) return 'ERROR'
    if (line.indexOf('daemon.debug') !== -1) return 'DEBUG'
    if (line.indexOf(' err=') !== -1) return 'ERROR'

    return 'INFO'
}

var LOG_CONTAINER_STYLE = [
    'width:100%',
    'font-family:"JetBrains Mono",Consolas,Monaco,monospace',
    'font-size:13px',
    'line-height:13px',
    'white-space:pre-wrap',
    'word-break:break-all',
    'background:#0d1117',
    'color:#c9d1d9',
    'padding:12px',
    'border-radius:6px',
    'border:1px solid #30363d',
    'height:600px',
    'overflow-y:auto',
    'box-sizing:border-box',
].join(';')

// ── Парсинг одной строки лога ─────────────────────────────────────────────────
// Формат: "Sat May 23 20:30:34 2026 daemon.info dnsproxy[4855]: 2026/05/23 17:30:34.110882 DEBUG msg..."
var LINE_RE =
    /^(\w{3} \w{3} +\d+ [\d:]+ \d{4})\s+[\w.]+\s+dnsproxy\[(\d+)\]:\s+([\d/]+ [\d:.]+)\s+(DEBUG|INFO|WARN|ERROR|FATAL)\s(.*)$/

// "DEBUG out prefix=dnsproxy line_num=N line="..." " — строки DNS wire-dump
var WIRE_RE = /^out\s+prefix=\S+\s+line_num=(\d+)\s+line="(.*)"$/

function parseLine(raw) {
    var m = raw.match(LINE_RE)
    if (!m) return null
    return {
        pid: m[2],
        ts: m[3], // внутренний timestamp dnsproxy — точнее syslog
        level: m[4],
        msg: m[5],
    }
}

// Группирует строки: обычные идут по одной, серии "DEBUG out line_num=N"
// схлопываются в один объект { isDump: true, lines: [...] }
function groupLines(parsed) {
    var groups = []
    var dumpBuf = null // буфер текущего wire-dump блока

    parsed.forEach(function (p) {
        var wire = p.level === 'DEBUG' ? p.msg.match(WIRE_RE) : null

        if (wire) {
            if (!dumpBuf) {
                dumpBuf = { isDump: true, pid: p.pid, ts: p.ts, lines: [] }
                groups.push(dumpBuf)
            }
            // line_num=6 line="" — пустая строка — скипаем в буфере
            if (wire[2] !== '') dumpBuf.lines.push(wire[2])
        } else {
            dumpBuf = null
            groups.push(p)
        }
    })

    return groups
}

// Подсвечивает key=value в сообщении
function highlightKV(msg) {
    return msg.replace(/(\w+)=/g, function (_, key) {
        return '<span style="color:#79c0ff">' + key + '</span>='
    })
}

// Строит DOM-строку для обычного лог-события
function buildNormalRow(p, prevTs, prevPid) {
    var color = LEVEL_COLORS[p.level] || '#c9d1d9'

    // Показываем только время если секунда совпадает с предыдущей строкой,
    // иначе — полный timestamp.
    var tsSecond = p.ts.slice(0, 19) // "2026/05/23 17:30:34"
    var tsMicro = p.ts.slice(19) // ".110882"
    var sameSecond = prevTs && prevTs.slice(0, 19) === tsSecond
    var tsDisplay = sameSecond
        ? E(
              'span',
              { style: 'color:#3a3f47;min-width:8.5em;display:inline-block' },
              '           ' + tsMicro,
          )
        : E(
              'span',
              { style: 'color:#484f58;min-width:8.5em;display:inline-block' },
              tsSecond + tsMicro,
          )

    // pid показываем только при смене
    var pidSpan =
        prevPid && prevPid === p.pid
            ? E(
                  'span',
                  {
                      style: 'color:transparent;user-select:none;min-width:4em;display:inline-block',
                  },
                  '      ',
              )
            : E(
                  'span',
                  { style: 'color:#444c56;min-width:4em;display:inline-block' },
                  '[' + p.pid + ']',
              )

    var levelSpan = E(
        'span',
        {
            style:
                'color:' +
                color +
                ';font-weight:600;padding:1px 4px;border-radius:2px;' +
                'background:' +
                color +
                '22;min-width:4.5em;display:inline-block;text-align:center',
        },
        p.level,
    )

    var msgSpan = E('span', { style: 'color:#c9d1d9' })
    msgSpan.innerHTML = highlightKV(p.msg)

    var row = E(
        'div',
        {
            style: 'margin-bottom:1px;padding:2px 0;border-left:3px solid transparent;display:flex;gap:6px;align-items:baseline',
        },
        [tsDisplay, pidSpan, levelSpan, msgSpan],
    )

    if (p.level === 'ERROR' || p.level === 'FATAL') {
        row.style.borderLeftColor = color
        row.style.backgroundColor = color + '11'
    }

    return row
}

// Строит свёрнутый/раскрытый блок DNS wire-dump
function buildDumpRow(group, prevTs, prevPid) {
    var count = group.lines.length
    var label = 'DNS dump (' + count + ' lines)'

    var tsSecond = group.ts.slice(0, 19)
    var tsMicro = group.ts.slice(19)
    var sameSecond = prevTs && prevTs.slice(0, 19) === tsSecond
    var tsDisplay = sameSecond
        ? E(
              'span',
              { style: 'color:#3a3f47;min-width:8.5em;display:inline-block' },
              '           ' + tsMicro,
          )
        : E(
              'span',
              { style: 'color:#484f58;min-width:8.5em;display:inline-block' },
              tsSecond + tsMicro,
          )

    var pidSpan =
        prevPid && prevPid === group.pid
            ? E(
                  'span',
                  {
                      style: 'color:transparent;user-select:none;min-width:4em;display:inline-block',
                  },
                  '      ',
              )
            : E(
                  'span',
                  { style: 'color:#444c56;min-width:4em;display:inline-block' },
                  '[' + group.pid + ']',
              )

    var levelSpan = E(
        'span',
        {
            style:
                'color:#6c757d;font-weight:600;padding:1px 4px;border-radius:2px;' +
                'background:#6c757d22;min-width:4.5em;display:inline-block;text-align:center',
        },
        'DEBUG',
    )

    // Содержимое dump-блока (скрыто по умолчанию)
    var body = E(
        'div',
        {
            style:
                'display:none;margin-top:4px;padding:6px 10px;background:#161b22;' +
                'border:1px solid #30363d;border-radius:4px;color:#8b949e;' +
                'font-size:12px;line-height:1.6;white-space:pre',
        },
        group.lines.join('\n'),
    )

    // Кнопка-триггер
    var toggle = E(
        'span',
        {
            style: 'color:#6c757d;cursor:pointer;border-bottom:1px dashed #6c757d44',
            click: function () {
                var open = body.style.display !== 'none'
                body.style.display = open ? 'none' : 'block'
                toggle.textContent = open ? '▶ ' + label : '▼ ' + label
            },
        },
        '▶ ' + label,
    )

    var row = E(
        'div',
        {
            style: 'margin-bottom:1px;padding:2px 0;border-left:3px solid transparent',
        },
        [
            E(
                'div',
                {
                    style: 'display:flex;gap:6px;align-items:baseline',
                },
                [tsDisplay, pidSpan, levelSpan, toggle],
            ),
            body,
        ],
    )

    return row
}

// Заполняет существующий контейнер строками лога.
// Не создаёт новый элемент — мутирует переданный.
function fillLogContainer(container, text, levelFilter) {
    while (container.firstChild) container.removeChild(container.firstChild)

    var rawLines = text ? text.split('\n') : []

    // Парсим и фильтруем
    var parsed = []
    rawLines.forEach(function (raw) {
        if (!raw.trim()) return
        var p = parseLine(raw)
        if (!p) {
            // строка не совпала с форматом — показываем как есть
            parsed.push({ raw: raw, level: getLineLevel(raw) })
            return
        }
        if (levelFilter !== 'ALL' && p.level !== levelFilter) return
        parsed.push(p)
    })

    if (!parsed.length) {
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
        return
    }

    var groups = groupLines(parsed)
    var prevTs = null
    var prevPid = null

    groups.forEach(function (g) {
        var row
        if (g.raw) {
            // нераспознанная строка
            row = E(
                'div',
                { style: 'color:#6e7681;margin-bottom:1px;padding:2px 0' },
                g.raw,
            )
        } else if (g.isDump) {
            row = buildDumpRow(g, prevTs, prevPid)
            prevTs = g.ts
            prevPid = g.pid
        } else {
            row = buildNormalRow(g, prevTs, prevPid)
            prevTs = g.ts
            prevPid = g.pid
        }
        container.appendChild(row)
    })
}

return view.extend({
    _currentFilter: 'ALL',
    _lastRaw: '',

    load: function () {
        return fetchLog()
    },

    // Обновляет содержимое существующего контейнера без его замены.
    // Сохраняет позицию скролла: если пользователь прокрутил вверх —
    // остаётся там; если был у низа — прижимается к новому концу.
    _rebuildOutput: function () {
        var el = document.getElementById('dnsproxy-log-output')
        if (!el) return

        var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4
        var savedTop = el.scrollTop

        fillLogContainer(el, this._lastRaw, this._currentFilter)

        el.scrollTop = atBottom ? el.scrollHeight : savedTop
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

        poll.add(function () {
            return self.refresh()
        }, 10)

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
                    click: function () {
                        self._currentFilter = lvl
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

        // Создаём контейнер один раз — далее только заполняем его
        var outputEl = E('div', {
            id: 'dnsproxy-log-output',
            style: LOG_CONTAINER_STYLE,
        })
        fillLogContainer(outputEl, log, 'ALL')

        // Прокрутка вниз при первом рендере
        requestAnimationFrame(function () {
            outputEl.scrollTop = outputEl.scrollHeight
        })

        return E('div', { class: 'cbi-map' }, [
            E('h3', {}, _('DNS Proxy: System Log')),
            E(
                'div',
                { class: 'cbi-map-descr' },
                _(
                    'Real-time syslog filtered by "dnsproxy". Last %d lines with syntax highlighting.',
                ).format(LOG_LINES),
            ),

            E('div', { class: 'cbi-section' }, [
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

                outputEl,
            ]),
        ])
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
})
