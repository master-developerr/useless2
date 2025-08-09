(function () {
  // Ensure base API exists
  if (!window.DramaLounge || typeof window.DramaLounge.triggerMood !== 'function') return;

  const MOODS = window.DramaLoungeMoods || {};

  // Case-insensitive phrase detection; fire once per occurrence
  const TRIGGERS = [
    { phrase: 'i love you', mood: 'happy', lines: MOODS.happy || [], effect: 'blush' },
    {
      phrase: 'goodbye',
      mood: 'dramatic',
      lines: MOODS.dramatic || [],
      effect: 'zoom'
    },
    {
      phrase: 'pizza',
      mood: 'happy',
      lines: MOODS.happy || [],
      effect: 'pizzaConfetti'
    },
    // Malayalam Easter Eggs
    { phrase: 'ente ponnu', mood: 'happy', lines: MOODS.happy || [], effect: 'blush' },
    { phrase: 'pani', mood: 'sad', lines: MOODS.sad || [], effect: 'rain' },
    { phrase: 'kalipp', mood: 'dramatic', lines: MOODS.dramatic || [], effect: 'vignette' },
    { phrase: 'mass', mood: 'happy', lines: MOODS.happy || [], effect: 'confetti' },
    { phrase: 'kidu', mood: 'happy', lines: MOODS.happy || [], effect: 'confetti' },
    { phrase: 'vallom', mood: 'jealous', lines: MOODS.jealous || [], effect: 'shake' },
    { phrase: 'padam', mood: 'dramatic', lines: MOODS.dramatic || [], effect: 'vignette' },
    { phrase: 'thendi', mood: 'jealous', lines: MOODS.jealous || [], effect: 'shake' },
    { phrase: 'onnumilla', mood: 'sad', lines: MOODS.sad || [], effect: 'rain' },
    { phrase: 'theppu', mood: 'jealous', lines: MOODS.jealous || [], effect: 'shake' },
    { phrase: 'poli', mood: 'happy', lines: MOODS.happy || [], effect: 'confetti' },
    { phrase: 'thall', mood: 'dramatic', lines: MOODS.dramatic || [], effect: 'vignette' },
    { phrase: 'nirthada', mood: 'jealous', lines: MOODS.jealous || [], effect: 'shake' },
    { phrase: 'adi', mood: 'dramatic', lines: MOODS.dramatic || [], effect: 'vignette' },
    { phrase: 'chaaya', mood: 'happy', lines: MOODS.happy || [], effect: 'pizzaConfetti' },
    { phrase: 'meen', mood: 'happy', lines: MOODS.happy || [], effect: 'pizzaConfetti' },
    { phrase: 'kappa', mood: 'happy', lines: MOODS.happy || [], effect: 'pizzaConfetti' }
  ];

  // We accumulate the last N typed chars across inputs and body
  let buffer = '';
  const MAX_BUFFER = 64;
  const recentlyFired = new Map(); // phrase -> timestamp
  const COOLDOWN_MS = 6000; // prevent rapid repeat

  function normalize(s) { return (s || '').toLowerCase(); }

  function handleKeydown(ev) {
    // Ignore while typing in password fields
    const t = ev.target;
    if (t && t.tagName === 'INPUT' && t.type === 'password') return;

    // Only add printable chars and space/backspace
    if (ev.key && ev.key.length === 1) {
      buffer += ev.key;
    } else if (ev.key === 'Backspace') {
      buffer = buffer.slice(0, -1);
    } else if (ev.key === 'Enter') {
      buffer += '\n';
    } else if (ev.key === 'Spacebar' || ev.key === ' ') {
      buffer += ' ';
    } else {
      // ignore control keys
      return;
    }

    if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
    const lower = normalize(buffer);

    for (const trig of TRIGGERS) {
      const phrase = normalize(trig.phrase);
      const idx = lower.lastIndexOf(phrase);
      if (idx !== -1) {
        // Fire only if last char completed the phrase
        const justTyped = lower.endsWith(phrase);
        if (!justTyped) continue;
        const lastTs = recentlyFired.get(phrase) || 0;
        const now = Date.now();
        if (now - lastTs < COOLDOWN_MS) continue;
        recentlyFired.set(phrase, now);

        const line = trig.lines[Math.floor(Math.random() * trig.lines.length)];
        console.log('[DramaLounge] Event: easter_egg', { phrase: trig.phrase, mood: trig.mood, line });
        window.DramaLounge.triggerMood(trig.mood, line);
        triggerEasterEggEffect(trig.effect);
        break;
      }
    }
  }

  window.addEventListener('keydown', handleKeydown, { capture: true });

  // ————————————————————————————————————————————
  // Easter egg effects
  // ————————————————————————————————————————————
  function createOverlay(tag = 'div') {
    const el = document.createElement(tag);
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = '100vw';
    el.style.height = '100vh';
    el.style.zIndex = '2147483646';
    el.style.pointerEvents = 'none';
    return el;
  }

  function triggerEasterEggEffect(effect) {
    try { window.DramaLounge.clearOverlays(); } catch (_) {}
    switch (effect) {
      case 'blush':
        window.DramaLounge.registerOverlay(blushCheeks());
        break;
      case 'zoom':
        window.DramaLounge.registerOverlay(cinematicZoom());
        break;
      case 'pizzaConfetti':
        window.DramaLounge.registerOverlay(pizzaConfetti());
        break;
      case 'confetti':
        try { window.DramaLounge.triggerMood('happy'); } catch (_) {}
        break;
      case 'rain':
        try { window.DramaLounge.triggerMood('sad'); } catch (_) {}
        break;
      case 'vignette':
        try { window.DramaLounge.triggerMood('dramatic'); } catch (_) {}
        break;
      case 'shake':
        try { window.DramaLounge.triggerMood('jealous'); } catch (_) {}
        break;
      default:
        break;
    }
  }

  // blush cheeks overlay (two soft pink circles bottom corners)
  function blushCheeks(durationMs = 2000) {
    const o = createOverlay('div');
    o.style.background = 'radial-gradient(circle at 20% 85%, rgba(244,114,182,0.25) 0%, rgba(244,114,182,0) 45%), radial-gradient(circle at 80% 85%, rgba(244,114,182,0.25) 0%, rgba(244,114,182,0) 45%)';
    document.documentElement.appendChild(o);
    const timeout = setTimeout(() => o.remove(), durationMs);
    return { remove: () => { try { clearTimeout(timeout); o.remove(); } catch (_) {} } };
  }

  // cinematic slow zoom-in (scale the document)
  function cinematicZoom(durationMs = 2200) {
    const root = document.documentElement;
    const originalTransform = root.style.transform || '';
    const originalTransition = root.style.transition || '';
    root.style.transition = 'transform 2200ms ease-in-out';
    root.style.transformOrigin = '50% 50%';
    root.style.transform = 'scale(1.06)';
    const timeout = setTimeout(() => {
      root.style.transform = originalTransform;
      root.style.transition = originalTransition;
    }, durationMs);
    return { remove: () => { try { clearTimeout(timeout); root.style.transform = originalTransform; root.style.transition = originalTransition; } catch (_) {} } };
  }

  // pizza confetti: fall sprites (simple squares with 🍕 emoji)
  function pizzaConfetti(durationMs = 2600) {
    const o = createOverlay('div');
    document.documentElement.appendChild(o);

    const count = Math.max(24, Math.floor(window.innerWidth / 40));
    const pieces = [];
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.textContent = '🍕';
      span.style.position = 'absolute';
      span.style.left = Math.floor(Math.random() * 100) + 'vw';
      span.style.top = (-10 - Math.random() * 30) + 'px';
      span.style.fontSize = (16 + Math.random() * 18) + 'px';
      span.style.filter = 'drop-shadow(0 2px 2px rgba(0,0,0,0.25))';
      o.appendChild(span);
      pieces.push({ el: span, x: parseFloat(span.style.left), y: parseFloat(span.style.top), r: Math.random() * Math.PI, s: 2 + Math.random() * 3 });
    }

    let rafId;
    const start = performance.now();
    function animate(now) {
      const t = now - start;
      pieces.forEach(p => {
        p.y += p.s * 1.4;
        const drift = Math.sin((p.y + p.r) * 0.02) * 0.6;
        p.x += drift;
        p.el.style.transform = `translate(${p.x}vw, ${p.y}px)`;
      });
      if (t < durationMs) rafId = requestAnimationFrame(animate);
      else {
        cancelAnimationFrame(rafId);
        o.remove();
      }
    }
    rafId = requestAnimationFrame(animate);
    return { remove: () => { try { cancelAnimationFrame(rafId); o.remove(); } catch (_) {} } };
  }
})();


