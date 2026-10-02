# Landing ürün görselleri

2026-10-02 tarihinde PDA'nın gerçek `/projects/pda-visual-preview` ve `?section=criteria` arayüzlerinden Playwright ile yakalandı; 1440×900, light/dark. Görseller WebP biçimindedir.

Veriler `frontend/scripts/preview-project.cjs` içindeki örnek proje/kriter/üye fixture'larından gelir. Tüm `/api/v1/` istekleri yakalama tarayıcısında taklit edildi; GET dışındaki istekler engellendi. Gerçek kullanıcı verisi veya erişim bilgisi içermez. Taklit ekip/bildirim yanıtları güncel UI sözleşmesine uyarlanmıştır.

Landing caption ve alt metinler üç dilde, ekran içindeki örnek proje metinleri Türkçedir. Arayüz değiştiğinde görseller yeniden yakalanmalıdır. Dosya adındaki sürümü artırmak Next/Image önbelleğinde önceki ekranın kalmasını önler.
