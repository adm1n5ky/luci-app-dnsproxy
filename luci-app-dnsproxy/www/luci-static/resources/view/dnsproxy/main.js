'use strict'

'require view'
'require form'
'require poll'
'require uci'
'require ui'
'require rpc'
'require fs'

'require tools.dnsproxy.settings as tabSettings'

var mapdata = { settings: {} }

var callInitAction = rpc.declare({
    object: 'rc',
    method: 'init',
    params: ['name', 'action'],
    expect: { result: false },
})

var callServiceStatus = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} },
})

// Прямая запись UCI через ubus — минует staging area
var callUciSet = rpc.declare({
    object: 'uci',
    method: 'set',
    params: ['config', 'section', 'values'],
    expect: { result: 0 },
})

var callUciCommit = rpc.declare({
    object: 'uci',
    method: 'commit',
    params: ['config'],
    expect: { result: 0 },
})

function getRunning(status) {
    return !!(
        status.dnsproxy &&
        status.dnsproxy.instances &&
        Object.keys(status.dnsproxy.instances).length > 0
    )
}

function getEnabled() {
    return uci.get('dnsproxy', 'global', 'enabled') === '1'
}

// Состояния:
// 🟢 запущена
// 🟡 включена, но не запущена — Stopped (enabled)
// ⚫ выключена — Disabled
// 🔴 не установлена — выставляется при инициализации отдельно
function getStatusEmoji(enabled, running) {
    if (running) return '\uD83D\uDFE2' // 🟢
    if (enabled) return '\uD83D\uDFE1' // 🟡
    return '\u26AB' // ⚫
}

function updateStatusUI(running) {
    var enabled = getEnabled()
    var dot = document.getElementById('dnsproxy-status-dot')
    var txt = document.getElementById('dnsproxy-status-txt')
    var btnStart = document.getElementById('dnsproxy-btn-start')
    var btnStop = document.getElementById('dnsproxy-btn-stop')
    var btnRestart = document.getElementById('dnsproxy-btn-restart')
    var btnEnable = document.getElementById('dnsproxy-btn-enable')
    var btnDisable = document.getElementById('dnsproxy-btn-disable')

    if (dot) dot.textContent = getStatusEmoji(enabled, running) + ' '
    if (txt) {
        if (running) txt.textContent = _('Running')
        else if (enabled) txt.textContent = _('Stopped (enabled)')
        else txt.textContent = _('Disabled')
    }

    if (btnEnable) btnEnable.disabled = enabled
    if (btnDisable) btnDisable.disabled = !enabled
    if (btnStart) btnStart.disabled = !enabled || running
    if (btnStop) btnStop.disabled = !running
    if (btnRestart) btnRestart.disabled = !running
}

function makeActionHandler(action) {
    return function (ev) {
        var task

        if (action === 'restart') {
            // Показать промежуточное состояние — поллинг обновит на следующем тике
            var dot = document.getElementById('dnsproxy-status-dot')
            var txt = document.getElementById('dnsproxy-status-txt')
            if (dot) dot.textContent = '\u26AB ' // ⚫
            if (txt) txt.textContent = _('Restarting...')

            return callInitAction('dnsproxy', 'restart').catch(function (e) {
                ui.addNotification(null, E('p', e.message))
            })
        }

        if (action === 'enable') {
            task = callUciSet('dnsproxy', 'global', { enabled: '1' })
                .then(function () {
                    return callUciCommit('dnsproxy')
                })
                .then(function () {
                    return callInitAction('dnsproxy', 'enable')
                })
                .then(function () {
                    uci.set('dnsproxy', 'global', 'enabled', '1')
                })
        } else if (action === 'disable') {
            task = callInitAction('dnsproxy', 'stop')
                .then(function () {
                    return callInitAction('dnsproxy', 'disable')
                })
                .then(function () {
                    return callUciSet('dnsproxy', 'global', { enabled: '0' })
                })
                .then(function () {
                    return callUciCommit('dnsproxy')
                })
                .then(function () {
                    uci.set('dnsproxy', 'global', 'enabled', '0')
                })
        } else {
            task = callInitAction('dnsproxy', action)
        }

        return task
            .then(function () {
                return L.resolveDefault(callServiceStatus('dnsproxy'), {})
            })
            .then(function (status) {
                updateStatusUI(getRunning(status))
            })
            .catch(function (e) {
                ui.addNotification(null, E('p', e.message))
            })
    }
}

// apk info dnsproxy возвращает строку вида "dnsproxy-0.73.4-r0" или пустую строку
function parseVersion(apkOutput) {
    if (!apkOutput || !apkOutput.trim()) return null // null = не установлен

    // Ожидаем формат: dnsproxy-0.81.0-r1 x86_64 ... [installed]
    // Ищем имя пакета, тире и версию до первого пробела
    var m = apkOutput.trim().match(/^dnsproxy-([^\s]+)/)

    return m ? m[1].trim() : null
}

// Рендер статус-блока — отдельно от Map, как в PBR
function renderStatus(initStatus, version) {
    var notInstalled = version === null
    var running = notInstalled ? false : getRunning(initStatus)
    var enabled = notInstalled ? false : getEnabled()

    var initialDot = notInstalled
        ? '\uD83D\uDD34 ' // 🔴 не установлен
        : getStatusEmoji(enabled, running) + ' '
    var initialText = notInstalled
        ? _('Not installed')
        : running
          ? _('Running')
          : enabled
            ? _('Stopped (enabled)')
            : _('Disabled')

    // Поллинг каждые 5 секунд — только если пакет установлен
    if (!notInstalled) {
        poll.add(function () {
            return L.resolveDefault(callServiceStatus('dnsproxy'), {}).then(
                function (status) {
                    updateStatusUI(getRunning(status))
                },
            )
        }, 5)
    }

    var gap = '\u00a0\u00a0'
    var longGap = '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0'

    return E('div', {}, [
        E('h3', {}, _('DNS Proxy: Status')),

        // Строка: Service Status
        E('div', { class: 'cbi-value' }, [
            E('label', { class: 'cbi-value-title' }, _('Service Status')),
            E(
                'div',
                {
                    class: 'cbi-value-field cbi-value-description',
                    style: 'opacity:1 !important',
                },
                [
                    E('span', { id: 'dnsproxy-status-dot' }, initialDot),
                    E('span', { id: 'dnsproxy-status-txt' }, initialText),
                ],
            ),
        ]),

        // Строка: Version
        E('div', { class: 'cbi-value' }, [
            E('label', { class: 'cbi-value-title' }, _('Version')),
            E(
                'div',
                {
                    class: 'cbi-value-field cbi-value-description',
                    style: 'opacity:1 !important',
                },
                version !== null ? version : _('—'),
            ),
        ]),

        // Строка: Service Control — 5 кнопок
        E('div', { class: 'cbi-value' }, [
            E('label', { class: 'cbi-value-title' }, _('Service Control')),
            E('div', { class: 'cbi-value-field' }, [
                E(
                    'button',
                    {
                        id: 'dnsproxy-btn-start',
                        class: 'btn cbi-button cbi-button-apply',
                        disabled: !enabled || running || notInstalled || null,
                        click: makeActionHandler('start'),
                    },
                    _('Start'),
                ),
                gap,
                E(
                    'button',
                    {
                        id: 'dnsproxy-btn-restart',
                        class: 'btn cbi-button cbi-button-apply',
                        disabled: !running || notInstalled || null,
                        click: makeActionHandler('restart'),
                    },
                    _('Restart'),
                ),
                gap,
                E(
                    'button',
                    {
                        id: 'dnsproxy-btn-stop',
                        class: 'btn cbi-button cbi-button-reset',
                        disabled: !running || notInstalled || null,
                        click: makeActionHandler('stop'),
                    },
                    _('Stop'),
                ),
                longGap,
                E(
                    'button',
                    {
                        id: 'dnsproxy-btn-enable',
                        class: 'btn cbi-button cbi-button-apply',
                        disabled: enabled || notInstalled || null,
                        click: makeActionHandler('enable'),
                    },
                    _('Enable'),
                ),
                gap,
                E(
                    'button',
                    {
                        id: 'dnsproxy-btn-disable',
                        class: 'btn cbi-button cbi-button-reset',
                        disabled: !enabled || notInstalled || null,
                        click: makeActionHandler('disable'),
                    },
                    _('Disable'),
                ),
            ]),
        ]),

        // Строка: донат без label
        E('div', { class: 'cbi-value' }, [
            E('label', { class: 'cbi-value-title' }, ''),
            E(
                'div',
                { class: 'cbi-value-field' },
                E(
                    'div',
                    { class: 'cbi-value-description' },
                    _('Please support the development of this project'),
                ),
            ),
        ]),
    ])
}

return view.extend({
    load: function () {
        return Promise.all([
            uci.load('dnsproxy'),
            L.resolveDefault(callServiceStatus('dnsproxy'), {}),
            L.resolveDefault(
                fs.exec_direct('apk', ['list', '--installed', 'dnsproxy']),
                null,
            ),
        ])
    },

    render: function (data) {
        var initStatus = data[1]
        var version = parseVersion(data[2])

        var m = new form.JSONMap(
            mapdata,
            _(''),
            _(
                'A simple DNS proxy server that supports all existing DNS protocols including DNS-over-TLS, DNS-over-HTTPS, DNSCrypt, and DNS-over-QUIC. Moreover, it can work as a DNS-over-HTTPS, DNS-over-TLS or DNS-over-QUIC server.',
            ),
        )
        this.map = m

        tabSettings.addSection(m)

        return Promise.all([
            Promise.resolve(renderStatus(initStatus, version)),
            m.render(),
        ]).then(function (nodes) {
            return [nodes[0], E('h3', {}, _('Configuration')), nodes[1]]
        })
    },

    handleSave: function (ev) {
        return this.map.save(null, true).then(function () {
            return uci.save()
        })
    },

    handleSaveApply: function (ev, mode) {
        return this.handleSave(ev).then(function () {
            ui.changes.apply(mode == '0')
        })
    },

    handleReset: null,
})
