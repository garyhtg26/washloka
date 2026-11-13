# Email verifikasi Washloka

Email verifikasi dengan desain Washloka menggunakan Firebase Authentication untuk
membuat dan memeriksa tautan, dan Resend untuk mengirim email. Password reset
tetap menggunakan email Firebase yang sudah ada.

## Persiapan

1. Buat akun [Resend](https://resend.com/) dan tambahkan domain email yang kamu
   miliki melalui menu **Domains**. Ikuti petunjuk Resend untuk memasang dan
   memverifikasi catatan DNS. Nama domain pengirim harus sesuai dengan domain
   yang sudah diverifikasi; alamat uji Resend tidak ditujukan untuk pengiriman
   kepada semua pelanggan.
2. Buat API key Resend dengan izin **Sending access**. Simpan key sebagai
   rahasia; jangan simpan di Git, chat, atau variabel `NEXT_PUBLIC_`.
3. Di Firebase Console, buka **Authentication → Settings → Authorized domains**.
   Pastikan domain website yang dipakai untuk link email sudah ada di daftar.
4. Di Vercel, buka **Project Settings → Environment Variables**. Isi ketiga
   variabel berikut pada environment yang sesuai:

   - `RESEND_API_KEY`: API key Resend untuk pengiriman.
   - `RESEND_FROM_EMAIL`: alamat pengirim pada domain yang sudah diverifikasi,
     misalnya `Washloka <no-reply@domain-milikmu.id>`.
   - `EMAIL_APP_ORIGIN`: alamat dasar HTTPS website, misalnya
     `https://washloka.vercel.app`. Jangan tambahkan path, query, atau slash
     yang berisi nama halaman. Alamat ini juga harus diizinkan di Firebase.

   Gunakan nilai yang sama di `.env.local` untuk pengembangan lokal jika ingin
   mencoba pengiriman; tautan email tetap menuju origin HTTPS yang dikonfigurasi.
5. Redeploy aplikasi di Vercel setelah mengganti environment variables. Untuk
   lokal, jalankan ulang server pengembangan agar membaca konfigurasi terbaru.
6. Gunakan akun email milik sendiri yang belum terverifikasi untuk mencoba:
   masuk, pilih **Kirim ulang email verifikasi**, lalu buka tombol di email dan
   selesaikan verifikasi. Periksa folder spam bila email tidak terlihat. Jangan
   gunakan akun pelanggan sungguhan sebagai data uji tanpa persetujuan.

Jika ketiga variabel tidak diisi, aplikasi tetap memakai email bawaan Firebase.
Jika hanya sebagian diisi atau layanan pengirim gagal, pengiriman akan menunjukkan
kesalahan; aplikasi tidak diam-diam kembali ke email bawaan. Endpoint hanya
mengirim ke email pengguna yang sedang login dan menerapkan batas permintaan.

Referensi: [Resend domain](https://resend.com/docs/dashboard/domains/introduction),
[API key Resend](https://resend.com/docs/dashboard/api-keys/introduction), dan
[Firebase email action links](https://firebase.google.com/docs/auth/admin/email-action-links).
