# -*- coding: utf-8 -*-
"""
Сид HTML-шаблона «КП Дома кубани Стандарт».
Запуск: python -m app.seed_kp_dom_kubani_standart
"""
from __future__ import annotations

from datetime import datetime

from app.database import SessionLocal
from app.models import KpHtmlTemplate
from app.services.kp_dom_kubani_standart import (
    KP_DOM_KUBANI_STANDART_BODY,
    KP_DOM_KUBANI_STANDART_TITLE,
)

DESCRIPTION = (
    "Пакет «Стандарт», предварительный расчёт дома 6×4,5 м (27 м²). "
    "Таблица позиций подставляется из спецификации CRM; "
    "если позиций нет — используется типовой состав из расчёта."
)


def run() -> None:
    db = SessionLocal()
    try:
        row = (
            db.query(KpHtmlTemplate)
            .filter(KpHtmlTemplate.title == KP_DOM_KUBANI_STANDART_TITLE)
            .first()
        )
        now = datetime.utcnow()
        if row:
            row.html_content = KP_DOM_KUBANI_STANDART_BODY
            row.description = DESCRIPTION
            row.modified_on = now
            db.commit()
            print(f"Обновлён шаблон id={row.id}: {KP_DOM_KUBANI_STANDART_TITLE}")
        else:
            row = KpHtmlTemplate(
                title=KP_DOM_KUBANI_STANDART_TITLE,
                html_content=KP_DOM_KUBANI_STANDART_BODY,
                description=DESCRIPTION,
                created_on=now,
                modified_on=now,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            print(f"Создан шаблон id={row.id}: {KP_DOM_KUBANI_STANDART_TITLE}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
