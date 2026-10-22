# WA Cloning RK — Android (versi 2.1.0)

Aplikasi Android ini membuka situs resmi `https://web.whatsapp.com/` di dalam WebView. Ikon launcher menggunakan PNG RK yang diberikan pemilik proyek.

> Ini adalah pembungkus pihak ketiga, bukan aplikasi resmi atau afiliasi WhatsApp. WhatsApp dapat membatasi atau memutus sesi pada browser/aplikasi yang tidak didukung. Tidak ada cara yang sah untuk menjamin sesi selalu tertaut.

## Versi 2.1.0 — panel layar penuh, info kontak, arsip, dan ekspor chat

### 1. Panel menyempit, info profil kosong, baris arsip tidak bisa diketuk
Dari screenshot v2.0: panel Panggilan/Status/Saluran/Komunitas/Diarsipkan hanya selebar ±45% layar dan menumpuk di atas daftar chat; membuka info kontak menampilkan layar abu-abu kosong; baris chat di Diarsipkan tidak bereaksi saat diketuk.
- Panel dikenali dari **bentuknya** (tinggi, lebih sempit dari layar, ada isi, di layar), bukan dari nama kelas, lalu diberi layar penuh. Panel yang ditutup WhatsApp otomatis tidak lagi direntangkan.
- Kolom ketiga di samping chat (info kontak, penampil media) sekarang tampil layar penuh sebagai mode sendiri, bukan terdorong keluar layar.
- Ketukan di sisi kiri (daftar, Diarsipkan, Panggilan, dst.) dipantau: bila percakapan berubah, layar pindah ke chat. Ini yang membuat baris arsip bisa dibuka.
- Tombol Kembali menutup panel lewat tombol Kembali/Tutup milik panel itu sendiri, lalu kembali ke chat, lalu ke daftar. Di daftar, Kembali tetap memunculkan konfirmasi keluar.
- Menu ⋮ → **Laporan tampilan**: struktur layout yang sedang tampil (tanpa isi pesan atau nama kontak), bisa disalin. Berguna bila panel tertentu masih bermasalah.

Diuji di Chromium pada dua struktur tiruan (panel di dalam `#side` dan panel di root). Penyebabnya adalah dugaan dari screenshot; struktur asli WhatsApp Web belum terlihat langsung.

### 2. Ekspor chat
Menu ⋮ → **Ekspor chat ini…** (buka chat dulu). Tiga pilihan:
- **Chat saja (.txt)**: format ekspor WhatsApp (`22/10/2026 07.30 - Nama: pesan`), nama file `Obrolan WhatsApp dengan <nama>.txt`.
- **Chat + foto, video, suara (ZIP)**: berisi `.txt`, `index.html` (tampilan seperti WhatsApp: gelembung hijau/putih, chip tanggal, foto/video/suara tepat di urutan pesan, panggilan, lokasi, jam) dan folder `media/` (`IMG-…-WA0001.jpg`, `VID-…`). Ekstrak ZIP, lalu buka `index.html`.
- **Salin semua chat ke clipboard** (teks yang sangat panjang disimpan sebagai file).
Hasil masuk ke `Download/WA Cloning`. Android 9 ke bawah meminta izin penyimpanan lebih dulu. Ada tombol Bagikan (Android 10+).

Cara kerja: aplikasi menggulir chat ke atas untuk memuat seluruh riwayat, lalu ke bawah sambil membaca pesan dan mengambil media saat barisnya tampil. Video dan suara diambil lewat penampil WhatsApp sendiri.

Batasan yang perlu diketahui:
- Hanya riwayat yang tersimpan di perangkat tertaut ini yang bisa diekspor. Pesan lama yang belum disinkronkan dari ponsel utama tidak ada.
- Media **sekali lihat** tidak diambil (ditulis sebagai keterangan). Panggilan suara/video ditulis sebagai baris riwayat, bukan rekaman.
- Satu media maksimal 40 MB dan total 400 MB. Media yang gagal diambil tampil sebagai keterangan. Dokumen dicatat namanya, filenya tidak diambil.
- Chat besar dengan media bisa makan beberapa menit; biarkan app terbuka (layar dijaga menyala).
- Pembacaan pesan mengandalkan struktur HTML WhatsApp Web. Diuji pada chat tiruan (teks, emoji, foto+caption, video, suara, panggilan, lokasi, sekali-lihat, pesan dihapus, riwayat yang dimuat bertahap, ZIP diverifikasi dengan `zipfile`, pembatalan), **bukan** pada WhatsApp asli. Bila ada tipe pesan yang terbaca salah, kirim satu contoh agar pembaca disesuaikan.

### Belum diuji
APK belum dibuild atau dijalankan di perangkat di lingkungan ini. JS diuji di Chromium; Java diperiksa sintaks dan alur (javac) tanpa Android SDK.

## Versi 2.0.0 — menu samping, layar fitur, dan cek panggilan

Masalah yang dilaporkan: menu rel kiri WhatsApp Web (Chat, Panggilan, Status, Saluran, Komunitas) tidak bisa dibuka dari bottom bar ("Menu Panggilan belum ditemukan"), dan tombol telepon/video di header chat tampil abu-abu.

### 1. Pencarian menu samping (`phone-layout.js`) — bug nyata yang ditemukan
Diuji di Chromium dengan DOM tiruan rel WhatsApp Web (5 struktur berbeda × 5 menu = 25 kombinasi). v1.9 hanya benar pada 6 dari 25; v2.0 benar pada 25 dari 25.
- Klik dikirim ke pembungkus `data-navbar-item`, bukan ke tombol di dalamnya. v1.9 melapor berhasil, tetapi tidak ada yang terjadi.
- Item di dalam `role="listitem"` dikecualikan dari pencarian, sehingga semua menu dianggap tidak ada.
- Cadangan berdasarkan urutan ikon melewatkan ikon Chat karena badge angka ("62") dianggap teks. Akibatnya Panggilan salah menjadi Status.
- Rel disembunyikan dengan `display:none` sehingga tidak punya posisi/ukuran. Sekarang diparkir di luar layar (tetap punya ukuran, tidak menyita lebar, tidak bisa disentuh).
- Tombol "Chat baru" bisa terpilih sebagai "Chat". Sekarang ada daftar tolak (`baru`, `new`, dst.).
- Cadangan baru berbasis posisi: kolom paling kiri berisi ≥5 ikon, diurutkan dari atas.

Catatan: ini diuji pada DOM tiruan, bukan pada WhatsApp Web asli. Struktur asli WhatsApp dapat berbeda.

### 2. Layar fitur (cadangan bila menu tetap tidak ketemu)
- Tombol **Desktop** (paling kanan di bottom bar), menu ⋮ → "Layar fitur", atau tombol **Layar fitur** di dialog "menu belum ditemukan".
- Membuka tampilan desktop asli WhatsApp Web (lebar 1000 px) di layar sendiri: layar otomatis miring, bisa dicubit untuk memperbesar, rel kiri dan tombol telepon/video persis seperti di laptop.
- Tombol Kembali (atau panah di bilah atas) pulang ke tampilan HP. Sesi, chat, dan WebView-nya sama, jadi tidak memicu "WhatsApp terbuka di jendela lain".

### 3. Panggilan suara/video
Tombol telepon/video digambar dan dinonaktifkan oleh WhatsApp Web sendiri, bukan oleh app ini. Dari kode saja, penyebab pastinya belum bisa dipastikan. Perubahan yang mungkin berpengaruh:
- `desktop-compat.js`: user-agent sudah mengaku Windows/Chrome, tetapi `navigator.platform` masih "Linux" dan `navigator.userAgentData` masih `mobile=true / Android`. Keduanya sekarang diselaraskan dengan user-agent (hanya saat mode kompatibilitas desktop aktif, yaitu bawaan). Ini dugaan yang diuji pada Chromium emulasi HP, belum terbukti mengaktifkan tombol di WhatsApp asli.
- Izin mikrofon dan kamera diminta sekali setelah akun tertaut (juga lewat menu ⋮ → "Izinkan mikrofon & kamera").
- WebView tidak lagi di-pause saat jendela panggilan terbuka (sebelumnya pindah aplikasi/layar mati memutus mikrofon).
- Jendela panggilan memakai identitas desktop yang sama.
- **Menu ⋮ → "Cek dukungan panggilan"**: menampilkan versi WebView, izin, kemampuan WebRTC, status tombol telepon/video di header (disabled? tooltip?), dan apakah menu Panggilan ditemukan. Ada tombol **Salin**. Bila tombol tetap abu-abu, kirim laporan itu agar penyebab sebenarnya terbaca, bukan ditebak.

### Belum diuji
APK belum dibuild atau dijalankan di perangkat di lingkungan ini. JS diuji di Chromium; Java baru diperiksa sintaksnya. Build lewat GitHub Actions, lalu uji: bottom bar → Panggilan, Layar fitur masuk/keluar, Cek dukungan panggilan, dan panggilan sungguhan. Panggilan juga memerlukan akun yang sudah mendapat fitur Web Calling dan app harus tetap di layar depan (belum ada foreground service).

## Versi 1.9.0 — bottom bar dan panggilan suara/video

Perubahan:
- **Navigasi bottom bar**: pencarian tombol sidebar asli WhatsApp Web tidak lagi bergantung pada nama kelas CSS. Urutan pencarian: `aria-label`/`title`/teks `<title>` SVG (Inggris dan Indonesia), lalu `data-icon` pada tombol **maupun elemen anak** (sebelumnya hanya pada tombol itu sendiri), lalu `data-testid`, dan terakhir urutan ikon pada rel kiri (khusus Chat, Panggilan, Status, Saluran, Komunitas).
- Daftar chat, area pesan, footer, dan dialog **tidak lagi dipindai** saat mencari menu. Versi lama dapat mengetuk baris chat yang kebetulan berisi kata "status" atau "calls".
- Klik dikirim sebagai urutan pointer/mouse lalu `click()` pada elemen tombol terdekat.
- Setelah menu diketuk, layar diset ke panel kiri (daftar) dahulu, lalu pindah ke panel kanan hanya jika WhatsApp benar-benar membuka panel di sana.
- Rel navigasi desktop tidak pernah lagi memakai header daftar chat sebagai target sembunyi.
- Jika menu tetap tidak ditemukan, aplikasi mencoba ulang dua kali, lalu menampilkan dialog dengan tombol **Salin** berisi daftar kontrol yang terlihat oleh skrip (`__rkNavDebug`). Kirim laporan itu agar selector dapat disesuaikan.
- **Panggilan suara/video**: WhatsApp Web membuka layar panggilan lewat `window.open()`. WebView sekarang mengizinkan multi-jendela (`onCreateWindow`/`onCloseWindow`) dan menampilkannya layar penuh. Tautan biasa yang membuka tab baru tetap dilempar ke browser.
- Autoplay media tidak lagi memerlukan ketukan agar audio lawan bicara dapat terdengar; izin `MODIFY_AUDIO_SETTINGS` ditambahkan.

Belum dibuild di perangkat. Panggilan membutuhkan akun yang sudah mendapat fitur Web Calling dan izin kamera/mikrofon. Tombol Back pada layar panggilan menutup jendela panggilan.

## Perbaikan versi 1.7.0 — layar awal QR

- Saat halaman penautan terdeteksi (QR tersedia, daftar chat belum tersedia), adapter layout percakapan dimatikan sementara. Dengan demikian CSS panel desktop tidak memotong bagian QR.
- Layar QR memakai alur halaman normal, lebar 100% dan gulir vertikal bila diperlukan; elemen yang lebih lebar daripada layar dibatasi.
- QR dikecilkan secara proporsional hingga sekitar 72% lebar layar (maksimal 264 px) agar seluruh pola QR tampak di layar portrait dan dapat dipindai.
- Kontainer flex desktop yang menampung QR dan instruksi disusun vertikal pada layar sempit. Sesudah daftar chat muncul, aturan khusus login dilepas dan adapter chat kembali aktif.
- Naik versi aplikasi menjadi 1.7.0.

> Perbaikan QR ini memerlukan build dan pengujian nyata di HP. Tampilan login WhatsApp dapat berubah sewaktu-waktu, sehingga belum dijamin berhasil pada semua versi WebView.

## Perbaikan versi 1.5.0 (berdasarkan tangkapan layar)

- Memperbaiki penyebab area chat kosong: tata letak luar WhatsApp Web kini dibatasi ke lebar WebView, rel navigasi desktop disembunyikan di mode portrait, dan lebar navbar internal disetel ulang agar tidak menyisakan ruang off-screen.
- Panel yang diganti adalah pembungkus panel daftar dan pembungkus panel percakapan, bukan memaksa `#main` menjadi `display:flex` atau mengecilkan semua elemen chat.
- Saat mengetuk baris kontak, mode chat dipilih setelah event WhatsApp dijalankan; sinkronisasi ulang dilakukan beberapa kali untuk mengakomodasi render React yang terlambat.
- Tombol panah kembali ditambahkan pada bilah aplikasi Android dan ditampilkan saat panel chat/halaman sekunder aktif. Tombol itu memanggil navigasi kembali ke daftar chat tanpa menghapus cookie.
- Penanganan tap memiliki fallback selector untuk beberapa struktur baris chat dan kembali ke daftar dengan beberapa selector ikon/label.
- Naik versi aplikasi menjadi 1.5.0.

## Perubahan versi 1.4.0

- Menghapus bar tombol bawah. **Muat ulang, Unduh media, pilihan mode, browser, dan bantuan sekarang berada di menu tiga titik** di bagian atas.
- Mengunci antarmuka aplikasi dalam mode portrait agar lebih konsisten untuk penggunaan HP.
- Menambahkan **tampilan satu layar HP**: pada layar sempit, daftar chat dan obrolan ditampilkan bergantian, bukan berdampingan seperti tampilan desktop. Ketuk chat dari daftar untuk masuk ke percakapan; tombol Back Android atau menu kembali mengunci mode daftar chat sampai baris chat lain dipilih.
- Menghapus pemaksaan lebar/tinggi pada semua elemen halaman. Hanya panel daftar chat dan panel percakapan yang bergantian memenuhi layar portrait; konten pesan tidak dipaksa gepeng. Kolom pengetikan memakai ukuran dasar 16 px.
- Tidak lagi mengubah lebar atau tinggi panel emoji/stiker secara global, untuk mengurangi risiko pemotongan dan gangguan pengiriman. Fungsi panel tetap bergantung pada versi WhatsApp Web.
- Mempertahankan penyimpanan cookie dan DOM storage WebView. Aplikasi tidak menghapus cookie ketika keluar atau saat memuat ulang.
- Tetap menyediakan pemilih file untuk mengirim foto, video, dan dokumen.
- Menaruh fitur unduh foto/video di menu tiga titik. Tombol itu mencari media yang tampak di halaman, kemudian mencoba menyimpan URL langsung atau media Blob yang dapat dibaca WebView. Ekspor Blob dibatasi maksimal 40 MB untuk mengurangi risiko kehabisan memori.
- Menggunakan ikon RK yang dikirim pemilik proyek di semua kepadatan layar.


## Perbaikan versi 1.4.0 (riwayat)

- Perpindahan layar saat memilih chat dipaksa secara eksplisit setelah ketukan pada baris chat.
- Kembali ke daftar chat mengubah mode layar sampai pengguna memilih chat lain.
- Deteksi daftar dan panel menggunakan beberapa selector alternatif dan observer DOM.
- Versi ini masih memiliki bug pembungkus layout yang menyebabkan tampilan percakapan kosong pada perangkat pengguna; versi 1.5.0 memperbaiki bagian tersebut.

## Catatan penggunaan dan kompatibilitas

- Default tetap menggunakan user-agent desktop yang diperlukan sejumlah alur WhatsApp Web, sementara navigasi portrait dilakukan dengan CSS/JavaScript di WebView. Mode daftar/chat portrait aktif otomatis dan tidak memiliki sakelar yang dapat membuat halaman kembali gepeng. Pilihan user-agent seluler tersedia sebagai opsi uji, tetapi situs WhatsApp mungkin tidak mendukungnya.
- WhatsApp dapat mengubah struktur HTML/selector sewaktu-waktu. Akibatnya, optimasi satu layar, deteksi percakapan, panel stiker, atau deteksi media mungkin perlu diperbarui bila situs berubah. Ini belum diuji pada semua versi WhatsApp Web.
- Kolom teks dibuat lebih ramah layar sentuh, namun bug pengiriman stiker atau masalah server WhatsApp tidak dapat dijamin terselesaikan hanya dengan CSS pada pembungkus.
- Unduhan bukan ekstensi browser dengan akses internal penuh. Tidak semua Status, media yang dilindungi, URL sementara, atau media sekali lihat dapat diunduh. Aplikasi tidak mencoba melewati perlindungan privasi WhatsApp.
- Build dikonfigurasi untuk Android API 24+ termasuk Android Oreo (API 26). Pengalaman WebView juga bergantung pada versi Android System WebView/Chrome yang terpasang di HP.
- Sesi biasanya tetap ada setelah aplikasi ditutup atau HP di-restart karena cookie tidak dihapus. WhatsApp masih bisa meminta tautan ulang atau mencabut sesi, dan Android dapat menghentikan proses aplikasi kapan saja.

## Cara build APK lewat GitHub Actions

1. Ekstrak ZIP source code di komputer.
2. Buat repository GitHub dan unggah **isi folder `wa-cloning-android`** ke root repository, termasuk folder tersembunyi `.github/workflows`. Jangan hanya mengunggah file ZIP.
3. Buka tab **Actions → Build WA Cloning APK → Run workflow**.
4. Tunggu proses build berhasil. Buka run yang selesai dan unduh **Artifacts → `wa-cloning-apk`**.
5. Ekstrak artifact tersebut untuk mendapatkan `app-debug.apk`, lalu kirim ke HP Android dan instal setelah memverifikasi sumber file.

Proyek sumber sudah disesuaikan, tetapi perlu dikompilasi lewat workflow dan diuji di HP sebelum dianggap siap produksi. Uji login/tautkan perangkat, chat teks, emoji/stiker, keyboard, unggah file, navigasi daftar-chat, sesi setelah restart, dan unduhan media.

## Apakah perlu Netlify?

Tidak. Aplikasi langsung membuka situs resmi `web.whatsapp.com`; tidak perlu membuat tiruan WhatsApp Web di Netlify atau menaruh sesi akun di server milik sendiri.




Versi 1.7.0 menambahkan bilah navigasi bawah yang dapat digeser horizontal untuk menu Chat, Panggilan, Status, Saluran, Komunitas, Bisnis, Iklan, Media, Setelan, dan Profil. Struktur menu WhatsApp Web dapat berubah; item yang tidak terdeteksi akan menampilkan pesan dan bukan membuka halaman palsu.


## Versi 1.8.0 — perbaikan scroll, panel kosong, dan lag

Perubahan penting:
- CSS injeksi tidak lagi mengunci `overflow:hidden` pada `html/body` atau panel daftar/chat internal.
- Panel internal WhatsApp tidak lagi dipaksa `display:flex`; aturan layout hanya mengatur panel luar yang bergantian ditampilkan di layar portrait.
- `#pane-side` diberi scroll vertikal sentuh agar daftar chat dapat digulir; area pesan WhatsApp tetap memakai DOM scroll miliknya.
- Tombol kembali menetapkan mode `list` dan mempertahankannya meskipun composer lama masih ada di DOM.
- Pengamatan DOM di-debounce, mutasi pesan/keyboard yang sering terjadi disaring, dan polling permanen 900 ms dihapus untuk mengurangi kerja berulang.
- Kelas responsif sementara QR dibersihkan setelah penautan sehingga tidak tertinggal di halaman chat.
- Pengaturan WebView membiarkan scroll/touch standar bekerja dan mempertahankan `adjustResize` untuk keyboard.

Belum ada APK yang dibuild atau diuji pada perangkat fisik di lingkungan ini. Hasil harus divalidasi melalui GitHub Actions dan perangkat target; WhatsApp Web dapat mengubah selector/struktur sewaktu-waktu.
