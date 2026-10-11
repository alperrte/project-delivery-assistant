# Ortam profilleri (dev / prod)

İki profil dosyası var, ikisi de Git'e girmez:

| Dosya | Ne için |
|---|---|
| `.env.dev` | Yerel geliştirme |
| `.env.prod` | Production (sunucu) |
| `.env` | **Etkin profilin kopyası.** Elle düzenlenmez, betik yazar |

## Profil değiştirmek

Proje klasöründe PowerShell aç:

```powershell
.\ops\env.ps1 status     # şu an hangi profil etkin?
.\ops\env.ps1 use dev    # dev etkin olsun
.\ops\env.ps1 use prod   # prod etkin olsun
```

Geçişten sonra `.env`'yi okuyan şeyleri (docker compose, backend) yeniden başlat.

## Bir değeri değiştirmek

`.env`'yi değil, ilgili profil dosyasını (`.env.dev` veya `.env.prod`) düzenle, sonra tekrar yaz:

```powershell
.\ops\env.ps1 use dev
```

`.env`'yi elle düzenlersen betik geçişi reddeder. Yine de geçmek istersen `-Force` ekle; eski `.env` önce `.env.bak` olarak yedeklenir.

## Dikkat

- **Günlük işte `dev` etkin kalsın.** `prod` etkinken dev compose'u (`docker compose up`) veya `pre-push` çalıştırma: `APP_ENV=prod` çerezleri `Secure` yapar ve `http://localhost` girişi bozulur.
- **Production'u başlatmak için geçiş gerekmez.** `.env.prod` doğrudan verilir:

  ```powershell
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
  ```

- Sunucuda yalnızca `.env.prod` bulunur (`scp` ile kopyalanır, `chmod 600`). Orada `env.ps1` kullanılmaz.
- `.env.prod` içindeki `TOTP_ENCRYPTION_KEY` bir şifre yöneticisine de kaydedilmeli; kaybolursa kullanıcıların 2FA'sı bozulur.
