'use strict'
'require view'
'require fs'
'require ui'
'require poll'

var LOG_LINES = 500

var LEVELS = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']

// Яркие цвета для тёмного фона #0d1117
var LEVEL_COLORS = {
    DEBUG: '#8b949e',
    INFO: '#58c4dd',
    WARN: '#f0a030',
    ERROR: '#ff6b6b',
    FATAL: '#c792ea',
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
    'line-height:18px',
    'background:#0d1117',
    'color:#c9d1d9',
    'padding:12px 16px',
    'border-radius:6px',
    'border:1px solid #30363d',
    'height:600px',
    'overflow-y:auto',
    'box-sizing:border-box',
].join(';')

// ── Парсинг ───────────────────────────────────────────────────────────────────
// "Sat May 23 20:30:34 2026 daemon.info dnsproxy[4855]: 2026/05/23 17:30:34.110882 DEBUG msg"
var LINE_RE =
    /^(\w{3} \w{3} +\d+ [\d:]+ \d{4})\s+[\w.]+\s+dnsproxy\[(\d+)\]:\s+([\d/]+ [\d:.]+)\s+(DEBUG|INFO|WARN|ERROR|FATAL)\s(.*)$/

// Матчит "in" и "out" wire-dump строки dnsproxy:
// "in  prefix=dnsproxy line_num=1 line="...""
// "out prefix=dnsproxy line_num=4 line="...""
var WIRE_RE = /^(?:in|out)\s+prefix=\S+\s+line_num=(\d+)\s+line="(.*)"$/

function parseLine(raw) {
    var m = raw.match(LINE_RE)
    if (!m) return null
    return { pid: m[2], ts: m[3], level: m[4], msg: m[5] }
}

// ── Группировка wire-dump блоков ─────────────────────────────────────────────
// Серии "DEBUG in/out prefix=... line_num=N line="..."  схлопываются в один объект.
// "in" и "out" серии — разные блоки (разное направление трафика).
function groupLines(parsed) {
    var groups = []
    var dumpBuf = null

    parsed.forEach(function (p) {
        var wire = p.level === 'DEBUG' ? p.msg.match(WIRE_RE) : null

        if (wire) {
            var dir = p.msg.slice(0, 2) === 'in' ? 'in' : 'out'
            // Новый буфер если: нет текущего, или сменилось направление
            if (!dumpBuf || dumpBuf.dir !== dir) {
                dumpBuf = {
                    isDump: true,
                    pid: p.pid,
                    ts: p.ts,
                    dir: dir,
                    lines: [],
                }
                groups.push(dumpBuf)
            }
            if (wire[2] !== '') dumpBuf.lines.push(wire[2])
        } else {
            dumpBuf = null
            groups.push(p)
        }
    })

    return groups
}

// ── Highlight key=value пар ───────────────────────────────────────────────────
function highlightKV(msg) {
    return msg.replace(/(\w+)=/g, function (_, key) {
        return '<span style="color:#79c0ff">' + key + '</span>='
    })
}

// ── Timestamp колонка ─────────────────────────────────────────────────────────
// Моноширный шрифт + фиксированная ширина + text-align:right →
// микросекунды разных строк всегда выровнены по правому краю.
//
// Полный:  "2026/05/23 17:30:34.110882"  (26 ch)
// Краткий:               ".110882"       (выровнен по правому краю той же колонки)
var TS_WIDTH = '26ch'

function makeTsSpan(ts, prevTs) {
    var sameSecond = prevTs && prevTs.slice(0, 19) === ts.slice(0, 19)

    var cell = E('span', {
        style:
            'display:inline-block;width:' +
            TS_WIDTH +
            ';text-align:right;' +
            'flex-shrink:0;user-select:none;',
    })

    if (sameSecond) {
        // Только микросекунды, очень тусклые — глаз не цепляется
        cell.appendChild(E('span', { style: 'color:#2a2f38' }, ts.slice(19)))
    } else {
        // Дата тусклее, время ярче, микросекунды снова тусклее
        cell.appendChild(
            E('span', { style: 'color:#444c56' }, ts.slice(0, 10) + ' '),
        )
        cell.appendChild(
            E('span', { style: 'color:#768390' }, ts.slice(11, 19)),
        )
        cell.appendChild(E('span', { style: 'color:#444c56' }, ts.slice(19)))
    }

    return cell
}

// ── PID колонка ───────────────────────────────────────────────────────────────
var PID_WIDTH = '6ch'

function makePidSpan(pid, prevPid) {
    var same = prevPid && prevPid === pid
    return E(
        'span',
        {
            style:
                'display:inline-block;width:' +
                PID_WIDTH +
                ';text-align:right;' +
                'flex-shrink:0;color:' +
                (same ? 'transparent' : '#4a5568') +
                ';' +
                'user-select:' +
                (same ? 'none' : 'auto') +
                ';',
        },
        '[' + pid + ']',
    )
}

// ── Level badge ───────────────────────────────────────────────────────────────
function makeLevelSpan(level) {
    var color = LEVEL_COLORS[level] || '#c9d1d9'
    return E(
        'span',
        {
            style:
                'display:inline-block;width:5ch;flex-shrink:0;text-align:center;' +
                'color:' +
                color +
                ';font-weight:700;' +
                'background:' +
                color +
                '1a;border-radius:2px;',
        },
        level,
    )
}

// ── Обычная строка ────────────────────────────────────────────────────────────
function buildNormalRow(p, prevTs, prevPid) {
    var color = LEVEL_COLORS[p.level] || '#c9d1d9'
    var msgSpan = E('span', {
        style: 'color:#cdd6f4;flex:1;min-width:0;word-break:break-all;',
    })
    msgSpan.innerHTML = highlightKV(p.msg)

    var row = E(
        'div',
        {
            style:
                'display:flex;gap:8px;align-items:baseline;' +
                'padding:1px 0;border-left:3px solid transparent;',
        },
        [
            makeTsSpan(p.ts, prevTs),
            makePidSpan(p.pid, prevPid),
            makeLevelSpan(p.level),
            msgSpan,
        ],
    )

    if (p.level === 'ERROR' || p.level === 'FATAL') {
        row.style.borderLeftColor = color
        row.style.backgroundColor = color + '15'
    } else if (p.level === 'WARN') {
        row.style.borderLeftColor = color + '88'
    }

    return row
}

// ── DNS wire-dump строка ──────────────────────────────────────────────────────
function buildDumpRow(group, prevTs, prevPid) {
    // ▼ = входящий запрос (клиент → dnsproxy), ▲ = ответ (dnsproxy → клиент)
    var isIn = group.dir === 'in'
    var arrow = isIn ? '▼' : '▲'
    var dirLabel = isIn ? 'query' : 'reply'
    var dirColor = isIn ? '#58c4dd' : '#7ec8a0'
    var count = group.lines.length
    var labelTxt =
        arrow + ' DNS ' + dirLabel + ' (' + count + ' lines) — click to expand'

    var body = E(
        'div',
        {
            // Отступ слева = TS_WIDTH + PID_WIDTH + level + gaps ≈ 43ch
            style:
                'display:none;margin:3px 0 4px 43ch;padding:6px 10px;' +
                'background:#161b22;border:1px solid #21262d;border-radius:4px;' +
                'color:#a0aec0;font-size:12px;line-height:1.7;white-space:pre;',
        },
        group.lines.join('\n'),
    )

    var toggle = E(
        'span',
        {
            style:
                'color:' +
                dirColor +
                ';cursor:pointer;' +
                'border-bottom:1px dashed ' +
                dirColor +
                '66;',
            click: function () {
                var open = body.style.display !== 'none'
                body.style.display = open ? 'none' : 'block'
                toggle.textContent =
                    (open ? arrow : isIn ? '▽' : '△') +
                    ' DNS ' +
                    dirLabel +
                    ' (' +
                    count +
                    ' lines)' +
                    (open ? ' — click to expand' : ' — click to collapse')
            },
        },
        labelTxt,
    )

    return E(
        'div',
        { style: 'padding:1px 0;border-left:3px solid transparent;' },
        [
            E('div', { style: 'display:flex;gap:8px;align-items:baseline;' }, [
                makeTsSpan(group.ts, prevTs),
                makePidSpan(group.pid, prevPid),
                makeLevelSpan('DEBUG'),
                E('span', { style: 'flex:1;' }, [toggle]),
            ]),
            body,
        ],
    )
}

// ── Основная функция заполнения ───────────────────────────────────────────────
function fillLogContainer(container, text, levelFilter) {
    while (container.firstChild) container.removeChild(container.firstChild)

    var parsed = []
    ;(text ? text.split('\n') : []).forEach(function (raw) {
        if (!raw.trim()) return
        var p = parseLine(raw)
        if (!p) {
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
                {
                    style: 'color:#8b949e;text-align:center;padding:20px',
                },
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
            row = E('div', { style: 'color:#5a6473;padding:1px 0;' }, g.raw)
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

// ── View ──────────────────────────────────────────────────────────────────────
return view.extend({
    _currentFilter: 'ALL',
    _lastRaw: '',

    load: function () {
        return fetchLog()
    },

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

        var outputEl = E('div', {
            id: 'dnsproxy-log-output',
            style: LOG_CONTAINER_STYLE,
        })
        fillLogContainer(outputEl, log, 'ALL')
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
                // Панель фильтров
                E(
                    'div',
                    {
                        style:
                            'margin-bottom:12px;display:flex;flex-wrap:wrap;align-items:center;' +
                            'gap:8px;padding:8px;background:#f8f9fa;border-radius:4px',
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
                        style:
                            'margin-bottom:10px;font-size:11px;display:flex;flex-wrap:wrap;' +
                            'gap:12px;padding:6px;background:#f8f9fa;border-radius:4px',
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
                                        'display:inline-block;width:12px;height:12px;' +
                                        'background:' +
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
