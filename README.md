# Процесс разработки

## Какие промпты я использовал

- На старте я использовал короткие прикладные промпты под конкретный этап, а не один большой общий запрос. Это оказалось удобнее, потому что можно было по очереди собирать интеграции и сразу проверять результат.

- Для загрузки тестовых заказов в RetailCRM:
  - "В репо есть `mock_orders.json` — 50 тестовых заказов. Загрузи их в мой RetailCRM через API."
  - После этого отдельно уточнял ошибки, когда RetailCRM не принимал payload:
    - "Скрипт возвращает ошибку при загрузке заказов, проверь формат запроса и исправь его под реальный RetailCRM API."

- Для синхронизации данных из RetailCRM в Supabase:
  - "Напиши отдельным файлом скрипт который забирает заказы из RetailCRM API и кладёт в Supabase."
  - Потом пришлось отдельно дожимать конфигурацию через env:
    - "Сделай чтобы значения для RetailCRM и Supabase брались из переменных окружения, и объясни откуда их взять."

- Для фронтенда и дашборда:
  - "Create a production-ready web dashboard for visualizing RetailCRM orders stored in Supabase. Use Next.js App Router, TypeScript, Tailwind CSS, Recharts, Supabase JS client."
  - После первой версии был ещё отдельный промпт на улучшение аналитики:
    - "Refactor and significantly improve my existing Next.js analytics dashboard. Group orders by day, add KPIs, improve charts, loading states and UI."

- Для Telegram-уведомлений:
  - "Implement a notification system that sends a Telegram message when a new order in RetailCRM has total sum greater than 50,000 KZT."
  - После этого уже в диалоге отдельно разбирал прикладные вопросы:
    - как получить `TELEGRAM_CHAT_ID`
    - как настроить webhook / HTTP-call в RetailCRM
    - какой URL указывать в триггере
    - почему webhook не срабатывает после деплоя на Vercel

- В целом наиболее полезными были не абстрактные промпты "сделай проект", а короткие технические запросы по шагам:
  - сначала API и загрузка заказов
  - потом синк в Supabase
  - потом дашборд
  - потом webhook и Telegram
  - потом точечная отладка ошибок

## Где я застрял

- **RetailCRM API возвращал 404**
  - Сначала я использовал неправильный base path и неверно предположил структуру API.
  - Например, запросы на `/api/v5/sites` возвращали `404`, хотя домен и API key были корректными.

- **Неправильно понимал `BASE_URL`**
  - В начале я считал, что все endpoint'ы RetailCRM лежат под одной и той же схемой `/api/v5/...`.
  - На практике пришлось разделить:
    - origin URL
    - API base URL

- **Путаница с переменными окружения в Supabase / Vercel**
  - Я смешал публичные и секретные ключи.
  - Также была проблема, когда Vercel не подхватывал новые env без redeploy.
  - Отдельно выяснилось, что дашборд использует `NEXT_PUBLIC_*`, а webhook-синк в Supabase требует серверный секретный ключ.

- **Настройка webhook в RetailCRM**
  - Основная проблема была не в коде, а в конфигурации: RetailCRM отправлял запросы не на тот URL деплоя.
  - Ещё пришлось разобраться, какое событие и какое условие использовать в интерфейсе RetailCRM, потому что названия в UI не совпадали напрямую с `order.create` / `order.update`.

## Как я это решил

- **RetailCRM API**
  - Разделил origin и API base URL.
  - Использовал `/api/credentials`, чтобы определить доступный `site`.
  - Начал подтягивать справочники динамически, вместо жёстко заданных кодов `orderType` и `orderMethod`.

- **Синхронизация с Supabase**
  - Сделал отдельный скрипт, который забирает заказы из RetailCRM и делает upsert в `retailcrm_orders`.
  - Позже добавил upsert прямо в webhook, чтобы новые заказы автоматически появлялись в Supabase и дашборде.

- **Проблемы с env в Vercel**
  - Развёл публичные и серверные ключи по правильным переменным.
  - Использовал:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `TELEGRAM_BOT_TOKEN`
    - `TELEGRAM_CHAT_ID`
  - После каждого изменения env делал redeploy.

- **Отладка webhook**
  - Добавил health-check на `GET /api/webhook/retailcrm`.
  - Добавил временные логи, чтобы проверить:
    - доходит ли `POST` из RetailCRM
    - распарсился ли payload
    - извлекаются ли `order.id` и `totalSumm`

- **Финальная причина**
  - В итоге корень проблемы был в неверном URL webhook, поскольку при redeploy'е в Vercel создавался другой репозиторий на основе моего основного, и так каждый раз, пока я не подвязал свой репозиторий в Versel с автоматическим redeployem при пуше.
  - После замены URL на актуальный адрес Vercel заработали и Telegram-уведомления, и обновление дашборда.
