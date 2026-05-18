'use strict';
'require view';
'require fs';
'require ui';

return view.extend({

  handleCommand: function(exec, args) {
    var buttons = document.querySelectorAll('.diag-action > .cbi-button');
    var out     = document.getElementById('dnsproxy-diag-output');
    buttons.forEach(function(b) { b.disabled = true; });
    out.textContent = '';
    return fs.exec_direct(exec, args, 'text', false, true, function(ev) {
      out.textContent = ev.target.response;
    }).then(function(res) {
      out.textContent = res;
    }).catch(function(err) {
      ui.addNotification(null, E('p', String(err)));
    }).finally(function() {
      buttons.forEach(function(b) { b.disabled = false; });
    });
  },

  handleDig: function(ev) {
    var host = document.getElementById('dnsproxy-diag-host').value.trim();
    if (!host) return;
    return this.handleCommand('nslookup', [host, '127.0.0.1#5353']);
  },

  handlePing: function(ev) {
    var host = document.getElementById('dnsproxy-diag-host').value.trim();
    if (!host) return;
    return this.handleCommand('ping', ['-c', '4', '-W', '2', host]);
  },

  handleTraceroute: function(ev) {
    var host = document.getElementById('dnsproxy-diag-host').value.trim();
    if (!host) return;
    return this.handleCommand('traceroute', ['-q', '1', '-w', '2', '-n', '-m', '20', host]);
  },

  render: function() {
    var self = this;
    return E('div', { 'class': 'cbi-map' }, [
      E('h2', {}, _('DNSproxy - Diagnostics')),
      E('div', { 'class': 'cbi-map-descr' },
        _('Test DNS resolution through DNSproxy and network connectivity.')),

      E('div', { 'class': 'cbi-section' }, [
        E('div', { 'class': 'cbi-value' }, [
          E('label', { 'class': 'cbi-value-title' }, _('Hostname / IP')),
          E('div', { 'class': 'cbi-value-field' }, [
            E('input', {
              'id':          'dnsproxy-diag-host',
              'type':        'text',
              'class':       'cbi-input-text',
              'style':       'width:20em;margin-right:.5em',
              'placeholder': 'example.com',
              'value':       'example.com'
            }),
            E('span', { 'class': 'diag-action' }, [
              E('button', {
                'class': 'btn cbi-button cbi-button-action',
                'click': ui.createHandlerFn(self, 'handleDig')
              }, _('DNS Lookup')),
              '\u00a0',
              E('button', {
                'class': 'btn cbi-button cbi-button-action',
                'click': ui.createHandlerFn(self, 'handlePing')
              }, _('Ping')),
              '\u00a0',
              E('button', {
                'class': 'btn cbi-button cbi-button-action',
                'click': ui.createHandlerFn(self, 'handleTraceroute')
              }, _('Traceroute'))
            ])
          ])
        ]),

        E('div', { 'class': 'cbi-value' }, [
          E('label', { 'class': 'cbi-value-title' }, _('Output')),
          E('div', { 'class': 'cbi-value-field' }, [
            E('textarea', {
              'id':       'dnsproxy-diag-output',
              'style':    'width:100%;font-family:monospace;white-space:pre',
              'readonly': true,
              'wrap':     'off',
              'rows':     '16'
            })
          ])
        ])
      ])
    ]);
  },

  handleSave:      null,
  handleSaveApply: null,
  handleReset:     null
});
