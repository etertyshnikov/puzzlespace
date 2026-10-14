# Vuexy — стили и референс-страницы

Перенос стилей и HTML-шаблонов Vuexy (admin13_vuexy) в static для использования в приложении adminlte5.

## Структура

- **app-assets/** — CSS, JS, шрифты, изображения Vuexy (vendors, theme, components).
- **assets/** — кастомные стили Vuexy (style.css и др.).
- **html/ltr/horizontal-menu-template/** — референсные HTML-страницы для генерации своих страниц.

## Использование в layout (web2py)

В `views/layout.html` стили подключаются так:

```html
{{=URL('static','vuexy/app-assets/css/bootstrap.css')}}
{{=URL('static','vuexy/assets/css/style.css')}}
```

## Референс-страницы

Откройте в браузере (при запущенном приложении):

- Дашборд: `/adminlte5/static/vuexy/html/ltr/horizontal-menu-template/index.html`
- Список страниц: каталог `html/ltr/horizontal-menu-template/` (index, form-*, component-*, app-*, page-*, auth-* и т.д.)

Пути в этих HTML — относительные (`../../../app-assets`, `../../../assets`), они указывают на `static/vuexy/` и работают без правок.

Используйте эти файлы как образец разметки и классов при верстке новых страниц приложения.
