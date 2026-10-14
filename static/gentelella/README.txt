Gentelella — активы из _gentelella (Bootstrap Admin Template).

Структура:
  build/css/     — custom.css, custom.min.css (тема Gentelella)
  build/js/      — custom.js, custom.min.js (меню, панели, графики)
  build/images/  — картинки для кастома (стрелки, loading)
  vendors/       — Bootstrap, Font Awesome, NProgress, iCheck, Chart.js, Flot,
                   jqvmap, moment, daterangepicker и др.

Подключение на странице (views):
  В block head:
    {{include 'gentelella_assets_css.html'}}
  В block page_js:
    {{include 'gentelella_assets_js.html'}}

Внимание: Gentelella использует Bootstrap 3/4 и свою вёрстку (left_col, right_col,
nav-md, sidebar). Не подключайте вместе с Vuexy на одной странице без изоляции.
Для полной страницы в стиле Gentelella используйте класс body "nav-md" и разметку
из _gentelella/production/*.html.
