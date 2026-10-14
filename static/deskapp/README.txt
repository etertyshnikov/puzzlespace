DeskApp — активы из _deskapp (стили и JS) для использования в проекте.

Структура:
  vendors/styles/   — core.css, icon-font.min.css, style.css (Bootstrap 4 + тема DeskApp)
  vendors/scripts/   — core.js, script.min.js, process.js, layout-settings.js и др.
  vendors/fonts/     — шрифты (bootstrap-icons, dropways, FontAwesome, ionicons, themify)
  vendors/images/   — картинки для стилей (wave.png, check-mark.png и т.д.)
  src/styles/       — theme.css, style.css, media.css (доп. стили)
  src/scripts/      — setting.js, jquery.min.js, moment.js, clipboard.min.js

Подключение на странице (views):
  В шаблоне с layout.html в block head:
    {{include 'deskapp_assets_css.html'}}
  В block page_js:
    {{include 'deskapp_assets_js.html'}}

Внимание: DeskApp использует Bootstrap 4 и свою вёрстку (sidebar, header). Одновременное
использование с Vuexy (Bootstrap 5) на одной странице может давать конфликты. Подключайте
DeskApp только на тех страницах, где нужны его компоненты/стили.
