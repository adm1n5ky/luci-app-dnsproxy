'use strict'
'require view'
'require fs'
'require ui'

var LOG_LINES = 500
var POLL_INTERVAL = 10000
var LOG_BOTTOM_GAP = 16 // px отступ от нижнего края viewport до конца лога

var LEVELS = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']

// ── CSS ───────────────────────────────────────────────────────────────────────
// Высота #dnsproxy-log выставляется динамически через _fitHeight().
// Здесь только начальное значение чтобы не было прыжка при старте.
var LOG_CSS =
    '\
.container { margin-bottom: 0 !important; }\    
#dnsproxy-log {\
  font-family: "JetBrains Mono", Consolas, Monaco, monospace;\
  font-size: 13px;\
  line-height: 19px;\
  background: #0d1117;\
  color: #c9d1d9;\
  padding: 10px 14px;\
  border-radius: 0 0 6px 6px;\
  height: 400px;\
  min-height: 200px;\
  overflow-y: auto;\
  box-sizing: border-box;\
}\
#dnsproxy-toolbar {\
  display: flex;\
  align-items: center;\
  gap: 8px;\
  padding: 5px 10px;\
  background: #161b22;\
  border: 1px solid #30363d;\
  border-bottom: none;\
  border-radius: 6px 6px 0 0;\
  flex-wrap: wrap;\
}\
#dnsproxy-toolbar-title {\
  color: #e6edf3;\
  font-weight: 600;\
  font-size: 13px;\
  margin-right: 4px;\
  white-space: nowrap;\
}\
#dnsproxy-log-wrap {\
  border: 1px solid #30363d;\
  border-radius: 6px;\
}\
.dpl-entry { display: block; }\
.dpl-row {\
  display: flex;\
  gap: 8px;\
  align-items: baseline;\
  padding: 1px 0;\
  border-left: 3px solid transparent;\
}\
.dpl-row.lvl-error { border-left-color: #ff6b6b; background: #ff6b6b15; }\
.dpl-row.lvl-fatal { border-left-color: #c792ea; background: #c792ea15; }\
.dpl-row.lvl-warn  { border-left-color: #f0a03088; }\
.dpl-ts {\
  display: inline-block;\
  width: 26ch;\
  text-align: right;\
  flex-shrink: 0;\
  user-select: none;\
  color: #444c56;\
}\
.dpl-ts .ts-time { color: #768390; }\
.dpl-ts.ts-same  { color: #232830; }\
.dpl-pid {\
  display: inline-block;\
  width: 6ch;\
  text-align: right;\
  flex-shrink: 0;\
  color: #4a5568;\
}\
.dpl-pid.pid-same { color: transparent; user-select: none; }\
.dpl-lvl {\
  display: inline-block;\
  width: 5ch;\
  text-align: center;\
  flex-shrink: 0;\
  font-weight: 700;\
  border-radius: 2px;\
  padding: 0 2px;\
}\
.dpl-lvl.lvl-debug { color: #8b949e; background: #8b949e1a; }\
.dpl-lvl.lvl-info  { color: #58c4dd; background: #58c4dd1a; }\
.dpl-lvl.lvl-warn  { color: #f0a030; background: #f0a0301a; }\
.dpl-lvl.lvl-error { color: #ff6b6b; background: #ff6b6b1a; }\
.dpl-lvl.lvl-fatal { color: #c792ea; background: #c792ea1a; }\
.dpl-msg { flex: 1; min-width: 0; word-break: break-all; color: #cdd6f4; }\
.dpl-kv-val { color: #e8a87c; }\
.dpl-dump-toggle {\
  color: #7ec8a0;\
  cursor: pointer;\
  border-bottom: 1px dashed #7ec8a066;\
  user-select: none;\
}\
.dpl-dump-body {\
  display: none;\
  margin: 2px 0 4px calc(26ch + 8ch + 6ch + 24px);\
  padding: 6px 10px;\
  background: #161b22;\
  border: 1px solid #21262d;\
  border-radius: 4px;\
  color: #a0aec0;\
  font-size: 12px;\
  line-height: 1.7;\
  white-space: pre;\
}\
.dpl-dump-body.open { display: block; }\
.dpl-unmatched { color: #5a6473; padding: 1px 0; }\
.dpl-filter-btn {\
  font-size: 11px;\
  padding: 1px 8px;\
  border-radius: 3px;\
  cursor: pointer;\
  border: 1px solid #30363d;\
  background: transparent;\
  color: #768390;\
  text-transform: uppercase;\
  letter-spacing: .04em;\
}\
.dpl-filter-btn.active { background: #58c4dd22; border-color: #58c4dd66; color: #58c4dd; }\
.dpl-ctrl-btn {\
  font-size: 11px;\
  padding: 1px 10px;\
  border-radius: 3px;\
  cursor: pointer;\
  border: 1px solid #30363d;\
  background: transparent;\
  color: #768390;\
}\
.dpl-ctrl-btn.paused { border-color: #f0a03066; color: #f0a030; }\
.dpl-ctrl-btn.follow { border-color: #58c4dd66; color: #58c4dd; }\
#dnsproxy-status-line {\
  font-size: 11px;\
  color: #444c56;\
  margin-left: auto;\
  user-select: none;\
  white-space: nowrap;\
}'

// ── Парсинг ───────────────────────────────────────────────────────────────────
var LINE_RE =
    /^(?:\w{3} \w{3} +\d+ [\d:]+ \d{4})\s+[\w.]+\s+dnsproxy\[(\d+)\]:\s+([\d/]+ [\d:.]+)\s+(DEBUG|INFO|WARN|ERROR|FATAL)\s(.*)$/
var WIRE_RE = /^(?:in|out)\s+prefix=\S+\s+line_num=(\d+)\s+line="(.*)"$/
var KV_RE = /\b(addr|upstream|raddr)=(\S+)/g

function parseLine(raw) {
    var m = raw.match(LINE_RE)
    if (!m) return null
    return { pid: m[1], ts: m[2], level: m[3], msg: m[4] }
}

// ── Группировка ───────────────────────────────────────────────────────────────
function groupLines(parsed) {
    var groups = []
    var dumpBuf = null
    parsed.forEach(function (p) {
        var wire = p.level === 'DEBUG' ? p.msg.match(WIRE_RE) : null
        if (wire) {
            var dir = p.msg.slice(0, 2) === 'in' ? 'in' : 'out'
            if (!dumpBuf || dumpBuf.dir !== dir) {
                dumpBuf = {
                    isDump: true,
                    pid: p.pid,
                    ts: p.ts,
                    dir: dir,
                    lines: [],
                    key: p.ts + dir,
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

// ── DOM helpers ───────────────────────────────────────────────────────────────
function makeTsEl(ts, prevTs) {
    var same = prevTs && prevTs.slice(0, 19) === ts.slice(0, 19)
    var el = E('span', { class: 'dpl-ts' + (same ? ' ts-same' : '') })
    if (same) {
        el.textContent = ts.slice(19)
    } else {
        el.appendChild(document.createTextNode(ts.slice(0, 11)))
        el.appendChild(E('span', { class: 'ts-time' }, ts.slice(11, 19)))
        el.appendChild(document.createTextNode(ts.slice(19)))
    }
    return el
}

function makePidEl(pid, prevPid) {
    return E(
        'span',
        {
            class: 'dpl-pid' + (prevPid && prevPid === pid ? ' pid-same' : ''),
        },
        '[' + pid + ']',
    )
}

function makeLvlEl(level) {
    return E('span', { class: 'dpl-lvl lvl-' + level.toLowerCase() }, level)
}

function makeMsgEl(msg) {
    var el = E('span', { class: 'dpl-msg' })
    var re = new RegExp(KV_RE.source, 'g')
    var last = 0
    var m
    while ((m = re.exec(msg)) !== null) {
        if (m.index > last)
            el.appendChild(document.createTextNode(msg.slice(last, m.index)))
        el.appendChild(document.createTextNode(m[1] + '='))
        el.appendChild(E('span', { class: 'dpl-kv-val' }, m[2]))
        last = m.index + m[0].length
    }
    if (last < msg.length)
        el.appendChild(document.createTextNode(msg.slice(last)))
    return el
}

function buildNormalRow(p, prevTs, prevPid) {
    return E('div', { class: 'dpl-entry' }, [
        E('div', { class: 'dpl-row lvl-' + p.level.toLowerCase() }, [
            makeTsEl(p.ts, prevTs),
            makePidEl(p.pid, prevPid),
            makeLvlEl(p.level),
            makeMsgEl(p.msg),
        ]),
    ])
}

function buildDumpRow(group, prevTs, prevPid, openKeys) {
    var isIn = group.dir === 'in'
    var arrow = isIn ? '▲' : '▼'
    var label =
        arrow +
        ' DNS ' +
        (isIn ? 'query' : 'reply') +
        ' (' +
        group.lines.length +
        ' lines)'
    var isOpen = openKeys && openKeys[group.key]

    var body = E(
        'div',
        { class: 'dpl-dump-body' + (isOpen ? ' open' : '') },
        group.lines.join('\n'),
    )

    var toggle = E(
        'span',
        {
            class: 'dpl-dump-toggle',
            click: function () {
                var open = body.classList.contains('open')
                body.classList.toggle('open')
                toggle.textContent = open ? label : label + ' ▸ collapse'
            },
        },
        isOpen ? label + ' ▸ collapse' : label,
    )

    return E('div', { class: 'dpl-entry', 'data-dumpkey': group.key }, [
        E('div', { class: 'dpl-row' }, [
            makeTsEl(group.ts, prevTs),
            makePidEl(group.pid, prevPid),
            makeLvlEl('DEBUG'),
            E('span', { class: 'dpl-msg' }, [toggle]),
        ]),
        body,
    ])
}

// ── Заполнение ────────────────────────────────────────────────────────────────
function fillLog(container, text, levelFilter, openKeys) {
    // Сохраняем открытые блоки до очистки
    if (!openKeys) {
        openKeys = {}
        container
            .querySelectorAll('.dpl-dump-body.open')
            .forEach(function (el) {
                var key =
                    el.parentElement &&
                    el.parentElement.getAttribute('data-dumpkey')
                if (key) openKeys[key] = true
            })
    }

    while (container.firstChild) container.removeChild(container.firstChild)

    var parsed = []
    ;(text || '').split('\n').forEach(function (raw) {
        if (!raw.trim()) return
        var p = parseLine(raw)
        if (!p) {
            parsed.push({ raw: raw })
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
                    style: 'color:#5a6473;padding:20px;text-align:center',
                },
                _('No messages.') +
                    (levelFilter !== 'ALL'
                        ? ' (filter: ' + levelFilter + ')'
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
            row = E('div', { class: 'dpl-unmatched' }, g.raw)
        } else if (g.isDump) {
            row = buildDumpRow(g, prevTs, prevPid, openKeys)
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

// ── Fetch ─────────────────────────────────────────────────────────────────────
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
            .filter(function (l) {
                return l.indexOf('dnsproxy') !== -1
            })
            .join('\n')
    })
}

// ── View ──────────────────────────────────────────────────────────────────────
return view.extend({
    _filter: 'ALL',
    _lastRaw: '',
    _paused: false,
    _timer: null,
    _followBtn: null,
    _statusEl: null,
    _resizeObs: null,

    load: function () {
        return fetchLog()
    },

    // Высота лога = расстояние от верхнего края #dnsproxy-log до нижней
    // границы страницы минус footer и небольшой отступ.
    // Вызывается при рендере и по ResizeObserver.
    // _fitHeight: function () {
    //     var logEl = document.getElementById('dnsproxy-log')
    //     var footer = document.querySelector('footer.mobile-hide')
    //     if (!logEl) return

    //     var logTop = logEl.getBoundingClientRect().top + window.scrollY
    //     var pageHeight = document.documentElement.scrollHeight
    //     var footerH = footer ? footer.offsetHeight : 0
    //     var h = pageHeight - logTop - footerH - LOG_BOTTOM_GAP

    //     logEl.style.height = Math.max(h, 200) + 'px'
    // },

    _fitHeight: function () {
        var logEl = document.getElementById('dnsproxy-log')
        var wrap = document.getElementById('dnsproxy-log-wrap')
        var footer = document.querySelector('footer.mobile-hide')
        if (!logEl || !wrap) return

        var wrapTop = wrap.getBoundingClientRect().top
        var footerH = footer ? footer.offsetHeight : 0
        // Всё пространство от верха wrap до верха footer
        var available = window.innerHeight - wrapTop - footerH - LOG_BOTTOM_GAP
        // Вычитаем всё что занимает wrap кроме самого лога
        var overhead = wrap.offsetHeight - logEl.offsetHeight

        logEl.style.height = Math.max(available - overhead, 200) + 'px'
    },

    _isAtBottom: function (el) {
        return el.scrollTop + el.clientHeight >= el.scrollHeight - 6
    },

    _rebuild: function () {
        var el = document.getElementById('dnsproxy-log')
        if (!el) return
        var atBottom = this._isAtBottom(el)
        var savedTop = el.scrollTop
        fillLog(el, this._lastRaw, this._filter)
        el.scrollTop = atBottom ? el.scrollHeight : savedTop
        this._updateFollow(el)
    },

    _updateFollow: function (el) {
        if (!this._followBtn) return
        this._followBtn.style.display = this._isAtBottom(el) ? 'none' : ''
    },

    _setStatus: function (txt) {
        if (this._statusEl) this._statusEl.textContent = txt
    },

    _scheduleRefresh: function () {
        var self = this
        clearTimeout(self._timer)
        if (self._paused) return
        self._timer = setTimeout(function () {
            fetchLog().then(function (log) {
                self._lastRaw = log
                self._rebuild()
                self._setStatus(
                    _('updated') + ' ' + new Date().toLocaleTimeString(),
                )
                self._scheduleRefresh()
            })
        }, POLL_INTERVAL)
    },

    render: function (log) {
        var self = this
        self._lastRaw = log

        if (!document.getElementById('dnsproxy-log-css')) {
            var style = document.createElement('style')
            style.id = 'dnsproxy-log-css'
            style.textContent = LOG_CSS
            document.head.appendChild(style)
        }

        var filterBtns = LEVELS.map(function (lvl) {
            return E(
                'button',
                {
                    class:
                        'dpl-filter-btn' +
                        (lvl === self._filter ? ' active' : ''),
                    'data-lvl': lvl,
                    click: function () {
                        self._filter = lvl
                        document
                            .querySelectorAll('.dpl-filter-btn')
                            .forEach(function (b) {
                                b.className =
                                    'dpl-filter-btn' +
                                    (b.getAttribute('data-lvl') === lvl
                                        ? ' active'
                                        : '')
                            })
                        self._rebuild()
                    },
                },
                lvl === 'ALL' ? _('All') : lvl,
            )
        })

        var pauseBtn = E(
            'button',
            {
                class: 'dpl-ctrl-btn',
                click: function () {
                    self._paused = !self._paused
                    pauseBtn.textContent = self._paused
                        ? '▶ ' + _('Resume')
                        : '⏸ ' + _('Pause')
                    pauseBtn.className =
                        'dpl-ctrl-btn' + (self._paused ? ' paused' : '')
                    if (!self._paused) self._scheduleRefresh()
                },
            },
            '⏸ ' + _('Pause'),
        )

        var followBtn = E(
            'button',
            {
                class: 'dpl-ctrl-btn follow',
                style: 'display:none',
                click: function () {
                    var el = document.getElementById('dnsproxy-log')
                    if (el) el.scrollTop = el.scrollHeight
                    followBtn.style.display = 'none'
                },
            },
            '↓ ' + _('Follow'),
        )
        self._followBtn = followBtn

        var statusEl = E('span', { id: 'dnsproxy-status-line' }, '')
        self._statusEl = statusEl

        var toolbar = E(
            'div',
            { id: 'dnsproxy-toolbar' },
            [E('span', { id: 'dnsproxy-toolbar-title' }, 'DNS Proxy Syslog')]
                .concat(filterBtns)
                .concat([pauseBtn, followBtn, statusEl]),
        )

        var logEl = E('div', { id: 'dnsproxy-log' })
        fillLog(logEl, log, 'ALL', {})

        logEl.addEventListener('scroll', function () {
            self._updateFollow(logEl)
        })

        // После вставки в DOM: подогнать высоту, прокрутить вниз
        requestAnimationFrame(function () {
            self._fitHeight()
            logEl.scrollTop = logEl.scrollHeight

            // Пересчитываем высоту при изменении размера окна
            window.addEventListener('resize', function () {
                self._fitHeight()
            })

            // ResizeObserver на footer — пересчитываем если footer меняет высоту
            var footer = document.querySelector('footer.mobile-hide')
            if (footer && window.ResizeObserver) {
                self._resizeObs = new ResizeObserver(function () {
                    self._fitHeight()
                })
                self._resizeObs.observe(footer)
            }
        })

        self._scheduleRefresh()

        return E(
            'div',
            {
                class: 'cbi-section',
                style: 'padding:0;margin:1rem 0 0;background:none;box-shadow: none;',
            },
            [E('div', { id: 'dnsproxy-log-wrap' }, [toolbar, logEl])],
        )
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
})
