# -*- coding: utf-8 -*-
"""Запуск API: python run.py или uvicorn app.main:app --reload --host 0.0.0.0 --port 8008"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8008, reload=True)
