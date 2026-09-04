# Yamzz Market Payment — Vercel

## Isi
- payment.html
- upload-bukti.html
- api/payment.js
- vercel.json

## Deploy
1. Upload folder/project ini ke GitHub.
2. Import repository ke Vercel.
3. Tambahkan Environment Variables:
   TELEGRAM_BOT_TOKEN = token bot Telegram
   TELEGRAM_CHAT_ID = chat ID admin
4. Redeploy.

## Ganti data pembayaran
Edit `payment.html`:
- URL logo
- URL QRIS
- nomor DANA
- nomor rekening SeaBank
- nama penerima

## Telegram
Bot menerima foto bukti + data pembeli:
ID, nama, WhatsApp, nominal, metode, detail pesanan, status Pending.

Catatan:
Tombol TERIMA/TOLAK di pesan Telegram baru sebatas tampilan. Agar tombol benar-benar mengubah status transaksi, diperlukan webhook Telegram + database transaksi.
