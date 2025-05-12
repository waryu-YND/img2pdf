const input = document.getElementById("fileInput");
const btn = document.getElementById("makePdf");
const fileNameEl = document.getElementById("fileName");
const thumbStrip = document.querySelector(".thumbnails");
let rafId;
const SPEED = 60;

input.addEventListener("change", async () => {
  if (rafId) cancelAnimationFrame(rafId);
  thumbStrip.innerHTML = "";

  const files = Array.from(input.files);
  btn.disabled = files.length === 0;
  if (!files.length) return;

  const urls = await Promise.all(
    files.map(
      (f) =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(r.error);
          r.readAsDataURL(f);
        })
    )
  );

  let base = urls.slice();
  while (base.length < 4) base.push(urls[base.length % urls.length]);

  const seq = [...base, ...base, ...base];
  let loaded = 0,
    total = seq.length;
  seq.forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    img.onload = () => {
      if (++loaded === total) startScroll(base.length);
    };
    thumbStrip.append(img);
  });
});

function startScroll(baseCount) {
  const firstImg = thumbStrip.querySelector("img");
  const style = getComputedStyle(firstImg);
  const marginR = parseFloat(style.marginRight);
  const imgW = firstImg.getBoundingClientRect().width;
  const baseW = baseCount * (imgW + marginR);

  let offset = baseW;
  thumbStrip.style.transform = `translateX(${-offset}px) translateY(-50%)`;

  let lastTime = performance.now();
  function step(now) {
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    offset += SPEED * delta;
    if (offset >= baseW * 2) offset -= baseW;

    thumbStrip.style.transform = `translateX(${-offset}px) translateY(-50%)`;
    rafId = requestAnimationFrame(step);
  }
  rafId = requestAnimationFrame(step);
}

function compressImage(file, { maxWidth = 1200, quality = 0.5 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const img = new Image();
    reader.onload = () => (img.src = reader.result);
    reader.onerror = () => reject(reader.error);

    img.onload = () => {
      const ratio = img.width / img.height;
      const width = Math.min(img.width, maxWidth);
      const height = width / ratio;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("画像の読み込み失敗"));
    reader.readAsDataURL(file);
  });
}

btn.addEventListener("click", async () => {
  const files = Array.from(input.files);
  if (!files.length) return;

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "px", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < files.length; i++) {
    const dataUrl = await compressImage(files[i], {
      maxWidth: 1200,
      quality: 0.5,
    });
    const props = pdf.getImageProperties(dataUrl);
    const imgW = pageW;
    const imgH = (props.height * pageW) / props.width;
    const x = (pageW - imgW) / 2;
    const y = (pageH - imgH) / 2;

    pdf.addImage(dataUrl, "JPEG", x, y, imgW, imgH);
    if (i < files.length - 1) pdf.addPage();
  }
  const name = fileNameEl.value.trim() || "images.pdf";
  const filename = name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;

  pdf.save(filename);
});
