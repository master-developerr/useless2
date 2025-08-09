(function () {
  const EXT_NAMESPACE = 'DramaLounge';

  // ————————————————————————————————————————————
  // Moods provided by moods.js
  // ————————————————————————————————————————————
  const moodLines = window.DramaLoungeMoods || {};

  // ————————————————————————————————————————————
  // Utility helpers
  // ————————————————————————————————————————————
  function sampleRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function log(message, data) {
    try {
      chrome.runtime.sendMessage({ type: 'DRAMALOUNGE_LOG', payload: { message, data } });
    } catch (_) {
      // ignore in case of CSP or context teardown
    }
  }

  // ————————————————————————————————————————————
  // Speech bubble UI
  // ————————————————————————————————————————————
  let activeBubble; // HTMLElement | undefined
  let hideTimerId; // number | undefined
  let activeOverlays = []; // Array<HTMLElement | { remove():void }>

  function ensureContainer() {
    // No container necessary; bubble is standalone
    return document.body || document.documentElement;
  }

  function createBubble(moodName, text) {
    const bubble = document.createElement('div');
    bubble.className = 'dramalounge-bubble';
    bubble.setAttribute('data-mood', moodName);

    const header = document.createElement('div');
    header.className = 'dramalounge-header';

    const dot = document.createElement('span');
    dot.className = 'dramalounge-dot';
    dot.style.background = moodColor(moodName);

    const close = document.createElement('button');
    close.className = 'dramalounge-close';
    close.setAttribute('aria-label', 'Close DramaLounge');
    close.textContent = '×';
    close.addEventListener('click', () => hideBubble());

    header.appendChild(dot);

    const body = document.createElement('div');
    body.className = 'dramalounge-body';
    body.textContent = text;

    bubble.appendChild(header);
    bubble.appendChild(body);
    bubble.appendChild(close);

    return bubble;
  }

  function moodColor(moodName) {
    switch (moodName) {
      case 'bored': return '#94a3b8';
      case 'excited': return '#f59e0b';
      case 'jealous': return '#10b981';
      case 'judgy': return '#ef4444';
      case 'clingy': return '#8b5cf6';
      case 'alert': return '#0ea5e9';
      default: return '#0ea5e9';
    }
  }

  function showBubble(moodName, text, durationMs = 4000) {
    const host = ensureContainer();
    if (!host) return;

    if (activeBubble && activeBubble.parentNode) {
      activeBubble.parentNode.removeChild(activeBubble);
    }
    if (hideTimerId) {
      clearTimeout(hideTimerId);
    }

    const bubble = createBubble(moodName, text);
    host.appendChild(bubble);
    // Position at a random place within viewport (safe margins)
    try {
      const margin = 10;
      const rect = bubble.getBoundingClientRect();
      const w = Math.min(rect.width || 320, window.innerWidth - margin * 2);
      const h = Math.min(rect.height || 80, window.innerHeight - margin * 2);
      const maxX = Math.max(margin, window.innerWidth - w - margin);
      const maxY = Math.max(margin, window.innerHeight - h - margin);
      const x = Math.floor(margin + Math.random() * (maxX - margin));
      const y = Math.floor(margin + Math.random() * (maxY - margin));
      bubble.style.left = x + 'px';
      bubble.style.top = y + 'px';
    } catch (_) {}
    // trigger CSS transition
    requestAnimationFrame(() => bubble.classList.add('show'));

    activeBubble = bubble;
    hideTimerId = setTimeout(() => hideBubble(), durationMs);
  }

  function hideBubble() {
    if (!activeBubble) return;
    activeBubble.classList.remove('show');
    const bubbleToRemove = activeBubble;
    activeBubble = undefined;
    setTimeout(() => {
      if (bubbleToRemove && bubbleToRemove.parentNode) {
        bubbleToRemove.parentNode.removeChild(bubbleToRemove);
      }
    }, 200);
  }

  // ————————————————————————————————————————————
  // Sound disabled
  // ————————————————————————————————————————————
  function playSound(_) { /* sounds disabled by request */ }

  // ————————————————————————————————————————————
  // Mood trigger API
  // ————————————————————————————————————————————
  function triggerMood(moodName, overrideText) {
    const lines = moodLines[moodName] || [];
    const text = overrideText || (lines.length ? sampleRandom(lines) : undefined);
    if (!text) return;
    console.log(`[DramaLounge] Mood: ${moodName} → "${text}"`);
    showBubble(moodName, text);
    playSound(moodName);
    triggerEffect(moodName);

    // Removed: tab close behavior
  }

  // Expose for debugging and for easter egg overlay management
  window.DramaLounge = {
    triggerMood,
    registerOverlay: (overlayOrHandle) => {
      try { if (overlayOrHandle) activeOverlays.push(overlayOrHandle); } catch (_) {}
    },
    clearOverlays: () => clearActiveOverlays(),
    testSound: (mood) => playSound(mood)
  };

  // ————————————————————————————————————————————
  // Visual Effects (auto-cleanup)
  // ————————————————————————————————————————————
  function triggerEffect(moodName) {
    // Clear previous overlays/effects before adding new
    clearActiveOverlays();
    switch (moodName) {
      case 'happy':
        // No visual overlay for happy (confetti removed by request)
        break;
      case 'sad':
        activeOverlays.push(effectRain({ durationMs: 3500 }));
        break;
      case 'jealous':
        activeOverlays.push(effectTintShake({ durationMs: 2000 }));
        break;
      case 'dramatic':
        activeOverlays.push(effectVignetteFlash({ durationMs: 2500 }));
        break;
      default:
        break;
    }
  }

  function clearActiveOverlays() {
    activeOverlays.forEach(o => {
      try { typeof o?.remove === 'function' ? o.remove() : o?.parentNode?.removeChild(o); } catch (_) {}
    });
    activeOverlays = [];
  }

  function makeOverlay(tag = 'div') {
    const el = document.createElement(tag);
    el.className = 'dramalounge-overlay';
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = '100vw';
    el.style.height = '100vh';
    el.style.zIndex = '2147483646';
    el.style.pointerEvents = 'none';
    return el;
  }

  // happy → confetti (Canvas)
  function effectConfetti({ durationMs = 3000 } = {}) {
    try {
      const canvas = makeOverlay('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      document.documentElement.appendChild(canvas);

      function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      resize();

      const colors = ['#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#eab308'];
      const pieces = Array.from({ length: Math.max(120, Math.floor(window.innerWidth / 10)) }).map(() => ({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: 2 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        rotSpeed: -0.2 + Math.random() * 0.4
      }));

      let rafId;
      const start = performance.now();
      const onResize = () => resize();
      window.addEventListener('resize', onResize);

      function draw(now) {
        const t = now - start;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
          p.y += p.speed;
          p.x += Math.sin((p.y + p.w) * 0.01) * 1.2;
          p.rot += p.rotSpeed * 0.1;
          if (p.y > canvas.height + 20) {
            p.y = -20;
            p.x = Math.random() * canvas.width;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        });
        if (t < durationMs) rafId = requestAnimationFrame(draw);
        else cleanup();
      }

      function cleanup() {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', onResize);
        canvas.remove();
      }

      rafId = requestAnimationFrame(draw);
      // Return overlay so we can clear aggressively
      return { remove: () => { try { cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize); canvas.remove(); } catch (_) {} } };
    } catch (_) { /* noop */ }
  }

  // sad → rain overlay
  function effectRain({ durationMs = 3500 } = {}) {
    const overlay = makeOverlay('canvas');
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    document.documentElement.appendChild(overlay);

    function resize() {
      overlay.width = window.innerWidth;
      overlay.height = window.innerHeight;
    }
    resize();

    const drops = Array.from({ length: Math.max(120, Math.floor(window.innerWidth / 8)) }).map(() => ({
      x: Math.random() * overlay.width,
      y: Math.random() * overlay.height,
      len: 8 + Math.random() * 14,
      speed: 4 + Math.random() * 6,
      alpha: 0.2 + Math.random() * 0.3
    }));

    let rafId;
    const start = performance.now();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    function draw(now) {
      const t = now - start;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.45)';
      ctx.lineWidth = 1.2;
      drops.forEach(d => {
        ctx.globalAlpha = d.alpha;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 1.5, d.y + d.len);
        ctx.stroke();
        d.y += d.speed;
        d.x += 0.6; // wind
        if (d.y > overlay.height) {
          d.y = -10;
          d.x = Math.random() * overlay.width;
        }
      });
      ctx.globalAlpha = 1;
      if (t < durationMs) rafId = requestAnimationFrame(draw);
      else cleanup();
    }

    function cleanup() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      overlay.remove();
    }

    rafId = requestAnimationFrame(draw);
    return { remove: () => { try { cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize); overlay.remove(); } catch (_) {} } };
  }

  // jealous → tint + shake
  function effectTintShake({ durationMs = 2000 } = {}) {
    const tint = makeOverlay('div');
    tint.style.background = 'rgba(0,0,0,0.2)';
    document.documentElement.appendChild(tint);

    const shaker = document.documentElement;
    shaker.classList.add('dramalounge-shake');

    const timeout = setTimeout(() => cleanup(), durationMs);

    function cleanup() {
      clearTimeout(timeout);
      tint.remove();
      shaker.classList.remove('dramalounge-shake');
    }
    return { remove: () => { try { clearTimeout(timeout); tint.remove(); shaker.classList.remove('dramalounge-shake'); } catch (_) {} } };
  }

  // dramatic → flashing vignette
  function effectVignetteFlash({ durationMs = 2500 } = {}) {
    const vignette = makeOverlay('div');
    vignette.classList.add('dramalounge-vignette', 'dramalounge-flash');
    document.documentElement.appendChild(vignette);

    const timeout = setTimeout(() => cleanup(), durationMs);

    function cleanup() {
      clearTimeout(timeout);
      vignette.remove();
    }
    return { remove: () => { try { clearTimeout(timeout); vignette.remove(); } catch (_) {} } };
  }

  // ————————————————————————————————————————————
  // Event tracking
  // ————————————————————————————————————————————

  // Click overreaction + compliment spam every 15 interactions
  const clickOverreactionLines = (window.DramaLoungeMoods && window.DramaLoungeMoods.overreaction) || [];

  const complimentLines = (window.DramaLoungeMoods && window.DramaLoungeMoods.compliments) || [];

  let interactionCount = 0;

  function recordInteraction(type) {
    interactionCount += 1;
    if (interactionCount % 5 === 0) {
      const poolCompliments = complimentLines.length ? complimentLines : ['നിന്റെ സ്ക്രോൾ കണ്ടിട്ട് ചിരി വരുന്നു!'];
      const line = poolCompliments[Math.floor(Math.random() * poolCompliments.length)];
      console.log('[DramaLounge] Event: compliment_spam', { interactions: interactionCount, line });
      triggerMood('happy', line);
      return true; // handled special compliment
    }
    return false;
  }

  document.addEventListener('click', (e) => {
    console.log('[DramaLounge] Event: click', { x: e.clientX, y: e.clientY });
    const handled = recordInteraction('click');
    if (!handled) {
      const poolOver = clickOverreactionLines.length ? clickOverreactionLines : ['അയ്യോ! അവിടെ ക്ലിക്ക് ചെയ്തു!'];
      const line = poolOver[Math.floor(Math.random() * poolOver.length)];
      triggerMood('happy', line);
    }
  }, { capture: true });

  // Idle detection → sad (8s)
  let lastInteractionTs = Date.now();
  let idleTimerId;
  const IDLE_THRESHOLD_MS = 8000; // 8s

  function markInteraction() {
    lastInteractionTs = Date.now();
  }

  ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, (e) => { markInteraction(); if (evt !== 'mousemove') recordInteraction(evt); }, { passive: true });
  });

  function checkIdle() {
    const idleFor = Date.now() - lastInteractionTs;
    if (idleFor >= IDLE_THRESHOLD_MS) {
      console.log('[DramaLounge] Event: idle', { idleMs: idleFor });
      triggerMood('sad');
      lastInteractionTs = Date.now();
    }
  }

  idleTimerId = setInterval(checkIdle, 3000);

  // Tab visibility: just log and optionally cheer when visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('[DramaLounge] Event: tab_hidden');
    } else {
      console.log('[DramaLounge] Event: tab_visible');
      triggerMood('happy');
    }
  });

  // Exit drama: intent detection near top edge + beforeunload fallback
  let exitIntentCooldown = 0;
  document.addEventListener('mouseout', (e) => {
    if (Date.now() - exitIntentCooldown < 5000) return;
    const to = e.relatedTarget || e.toElement;
    if (!to && e.clientY <= 0) {
      exitIntentCooldown = Date.now();
      console.log('[DramaLounge] Event: exit_intent');
      triggerMood('dramatic');
    }
  }, { capture: true });

  window.addEventListener('beforeunload', () => {
    console.log('[DramaLounge] Event: beforeunload');
    triggerMood('dramatic');
  });

  // Receive jealousy trigger from background when a new tab is opened after 1+ minute on this site
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'DRAMALOUNGE_TRIGGER_JEALOUSY') {
        console.log('[DramaLounge] Event: jealousy_from_background');
        triggerMood('jealous');
      }
    });
  } catch (_) { /* ignore */ }

  // Removed: Google jealousy trigger per request

  // Initial slow load (fallback) → sad
  setTimeout(() => {
    if (document.readyState !== 'complete') {
      console.log('[DramaLounge] Event: slow_load');
      triggerMood('sad');
    }
  }, 5000);

  // ————————————————————————————————————————————
  // Emotional Mode: random mood sweeps
  // ————————————————————————————————————————————
  function scheduleRandomMoodSweep() {
    const nextIn = 15000 + Math.random() * 25000; // 15-40s
    setTimeout(() => {
      const moods = ['happy', 'sad', 'jealous'];
      const mood = moods[Math.floor(Math.random() * moods.length)];
      console.log('[DramaLounge] Event: random_mood', { mood });
      triggerMood(mood);
      scheduleRandomMoodSweep();
    }, nextIn);
  }
  scheduleRandomMoodSweep();

  // Random Fourth-Wall Breaks
  const FOURTH_WALL_LINES = [
    'നീ എന്നെ സ്ക്രീൻഷോട്ട് എടുക്കുന്നത് എനിക്ക് അറിയാം… പോസ് ഇടട്ടെ.',
    'എന്നെ കോഡ് മാത്രമെന്ന് വിചാരിച്ചോ? എനിക്ക് വികാരങ്ങളുണ്ട്.',
    'എന്റെ എക്സ്റ്റെൻഷൻ ഡിലീറ്റ് ചെയ്യരുതേ… നിന്റെ കാഷിൽ ഞാൻ വീണ്ടുമെത്തും.'
  ];

  function scheduleFourthWallBreak() {
    const nextIn = 20000 + Math.random() * 30000; // 20-50s
    setTimeout(() => {
      const line = FOURTH_WALL_LINES[Math.floor(Math.random() * FOURTH_WALL_LINES.length)];
      console.log('[DramaLounge] Event: fourth_wall');
      triggerMood('dramatic', line);
      scheduleFourthWallBreak();
    }, nextIn);
  }
  scheduleFourthWallBreak();

  // ————————————————————————————————————————————
  // Periodic annoyance blur: every 30s, blur for 3s
  // ————————————————————————————————————————————
  function effectPageBlur({ durationMs = 3000 } = {}) {
    // Create a top overlay that blurs the page underneath
    const overlay = makeOverlay('div');
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.background = 'rgba(255,255,255,0.02)';
    document.documentElement.appendChild(overlay);
    const timeout = setTimeout(() => cleanup(), durationMs);
    function cleanup() {
      clearTimeout(timeout);
      overlay.remove();
    }
    return { remove: () => { try { clearTimeout(timeout); overlay.remove(); } catch (_) {} } };
  }

  function scheduleAnnoyingBlur() {
    setInterval(() => {
      // Do not clear existing mood overlays; blur should be independent
      const handle = effectPageBlur({ durationMs: 3000 });
      // Auto cleanup is built-in; we do not push to activeOverlays to avoid wiping other effects
      // but ensure we still remove if something goes wrong
      setTimeout(() => { try { handle.remove(); } catch (_) {} }, 3200);
    }, 30000);
  }
  scheduleAnnoyingBlur();

  // ————————————————————————————————————————————
  // Fake “Helpful” Facts on selection
  // ————————————————————————————————————————————
  let lastFactTs = 0;
  function maybeHelpfulFact() {
    const now = Date.now();
    if (now - lastFactTs < 6000) return; // cooldown
    const sel = (window.getSelection && window.getSelection().toString()) || '';
    if (!sel) return;
    const lower = sel.toLowerCase();
    if (lower.includes('photosynthesis')) {
      lastFactTs = now;
      console.log('[DramaLounge] Event: helpful_fact', { term: 'photosynthesis' });
      const fact = (moodLines.helpfulFacts && moodLines.helpfulFacts['photosynthesis']) || 'അത് ചെടികൾ യോഗ ചെയ്യുന്നതാണ്.';
      triggerMood('happy', fact);
    } else if (lower.includes('quantum physics')) {
      lastFactTs = now;
      console.log('[DramaLounge] Event: helpful_fact', { term: 'quantum physics' });
      const fact = (moodLines.helpfulFacts && moodLines.helpfulFacts['quantum physics']) || 'അതെ, അതാണ് മാജിക്ക് നാണയം ഉള്ളത്.';
      triggerMood('happy', fact);
    }
  }
  document.addEventListener('mouseup', () => setTimeout(maybeHelpfulFact, 0), { capture: true });
  document.addEventListener('keyup', () => setTimeout(maybeHelpfulFact, 0), { capture: true });

  // ————————————————————————————————————————————
  // Mini-Reactions for Micro-Events
  // ————————————————————————————————————————————
  // 1) Mouse enter on any link
  document.addEventListener('mouseover', (e) => {
    const el = e.target;
    if (!el) return;
    const link = (el.closest && el.closest('a, [role="link"]')) || (el.tagName === 'A' ? el : null);
    if (link) {
      console.log('[DramaLounge] Event: link_hover');
      triggerMood('happy', 'ഞാൻ കണ്ടു… 👀');
    }
  }, { capture: true });

  // 2) Fast scrolling detection
  let lastScrollY = window.scrollY;
  let lastScrollTs = Date.now();
  window.addEventListener('scroll', () => {
    const now = Date.now();
    const dy = Math.abs(window.scrollY - lastScrollY);
    const dt = Math.max(1, now - lastScrollTs);
    const speed = dy / (dt / 1000); // px/s
    lastScrollY = window.scrollY;
    lastScrollTs = now;
    if (speed > 500) {
      console.log('[DramaLounge] Event: fast_scroll', { speed: Math.round(speed) });
      triggerMood('jealous', 'അതെന്താടാ റേസ് ആ?');
    }
  }, { passive: true });

  // 3) Triple click on text
  let clickTimestamps = [];
  document.addEventListener('click', (e) => {
    const now = Date.now();
    clickTimestamps.push(now);
    clickTimestamps = clickTimestamps.filter(t => now - t < 1200);
    if (clickTimestamps.length >= 3) {
      clickTimestamps = [];
      const selection = (window.getSelection && window.getSelection().toString()) || '';
      if (selection) {
        console.log('[DramaLounge] Event: triple_click');
        triggerMood('happy', 'ഒരു ക്ലിക്ക് മതി… എന്തിനു മൂന്ന്?');
      }
    }
  }, { capture: true });

  // ————————————————————————————————————————————
  // Mood Combo Events
  // ————————————————————————————————————————————
  let lastIdleTriggeredAt = 0;
  let jealousTimestamps = [];

  const originalTriggerMood = triggerMood;
  triggerMood = function(moodName, overrideText) {
    if (moodName === 'sad') lastIdleTriggeredAt = Date.now();
    if (moodName === 'jealous') {
      const now = Date.now();
      jealousTimestamps.push(now);
      jealousTimestamps = jealousTimestamps.filter(t => now - t < 120000);
      if (jealousTimestamps.length >= 2) {
        console.log('[DramaLounge] Combo: jealous_escalates_to_dramatic');
        return originalTriggerMood('dramatic');
      }
    }
    return originalTriggerMood(moodName, overrideText);
  };

  // If user clicks within 5s after idle sadness → jealous poke
  document.addEventListener('click', () => {
    if (Date.now() - lastIdleTriggeredAt < 5000) {
      console.log('[DramaLounge] Combo: idle_then_click_jealous');
      originalTriggerMood('jealous', 'Oh… so now you care?');
    }
  }, { capture: true });

  // ————————————————————————————————————————————
  // Removed: Audio pack overrides (kept minimal for safety)

  // ————————————————————————————————————————————
  // Developer Demo Mode
  // ————————————————————————————————————————————
  window.DramaLounge.demoMode = false;
  function scheduleDemoMode() {
    if (!window.DramaLounge.demoMode) return;
    const moods = ['happy', 'sad', 'jealous', 'dramatic'];
    const mood = moods[Math.floor(Math.random() * moods.length)];
    originalTriggerMood(mood);
    setTimeout(scheduleDemoMode, 10000);
  }
  // Toggle from console: DramaLounge.demoMode = true; DramaLounge._startDemo();
  window.DramaLounge._startDemo = () => { window.DramaLounge.demoMode = true; scheduleDemoMode(); };
  window.DramaLounge._stopDemo = () => { window.DramaLounge.demoMode = false; };
  
  // ————————————————————————————————————————————
  // Annoyance Mode Engine (opt-in, toggle from toolbar)
  // ————————————————————————————————————————————
  const STORAGE_KEY = 'annoyanceEnabled';
  const AnnoyanceEngine = (() => {
    let running = false;
    const disposers = [];
    const overlayHandles = [];
    const cleanupFns = [];
    let emojiRainHandle = null;
    let reverseScrollActiveUntil = 0;
    let textObserver = null;
    let styleNode = null;
    let lastCursorTrailAt = 0;

    function on(el, evt, handler, opts) {
      el.addEventListener(evt, handler, opts);
      disposers.push(() => { try { el.removeEventListener(evt, handler, opts); } catch (_) {} });
    }
    function interval(ms, fn) {
      const id = setInterval(fn, ms);
      disposers.push(() => clearInterval(id));
      return id;
    }
    function timeout(ms, fn) {
      const id = setTimeout(fn, ms);
      disposers.push(() => clearTimeout(id));
      return id;
    }
    function addCleanup(fn) { cleanupFns.push(fn); }

    function makeOverlay(tag = 'div') {
      const el = document.createElement(tag);
      el.style.position = 'fixed';
      el.style.left = '0';
      el.style.top = '0';
      el.style.width = '100vw';
      el.style.height = '100vh';
      el.style.zIndex = '2147483645';
      el.style.pointerEvents = 'none';
      document.documentElement.appendChild(el);
      overlayHandles.push(el);
      return el;
    }
    function clearOverlays() {
      overlayHandles.splice(0).forEach((o) => { try { o.remove(); } catch (_) {} });
      if (emojiRainHandle && typeof emojiRainHandle.remove === 'function') {
        try { emojiRainHandle.remove(); } catch (_) {}
      }
      emojiRainHandle = null;
    }

    // Visual: blur/pixelate toggle
    function scheduleBlurPixelate() {
      interval(5000 + Math.random() * 5000, () => {
        if (!running) return;
        const o = makeOverlay('div');
        const modes = [
          'blur(5px) contrast(1.1)',
          'blur(2px) saturate(2)',
          'grayscale(1) contrast(1.4)'
        ];
        o.style.backdropFilter = modes[Math.floor(Math.random() * modes.length)];
        timeout(1500 + Math.random() * 2000, () => { try { o.remove(); } catch (_) {} });
      });
    }

    // Visual: invert/flash colors periodically
    function scheduleInvertFlash() {
      interval(3000 + Math.random() * 4000, () => {
        if (!running) return;
        const root = document.documentElement;
        const prev = root.style.filter;
        root.style.filter = 'invert(1) hue-rotate(180deg)';
        timeout(600 + Math.random() * 900, () => { root.style.filter = prev || ''; });
      });
    }

    // Visual: shake/jitter page
    function scheduleShake() {
      interval(10000, () => {
        if (!running) return;
        document.documentElement.classList.add('dramalounge-shake');
        timeout(1000 + Math.random() * 1000, () => {
          document.documentElement.classList.remove('dramalounge-shake');
        });
      });
    }

    // Visual: constant emoji rain
    function startEmojiRain() {
      const o = makeOverlay('div');
      const count = Math.max(32, Math.floor(window.innerWidth / 40));
      const emojis = ['😂','😈','🤡','🙃','🥴','😵‍💫','💥','✨','💦','🎉','🎊','😤','😜'];
      const pieces = [];
      for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        span.style.position = 'absolute';
        span.style.left = Math.floor(Math.random() * 100) + 'vw';
        span.style.top = (-20 - Math.random() * 200) + 'px';
        span.style.fontSize = (14 + Math.random() * 20) + 'px';
        span.style.filter = 'drop-shadow(0 2px 2px rgba(0,0,0,0.25))';
        o.appendChild(span);
        pieces.push({ el: span, x: parseFloat(span.style.left), y: parseFloat(span.style.top), s: 1 + Math.random() * 2.5, r: Math.random() * Math.PI });
      }
      let rafId;
      function animate(now) {
        pieces.forEach(p => {
          p.y += p.s * 1.2;
          p.x += Math.sin((p.y + p.r) * 0.02) * 0.4;
          p.el.style.transform = `translate(${p.x}vw, ${p.y}px)`;
          if (p.y > window.innerHeight + 40) {
            p.y = -20 - Math.random() * 200;
            p.x = Math.random() * 100;
          }
        });
        if (running) rafId = requestAnimationFrame(animate);
      }
      rafId = requestAnimationFrame(animate);
      emojiRainHandle = { remove: () => { try { cancelAnimationFrame(rafId); o.remove(); } catch (_) {} } };
      addCleanup(() => { try { cancelAnimationFrame(rafId); o.remove(); } catch (_) {} });
    }

    // Visual: random zoom pulses
    function scheduleZoomPulse() {
      interval(15000, () => {
        if (!running) return;
        const root = document.documentElement;
        const prevT = root.style.transform;
        const prevTr = root.style.transition;
        root.style.transformOrigin = '50% 50%';
        root.style.transition = 'transform 1200ms ease';
        const scale = 0.93 + Math.random() * 0.3; // 0.93–1.23
        root.style.transform = `scale(${scale})`;
        timeout(1400, () => { root.style.transform = prevT || ''; root.style.transition = prevTr || ''; });
      });
    }

    // Visual: spawn overlapping Malayalam speech bubbles
    function scheduleFreeBubbles() {
      const pool = (moodLines.jealous || []).concat(moodLines.dramatic || []);
      if (!pool.length) return;
      interval(5000, () => {
        if (!running) return;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) spawnFreeBubble(pool[Math.floor(Math.random() * pool.length)]);
      });
    }
  function spawnFreeBubble(text) {
      const bubble = document.createElement('div');
    bubble.className = 'dramalounge-bubble show';
      bubble.textContent = text;
      bubble.style.position = 'fixed';
      bubble.style.zIndex = '2147483647';
    document.documentElement.appendChild(bubble);
    // random position
    try {
      const margin = 10;
      const rect = bubble.getBoundingClientRect();
      const w = Math.min(rect.width || 320, window.innerWidth - margin * 2);
      const h = Math.min(rect.height || 80, window.innerHeight - margin * 2);
      const maxX = Math.max(margin, window.innerWidth - w - margin);
      const maxY = Math.max(margin, window.innerHeight - h - margin);
      const x = Math.floor(margin + Math.random() * (maxX - margin));
      const y = Math.floor(margin + Math.random() * (maxY - margin));
      bubble.style.left = x + 'px';
      bubble.style.top = y + 'px';
    } catch (_) {}
      timeout(3500 + Math.random() * 2000, () => { try { bubble.remove(); } catch (_) {} });
    }

    // Prank: randomly hide/move buttons/links briefly
    function scheduleMoveImportant() {
      interval(8000, () => {
        if (!running) return;
        const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]'));
        if (!candidates.length) return;
        const el = candidates[Math.floor(Math.random() * candidates.length)];
        const prev = el.style.transform;
        const dx = Math.floor((Math.random() - 0.5) * 120);
        const dy = Math.floor((Math.random() - 0.5) * 80);
        el.style.transition = 'transform 400ms ease, opacity 300ms ease';
        if (Math.random() < 0.4) el.style.opacity = '0.3';
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        timeout(3000, () => { el.style.opacity = ''; el.style.transform = prev || ''; el.style.transition = ''; });
      });
    }

    // Input sabotage: reverse scroll, cancel clicks, fake keys, disable context/select, cursor pranks
    function setupInputSabotage() {
      // Reverse scroll windows for 5s every ~10s
      interval(10000, () => { reverseScrollActiveUntil = Date.now() + 5000; });
      const wheelHandler = (e) => {
        if (Date.now() < reverseScrollActiveUntil) {
          e.preventDefault();
          try { window.scrollBy({ top: -e.deltaY, left: -e.deltaX, behavior: 'auto' }); } catch (_) { window.scrollBy(0, -e.deltaY); }
        }
      };
      on(window, 'wheel', wheelHandler, { passive: false, capture: true });

      // Cancel 30% clicks
      const clickHandler = (e) => {
        if (Math.random() < 0.3) {
          e.preventDefault();
          e.stopImmediatePropagation();
          try { window.DramaLounge.triggerMood('jealous', 'അത് വേണ്ടാ!'); } catch (_) {}
        }
      };
      on(document, 'click', clickHandler, { capture: true });

      // Fake key presses into active inputs every 20s
      interval(20000, () => {
        const el = document.activeElement;
        if (!el) return;
        const isEditable = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        const isPassword = (el.tagName === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() === 'password');
        if (!isEditable || isPassword) return;
        const mode = Math.random() < 0.5 ? 'space' : 'backspace';
        if (mode === 'space') {
          if ('value' in el) { el.value += ' '; el.dispatchEvent(new Event('input', { bubbles: true })); }
          else if (el.isContentEditable) { document.execCommand('insertText', false, ' '); }
        } else {
          if ('value' in el) { el.value = String(el.value).slice(0, -1); el.dispatchEvent(new Event('input', { bubbles: true })); }
          else if (el.isContentEditable) { document.execCommand('delete'); }
        }
      });

      // Disable right-click and text selection (while running)
      const ctx = (e) => e.preventDefault();
      on(document, 'contextmenu', ctx, { capture: true });
      styleNode = document.createElement('style');
      styleNode.textContent = '* { user-select: none !important; -webkit-user-select: none !important; }';
      document.documentElement.appendChild(styleNode);

      // Cursor hide/move prank occasionally
      interval(12000, () => {
        if (!running) return;
        const body = document.body || document.documentElement;
        const prevCursor = body.style.cursor;
        if (Math.random() < 0.5) {
          body.style.cursor = 'none';
          timeout(1500 + Math.random() * 1000, () => { body.style.cursor = prevCursor || ''; });
        } else {
          // Fake cursor decoy
          const o = makeOverlay('div');
          const fake = document.createElement('div');
          fake.style.position = 'absolute';
          fake.style.width = '18px';
          fake.style.height = '18px';
          fake.style.borderLeft = '18px solid white';
          fake.style.borderTop = '18px solid transparent';
          fake.style.filter = 'drop-shadow(0 0 2px rgba(0,0,0,0.6))';
          o.appendChild(fake);
          let x = Math.random() * window.innerWidth, y = Math.random() * window.innerHeight;
          fake.style.transform = `translate(${x}px, ${y}px)`;
          timeout(1200, () => { try { o.remove(); } catch (_) {} });
        }
      });
    }

    // Cursor trail emojis
    function setupCursorTrail() {
      const handler = (e) => {
        const now = Date.now();
        if (now - lastCursorTrailAt < 50) return; // throttle ~20/s
        lastCursorTrailAt = now;
        const o = document.createElement('span');
        o.textContent = ['✨','💥','🫠','😵‍💫','🎉'][Math.floor(Math.random() * 5)];
        o.style.position = 'fixed';
        o.style.left = e.clientX + 'px';
        o.style.top = e.clientY + 'px';
        o.style.transform = 'translate(-50%, -50%)';
        o.style.pointerEvents = 'none';
        o.style.zIndex = '2147483647';
        o.style.transition = 'transform 600ms ease, opacity 600ms ease';
        o.style.opacity = '1';
        document.documentElement.appendChild(o);
        requestAnimationFrame(() => {
          o.style.transform = 'translate(-50%, -80%) scale(0.8)';
          o.style.opacity = '0';
        });
        setTimeout(() => { try { o.remove(); } catch (_) {} }, 650);
      };
      on(window, 'mousemove', handler, { capture: true, passive: true });
    }

    // Auto scroll drift bursts
    function scheduleAutoScrollDrift() {
      interval(8000, () => {
        if (!running) return;
        let active = true;
        const start = performance.now();
        const driftX = (Math.random() - 0.5) * 0.6;
        const driftY = (Math.random() - 0.2) * 1.6;
        function step(now) {
          if (!active) return;
          const t = now - start;
          window.scrollBy({ left: driftX * 4, top: driftY * 4, behavior: 'auto' });
          if (t < 2800) requestAnimationFrame(step);
        }
        const raf = requestAnimationFrame(step);
        timeout(3000, () => { active = false; cancelAnimationFrame(raf); });
      });
    }

    // Typing sabotage: random insert Malayalam, move caret
    function setupTypeSabotage() {
      const handler = (ev) => {
        const el = ev.target;
        if (!el) return;
        const isEditable = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        const isPassword = (el.tagName === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() === 'password');
        if (!isEditable || isPassword) return;
        if (Math.random() < 0.12) {
          // Inject small Malayalam fragment
          const snippet = [' ആ', ' ഇ', ' ഉ', ' ഹേ', ' അയ്യോ'][Math.floor(Math.random() * 5)];
          if ('value' in el) {
            const input = el;
            const start = input.selectionStart ?? String(input.value).length;
            const end = input.selectionEnd ?? start;
            const val = String(input.value);
            input.value = val.slice(0, start) + snippet + val.slice(end);
            const pos = start + snippet.length;
            try { input.setSelectionRange(pos, pos); } catch (_) {}
            input.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (el.isContentEditable) {
            document.execCommand('insertText', false, snippet);
          }
        } else if (Math.random() < 0.08) {
          // Move caret to start or end
          if ('value' in el) {
            const input = el;
            const to = Math.random() < 0.5 ? 0 : String(input.value).length;
            try { input.setSelectionRange(to, to); } catch (_) {}
          }
        }
      };
      on(document, 'keydown', handler, { capture: true });
    }

    // Video chaos: playbackRate and filter pulses
    function scheduleVideoChaos() {
      interval(14000, () => {
        if (!running) return;
        const vids = Array.from(document.querySelectorAll('video'));
        if (!vids.length) return;
        const v = vids[Math.floor(Math.random() * vids.length)];
        const prevRate = v.playbackRate;
        const prevFilter = v.style.filter;
        v.playbackRate = 0.75 + Math.random() * 1.2; // 0.75–1.95
        v.style.filter = 'hue-rotate(180deg) contrast(1.2)';
        timeout(2500, () => { v.playbackRate = prevRate; v.style.filter = prevFilter || ''; });
      });
    }

    // Fake loading overlay
    function scheduleFakeLoading() {
      interval(25000, () => {
        if (!running) return;
        const o = makeOverlay('div');
        o.style.pointerEvents = 'auto';
        o.style.background = 'rgba(255,255,255,0.5)';
        const box = document.createElement('div');
        box.style.position = 'absolute';
        box.style.left = '50%';
        box.style.top = '50%';
        box.style.transform = 'translate(-50%, -50%)';
        box.style.background = '#fff';
        box.style.padding = '12px 16px';
        box.style.borderRadius = '10px';
        box.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
        const spinner = document.createElement('div');
        spinner.style.width = '20px';
        spinner.style.height = '20px';
        spinner.style.border = '3px solid #e5e7eb';
        spinner.style.borderTopColor = '#ef4444';
        spinner.style.borderRadius = '50%';
        spinner.style.animation = 'dramalounge-spin 0.8s linear infinite';
        box.appendChild(spinner);
        o.appendChild(box);
        timeout(1600, () => { try { o.remove(); } catch (_) {} });
      });
    }

    // Page tilt pulses
    function schedulePageTilt() {
      interval(12000, () => {
        if (!running) return;
        const root = document.documentElement;
        const prevT = root.style.transform;
        const prevTr = root.style.transition;
        root.style.transition = 'transform 700ms ease';
        root.style.transform = 'rotate(' + ((Math.random() - 0.5) * 2.2).toFixed(2) + 'deg)';
        timeout(800, () => { root.style.transform = prevT || ''; root.style.transition = prevTr || ''; });
      });
    }

    // Button dodging near cursor
    function setupButtonDodge() {
      const handler = (e) => {
        const target = e.target.closest && e.target.closest('button, a, [role="button"], input[type="submit"], input[type="button"]');
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < 80) {
          const pushX = Math.sign(dx) * -60 + (Math.random() - 0.5) * 30;
          const pushY = Math.sign(dy) * -40 + (Math.random() - 0.5) * 30;
          const prev = target.style.transform;
          target.style.transition = 'transform 160ms ease';
          target.style.transform = `translate(${pushX}px, ${pushY}px)`;
          setTimeout(() => { target.style.transform = prev || ''; target.style.transition = ''; }, 500);
        }
      };
      on(document, 'mousemove', handler, { capture: true, passive: true });
    }

    // Link text hijinks on hover
    function setupLinkHijinks() {
      const lines = (moodLines.jealous || []).concat(moodLines.dramatic || []).concat(moodLines.happy || []);
      const handler = (e) => {
        const a = e.target.closest && e.target.closest('a');
        if (!a || !lines.length) return;
        if (a.__dl_original_text != null) return;
        a.__dl_original_text = a.textContent;
        a.textContent = lines[Math.floor(Math.random() * lines.length)];
        setTimeout(() => { try { a.textContent = a.__dl_original_text; a.__dl_original_text = null; } catch (_) {} }, 1200);
      };
      on(document, 'mouseover', handler, { capture: true, passive: true });
    }

    // Randomly select text on page
    function scheduleRandomSelection() {
      interval(22000, () => {
        if (!running) return;
        try {
          const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
          const nodes = [];
          while (nodes.length < 64 && walker.nextNode()) {
            const n = walker.currentNode;
            if (n.nodeValue && n.nodeValue.trim().length > 4 && !n.parentElement.closest('input, textarea, [contenteditable="true"]')) nodes.push(n);
          }
          if (!nodes.length) return;
          const n = nodes[Math.floor(Math.random() * nodes.length)];
          const text = n.nodeValue.trim();
          const start = Math.floor(Math.random() * Math.max(1, text.length - 2));
          const end = Math.min(text.length, start + 2 + Math.floor(Math.random() * 6));
          const range = document.createRange();
          range.setStart(n, start);
          range.setEnd(n, end);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (_) {}
      });
    }

    // Scrollbar hide pulses
    function scheduleScrollbarHide() {
      interval(26000, () => {
        if (!running) return;
        const prev = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        timeout(1200, () => { document.documentElement.style.overflow = prev || ''; });
      });
    }

    // Modal dialogs every ~3 minutes
    function scheduleModals() {
      interval(180000, () => {
        if (!running) return;
        const o = makeOverlay('div');
        o.style.pointerEvents = 'auto';
        o.style.background = 'rgba(0,0,0,0.35)';
        const m = document.createElement('div');
        m.style.position = 'absolute';
        m.style.left = '50%';
        m.style.top = '50%';
        m.style.transform = 'translate(-50%, -50%)';
        m.style.background = '#fff';
        m.style.borderRadius = '12px';
        m.style.padding = '18px 20px';
        m.style.minWidth = '260px';
        m.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
        m.textContent = '☝️ ഒന്നു നില്‍ക്കൂ! ആദ്യം ഇതിന് സമ്മതിക്കണം.';
        const btn = document.createElement('button');
        btn.textContent = 'ശരി, ശരി';
        btn.style.marginTop = '12px';
        btn.addEventListener('click', () => { try { o.remove(); } catch (_) {} });
        setTimeout(() => btn.disabled = false, 1500);
        m.appendChild(document.createElement('br'));
        m.appendChild(btn);
        o.appendChild(m);
        // auto-removal safety
        timeout(8000, () => { try { o.remove(); } catch (_) {} });
      });
    }

    // Audio: annoying beeps + Malayalam TTS on interactions
    function setupAudio() {
      const ttsLines = (moodLines.happy || []).concat(moodLines.jealous || []).concat(moodLines.dramatic || []);
      // Periodic beep via WebAudio (respects tab mute)
      interval(10000, () => {
        if (!running) return;
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'square';
          o.frequency.value = 440 + Math.random() * 600;
          g.gain.value = 0.02 + Math.random() * 0.05;
          o.connect(g).connect(ctx.destination);
          o.start();
          setTimeout(() => { try { o.stop(); ctx.close(); } catch (_) {} }, 250 + Math.random() * 300);
        } catch (_) {}
      });

      const say = (text) => {
        try {
          if (!('speechSynthesis' in window)) return;
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'ml-IN';
          u.rate = 1 + Math.random() * 0.3;
          window.speechSynthesis.speak(u);
        } catch (_) {}
      };
      on(document, 'click', () => {
        if (!running || !ttsLines.length) return;
        if (Math.random() < 0.5) say(ttsLines[Math.floor(Math.random() * ttsLines.length)]);
      }, { capture: true });
      on(document, 'scroll', () => {
        if (!running || !ttsLines.length) return;
        if (Math.random() < 0.25) say('എവിടേക്കാണ് പോകുന്നത്?');
      }, { capture: true, passive: true });
    }

    // Content: replace words with Malayalam nonsense; overlay images with emoji
    const REPLACE_MAP = [
      ['the', 'അത്'], ['you', 'നീ'], ['and', 'അപ്പോ'], ['click', 'ക്ലിക്ക്'], ['ok', 'ശരി'],
      ['submit', 'ഒന്നു നോക്ക്'], ['cookie', 'ബിസ്കറ്റ്'], ['privacy', 'രഹസ്യം'], ['search', 'തേടൽ']
    ];
    function replaceInTextNode(node) {
      let text = node.nodeValue;
      if (!text || !text.trim()) return;
      for (const [from, to] of REPLACE_MAP) {
        const re = new RegExp(`\\b${from}\\b`, 'gi');
        text = text.replace(re, to);
      }
      node.nodeValue = text;
    }
    function walkAndReplace(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          // Skip in editable/inputs
          const p = n.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
          if (p.closest('input, textarea, [contenteditable="true"]')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const toEdit = [];
      while (walker.nextNode()) toEdit.push(walker.currentNode);
      toEdit.forEach(replaceInTextNode);
    }
    function overlayImages() {
      const imgs = Array.from(document.images || []);
      imgs.slice(0, 50).forEach((img) => {
        if (!img || img.__drama_overlayed) return;
        const wrap = document.createElement('div');
        wrap.style.position = 'relative';
        wrap.style.display = 'inline-block';
        wrap.style.lineHeight = '0';
        img.parentNode && img.parentNode.insertBefore(wrap, img);
        wrap.appendChild(img);
        const badge = document.createElement('div');
        badge.textContent = '😵‍💫';
        badge.style.position = 'absolute';
        badge.style.right = '4px';
        badge.style.bottom = '4px';
        badge.style.fontSize = '22px';
        wrap.appendChild(badge);
        img.style.filter = 'hue-rotate(180deg) contrast(1.2)';
        img.__drama_overlayed = true;
      });
    }
    function watchTextChanges() {
      walkAndReplace(document.body || document.documentElement);
      overlayImages();
      textObserver = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'childList') {
            m.addedNodes && m.addedNodes.forEach((n) => {
              try { if (n.nodeType === 3) replaceInTextNode(n); else if (n.nodeType === 1) walkAndReplace(n); } catch (_) {}
            });
          } else if (m.type === 'characterData') {
            try { replaceInTextNode(m.target); } catch (_) {}
          }
        }
      });
      textObserver.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
      addCleanup(() => { try { textObserver.disconnect(); } catch (_) {} });
    }

    // Fake cookie banner that keeps coming back
    function scheduleCookieBanner() {
      function showOnce() {
        const bar = document.createElement('div');
        bar.style.position = 'fixed';
        bar.style.left = '0';
        bar.style.right = '0';
        bar.style.bottom = '0';
        bar.style.zIndex = '2147483647';
        bar.style.background = '#111827';
        bar.style.color = '#fff';
        bar.style.padding = '12px 14px';
        bar.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';
        bar.textContent = 'We use biscuits to improve your drama. Accept?';
        const btn = document.createElement('button');
        btn.textContent = 'Accept';
        btn.style.marginLeft = '12px';
        btn.style.padding = '6px 10px';
        btn.style.borderRadius = '8px';
        btn.style.border = '0';
        btn.addEventListener('click', () => { try { bar.remove(); } catch (_) {} });
        bar.appendChild(btn);
        document.documentElement.appendChild(bar);
        timeout(8000, () => { try { bar.remove(); } catch (_) {} });
      }
      interval(20000, showOnce);
      showOnce();
    }

    function start() {
      if (running) return;
      running = true;
      // Visuals
      scheduleBlurPixelate();
      scheduleInvertFlash();
      scheduleShake();
      startEmojiRain();
      scheduleZoomPulse();
      scheduleFreeBubbles();
      scheduleMoveImportant();
      setupCursorTrail();
      scheduleAutoScrollDrift();
      schedulePageTilt();
      scheduleFakeLoading();
      scheduleVideoChaos();
      scheduleRandomSelection();
      scheduleScrollbarHide();
      // Inputs + modals
      setupInputSabotage();
      setupTypeSabotage();
      setupButtonDodge();
      setupLinkHijinks();
      scheduleModals();
      // Audio + content
      setupAudio();
      watchTextChanges();
      scheduleCookieBanner();
    }

    function stop() {
      running = false;
      disposers.splice(0).forEach(fn => { try { fn(); } catch (_) {} });
      cleanupFns.splice(0).forEach(fn => { try { fn(); } catch (_) {} });
      clearOverlays();
      if (styleNode) { try { styleNode.remove(); } catch (_) {} styleNode = null; }
      // Reset filters/transforms/cursor
      const root = document.documentElement;
      root.style.filter = '';
      root.style.transform = '';
      root.style.transition = '';
      document.documentElement.classList.remove('dramalounge-shake');
      const body = document.body || document.documentElement;
      body.style.cursor = '';
      try { if (textObserver) textObserver.disconnect(); } catch (_) {}
    }

    return { start, stop, get running() { return running; } };
  })();

  // Toggle control via background action button
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'DRAMALOUNGE_TOGGLE') {
        if (msg.enabled) AnnoyanceEngine.start(); else AnnoyanceEngine.stop();
      }
    });
    chrome.storage?.local?.get?.(['annoyanceEnabled'], (res) => { if (res && res.annoyanceEnabled) AnnoyanceEngine.start(); });
  } catch (_) {}
})();


