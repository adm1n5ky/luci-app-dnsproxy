'use strict';
'require view';
'require form';
'require poll';
'require uci';
'require ui';
'require rpc';
'require fs';

'require tools.dnsproxy.settings as tabSettings';

var mapdata = { settings: {} };

var callInitAction = rpc.declare({
  object: 'rc',
  method: 'init',
  params: ['name', 'action'],
  expect: { result: false }
});

var callServiceStatus = rpc.declare({
  object: 'service',
  method: 'list',
  params: ['name'],
  expect: { '': {} }
});

// Прямая запись UCI через ubus — минует staging area
var callUciSet = rpc.declare({
  object: 'uci',
  method: 'set',
  params: ['config', 'section', 'values'],
  expect: { result: 0 }
});

var callUciCommit = rpc.declare({
  object: 'uci',
  method: 'commit',
  params: ['config'],
  expect: { result: 0 }
});

function getRunning(status) {
  return !!(status.dnsproxy &&
            status.dnsproxy.instances &&
            Object.keys(status.dnsproxy.instances).length > 0);
}

function getEnabled() {
  return uci.get('dnsproxy', 'global', 'enabled') === '1';
}

function getStatusEmoji(enabled, running) {
  if (running)  return '\uD83D\uDFE2'; // 🟢 running
  if (enabled)  return '\uD83D\uDFE1'; // 🟡 enabled but stopped
  return '\uD83D\uDD34';               // 🔴 disabled
}

function updateStatusUI(running) {
  var enabled    = getEnabled();
  var dot        = document.getElementById('dnsproxy-status-dot');
  var txt        = document.getElementById('dnsproxy-status-txt');
  var btnStart   = document.getElementById('dnsproxy-btn-start');
  var btnStop    = document.getElementById('dnsproxy-btn-stop');
  var btnRestart = document.getElementById('dnsproxy-btn-restart');
  var btnEnable  = document.getElementById('dnsproxy-btn-enable');
  var btnDisable = document.getElementById('dnsproxy-btn-disable');

  if (dot) dot.textContent = getStatusEmoji(enabled, running) + ' ';
  if (txt) {
    if (running)      txt.textContent = _('Running');
    else if (enabled) txt.textContent = _('Stopped (enabled)');
    else              txt.textContent = _('Disabled');
  }

  if (btnEnable)  btnEnable.disabled  = enabled;
  if (btnDisable) btnDisable.disabled = !enabled;
  if (btnStart)   btnStart.disabled   = !enabled || running;
  if (btnStop)    btnStop.disabled    = !running;
  if (btnRestart) btnRestart.disabled = !running;
}

function makeActionHandler(action) {
  return function(ev) {
    var task;
    if (action === 'enable') {
      task = callUciSet('dnsproxy', 'global', { enabled: '1' })
        .then(function() { return callUciCommit('dnsproxy'); })
        .then(function() { return callInitAction('dnsproxy', 'enable'); })
        .then(function() { uci.set('dnsproxy', 'global', 'enabled', '1'); });
    } else if (action === 'disable') {
      task = callInitAction('dnsproxy', 'stop')
        .then(function() { return callInitAction('dnsproxy', 'disable'); })
        .then(function() { return callUciSet('dnsproxy', 'global', { enabled: '0' }); })
        .then(function() { return callUciCommit('dnsproxy'); })
        .then(function() { uci.set('dnsproxy', 'global', 'enabled', '0'); });
    } else {
      task = callInitAction('dnsproxy', action);
    }

    return task.then(function() {
      return L.resolveDefault(callServiceStatus('dnsproxy'), {});
    }).then(function(status) {
      updateStatusUI(getRunning(status));
    }).catch(function(e) {
      ui.addNotification(null, E('p', e.message));
    });
  };
}

// Рендер статус-блока — отдельно от Map, как в PBR
function renderStatus(initStatus) {
  var running = getRunning(initStatus);
  var enabled = getEnabled();

  // Поллинг каждые 5 секунд
  poll.add(function() {
    return L.resolveDefault(callServiceStatus('dnsproxy'), {})
      .then(function(status) { updateStatusUI(getRunning(status)); });
  }, 5);

  var gap     = '\u00a0\u00a0';
  var longGap = '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0';

  return E('div', {}, [
    E('h2', {}, _('DNSproxy - Status')),

    // Строка: Service Status
    E('div', { 'class': 'cbi-value' }, [
      E('label', { 'class': 'cbi-value-title' }, _('Service Status')),
      E('div',   { 'class': 'cbi-value-field' }, [
        E('span', { 'id': 'dnsproxy-status-dot' },
          getStatusEmoji(enabled, running) + ' '),
        E('span', { 'id': 'dnsproxy-status-txt' },
          running ? _('Running') : (enabled ? _('Stopped (enabled)') : _('Disabled')))
      ])
    ]),

    // Строка: Service Control — 5 кнопок
    E('div', { 'class': 'cbi-value' }, [
      E('label', { 'class': 'cbi-value-title' }, _('Service Control')),
      E('div',   { 'class': 'cbi-value-field' }, [
        E('button', {
          'id':      'dnsproxy-btn-start',
          'class':   'btn cbi-button cbi-button-apply',
          'disabled': (!enabled || running) || null,
          'click':   makeActionHandler('start')
        }, _('Start')),
        gap,
        E('button', {
          'id':      'dnsproxy-btn-restart',
          'class':   'btn cbi-button cbi-button-apply',
          'disabled': !running || null,
          'click':   makeActionHandler('restart')
        }, _('Restart')),
        gap,
        E('button', {
          'id':      'dnsproxy-btn-stop',
          'class':   'btn cbi-button cbi-button-reset',
          'disabled': !running || null,
          'click':   makeActionHandler('stop')
        }, _('Stop')),
        longGap,
        E('button', {
          'id':      'dnsproxy-btn-enable',
          'class':   'btn cbi-button cbi-button-apply',
          'disabled': enabled || null,
          'click':   makeActionHandler('enable')
        }, _('Enable')),
        gap,
        E('button', {
          'id':      'dnsproxy-btn-disable',
          'class':   'btn cbi-button cbi-button-reset',
          'disabled': !enabled || null,
          'click':   makeActionHandler('disable')
        }, _('Disable'))
      ])
    ]),

    // Строка: донат без label
    E('div', { 'class': 'cbi-value' }, [
      E('label', { 'class': 'cbi-value-title' }, ''),
      E('div', { 'class': 'cbi-value-field' },
        E('div', { 'class': 'cbi-value-description' },
          _('Please support the development of this project')))
    ])
  ]);
}

return view.extend({

  load: function() {
    return Promise.all([
      uci.load('dnsproxy'),
      L.resolveDefault(callServiceStatus('dnsproxy'), {})
    ]);
  },

  render: function(data) {
    var initStatus = data[1];

    var m = new form.JSONMap(mapdata, _('DNSproxy - Configuration'),
      _('Simple DNS proxy with DoH, DoT, DoQ and DNSCrypt support.'));
    this.map = m;

    tabSettings.addSection(m);

    // Возвращаем массив [статус, форма] — как в PBR
    return Promise.all([
      Promise.resolve(renderStatus(initStatus)),
      m.render()
    ]);
  },

  handleSave: function(ev) {
    return this.map.save(null, true).then(function() {
      return uci.save();
    });
  },

  handleSaveApply: function(ev, mode) {
    return this.handleSave(ev).then(function() {
      ui.changes.apply(mode == '0');
    });
  },

  handleReset: null
});
