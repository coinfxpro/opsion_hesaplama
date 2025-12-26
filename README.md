# Opsiyon Hesaplama (Web UI)

Bu proje VIOP / Tezgahüstü opsiyon işlemleri için prim, komisyon, nema ve uzlaşma etkisini hesaplayan bir Web UI uygulamasıdır.

## Çalıştırma (Local)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Ardından:

- http://127.0.0.1:8000

## Railway

Railway’de `Procfile` ile aşağıdaki komut çalışır:

- `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Notlar

- Döviz (FX) dayanaklarında prim girişi varsayılan olarak **kuruş** kabul edilir (ör. 59 ⇒ 0.59 TL). Bu ölçek `Ayarlar > FX Prim Ölçeği` ile değiştirilebilir.
- Komisyon oranı binde olarak girilir; BSMV ve stopaj ayarlardan yönetilir.
