'use strict'
'use ui'

// Явно импортируем необходимые модули LuCI
return L.Class.extend({
    // Метод load выполняется ДО отрисовки страницы. Собираем данные.
    load: function () {
        return Promise.all([
            // 1. Получаем статус процесса из подсистемы service
            L.resolveDefault(
                ubus.call('service', 'list', { name: 'dnsproxy' }),
                {},
            ),
            // 2. Читаем конфиг UCI, чтобы узнать, какой порт там задан
            uci.load('dnsproxy'),
        ])
    },

    render: function (data) {
        let serviceData = data[0] // Результат первого промиса (ubus)
        let listenPort = uci.get('dnsproxy', 'global', 'listen_port') || '5353' // 5353 как дефолт

        // Проверяем, запущен ли инстанс внутри procd
        let isRunning = false
        if (
            serviceData &&
            serviceData.dnsproxy &&
            serviceData.dnsproxy.instances
        ) {
            let instances = serviceData.dnsproxy.instances
            // Проверяем первый попавшийся инстанс (обычно instance1)
            for (let name in instances) {
                if (instances[name].running === true) {
                    isRunning = true
                    break
                }
            }
        }

        // Создаем контейнер для плашки статуса
        let statusDescription
        if (isRunning) {
            statusDescription = E(
                'div',
                { class: 'alert-message success' },
                _('Служба активна на порту %s').format(listenPort),
            )
        } else {
            statusDescription = E(
                'div',
                { class: 'alert-message danger' },
                _('Служба dnsproxy остановлена'),
            )
        }

        // Отрисовка основной формы
        let m, s, o
        m = new form.Map('dnsproxy', _('DNSProxy Settings'))

        s = m.section(
            form.NamedSection,
            'global',
            'dnsproxy',
            _('Статус и конфигурация'),
        )

        // Добавляем плашку в LuCI как кастомный HTML-элемент
        s.render = function () {
            let node = form.NamedSection.prototype.render.call(this)
            node.appendChild(statusDescription)
            return node
        }

        // Интерактивное поле для изменения настроек
        o = s.option(form.Value, 'listen_port', _('Порт прослушивания'))
        o.datatype = 'port'
        o.placeholder = '5353'

        return m.compile()
    },
})
