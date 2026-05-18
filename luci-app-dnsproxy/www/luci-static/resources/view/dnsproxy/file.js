'use strict';
'require view';
'require fs';
'require ui';

var filePath = '/etc/config/dnsproxy';

return view.extend({

  load: function() {
    return L.resolveDefault(fs.read(filePath), '');
  },

  render: function(content) {
    return E('div', { 'class': 'cbi-section' }, [
      E('h3', _('Configuration File')),
      E('p', { 'class': 'cbi-section-descr' },
        _('Edit /etc/config/dnsproxy directly. Single source of truth — saved directly to disk, bypassing UCI.')),
      E('textarea', {
        'style': 'width:100%;padding:5px;font-family:monospace;margin-top:.4em',
        'spellcheck': 'false',
        'wrap': 'off',
        'rows': 30
      }, [content])
    ]);
  },

  handleSave: function(ev) {
    var value = document.querySelector('textarea').value;
    return fs.write(filePath, value).then(function() {
      ui.addNotification(null,
        E('p', _('Configuration file saved.')), 'info');
    }).catch(function(e) {
      ui.addNotification(null,
        E('p', _('Unable to save: %s').format(e.message)));
    });
  },

  handleSaveApply: null,
  handleReset: null
});
