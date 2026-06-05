/* ============================================================
   app.js — Логика подарочного сайта
   ============================================================ */

const API_BASE = 'https://foryou.qbeely.ru';

// ─── Дата начала отношений (ИЗМЕНИ НА СВОЮ) ─────────────────
// Формат: год, месяц (0-11), день
const TOGETHER_SINCE = new Date(2025, 9, 1); // 1 января 2024

// ─── Ключи разблокированных глав (хранятся в localStorage) ──
let unlocked = JSON.parse(localStorage.getItem('gift_unlocked') || '{}');
let allChapters = {};
let pendingChapterId = null;


// ============================================================
// INTRO SPLASH — удаляем из DOM после анимации
// ============================================================
const splash = document.getElementById('introSplash');
if (splash) {
  splash.addEventListener('animationend', () => splash.remove(), { once: true });
}

// ============================================================
// PARTICLES — плавающие частицы в hero
// ============================================================
(function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;

  const symbols = ['♥', '✦', '✧', '·', '✶', '⋆', '◇'];
  const count   = 22;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'particle';
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];

    const left     = Math.random() * 100;
    const duration = 12 + Math.random() * 18;   // 12–30s
    const delay    = Math.random() * 20;          // старт в разное время
    const size     = 0.6 + Math.random() * 0.8;  // 0.6–1.4rem

    el.style.cssText = `
      left: ${left}%;
      font-size: ${size}rem;
      animation-duration: ${duration}s;
      animation-delay: -${delay}s;
    `;

    container.appendChild(el);
  }
})();

// ============================================================
// ПАРАЛЛАКС hero-фона
// ============================================================
(function initParallax() {
  const bg = document.getElementById('heroBg');
  if (!bg) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        bg.style.transform = `translateY(${window.scrollY * 0.35}px) scale(1.1)`;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

// ============================================================
// СЧЁТЧИК ДНЕЙ ВМЕСТЕ
// ============================================================
function updateCounter() {
  const now    = new Date();
  const diff   = now - TOGETHER_SINCE;
  if (diff < 0) return; // дата в будущем — не показываем

  const totalSec  = Math.floor(diff / 1000);
  const days      = Math.floor(totalSec / 86400);
  const hours     = Math.floor((totalSec % 86400) / 3600);
  const minutes   = Math.floor((totalSec % 3600)  / 60);

  const pad = n => String(n).padStart(2, '0');

  const dEl = document.getElementById('counterDays');
  const hEl = document.getElementById('counterHours');
  const mEl = document.getElementById('counterMinutes');

  if (dEl) dEl.textContent = days;
  if (hEl) hEl.textContent = pad(hours);
  if (mEl) mEl.textContent = pad(minutes);
}

updateCounter();
setInterval(updateCounter, 30000); // обновлять каждые 30 секунд

// ============================================================
// ПРОГРЕСС РАЗБЛОКИРОВКИ
// ============================================================
function updateProgress() {
  const total      = Object.keys(allChapters).length || 5;
  const unlockedN  = Object.keys(unlocked).length;
  const pct        = total > 0 ? (unlockedN / total) * 100 : 0;

  const bar   = document.getElementById('unlockProgressBar');
  const label = document.getElementById('unlockLabel');
  if (bar)   bar.style.width = `${pct}%`;
  if (label) label.textContent = `${unlockedN} / ${total} открыто`;
}

// ============================================================
// ЗАГРУЗКА И РЕНДЕР КАРТОЧЕК
// ============================================================
async function loadChapters() {
  try {
    const res = await fetch(`${API_BASE}/chapters`);
    if (!res.ok) throw new Error('Сервер не отвечает');
    allChapters = await res.json();
    renderGrid();
    updateProgress();
  } catch (err) {
    console.error(err);
    document.getElementById('chaptersGrid').innerHTML =
      '<p style="color:var(--muted);text-align:center;grid-column:1/-1">Не удалось загрузить главы.<br>Убедись, что сервер запущен.</p>';
  }
}

// ── SVG-иконки ───────────────────────────────────────────────
const SVG_LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
  <rect x="5" y="11" width="14" height="10" rx="1.5"/>
  <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke-linecap="round"/>
  <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none"/>
</svg>`;

const SVG_UNLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
  <rect x="5" y="11" width="14" height="10" rx="1.5"/>
  <path d="M8 11V7a4 4 0 0 1 8 0" stroke-linecap="round" stroke-dasharray="2 1.5" opacity="0.4"/>
  <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none"/>
</svg>`;

// ── Форматирование обратного отсчёта ─────────────────────────
function formatCountdown(revealAt) {
  if (!revealAt) return null;
  const target = new Date(revealAt);
  const diff   = target - new Date();

  if (diff <= 0) return { text: 'Ключ готов', available: true };

  const totalSec = Math.floor(diff / 1000);
  const days    = Math.floor(totalSec / 86400);
  const hours   = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);

  const parts = [];
  if (days > 0)    parts.push(`${days} дн.`);
  if (hours > 0)   parts.push(`${hours} ч.`);
  if (minutes > 0) parts.push(`${minutes} мин.`);
  if (parts.length === 0) parts.push('< 1 мин.');

  return { text: parts.join(' '), available: false };
}

// ── Рендер карточек ──────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('chaptersGrid');
  grid.innerHTML = '';

  Object.entries(allChapters).forEach(([id, ch], idx) => {
    const isUnlocked = !!unlocked[id];
    const card = document.createElement('div');
    card.className = `chapter-card ${isUnlocked ? 'unlocked' : 'locked'}`;
    card.dataset.id = id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', isUnlocked ? `Открыть главу: ${ch.title}` : `Заблокированная глава: ${ch.title}`);

    // Таймер под заблокированными
    let countdownHTML = '';
    if (!isUnlocked && ch.reveal_at) {
      const cd = formatCountdown(ch.reveal_at);
      if (cd) {
        countdownHTML = `
          <div class="card-countdown">
            <span class="card-countdown-label">До открытия</span>
            <span class="card-countdown-time${cd.available ? ' available' : ''}" data-reveal="${ch.reveal_at}">
              ${cd.text}
            </span>
          </div>`;
      }
    }

    card.innerHTML = `
      <p class="card-index">0${idx + 1}</p>
      <div class="card-icon">${isUnlocked ? SVG_UNLOCK : SVG_LOCK}</div>
      <h3 class="card-title">${ch.title}</h3>
      <p class="card-subtitle">${isUnlocked ? ch.subtitle : '— Заблокировано —'}</p>
      ${countdownHTML}
    `;

    card.addEventListener('click', () => handleCardClick(id, isUnlocked));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') handleCardClick(id, isUnlocked);
    });

    grid.appendChild(card);
  });
}

// ── Живое обновление таймеров (каждую минуту) ─────────────────
setInterval(() => {
  document.querySelectorAll('.card-countdown-time[data-reveal]').forEach(el => {
    const cd = formatCountdown(el.dataset.reveal);
    if (!cd) return;
    el.textContent = cd.text;
    if (cd.available) el.classList.add('available');
  });
}, 30000);

function handleCardClick(id, isUnlocked) {
  if (isUnlocked) openChapterModal(id);
  else { pendingChapterId = id; openKeyModal(); }
}

// ============================================================
// МОДАЛЬНОЕ ОКНО ВВОДА КЛЮЧА
// ============================================================
function openKeyModal() {
  document.getElementById('keyInput').value = '';
  document.getElementById('keyError').textContent = '';
  document.getElementById('keyModal').classList.add('active');
  setTimeout(() => document.getElementById('keyInput').focus(), 100);
}

function closeKeyModal() {
  document.getElementById('keyModal').classList.remove('active');
  pendingChapterId = null;
}

document.getElementById('closeKeyModal').addEventListener('click', closeKeyModal);
document.getElementById('keyModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeKeyModal();
});
document.getElementById('keyInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitKey();
});
document.getElementById('submitKey').addEventListener('click', submitKey);

async function submitKey() {
  const key = document.getElementById('keyInput').value.trim();
  if (!key) return;

  const btn = document.getElementById('submitKey');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Проверяю...';

  try {
    const res = await fetch(`${API_BASE}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();

    if (data.success) {
      unlocked[data.chapterId] = data.chapter;
      localStorage.setItem('gift_unlocked', JSON.stringify(unlocked));

      if (allChapters[data.chapterId]) {
        allChapters[data.chapterId].subtitle = data.chapter.subtitle;
      }

      closeKeyModal();
      renderGrid();
      updateProgress();
      flashCard(data.chapterId);

      // Если все открыты — показать финальное окно
      const allDone = Object.keys(allChapters).every(id => !!unlocked[id]);
      if (allDone) {
        setTimeout(() => showAllUnlocked(), 900);
      } else {
        setTimeout(() => openChapterModal(data.chapterId), 600);
      }
    } else {
      document.getElementById('keyError').textContent = 'Неверный ключ. Попробуй ещё раз ✕';
      document.getElementById('keyInput').focus();
    }
  } catch (err) {
    document.getElementById('keyError').textContent = 'Ошибка соединения с сервером.';
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Открыть ✦';
  }
}

// ─── Анимация карточки при разблокировке ─────────────────────
function flashCard(id) {
  const card = document.querySelector(`.chapter-card[data-id="${id}"]`);
  if (!card) return;
  card.classList.add('just-unlocked');
  card.addEventListener('animationend', () => card.classList.remove('just-unlocked'), { once: true });
}

// ============================================================
// АУДИОПЛЕЕР
// ============================================================
const audioEl        = document.getElementById('audioEl');
const audioPlayer    = document.getElementById('audioPlayer');
const audioPlayBtn   = document.getElementById('audioPlayBtn');
const audioWaveform  = document.getElementById('audioWaveform');
const audioFill      = document.getElementById('audioFill');
const audioThumb     = document.getElementById('audioThumb');
const audioTrack     = document.getElementById('audioTrack');
const audioCurrentEl = document.getElementById('audioCurrentTime');
const audioDurEl     = document.getElementById('audioDuration');

function formatTime(sec) {
  if (isNaN(sec) || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function setPlayingState(playing) {
  audioPlayBtn.classList.toggle('playing', playing);
  audioWaveform.classList.toggle('playing', playing);
}

function initAudioPlayer(src) {
  audioEl.pause();
  audioEl.removeAttribute('src');
  audioEl.load();
  setPlayingState(false);
  audioFill.style.width = '0%';
  audioThumb.style.left = '0%';
  audioCurrentEl.textContent = '0:00';
  audioDurEl.textContent = '0:00';

  if (!src) { audioPlayer.classList.add('hidden'); return; }
  audioPlayer.classList.remove('hidden');
  audioEl.src = src;
  audioEl.load();
}

audioPlayBtn.addEventListener('click', () => {
  if (!audioEl.src) return;
  audioEl.paused ? audioEl.play() : audioEl.pause();
});

audioEl.addEventListener('play',  () => setPlayingState(true));
audioEl.addEventListener('pause', () => setPlayingState(false));
audioEl.addEventListener('ended', () => {
  setPlayingState(false);
  audioFill.style.width = '0%';
  audioThumb.style.left = '0%';
  audioCurrentEl.textContent = '0:00';
  audioEl.currentTime = 0;
});
audioEl.addEventListener('loadedmetadata', () => {
  audioDurEl.textContent = formatTime(audioEl.duration);
});
audioEl.addEventListener('timeupdate', () => {
  if (!audioEl.duration) return;
  const pct = (audioEl.currentTime / audioEl.duration) * 100;
  audioFill.style.width = `${pct}%`;
  audioThumb.style.left = `${pct}%`;
  audioCurrentEl.textContent = formatTime(audioEl.currentTime);
});

function seekTo(e) {
  if (!audioEl.duration) return;
  const rect = audioTrack.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audioEl.currentTime = pct * audioEl.duration;
}

audioTrack.addEventListener('click', seekTo);
let dragging = false;
audioTrack.addEventListener('mousedown', e => { dragging = true; seekTo(e); });
window.addEventListener('mousemove', e  => { if (dragging) seekTo(e); });
window.addEventListener('mouseup',   () => { dragging = false; });

// ============================================================
// МОДАЛЬНОЕ ОКНО ГЛАВЫ
// ============================================================
function openChapterModal(id) {
  const chapter = unlocked[id];
  if (!chapter) return;

  const img = document.getElementById('chapterImg');
  if (chapter.image) {
    img.src = chapter.image;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
  }

  const idx = Object.keys(allChapters).indexOf(id);
  document.getElementById('chapterLabel').textContent    = `Глава 0${idx + 1}`;
  document.getElementById('chapterTitle').textContent    = chapter.title;
  document.getElementById('chapterSubtitle').textContent = chapter.subtitle;
  document.getElementById('chapterText').textContent     = chapter.text;

  initAudioPlayer(chapter.audio || null);
  document.getElementById('chapterModal').classList.add('active');
}

function closeChapterModal() {
  audioEl.pause();
  setPlayingState(false);
  document.getElementById('chapterModal').classList.remove('active');
}

document.getElementById('closeChapterModal').addEventListener('click', closeChapterModal);
document.getElementById('chapterModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeChapterModal();
});

// ============================================================
// ФИНАЛЬНОЕ ОКНО — ВСЕ ГЛАВЫ ОТКРЫТЫ
// ============================================================
function showAllUnlocked() {
  const overlay = document.getElementById('allUnlockedModal');
  overlay.classList.add('active');

  // Взрыв сердечек
  const heartsContainer = document.getElementById('allUnlockedHearts');
  heartsContainer.innerHTML = '';
  const cx = 50, cy = 50; // центр (%)
  for (let i = 0; i < 24; i++) {
    const h  = document.createElement('span');
    h.className = 'burst-heart';
    h.textContent = '♥';

    const angle  = (i / 24) * 2 * Math.PI;
    const radius = 80 + Math.random() * 60;
    const tx     = Math.cos(angle) * radius;
    const ty     = Math.sin(angle) * radius;
    const delay  = Math.random() * 0.4;

    h.style.cssText = `
      left: ${cx}%;
      top:  ${cy}%;
      --tx: ${tx}px;
      --ty: ${ty}px;
      animation-delay: ${delay}s;
      font-size: ${0.7 + Math.random() * 0.8}rem;
    `;
    heartsContainer.appendChild(h);
  }
}

document.getElementById('closeAllUnlocked').addEventListener('click', () => {
  document.getElementById('allUnlockedModal').classList.remove('active');
});

// ============================================================
// ESCAPE — закрыть любое модальное окно
// ============================================================
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeKeyModal();
  closeChapterModal();
  document.getElementById('allUnlockedModal').classList.remove('active');
});

// ─── Старт ──────────────────────────────────────────────────
loadChapters();

// ============================================================
// FOOTER TYPEWRITER
// ============================================================
(function initFooterTypewriter() {
  const el = document.getElementById('footerPhrase');
  if (!el) return;

  const phrases = [
    'Сделано с ♥ специально для тебя',
    'Каждое слово — это я',
    'Ты заслуживаешь большего',
    'Всё это — правда',
    'Спасибо, что ты есть',
  ];

  let phraseIdx  = 0;
  let charIdx    = 0;
  let isDeleting = false;
  let pauseTicks = 0;

  const TYPE_SPEED   = 55;   // мс на символ при печатании
  const DELETE_SPEED = 28;   // мс на символ при стирании
  const PAUSE_AFTER  = 2600; // пауза после полной фразы
  const PAUSE_BEFORE = 400;  // пауза перед новой фразой

  function tick() {
    const current = phrases[phraseIdx];

    if (!isDeleting) {
      // Печатаем
      charIdx++;
      el.textContent = current.slice(0, charIdx);

      if (charIdx === current.length) {
        // Фраза набрана — пауза перед стиранием
        isDeleting = true;
        setTimeout(tick, PAUSE_AFTER);
        return;
      }
      setTimeout(tick, TYPE_SPEED);
    } else {
      // Стираем
      charIdx--;
      el.textContent = current.slice(0, charIdx);

      if (charIdx === 0) {
        // Стёрто — переходим к следующей фразе
        isDeleting = false;
        phraseIdx  = (phraseIdx + 1) % phrases.length;
        setTimeout(tick, PAUSE_BEFORE);
        return;
      }
      setTimeout(tick, DELETE_SPEED);
    }
  }

  // Небольшая задержка при первом запуске
  setTimeout(tick, 800);
})();
