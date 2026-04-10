// ==========================================
// CONFIGURATION
// ==========================================
// Pastikan URL ini adalah Web App URL yang BARU jika kamu men-deploy ulang
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyfQY3WrU1Wv1HI3QxELvQSB-tqV7iJ3p6Pi0Vt86iCyIaYMfQt-b3wzQGwAtwoFpA/exec";

// ==========================================
// STATE MANAGEMENT & DOM ELEMENTS
// ==========================================
const views = {
  landing: document.getElementById("view-landing"),
  tentang: document.getElementById("view-tentang"),
  camera: document.getElementById("view-camera"),
  result: document.getElementById("view-result"),
  gallery: document.getElementById("view-gallery"),
};

const video = document.getElementById("camera-feed");
const videoWrapper = document.getElementById("video-wrapper");
const mainCanvas = document.getElementById("main-canvas");
const ctx = mainCanvas.getContext("2d");
const resultDisplay = document.getElementById("result-display");
const cameraSelect = document.getElementById("camera-select");
const btnStartCapture = document.getElementById("btn-start-capture");
const galleryContainer = document.getElementById("gallery-container");

// Efek Suara Kamera (Diganti ke MP3 standar agar tidak error NotSupported)
const shutterSound = new Audio(
  "https://upload.wikimedia.org/wikipedia/commons/d/d3/Camera_click.ogg",
);

let videoStream = null;
let currentDeviceId = null;
let selectedTemplate = "UMUM";
let selectedLayout = "GRID";
let selectedTime = 3;
let capturedPhotos = [];
let lastFolderUrl = "";
let currentSessionId = "";

// STATE LOKAL UNTUK GALERI
let gallerySessions = JSON.parse(localStorage.getItem("booth_gallery")) || [];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// INISIALISASI APLIKASI
// ==========================================
async function initApp() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === "videoinput");

    cameraSelect.innerHTML = videoDevices
      .map(
        (d, i) =>
          `<option value="${d.deviceId}">${d.label || "Kamera " + (i + 1)}</option>`,
      )
      .join("");

    if (videoDevices.length > 0) {
      currentDeviceId = videoDevices[0].deviceId;
      await startCamera(currentDeviceId);
    }
  } catch (err) {
    console.error("Kamera ditolak/error:", err);
    alert("Izin akses kamera diperlukan untuk menggunakan Photobooth.");
  }
}

cameraSelect.onchange = (e) => startCamera(e.target.value);
window.onload = initApp;

// ==========================================
// ROUTING & SIDEBAR CONTROLS
// ==========================================
function showView(viewName) {
  Object.values(views).forEach((v) => {
    v.classList.remove("block", "flex");
    v.classList.add("hidden");
  });

  if (viewName === "landing") {
    views[viewName].classList.add("block");
    views[viewName].classList.remove("hidden");
  } else {
    views[viewName].classList.add("flex");
    views[viewName].classList.remove("hidden");
  }

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active-nav");
  });

  if (viewName === "landing" || viewName === "tentang") {
    document.getElementById("nav-landing")?.classList.add("active-nav");
  } else if (viewName === "camera" || viewName === "result") {
    document.getElementById("nav-camera")?.classList.add("active-nav");
  } else if (viewName === "gallery") {
    document.getElementById("nav-gallery")?.classList.add("active-nav");
    renderGallery();
  }
}

async function startCamera(deviceId) {
  if (videoStream) {
    videoStream.getTracks().forEach((t) => t.stop());
  }
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    video.srcObject = videoStream;
  } catch (err) {
    console.error("Gagal menjalankan kamera:", err);
  }
}

function selectTemplateAndStart(templateName, layout = "GRID") {
  selectedTemplate = templateName;
  selectedLayout = layout;
  showView("camera");
}

function setTimer(seconds) {
  selectedTime = seconds;
  document.querySelectorAll(".timer-btn").forEach((btn) => {
    if (parseInt(btn.dataset.time) === seconds) {
      btn.classList.replace("bg-surface-container-lowest", "bg-primary");
      btn.classList.replace("text-on-surface", "text-white");
      btn.classList.add("shadow-sm");
      btn.classList.remove("border-2", "border-transparent");
    } else {
      btn.classList.replace("bg-primary", "bg-surface-container-lowest");
      btn.classList.replace("text-white", "text-on-surface");
      btn.classList.remove("shadow-sm");
      btn.classList.add("border-2", "border-transparent");
    }
  });
}

// ==========================================
// CAPTURE ENGINE (4 LOOP)
// ==========================================
async function startSequenceCapture() {
  btnStartCapture.disabled = true;
  btnStartCapture.classList.add("opacity-50");
  capturedPhotos = [];
  currentSessionId = "SESS-" + Date.now();

  // Memancing audio agar diizinkan browser
  try {
    shutterSound.volume = 0;
    await shutterSound.play();
    shutterSound.pause();
    shutterSound.currentTime = 0;
    shutterSound.volume = 1;
  } catch (e) {} // Abaikan jika masih diblokir browser

  const overlay = document.getElementById("countdown-overlay");
  const txtCount = document.getElementById("countdown-text");
  const txtPose = document.getElementById("pose-status");

  for (let i = 1; i <= 4; i++) {
    overlay.classList.remove("hidden");
    txtPose.innerText = `Pose ${i} / 4`;

    for (let s = selectedTime; s > 0; s--) {
      txtCount.innerText = s;
      await wait(1000);
    }

    overlay.classList.add("hidden");

    // Putar suara saat memotret
    try {
      shutterSound.currentTime = 0;
      shutterSound.play();
    } catch (e) {}

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tCtx = tempCanvas.getContext("2d");

    tCtx.drawImage(video, 0, 0);

    const img = new Image();
    img.src = tempCanvas.toDataURL("image/jpeg", 0.9);
    await new Promise((r) => (img.onload = r));
    capturedPhotos.push(img);

    videoWrapper.classList.add("flash-effect");
    await wait(150);
    videoWrapper.classList.remove("flash-effect");

    if (i < 4) await wait(1000);
  }

  btnStartCapture.disabled = false;
  btnStartCapture.classList.remove("opacity-50");

  showView("result");
  await drawCompiledCanvas();
}

// ==========================================
// CANVAS RENDERING
// ==========================================
async function drawCompiledCanvas() {
  if (selectedLayout === "STRIP") {
    mainCanvas.width = 600;
    mainCanvas.height = 1800;
  } else {
    mainCanvas.width = 1200;
    mainCanvas.height = 1800;
  }

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

  capturedPhotos.forEach((img, i) => {
    let x, y, photoW, photoH;

    if (selectedLayout === "STRIP") {
      photoW = 500;
      photoH = 350;
      x = 50;
      y = 200 + i * (photoH + 30);
    } else {
      photoW = 502;
      photoH = 500;
      const col = i % 2;
      const row = Math.floor(i / 2);
      x = 88 + col * (photoW + 22);
      y = 388 + row * (photoH + 22);
    }

    ctx.save();
    const scale = Math.max(photoW / img.width, photoH / img.height);
    const nw = img.width * scale;
    const nh = img.height * scale;

    ctx.beginPath();
    ctx.rect(x, y, photoW, photoH);
    ctx.clip();
    ctx.drawImage(img, x + (photoW - nw) / 2, y + (photoH - nh) / 2, nw, nh);
    ctx.restore();
  });

  const frameImg = new Image();
  let frameName = `frame-${selectedTemplate.toLowerCase()}`;
  if (selectedLayout === "STRIP") frameName += "-strip";
  frameImg.src = `${frameName}.png`;

  try {
    await new Promise((resolve, reject) => {
      frameImg.onload = resolve;
      frameImg.onerror = reject;
    });
    ctx.drawImage(frameImg, 0, 0, mainCanvas.width, mainCanvas.height);
  } catch (e) {
    console.warn("Frame PNG tidak ditemukan. Fallback teks diaktifkan.");
    ctx.fillStyle = "#0846ed";
    ctx.font = "bold 40px Arial";
    ctx.fillText(`PAMERAN KELAS 9 - ${selectedTemplate}`, 50, 100);
  }

  updateResultDisplay();
  await processCloudUpload();
}

function updateResultDisplay() {
  resultDisplay.src = mainCanvas.toDataURL("image/jpeg", 0.95);
}

// ==========================================
// CLOUD STORAGE & DATABASE
// ==========================================
async function processCloudUpload() {
  const statusText = document.getElementById("upload-status-text");

  const visitorNameNode = document.getElementById("visitor-name");
  const visitorPhoneNode = document.getElementById("visitor-phone");
  const visitorName = visitorNameNode
    ? visitorNameNode.value
    : "Pengunjung Anonim";
  const visitorPhone = visitorPhoneNode ? visitorPhoneNode.value : "-";

  try {
    // 1. Panggil GAS untuk Buat Folder & Log
    // Perhatikan: Kita TIDAK mengirimkan headers Content-Type
    // agar browser mengirimkannya sebagai text/plain default (menghindari CORS)
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "create_folder_and_log",
        id_sesi: currentSessionId,
        nama_pengunjung: visitorName,
        no_telepon: visitorPhone,
        template: selectedTemplate + " (" + selectedLayout + ")",
      }),
    });

    // Cek apakah response OK sebelum parsing JSON
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const folderData = await response.json();

    if (folderData.status === "success") {
      lastFolderUrl = folderData.folderUrl;

      await generateAndDrawQR(folderData.folderUrl);
      updateResultDisplay();

      // SIMPAN KE GALERI LOKAL
      const compressedDataUrl = mainCanvas.toDataURL("image/jpeg", 0.3);
      const newSession = {
        id: currentSessionId,
        image: compressedDataUrl,
        template: selectedTemplate,
        date: new Date().toLocaleString("id-ID"),
        driveUrl: lastFolderUrl,
      };

      gallerySessions.unshift(newSession);
      saveToLocalStorage();

      statusText.innerText = "Mengunggah foto ke Cloud (Latar Belakang)...";
      statusText.classList.remove("animate-pulse");
      statusText.classList.add("text-slate-600");

      const uploads = capturedPhotos.map((img, i) =>
        uploadSingleFile(img.src, `Pose_${i + 1}.jpg`, folderData.folderId),
      );

      uploads.push(
        uploadSingleFile(
          mainCanvas.toDataURL("image/jpeg", 0.95),
          "Final_Photobooth.jpg",
          folderData.folderId,
        ),
      );

      await Promise.all(uploads);

      statusText.innerHTML = "✅ Data tersimpan di Database & Cloud!";
      statusText.classList.replace("text-slate-600", "text-green-600");
    } else {
      throw new Error(folderData.message || "Error dari Apps Script");
    }
  } catch (err) {
    console.error("Gagal Upload:", err);
    statusText.innerHTML =
      "❌ Koneksi ke Database Gagal. Periksa Console (F12).";
    statusText.classList.add("text-red-500");
  }
}

async function uploadSingleFile(base64Str, filename, folderId) {
  const cleanBase64 = base64Str.split(",")[1];

  // Sama seperti di atas, hindari penggunaan headers
  return fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "upload_file",
      folderId: folderId,
      image: cleanBase64,
      filename: filename,
    }),
  });
}
// CLOUD STORAGE & DATABASE
// ==========================================
async function processCloudUpload() {
  const statusText = document.getElementById("upload-status-text");

  const visitorNameNode = document.getElementById("visitor-name");
  const visitorPhoneNode = document.getElementById("visitor-phone");
  const visitorName = visitorNameNode
    ? visitorNameNode.value
    : "Pengunjung Anonim";
  const visitorPhone = visitorPhoneNode ? visitorPhoneNode.value : "-";

  try {
    // Dihapus pengaturan header agar browser menggunakan default text/plain
    // Ini adalah kunci agar lolos dari blokir CORS Google
    const response = await fetch(
      "https://script.google.com/macros/s/AKfycbyfQY3WrU1Wv1HI3QxELvQSB-tqV7iJ3p6Pi0Vt86iCyIaYMfQt-b3wzQGwAtwoFpA/exec",
      {
        redirect: "follow", // Tambahkan baris ini
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8", // Tambahkan baris ini
        },
        body: JSON.stringify({
          action: "create_folder_and_log",
          id_sesi: currentSessionId,
          nama_pengunjung: visitorName,
          no_telepon: visitorPhone,
          template: selectedTemplate + " (" + selectedLayout + ")",
        }),
      },
    );

    const folderData = await response.json();

    if (folderData.status === "success") {
      lastFolderUrl = folderData.folderUrl;

      await generateAndDrawQR(folderData.folderUrl);
      updateResultDisplay();

      // SIMPAN KE GALERI LOKAL (Gunakan resolusi rendah untuk menghindari QuotaExceededError)
      const compressedDataUrl = mainCanvas.toDataURL("image/jpeg", 0.3);
      const newSession = {
        id: currentSessionId,
        image: compressedDataUrl,
        template: selectedTemplate,
        date: new Date().toLocaleString("id-ID"),
        driveUrl: lastFolderUrl,
      };

      gallerySessions.unshift(newSession);
      saveToLocalStorage();

      statusText.innerText = "Mengunggah foto ke Cloud (Latar Belakang)...";
      statusText.classList.remove("animate-pulse");
      statusText.classList.add("text-slate-600");

      const uploads = capturedPhotos.map((img, i) =>
        uploadSingleFile(img.src, `Pose_${i + 1}.jpg`, folderData.folderId),
      );

      uploads.push(
        uploadSingleFile(
          mainCanvas.toDataURL("image/jpeg", 0.95),
          "Final_Photobooth.jpg",
          folderData.folderId,
        ),
      );

      await Promise.all(uploads);

      statusText.innerHTML = "✅ Data tersimpan di Database & Cloud!";
      statusText.classList.replace("text-slate-600", "text-green-600");
    } else {
      throw new Error(folderData.message || "Error tidak diketahui");
    }
  } catch (err) {
    console.error("Gagal Upload:", err);
    statusText.innerHTML =
      "❌ Koneksi ke Database Gagal. Periksa Deployment App Script.";
    statusText.classList.add("text-red-500");
  }
}

async function uploadSingleFile(base64Str, filename, folderId) {
  const cleanBase64 = base64Str.split(",")[1];
  return fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "upload_file",
      folderId: folderId,
      image: cleanBase64,
      filename: filename,
    }),
  });
}

async function generateAndDrawQR(url) {
  const qrUIContainer = document.getElementById("qrcode-ui-container");
  const qrElement = document.getElementById("qr-element");

  qrElement.innerHTML = "";
  qrUIContainer.classList.remove("hidden");
  qrUIContainer.classList.add("flex");

  new QRCode(qrElement, {
    text: url,
    width: 256,
    height: 256,
    correctLevel: QRCode.CorrectLevel.H,
  });

  await wait(600);

  const qrCanvas = qrElement.querySelector("canvas");
  if (qrCanvas) {
    const qrSize = 235;
    const qrX = selectedLayout === "STRIP" ? 180 : 845;
    const qrY = selectedLayout === "STRIP" ? 1500 : 1456;
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
  }
}

// ==========================================
// MANAJEMEN GALERI LOKAL & MEMORI BROWSER
// ==========================================
function saveToLocalStorage() {
  try {
    localStorage.setItem(
      "booth_gallery",
      JSON.stringify(gallerySessions.slice(0, 10)),
    );
  } catch (e) {
    if (
      e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED"
    ) {
      gallerySessions.pop();
      saveToLocalStorage();
    }
  }
}

function renderGallery() {
  galleryContainer.innerHTML = "";

  if (gallerySessions.length === 0) {
    galleryContainer.innerHTML = `
      <div class="col-span-full text-center py-20 bg-surface-container-low rounded-xl border border-dashed border-outline-variant">
        <span class="material-symbols-outlined text-6xl text-slate-300 mb-4">photo_library</span>
        <p class="text-slate-500 font-medium">Belum ada karya yang tersimpan.</p>
        <button onclick="showView('camera')" class="mt-4 bg-primary text-white px-6 py-2 rounded-full font-bold shadow-sm transition-transform active:scale-95 hover:opacity-90">
            Mulai Capture
        </button>
      </div>
    `;
    return;
  }

  gallerySessions.forEach((session) => {
    const card = document.createElement("div");
    card.className =
      "gallery-card group relative bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden";
    card.innerHTML = `
      <div class="aspect-[2/3] bg-gray-100 overflow-hidden relative">
        <img src="${session.image}" class="w-full h-full object-cover" alt="Hasil Photobooth">
        
        <div class="action-overlay absolute inset-0 flex flex-col justify-end p-6 gap-3 opacity-0 group-hover:opacity-100 bg-black/50 transition-opacity">
          <div class="flex gap-2">
            <button onclick="downloadSpecific('${session.image}')" class="flex-1 bg-white/20 backdrop-blur-md hover:bg-white text-white hover:text-primary py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-sm">download</span> Save
            </button>
            <button onclick="shareSpecific('${session.id}')" class="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-sm">share</span> Share
            </button>
          </div>
          <button onclick="deleteSession('${session.id}')" class="w-full bg-red-500/80 hover:bg-red-600 text-white py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-sm">delete</span> Hapus
          </button>
        </div>
      </div>
      <div class="p-4 flex justify-between items-center bg-white z-10 relative">
        <div>
          <p class="text-[10px] font-bold text-primary uppercase tracking-wider">${session.template} Template</p>
          <p class="text-[11px] text-slate-400">${session.date}</p>
        </div>
      </div>
    `;
    galleryContainer.appendChild(card);
  });
}

function deleteSession(id) {
  if (confirm("Hapus foto ini dari riwayat?")) {
    gallerySessions = gallerySessions.filter((s) => s.id !== id);
    saveToLocalStorage();
    renderGallery();
  }
}

function clearAllGallery() {
  if (
    confirm("Hapus seluruh riwayat foto? Tindakan ini tidak bisa dibatalkan.")
  ) {
    gallerySessions = [];
    localStorage.removeItem("booth_gallery");
    renderGallery();
  }
}

function downloadSpecific(dataUrl) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `Photobooth_Pameran_${Date.now()}.jpg`;
  link.click();
}

function shareSpecific(id) {
  const session = gallerySessions.find((s) => s.id === id);
  if (session) {
    const waNumber = prompt(
      "Masukkan nomor WhatsApp tujuan (contoh: 081234567890):",
    );
    if (waNumber) {
      let cleanNumber = waNumber.replace(/\D/g, "");
      if (cleanNumber.startsWith("0"))
        cleanNumber = "62" + cleanNumber.slice(1);

      const driveMsg = session.driveUrl
        ? `\n\n*Link Foto HD (Google Drive):* ${session.driveUrl}`
        : "\n\n(Foto tersimpan di memori lokal perangkat ini)";

      const message = encodeURIComponent(
        `*📸 HASIL PHOTOBOOTH PAMERAN KELAS 9*${driveMsg}\n\nTerima kasih telah berkunjung ke pameran karya kami!`,
      );
      window.open(`https://wa.me/${cleanNumber}?text=${message}`, "_blank");
    }
  }
}

// ==========================================
// ACTIONS: WHATSAPP (Sesi Saat Ini), DOWNLOAD, RESET
// ==========================================
function shareWA() {
  const waNumber = document.getElementById("wa-number").value.trim();
  if (!waNumber || !lastFolderUrl) {
    alert("Mohon masukkan nomor WhatsApp dan tunggu proses Cloud selesai.");
    return;
  }

  let cleanNumber = waNumber.replace(/\D/g, "");
  if (cleanNumber.startsWith("0")) cleanNumber = "62" + cleanNumber.slice(1);

  const message = encodeURIComponent(
    `*📸 KENANGAN PAMERAN KELAS 9 PHOTOBOOTH*\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\n` +
      `Terima kasih telah berkunjung ke pameran karya kami. Hasil foto Anda sudah siap dan dapat diunduh melalui tautan Google Drive di bawah ini:\n\n` +
      `*Link Foto:* ${lastFolderUrl}\n\n` +
      `--------------------------------------------\n` +
      `* INFO SPMB TA. 2026/2027*\n\n` +
      `Dapatkan pendidikan terbaik untuk buah hati Anda. Info & Registrasi:\n` +
      ` www.ppdb.ppiabaitulmaal.sch.id\n\n` +
      `*Call & WA Center SMPIP Baitul Maal:*\n` +
      ` 021-735-8755 (Kantor)\n` +
      ` wa.me/6281284422270 (WhatsApp)\n\n` +
      `*Official Account:*\n` +
      ` Instagram: @smpip_baitul_maal\n` +
      ` YouTube: SMPIP Baitul Maal\n` +
      ` TikTok: @smpip_baitulmaal\n` +
      ` FB: Smpip Baitul Maal\n\n` +
      `--------------------------------------------\n` +
      `💻 *Sistem Photobooth ini dikembangkan oleh:*\n` +
      `Syamil Muhammad Aulia\n` +
      `🌐 https://syamil.vercel.app`,
  );

  window.open(`https://wa.me/${cleanNumber}?text=${message}`, "_blank");
  document.getElementById("wa-number").value = "";
}

function downloadImage() {
  const link = document.createElement("a");
  link.download = `Photobooth_Kelas9_${Date.now()}.jpg`;
  link.href = mainCanvas.toDataURL("image/jpeg", 0.98);
  link.click();
}

function resetApp() {
  if (confirm("Mulai sesi baru? Foto yang belum disimpan akan hilang.")) {
    location.reload();
  }
}
