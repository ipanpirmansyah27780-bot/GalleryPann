"use strict";

// ========================================
// 1. KONFIGURASI SUPABASE
// ========================================

const SUPABASE_URL = "https://kfesxsoxapiutzyknqwz.supabase.co";
const SUPABASE_KEY = "sb_publishable_1YYWVbLXamgotdDyM1B1bQ_n1W0e2ib";
const NAMA_BUCKET = "photos";
const MAKSIMAL_UKURAN = 10 * 1024 * 1024; // 10 MB

const konfigurasiSiap =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_KEY !== "PUBLISHABLE_KEY_SUPABASE" &&
  SUPABASE_KEY.trim() !== "";

const supabaseClient = konfigurasiSiap
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ========================================
// 2. MENGAMBIL ELEMEN HTML
// ========================================

const authSection = document.getElementById("authSection");
const gallerySection = document.getElementById("gallerySection");
const authForm = document.getElementById("authForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnAuth = document.getElementById("btnAuth");
const btnSwitchAuth = document.getElementById("btnSwitchAuth");
const btnLogout = document.getElementById("btnLogout");
const btnLupaPassword = document.getElementById("btnLupaPassword");

const authMessage = document.getElementById("authMessage");
const uploadForm = document.getElementById("uploadForm");
const photoFiles = document.getElementById("photoFiles");
const uploadAlbum = document.getElementById("uploadAlbum");
const uploadMessage = document.getElementById("uploadMessage");

const albumForm = document.getElementById("albumForm");
const albumName = document.getElementById("albumName");
const albumMessage = document.getElementById("albumMessage");

const filterAlbum = document.getElementById("filterAlbum");
const photoGallery = document.getElementById("photoGallery");
const galleryMessage = document.getElementById("galleryMessage");

const totalPhotos = document.getElementById("totalPhotos");
const totalAlbums = document.getElementById("totalAlbums");

// ========================================
// 3. STATUS DAN DATA APLIKASI
// ========================================

let modeDaftar = false;
let penggunaAktif = null;
let daftarAlbum = [];
let daftarFoto = [];
let sedangMemuat = false;

// ========================================
// 4. FUNGSI PESAN
// ========================================

function tampilkanPesan(elemen, pesan, jenis = "") {
  elemen.textContent = pesan;
  elemen.className = "message";

  if (jenis) {
    elemen.classList.add(jenis);
  }
}

function formatError(error) {
  const pesan = error?.message || "Terjadi kesalahan.";

  // Jangan menampilkan detail konfigurasi internal ke pengguna.
  console.error(error);
  return pesan;
}

// ========================================
// 5. PINDAH HALAMAN LOGIN / GALERI
// ========================================

function tampilkanHalamanLogin() {
  authSection.classList.remove("hidden");
  gallerySection.classList.add("hidden");
  btnLogout.classList.add("hidden");
}

function tampilkanDashboard() {
  authSection.classList.add("hidden");
  gallerySection.classList.remove("hidden");
  btnLogout.classList.remove("hidden");
}

// ========================================
// 6. DAFTAR ATAU MASUK
// ========================================

btnSwitchAuth.addEventListener("click", () => {
  modeDaftar = !modeDaftar;

  btnAuth.textContent = modeDaftar ? "Daftar Akun" : "Masuk";
  btnSwitchAuth.textContent = modeDaftar ? "Masuk" : "Daftar";
  btnSwitchAuth.parentElement.firstChild.textContent =
    modeDaftar ? "Sudah punya akun? " : "Belum punya akun? ";

  tampilkanPesan(authMessage, "");
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    tampilkanPesan(
      authMessage,
      "Isi URL dan Publishable Key Supabase terlebih dahulu.",
      "error"
    );
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  btnAuth.disabled = true;
  btnAuth.textContent = "Memproses...";

  try {
    if (modeDaftar) {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      if (data.session) {
        penggunaAktif = data.user;
        await mulaiAplikasi();
      } else {
        tampilkanPesan(
          authMessage,
          "Pendaftaran berhasil. Periksa email untuk konfirmasi, lalu masuk.",
          "success"
        );
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      penggunaAktif = data.user;
      await mulaiAplikasi();
    }
  } catch (error) {
    tampilkanPesan(authMessage, formatError(error), "error");
  } finally {
    btnAuth.disabled = false;
    btnAuth.textContent = modeDaftar ? "Daftar Akun" : "Masuk";
  }
});

// ========================================
// 7. MENJALANKAN APLIKASI
// ========================================

async function mulaiAplikasi() {
  tampilkanDashboard();

  tampilkanPesan(galleryMessage, "Memuat galeri...");

  try {
    await muatAlbum();
    await muatFoto();
  } catch (error) {
    tampilkanPesan(galleryMessage, formatError(error), "error");
  }
}

// ========================================
// 8. MEMUAT ALBUM DARI DATABASE
// ========================================

async function muatAlbum() {
  const { data, error } = await supabaseClient
    .from("albums")
    .select("id, name, created_at")
    .eq("user_id", penggunaAktif.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  daftarAlbum = data || [];

  // Perbarui pilihan album untuk unggah dan filter.
  uploadAlbum.replaceChildren();
  filterAlbum.replaceChildren();

  const opsiTanpaAlbum = new Option("Tanpa album", "");
  const opsiSemuaFoto = new Option("Semua foto", "");

  uploadAlbum.add(opsiTanpaAlbum);
  filterAlbum.add(opsiSemuaFoto);

  daftarAlbum.forEach((album) => {
    uploadAlbum.add(new Option(album.name, album.id));
    filterAlbum.add(new Option(album.name, album.id));
  });

  totalAlbums.textContent = daftarAlbum.length;
}

// ========================================
// 9. MEMBUAT ALBUM BARU
// ========================================

albumForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!penggunaAktif) return;

  const nama = albumName.value.trim();

  if (!nama) {
    tampilkanPesan(albumMessage, "Nama album wajib diisi.", "error");
    return;
  }

  const tombol = albumForm.querySelector("button");
  tombol.disabled = true;

  try {
    const { error } = await supabaseClient
      .from("albums")
      .insert({
        user_id: penggunaAktif.id,
        name: nama
      });

    if (error) throw error;

    albumName.value = "";
    await muatAlbum();

    tampilkanPesan(albumMessage, "Album berhasil dibuat.", "success");
  } catch (error) {
    tampilkanPesan(albumMessage, formatError(error), "error");
  } finally {
    tombol.disabled = false;
  }
});

// ========================================
// 10. MENGUNGGAH FOTO KE CLOUD
// ========================================

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!penggunaAktif) return;

  const fileTerpilih = Array.from(photoFiles.files || []);

  if (fileTerpilih.length === 0) {
    tampilkanPesan(uploadMessage, "Pilih foto terlebih dahulu.", "error");
    return;
  }

  const fileTidakValid = fileTerpilih.find((file) =>
    !file.type.startsWith("image/") ||
    file.size > MAKSIMAL_UKURAN
  );

  if (fileTidakValid) {
    tampilkanPesan(
      uploadMessage,
      "Pastikan semua file berupa gambar dan ukurannya maksimal 10 MB.",
      "error"
    );
    return;
  }

  const tombol = uploadForm.querySelector("button");
  tombol.disabled = true;
  tombol.textContent = "Mengunggah...";

  const idAlbum = uploadAlbum.value || null;
  const fileBerhasil = [];

  try {
    for (const file of fileTerpilih) {
      // Nama unik untuk mencegah tabrakan nama file.
      const namaAman = file.name
        .replace(/[^a-zA-Z0-9.-]/g, "")
        .slice(-120);

      const namaFile =
        `${penggunaAktif.id}/${crypto.randomUUID()}-${namaAman}`;

      // A. Unggah file ke bucket privat.
      const { error: uploadError } = await supabaseClient.storage
        .from(NAMA_BUCKET)
        .upload(namaFile, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      // B. Simpan keterangan file ke database.
      const { error: dbError } = await supabaseClient
        .from("photos")
        .insert({
          user_id: penggunaAktif.id,
          album_id: idAlbum,
          file_path: namaFile,
          file_name: file.name
        });

      if (dbError) {
        // Bersihkan file jika pencatatan database gagal.
        await supabaseClient.storage.from(NAMA_BUCKET).remove([namaFile]);
        throw dbError;
      }

      fileBerhasil.push(file.name);
    }

    photoFiles.value = "";
    await muatFoto();

    tampilkanPesan(
      uploadMessage,
      `${fileBerhasil.length} foto berhasil diunggah ke cloud.`,
      "success"
    );
  } catch (error) {
    tampilkanPesan(uploadMessage, formatError(error), "error");

    // Foto yang berhasil sebelumnya tetap disimpan.
    if (fileBerhasil.length > 0) {
      await muatFoto();
    }
  } finally {
    tombol.disabled = false;
    tombol.textContent = "+ Unggah Foto";
  }
});

// ========================================
// 11. MEMUAT FOTO DARI DATABASE
// ========================================

async function muatFoto() {
  const { data, error } = await supabaseClient
    .from("photos")
    .select("id, album_id, file_path, file_name, created_at")
    .eq("user_id", penggunaAktif.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  daftarFoto = data || [];
  totalPhotos.textContent = daftarFoto.length;

  await tampilkanGaleri();
}

// ========================================
// 12. MENAMPILKAN GALERI
// ========================================

async function tampilkanGaleri() {
  photoGallery.replaceChildren();

  const filter = filterAlbum.value;

  const fotoTerfilter = filter
    ? daftarFoto.filter((foto) => foto.album_id === filter)
    : daftarFoto;

  if (fotoTerfilter.length === 0) {
    const kotak = document.createElement("div");
    kotak.className = "empty-state";

    const judul = document.createElement("strong");
    judul.textContent = "Belum ada foto";

    const deskripsi = document.createElement("p");
    deskripsi.textContent =
      "Unggah foto pertamamu untuk mulai mengisi galeri.";

    kotak.append(judul, deskripsi);
    photoGallery.append(kotak);

    tampilkanPesan(galleryMessage, "");
    return;
  }

  tampilkanPesan(galleryMessage, "Memuat foto...");

  const hasil = await Promise.all(
    fotoTerfilter.map(async (foto) => {
      const { data, error } = await supabaseClient.storage
        .from(NAMA_BUCKET)
        .createSignedUrl(foto.file_path, 3600);

      if (error) {
        console.error("Gagal membuat URL foto:", error);
        return { foto, url: null };
      }

      return { foto, url: data.signedUrl };
    })
  );

  hasil.forEach(({ foto, url }) => {
    const album = daftarAlbum.find((item) => item.id === foto.album_id);

    const kartu = document.createElement("article");
    kartu.className = "photo-card";

    const gambar = document.createElement("img");
    gambar.alt = foto.file_name;
    gambar.loading = "lazy";

    if (url) {
      gambar.src = url;
    } else {
      gambar.alt = "Foto tidak dapat dimuat";
    }

    const info = document.createElement("div");
    info.className = "photo-info";

    const nama = document.createElement("p");
    nama.className = "photo-name";
    nama.textContent = foto.file_name;

    const labelAlbum = document.createElement("span");
    labelAlbum.className = "photo-album";
    labelAlbum.textContent = album ? album.name : "Tanpa album";

    const aksi = document.createElement("div");
    aksi.className = "photo-actions";

    if (url) {
      const unduh = document.createElement("a");
      unduh.className = "download-link";
      unduh.href = url;
      unduh.target = "_blank";
      unduh.rel = "noopener noreferrer";
      unduh.textContent = "Lihat / Unduh";
      aksi.append(unduh);
    }

    const hapus = document.createElement("button");
    hapus.type = "button";
    hapus.className = "delete-button";
    hapus.textContent = "Hapus";

    hapus.addEventListener("click", () => hapusFoto(foto, hapus));

    aksi.append(hapus);
    info.append(nama, labelAlbum, aksi);
    kartu.append(gambar, info);
    photoGallery.append(kartu);
  });

  tampilkanPesan(galleryMessage, "");
}

// ========================================
// 13. FILTER ALBUM
// ========================================

filterAlbum.addEventListener("change", () => {
  tampilkanGaleri().catch((error) => {
    tampilkanPesan(galleryMessage, formatError(error), "error");
  });
});

// ========================================
// 14. MENGHAPUS FOTO
// ========================================

async function hapusFoto(foto, tombol) {
  const yakin = confirm(
    `Hapus foto "${foto.file_name}" secara permanen?`
  );

  if (!yakin) return;

  tombol.disabled = true;

  try {
    // Hapus file dari bucket terlebih dahulu.
    const { error: storageError } = await supabaseClient.storage
      .from(NAMA_BUCKET)
      .remove([foto.file_path]);

    if (storageError) throw storageError;

    // Hapus catatan database milik pengguna.
    const { error: dbError } = await supabaseClient
      .from("photos")
      .delete()
      .eq("id", foto.id)
      .eq("user_id", penggunaAktif.id);

    if (dbError) {
      tampilkanPesan(
        galleryMessage,
        "File terhapus, tetapi catatan database gagal dihapus. Hubungi pengelola.",
        "error"
      );
      await muatFoto();
      return;
    }

    await muatFoto();

    tampilkanPesan(galleryMessage, "Foto berhasil dihapus.", "success");
  } catch (error) {
    tampilkanPesan(galleryMessage, formatError(error), "error");
    tombol.disabled = false;
  }
}

// ========================================
// 15. KELUAR DARI AKUN
// ========================================

btnLogout.addEventListener("click", async () => {
  btnLogout.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    penggunaAktif = null;
    daftarAlbum = [];
    daftarFoto = [];

    tampilkanHalamanLogin();
    tampilkanPesan(authMessage, "Kamu sudah keluar.", "success");
  } catch (error) {
    tampilkanPesan(authMessage, formatError(error), "error");
  } finally {
    btnLogout.disabled = false;
  }
});

// ========================================
// 15A. FITUR LUPA PASSWORD
// ========================================

if (btnLupaPassword) {
  btnLupaPassword.addEventListener("click", async () => {

    if (!supabaseClient) {
      alert("Konfigurasi Supabase belum tersedia.");
      return;
    }

    const email = prompt("Masukkan email akun GalleryPann:");

    if (!email || !email.trim()) {
      alert("Email wajib diisi.");
      return;
    }

    try {
      const { error } =
        await supabaseClient.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: window.location.origin + "/"
          }
        );

      if (error) throw error;

      alert(
        "Link reset password berhasil dikirim. Silakan periksa email kamu."
      );

    } catch (error) {
      alert("Gagal mengirim link: " + error.message);
    }

  });
}


//==========================================
// 16. MEMERIKSA SESI LOGIN
// ========================================

async function periksaSesi() {
  if (!supabaseClient) {
    tampilkanHalamanLogin();

    tampilkanPesan(
      authMessage,
      "Konfigurasi Supabase belum diisi di script.js.",
      "error"
    );

    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    tampilkanPesan(authMessage, formatError(error), "error");
    return;
  }

  if (data.session) {
    penggunaAktif = data.session.user;
    await mulaiAplikasi();
  } else {
    tampilkanHalamanLogin();
  }
}

// Perbarui halaman jika status autentikasi berubah.
supabaseClient?.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    penggunaAktif = null;
    daftarAlbum = [];
    daftarFoto = [];
    tampilkanHalamanLogin();
  }
});

// Jalankan pemeriksaan pertama kali.
periksaSesi().catch((error) => {
  tampilkanPesan(authMessage, formatError(error), "error");
});