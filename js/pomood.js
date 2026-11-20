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
  const state = { name: '', message: '', stampFile: null, stampUrl: '', envColor: '', sender: '' };

  // ===== 1단계: 엽서 내용 (최대 4줄) → next 버튼 =====
  const msg   = document.getElementById('msg');
  const next2 = document.getElementById('p2-next');
  let lastMsg = '';

  function checkMsg() {
    if (msg.scrollHeight > msg.clientHeight + 1) {      // 4줄을 넘으면 직전 내용으로 되돌림
      const pos = Math.max(0, msg.selectionStart - (msg.value.length - lastMsg.length));
      msg.value = lastMsg;
      msg.setSelectionRange(pos, pos);
    } else {
      lastMsg = msg.value;
    }
    state.message = msg.value;
    next2.classList.toggle('show', msg.value.trim().length > 0);
  }
  msg.addEventListener('input', e => {
    state.message = msg.value;                           // 한글 조합 중에도 최신 내용을 보관
    next2.classList.toggle('show', msg.value.trim().length > 0);
    if (!e.isComposing) checkMsg();
  });
  msg.addEventListener('compositionend', checkMsg);

  // ===== next → 2단계: 우표 =====
  const page3 = document.getElementById('page3');
  next2.addEventListener('click', () => {
    if (!msg.value.trim()) return;
    state.message = msg.value;
    msg.blur();
    stage.classList.add('stamp');
    page3.setAttribute('aria-hidden', 'false');
  });

  // ===== 2단계: 우표 이미지 업로드 → next 버튼 =====
  const stamp     = document.getElementById('stamp');
  const stampPic  = document.getElementById('stamp-photo');
  const stampFile = document.getElementById('stamp-file');
  const next3     = document.getElementById('p3-next');

  function setStampImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (state.stampUrl) URL.revokeObjectURL(state.stampUrl);
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
    if (!state.stampFile) return;
    stage.classList.add('env');
    page4.setAttribute('aria-hidden', 'false');
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

  next4.addEventListener('click', () => {
    if (!state.envColor) return;
    togglePalette(false);
    pc5Name.textContent = state.name; fitEl(pc5Name);      // To. 이름
    pc5Msg.textContent  = (state.message && state.message.trim()) ? state.message : msg.value;   // 쓴 내용
    pc5Photo.src = state.stampUrl;                         // 고른 우표 이미지
    stage.classList.add('p5');
    document.body.classList.add('p5');
    page5.setAttribute('aria-hidden', 'false');
    setSealColors(state.envColor);                         // 고른 색으로 봉투 칠하기
    senderInk(state.envColor);                             // 봉투 색에 어울리는 글자색
    setTimeout(() => p5Name.focus({ preventScroll: true }), 1600);
  });

  // 보내는 사람 이름을 쓰면 → 봉투 오른쪽 아래에 그대로 적히고 + '봉투 봉하기' 버튼이 나타남
  const sender = document.getElementById('env5-sender');
  function senderInk(hex) {                               // 밝은 봉투면 진하게, 어두운 봉투면 밝게
    const [r, g, b] = hexToRgb(hex).map(v => v / 255);
    const lum = .2126 * r + .7152 * g + .0722 * b;
    const mix = (c, t, k) => c.map((v, i) => Math.round(v * (1 - k) + t * k));
    const rgb = hexToRgb(hex);
    const c = lum > .45 ? mix(rgb, 0, .62) : mix(rgb, 255, .78);
    sender.style.setProperty('--sender-ink', `rgba(${c.join(',')}, .88)`);
  }
  p5Name.addEventListener('input', () => {
    state.sender = p5Name.value.trim();
    sender.textContent = state.sender;
    fitEl(sender);
    seal.classList.toggle('show', state.sender.length > 0);
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
  let sealing = false;

  function sealEnvelope() {
    if (sealing || !state.sender) return;
    sealing = true;
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
    if (!state.stampUrl) return new Uint8Array(0);
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
    const meta = new TextEncoder().encode(JSON.stringify({ v: 1, to: state.name, msg: state.message, from: state.sender, c: state.envColor }));
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

  // ===== 받는 사람 화면(임시): 링크로 들어오면 닫힌 봉투 → 눌러서 열면 엽서가 크게 나옴 =====
  function startViewer(hash) {
    let data;
    try { data = parseLink(hash); } catch { return; }
    const m = data.meta;
    state.name = m.to || ''; state.message = m.msg || ''; state.sender = m.from || ''; state.envColor = m.c || '#efefeb';
    pc5Name.textContent = state.name; fitEl(pc5Name);
    pc5Msg.textContent = state.message;
    if (data.img.length) pc5Photo.src = URL.createObjectURL(new Blob([data.img], { type: 'image/jpeg' }));
    sender.textContent = state.sender; fitEl(sender);
    setSealColors(state.envColor); senderInk(state.envColor);
    stage.removeAttribute('role'); stage.removeAttribute('aria-label'); stage.removeAttribute('tabindex');
    document.body.style.cursor = '';
    stage.classList.add('viewer', 'notrans');
    sealEl.classList.add('upright', 'hover', 'inside', 'closed');     // 처음부터 닫힌 봉투 상태
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('notrans')));
    let opened = false;
    stage.addEventListener('click', () => {
      if (opened) return; opened = true; stage.classList.add('opened');
      sealEl.classList.remove('closed');                              // 뚜껑 열림
      setTimeout(() => sealEl.classList.remove('inside'), 1000);      // 엽서가 위로 올라옴
      setTimeout(() => stage.classList.add('reveal'), 2100);          // 엽서가 화면 가운데로 크게
    });
  }
  if (/^#c=/.test(location.hash)) startViewer(location.hash);
