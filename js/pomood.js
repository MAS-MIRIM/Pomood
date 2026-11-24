  const stage  = document.getElementById('stage');
  const letter = document.getElementById('letter');
  const input  = letter.querySelector('input');
  const button = letter.querySelector('button');

  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', fit);
  fit();

  function openEnvelope() {
    if (stage.classList.contains('open') || stage.classList.contains('viewer')) return;
    stage.classList.add('open');
    stage.removeAttribute('role');
    stage.removeAttribute('aria-label');
    stage.removeAttribute('tabindex');
    document.body.style.cursor = '';
  }

  // 화면 어디를 눌러도 열리도록 (여백 포함)
  document.addEventListener('click', openEnvelope);
  document.body.style.cursor = 'pointer';
  stage.addEventListener('keydown', e => {
    if (e.target !== stage) return;   // 입력창/편지 내용(contenteditable)에서 누른 스페이스·엔터는 건드리지 않음
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnvelope(); }
  });

  const scene = document.getElementById('scene');

  // 1) 편지지가 다 올라오면 → 잠깐 쉬었다가 확대 + 타이틀 퇴장
  letter.addEventListener('transitionend', e => {
    if (e.propertyName !== 'transform' || stage.classList.contains('zoom')) return;
    setTimeout(() => stage.classList.add('zoom'), 250);
  });

  // 2) 확대가 끝나면 입력 가능하게
  scene.addEventListener('transitionend', e => {
    if (e.target !== scene || e.propertyName !== 'transform') return;
    stage.classList.add('done');
    input.tabIndex = 0; button.tabIndex = 0;
    input.focus({ preventScroll: true });
  });

  // ===== 편지쓰기 → 엽서 페이지 =====
  const toName = document.getElementById('to-name');

  function fitName() {
    toName.style.fontSize = "26px";
    let size = 26;
    while (toName.scrollWidth > toName.clientWidth && size > 14) {
      size -= 1; toName.style.fontSize = size + 'px';
    }
  }

  function goNext() {
    const name = input.value.trim();
    if (!name) {                       // 이름을 안 적었으면 입력창만 흔들기
      input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
      input.focus();
      return;
    }
    toName.textContent = name;         // 입력한 이름을 "To" 줄에 표시
    fitName();
    input.blur();
    state.name = name;
    state.message = '';
    msg.textContent = '';
    checkMsg();
    stage.classList.add('next');
    document.body.classList.add('next');
    document.getElementById('page2').setAttribute('aria-hidden', 'false');
    setTimeout(() => msg.focus({ preventScroll: true }), 1400);   // 바로 내용을 쓸 수 있게
  }

  button.addEventListener('click', goNext);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); goNext(); }
  });
  if (document.fonts) document.fonts.ready.then(() => { if (toName.textContent) fitName(); });

  // ===== 입력한 값(다음 페이지에서 이어서 쓸 수 있게 보관) =====
  // 우표를 안 고르면 쓰는 기본 우표. 확장자를 모르는 경우를 위해 흔한 확장자를 차례로 찾아봄 (찾은 경로를 DEFAULT_STAMP에 저장)
  const DEFAULT_STAMP_BASE = '../assets/postage_stamps';
  let DEFAULT_STAMP = DEFAULT_STAMP_BASE + '.webp';
  const defaultStampReady = (async () => {
    for (const ext of ['.webp', '.png', '.jpg', '.jpeg', '.svg', '.avif', '.gif']) {
      const src = DEFAULT_STAMP_BASE + ext;
      const ok = await new Promise(r => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = src; });
      if (ok) { DEFAULT_STAMP = src; return src; }
    }
    console.warn('기본 우표 이미지를 찾지 못했어요:', DEFAULT_STAMP_BASE + '.*');
    return DEFAULT_STAMP;
  })();
  const DEFAULT_ENV_COLOR = '#eeeeea';                     // 봉투 기본 색 (처음 보이는 봉투 사진 색)
  const state = { name: '', message: '', stampFile: null, stampUrl: '', envColor: '', sender: '' };

  // ===== 1단계: 엽서 내용 (최대 4줄) → next 버튼 =====
  const msg   = document.getElementById('msg');
  const next2 = document.getElementById('p2-next');
  function fitMessageToPostcard(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const style = getComputedStyle(msg);
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const columnWidth = 380;
    const maxLines = 8; // four ruled lines on each side
    let lineCount = 1;
    let lineWidth = 0;

    for (let i = 0; i < text.length;) {
      const codePoint = text.codePointAt(i);
      const character = String.fromCodePoint(codePoint);
      const nextIndex = i + character.length;
      if (character === '\n') {
        lineCount += 1;
        lineWidth = 0;
        if (lineCount > maxLines) return text.slice(0, i);
        i = nextIndex;
        continue;
      }
      const width = context.measureText(character).width;
      if (lineWidth > 0 && lineWidth + width > columnWidth) {
        lineCount += 1;
        lineWidth = 0;
        if (lineCount > maxLines) return text.slice(0, i);
      }
      lineWidth += width;
      i = nextIndex;
    }
    return text;
  }

  function readMessage() {
    return (msg.innerText || msg.textContent || '').replace(/\r\n?/g, '\n');
  }
  function checkMsg(event) {
    if (event && event.isComposing) return;
    const typed = readMessage();
    const fitted = fitMessageToPostcard(typed);
    if (fitted !== typed) {
      msg.textContent = fitted;
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(msg);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    state.message = fitted;
    next2.classList.toggle('show', fitted.trim().length > 0);
    pc5Msg.textContent = fitted;
  }
  msg.addEventListener('input', checkMsg);
  msg.addEventListener('compositionend', checkMsg);

  // ===== next → 2단계: 우표 =====
  const page3 = document.getElementById('page3');
  next2.addEventListener('click', () => {
    if (!readMessage().trim()) return;
    state.message = readMessage();
    msg.blur();
    stage.classList.add('stamp');
    page3.setAttribute('aria-hidden', 'false');
    setTimeout(() => next3.classList.add('show'), 1500);   // 우표를 안 올려도 next 가능 (페이지 전환/안내 문구가 끝난 뒤 등장)
  });

  // ===== 2단계: 우표 이미지 업로드 → next 버튼 =====
  const stamp     = document.getElementById('stamp');
  const stampPic  = document.getElementById('stamp-photo');
  const stampFile = document.getElementById('stamp-file');
  const next3     = document.getElementById('p3-next');

  function setStampImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (state.stampFile && state.stampUrl) URL.revokeObjectURL(state.stampUrl);   // 업로드한 blob만 해제
    state.stampFile = file;
    state.stampUrl = URL.createObjectURL(file);
    stampPic.src = state.stampUrl;
    stamp.classList.add('has-photo');
    next3.classList.add('show');
  }
  document.getElementById('stamp-upload').addEventListener('click', () => stampFile.click());
  stampPic.addEventListener('click', () => stampFile.click());           // 다른 이미지로 교체
  stampFile.addEventListener('change', () => { setStampImage(stampFile.files[0]); stampFile.value = ''; });

  // 파일을 우표 위로 끌어다 놓아도 업로드
  ['dragenter', 'dragover'].forEach(t => stamp.addEventListener(t, e => { e.preventDefault(); stamp.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(t => stamp.addEventListener(t, e => { e.preventDefault(); stamp.classList.remove('dragover'); }));
  stamp.addEventListener('drop', e => setStampImage(e.dataTransfer.files[0]));

  // ===== next → 3단계: 봉투 색깔 =====
  const page4 = document.getElementById('page4');
  next3.addEventListener('click', () => {
    if (!state.stampFile) state.stampUrl = DEFAULT_STAMP;   // 안 올렸으면 기본 우표
    stage.classList.add('env');
    page4.setAttribute('aria-hidden', 'false');
    setTimeout(() => next4.classList.add('show'), 1500);    // 색을 안 골라도 next 가능 (페이지 전환/안내 문구가 끝난 뒤 등장)
  });

  // ===== 3단계: 봉투 색 고르기 =====
  const envMatrix = document.getElementById('envMatrix');
  const next4  = document.getElementById('p4-next');
  const swatches = [...document.querySelectorAll('.sw')];
  const palBtn = document.getElementById('pal-btn');
  const pop    = document.getElementById('pal-pop');
  const svWrap = document.getElementById('pal-sv-wrap');
  const sv     = document.getElementById('pal-sv');
  const dot    = document.getElementById('pal-dot');
  const hueEl  = document.getElementById('pal-hue');
  const hexEl  = document.getElementById('pal-hex');
  const prevEl = document.getElementById('pal-prev');

  const hexToRgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const rgbToHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  function hsvToRgb(h, s, v) {
    const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5) * 255, f(3) * 255, f(1) * 255];
  }
  function rgbToHsv([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s: max ? d / max : 0, v: max };
  }

  // 봉투에 색 입히기 (처음 색 = 원래 사진 색)
  let envRGB = [238, 238, 234], envAnim = 0;
  function paintEnv(rgb) {
    envRGB = rgb;
    const [r, g, b] = rgb.map(v => (v / 255).toFixed(4));
    envMatrix.setAttribute('values', `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`);
  }
  function tweenEnv(to, ms = 380) {                       // 부드럽게 색 전환
    cancelAnimationFrame(envAnim);
    const from = envRGB.slice(), t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      paintEnv(from.map((v, i) => v + (to[i] - v) * e));
      if (k < 1) envAnim = requestAnimationFrame(step);
    };
    envAnim = requestAnimationFrame(step);
  }
  function chosen(hex) {                                  // 색이 정해지면 next 표시
    state.envColor = hex;
    next4.classList.add('show');
  }

  // --- 미리 만든 색 5개
  swatches.forEach(sw => sw.addEventListener('click', () => {
    const hex = sw.dataset.color;
    swatches.forEach(x => x.classList.toggle('sel', x === sw));
    palBtn.classList.remove('custom');
    tweenEnv(hexToRgb(hex));
    syncPalette(hexToRgb(hex));
    chosen(hex);
  }));

  // --- 팔레트: 채도/명도 사각형 + 색상 슬라이더 + 색 코드
  const hsv = { h: 217, s: .46, v: .46 };
  function drawSV() {
    const c = sv.getContext('2d'), w = sv.width, h = sv.height;
    c.fillStyle = `hsl(${hsv.h} 100% 50%)`; c.fillRect(0, 0, w, h);
    let g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  function syncPalette(rgb) {                             // 팔레트 UI를 현재 색에 맞춤
    Object.assign(hsv, rgbToHsv(rgb));
    hueEl.value = Math.round(hsv.h);
    drawSV(); placeDot();
    const hex = rgbToHex(rgb);
    hexEl.value = hex.toUpperCase(); prevEl.style.background = hex;
  }
  function placeDot() { dot.style.left = (hsv.s * 100) + '%'; dot.style.top = ((1 - hsv.v) * 100) + '%'; }
  function applyHsv() {                                   // 팔레트에서 고른 색 적용
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v), hex = rgbToHex(rgb);
    hexEl.value = hex.toUpperCase(); prevEl.style.background = hex;
    swatches.forEach(x => x.classList.remove('sel'));
    palBtn.classList.add('custom'); palBtn.style.setProperty('--cc', hex);
    paintEnv(rgb);
    chosen(hex);
  }
  function pickSV(e) {
    const r = svWrap.getBoundingClientRect();
    hsv.s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    hsv.v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    placeDot(); applyHsv();
  }
  svWrap.addEventListener('pointerdown', e => { svWrap.setPointerCapture(e.pointerId); pickSV(e); });
  svWrap.addEventListener('pointermove', e => { if (svWrap.hasPointerCapture(e.pointerId)) pickSV(e); });
  hueEl.addEventListener('input', () => { hsv.h = +hueEl.value; drawSV(); applyHsv(); });
  hexEl.addEventListener('input', () => {
    const v = hexEl.value.trim().replace(/^#?/, '#');
    if (!/^#[0-9a-f]{6}$/i.test(v)) return;
    const rgb = hexToRgb(v); Object.assign(hsv, rgbToHsv(rgb));
    hueEl.value = Math.round(hsv.h); drawSV(); placeDot(); applyHsv();
  });

  function togglePalette(open) {
    open = open ?? !pop.classList.contains('open');
    pop.classList.toggle('open', open);
    palBtn.setAttribute('aria-expanded', open);
  }
  palBtn.addEventListener('click', e => { e.stopPropagation(); togglePalette(); });
  document.addEventListener('click', e => { if (!pop.contains(e.target) && e.target !== palBtn && !palBtn.contains(e.target)) togglePalette(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') togglePalette(false); });
  syncPalette(envRGB);

  // ===== next → 4단계: 만든 것 한데 모아 보여주기 + 받는 사람 이름 =====
  const page5   = document.getElementById('page5');
  const pc5Name = document.getElementById('pc5-name');
  const pc5Msg  = document.getElementById('pc5-msg');
  const pc5Photo = document.getElementById('pc5-photo');
  const p5Name  = document.getElementById('p5-name');
  const seal    = document.getElementById('p5-seal');

  function fitEl(el) {                                    // 한 줄에 안 들어가면 글자를 줄임
    let size = 26; el.style.fontSize = size + 'px';
    while (el.scrollWidth > el.clientWidth && size > 14) { size -= 1; el.style.fontSize = size + 'px'; }
  }

  const pc5El = document.getElementById('pc5');
  function renderPreview() {                              // 오른쪽 엽서에 받는 사람 + 내용 그리기
    pc5Name.textContent = state.name; fitEl(pc5Name);
    pc5Msg.textContent = state.message;
    pc5Msg.style.visibility = 'visible';
    void pc5El.offsetWidth;                               // 강제 리플로우로 바로 다시 그리게
  }

  next4.addEventListener('click', () => {
    if (!state.envColor) state.envColor = DEFAULT_ENV_COLOR;   // 안 골랐으면 기본 색
    togglePalette(false);
    state.message = readMessage();
    pc5Photo.src = state.stampUrl;                         // 고른 우표 이미지
    stage.classList.add('p5');
    document.body.classList.add('p5');
    renderPreview();
    requestAnimationFrame(() => requestAnimationFrame(renderPreview));
    setTimeout(renderPreview, 1700);                       // 봉투 등장 애니메이션이 끝난 뒤 한 번 더
    page5.setAttribute('aria-hidden', 'false');
    setSealColors(state.envColor);                         // 고른 색으로 봉투 칠하기
    senderInk(state.envColor);                             // 봉투 색에 어울리는 글자색
    // Clear browser-restored values when starting a new postcard.
    p5Name.value = '';
    state.sender = '';
    sender.textContent = '';
    seal.classList.remove('show');
    setTimeout(() => p5Name.focus({ preventScroll: true }), 1600);
  });

  // 보내는 사람 이름을 쓰면 → 봉투 오른쪽 아래에 그대로 적히고 + '봉투 봉하기' 버튼이 나타남
  const sender = document.getElementById('env5-sender');
  function setSender(name) {                              // 봉투 오른쪽 아래에 "From. 이름"으로 표시
    sender.textContent = name.trim() ? 'From. ' + name.trim() : '';
    fitEl(sender);
  }
  function senderInk(hex) {                               // 밝은 봉투면 진하게, 어두운 봉투면 밝게
    const [r, g, b] = hexToRgb(hex).map(v => v / 255);
    const lum = .2126 * r + .7152 * g + .0722 * b;
    const mix = (c, t, k) => c.map((v, i) => Math.round(v * (1 - k) + t * k));
    const rgb = hexToRgb(hex);
    const c = lum > .45 ? mix(rgb, 0, .62) : mix(rgb, 255, .78);
    sender.style.setProperty('--sender-ink', `rgba(${c.join(',')}, .88)`);
  }
  p5Name.addEventListener('input', () => {
    state.sender = p5Name.value;
    renderPreview();
    setSender(state.sender);
    seal.classList.toggle('show', state.sender.trim().length > 0);
  });


  // ===== 봉투 SVG 색 (고른 색 = 가장 밝은 면, 나머지는 같은 비율로 어둡게) =====
  const sealEl = document.getElementById('seal');
  function setSealColors(hex) {
    const C = hexToRgb(hex);
    const mul = k => `rgb(${C.map((v, i) => Math.min(255, Math.round(v * k[i]))).join(',')})`;
    const S = stage.style;
    S.setProperty('--s-pocket',    mul([1, 1, 1]));
    S.setProperty('--s-side',      mul([.955, .951, .951]));
    S.setProperty('--s-back',      mul([.9375, .943, .943]));
    S.setProperty('--s-flapback',  mul([.9375, .943, .943]));
    S.setProperty('--s-flapfront', mul([1.036, 1.032, 1.033]));
    S.setProperty('--s-shade',     mul([.84, .826, .82]));
  }

  // ===== 봉투 봉하기: 밝아지고 → 엽서가 똑바로 서서 봉투로 들어가고 → 뚜껑이 닫히고 → 링크 카드 =====
  const page6  = document.getElementById('page6');
  const lcUrl  = document.getElementById('lc-url');
  const lcCopy = document.getElementById('lc-copy');
  const lcRestart = document.getElementById('lc-restart');
  let sealing = false;

  function sealEnvelope() {
    if (sealing || !state.sender.trim()) return;
    sealing = true;
    pc5Msg.textContent = state.message;
    pc5Msg.style.visibility = 'visible';
    p5Name.blur();
    stage.classList.add('sealing');                                   // 화면 밝아지고 왼쪽 글씨 퇴장
    buildLink().then(url => {                                         // 이 사이에 링크 생성
      state.link = url; lcUrl.value = url; lcCopy.disabled = false;
    }).catch(() => { lcUrl.value = '링크를 만들지 못했어요. 다시 시도해 주세요'; });
    requestAnimationFrame(() => requestAnimationFrame(() => sealEl.classList.add('upright', 'hover')));  // 봉투 세우기 + 엽서 위로
    setTimeout(() => sealEl.classList.add('inside'), 1600);          // 엽서가 봉투 안으로
    setTimeout(() => sealEl.classList.add('closed'), 2750);          // 뚜껑 닫힘
    setTimeout(() => {                                                // 다시 어두워지며 링크 카드
      stage.classList.add('linked'); document.body.classList.add('linked');
      page6.setAttribute('aria-hidden', 'false');
    }, 3950);
  }
  seal.addEventListener('click', sealEnvelope);
  p5Name.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sealEnvelope(); } });

  // ===== 링크 만들기: 내용을 전부 링크(#c=...) 안에 담음 → 서버 없이 동작 (내용은 주소 # 뒤에만 있어서 서버로 전송되지 않음) =====
  const b64u = bytes => {
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64u = str => {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  };

  async function shrinkStamp() {                         // 우표 사진을 링크에 넣을 수 있게 작게 (우표 창과 같은 비율로 가운데 크롭)
    if (!state.stampFile || !state.stampUrl) return new Uint8Array(0);   // 기본 우표는 링크에 안 넣음
    const img = new Image(); img.src = state.stampUrl; await img.decode();
    const tries = [[200, .72], [180, .64], [160, .56], [140, .5], [120, .45]];
    let blob;
    for (const [w, q] of tries) {
      const h = Math.round(w * 592.3 / 464.6), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const k = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / k, sh = h / k;
      cv.getContext('2d').drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
      blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
      if (blob.size <= 6500) break;
    }
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function buildLink() {
    const meta = new TextEncoder().encode(JSON.stringify({ v: 1, to: state.name, msg: state.message, from: state.sender, c: state.envColor, ds: state.stampFile ? 0 : 1 }));
    const img = await shrinkStamp();
    const buf = new Uint8Array(4 + meta.length + img.length);
    new DataView(buf.buffer).setUint32(0, meta.length);
    buf.set(meta, 4); buf.set(img, 4 + meta.length);
    return location.href.split('#')[0] + '#c=' + b64u(buf);
  }
  function parseLink(hash) {
    const buf = unb64u(hash.slice(3));
    const n = new DataView(buf.buffer, buf.byteOffset).getUint32(0);
    const meta = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + n)));
    return { meta, img: buf.subarray(4 + n) };
  }

  lcCopy.addEventListener('click', async () => {
    if (!state.link) return;
    try { await navigator.clipboard.writeText(state.link); }
    catch { lcUrl.select(); document.execCommand('copy'); }
    lcCopy.textContent = '복사됨!'; setTimeout(() => { lcCopy.textContent = '링크 복사'; }, 1600);
  });
  lcUrl.addEventListener('focus', () => lcUrl.select());
  lcRestart.addEventListener('click', () => location.assign(location.pathname + location.search));

  // ===== 받는 사람 화면(임시): 링크로 들어오면 닫힌 봉투 → 눌러서 열면 엽서가 크게 나옴 =====
  function startViewer(hash) {
    let data;
    try { data = parseLink(hash); } catch { return; }
    const m = data.meta;
    state.name = m.to || ''; state.message = m.msg || ''; state.sender = m.from || ''; state.envColor = m.c || '#efefeb';
    pc5Name.textContent = state.name; fitEl(pc5Name);
    pc5Msg.textContent = state.message;
    if (data.img.length) pc5Photo.src = URL.createObjectURL(new Blob([data.img], { type: 'image/jpeg' }));
    else defaultStampReady.then(src => { pc5Photo.src = src; });
    setSender(state.sender);
    setSealColors(state.envColor); senderInk(state.envColor);
    stage.removeAttribute('role'); stage.removeAttribute('aria-label'); stage.removeAttribute('tabindex');
    document.body.style.cursor = '';
    stage.classList.add('viewer', 'notrans');
    sealEl.classList.add('upright', 'hover', 'inside', 'closed');     // 처음부터 닫힌 봉투 상태
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('notrans')));
    let opened = false;
    stage.addEventListener('click', () => {
      if (opened) return; opened = true; stage.classList.add('opened');
      sealEl.classList.add('cracked');                                // 왁스 봉인이 깨짐
      setTimeout(() => sealEl.classList.remove('closed'), 800);       // 왁스가 깨진 뒤 뚜껑 열림
      setTimeout(() => sealEl.classList.remove('inside'), 1800);      // 엽서가 위로 올라옴
      setTimeout(() => stage.classList.add('reveal'), 2900);          // 엽서가 화면 가운데로 크게
    });
  }
  // Only a valid postcard link opens the viewer; normal reload starts a fresh composition.
  if (/^#c=[A-Za-z0-9_-]+$/.test(location.hash)) startViewer(location.hash);

  // ===== 왁스 이미지 배경 지우기: 가장자리에서 시작해 배경색과 비슷한 픽셀을 투명하게 (이미 투명하면 건너뜀) =====
  (function cleanWax() {
    const img = document.querySelector('#wax img');
    if (!img) return;
    let done = false;
    function run() {
      if (done || !img.naturalWidth) return;
      done = true;
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const im = ctx.getImageData(0, 0, w, h), d = im.data;      // file:// 로 열면 보안상 여기서 막힐 수 있음 → catch
        const at = (x, y) => (y * w + x) * 4;
        const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
        if (corners.every(([x, y]) => d[at(x, y) + 3] < 10)) return;   // 이미 투명 배경
        let br = 0, bg = 0, bb = 0;                                    // 배경색 = 네 모서리 평균
        corners.forEach(([x, y]) => { const i = at(x, y); br += d[i]; bg += d[i + 1]; bb += d[i + 2]; });
        br /= 4; bg /= 4; bb /= 4;
        const T = 60, SOFT = 35;                                       // T 이내는 완전 투명, 그 바깥 SOFT까지는 가장자리를 부드럽게
        const dist = i => Math.hypot(d[i] - br, d[i + 1] - bg, d[i + 2] - bb);
        const seen = new Uint8Array(w * h), stack = [];
        const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const k = y * w + x; if (seen[k]) return; seen[k] = 1; stack.push(k); };
        for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
        for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
        while (stack.length) {
          const k = stack.pop(), i = k * 4, dd = dist(i);
          if (dd < T) {
            d[i + 3] = 0;
            const x = k % w, y = (k / w) | 0;
            push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
          } else if (dd < T + SOFT) {
            d[i + 3] = Math.round(255 * (dd - T) / SOFT);              // 경계는 부드럽게
          }
        }
        ctx.putImageData(im, 0, 0);
        img.src = cv.toDataURL('image/png');
      } catch (err) {
        img.style.mixBlendMode = 'multiply';                          // 읽기가 막히면 흰 배경만이라도 안 보이게
        console.warn('왁스 배경 자동 제거 실패(로컬 file:// 이면 서버로 열어보세요):', err);
      }
    }
    if (img.complete) run(); else img.addEventListener('load', run, { once: true });
  })();
