# Background images

Letakkan foto background masjid di folder ini, lalu isi `display.backgroundImage`
di `data/prayer-8bb0.json` atau panel konfigurasi. Contoh:

```json
"display": {
  "backgroundImage": "assets/images/masjid-background.jpg",
  "backgroundTone": "auto"
}
```

`backgroundTone: "auto"` akan mencoba membaca tingkat kecerahan foto agar teks
tetap kontras. Gunakan `"dark"` atau `"light"` jika ingin memaksa warna teks.
