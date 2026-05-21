'use strict'
'use ui'

// Подсказываем LuCI, какие модули нужно загрузить в фоне
'require form'
'require uci'
'require ubus'
'require view'

return L.view.extend({
    // 1. Метод загрузки данных ДО рендеринга страницы
    load: function () {
        return Promise.all([
            // Вызываем ubus строго через глобальный объект L.ubus
            L.resolveDefault(
                L.ubus.call('service', 'list', { name: 'dnsproxy' }),
                {},
            ),
            // Загружаем UCI строго через L.uci
            L.uci.load('dnsproxy'),
        ])
    },

    // 2. Отрисовка интерфейса на основе загруженных данных
    render: function (data) {
        let serviceData = data[0] // Результат ubus-запроса из массива Promise.all
        let listenPort =
            L.uci.get('dnsproxy', 'global', 'listen_port') || '5353'

        // Проверяем статус процесса в procd
        let isRunning = false
        if (
            serviceData &&
            serviceData.dnsproxy &&
            serviceData.dnsproxy.instances
        ) {
            let instances = serviceData.dnsproxy.instances
            for (let name in instances) {
                if (instances[name].running === true) {
                    isRunning = true
                    break
                }
            }
        }

        // Создаем элемент плашки (alert-message)
        let statusBox
        if (isRunning) {
            statusBox = E(
                'div',
                {
                    class: 'alert-message success',
                    style: 'margin-bottom: 15px;',
                },
                _('Служба активна на порту %s').format(listenPort),
            )
        } else {
            statusBox = E(
                'div',
                {
                    class: 'alert-message danger',
                    style: 'margin-bottom: 15px;',
                },
                _('Служба dnsproxy остановлена'),
            )
        }

        // Инициализируем карту формы UCI через L.form
        let m, s, o
        m = new L.form.Map('dnsproxy', _('DNSProxy Settings'))

        s = m.section(
            L.form.NamedSection,
            'global',
            'dnsproxy',
            _('Статус и конфигурация'),
        )

        // Внедряем HTML-плашку в рендеринг секции
        s.render = function () {
            let node = L.form.NamedSection.prototype.render.call(this)
            node.insertBefore(statusBox, node.firstChild)
            return node
        }

        // Настройка поля порта
        o = s.option(L.form.Value, 'listen_port', _('Порт прослушивания'))
        o.datatype = 'port'
        o.placeholder = '5353'

        return m.compile()
    },
})
