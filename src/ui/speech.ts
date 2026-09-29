// A spoken line at the bottom of the screen ("Wiktor: Don't shoot!"), fading after a few seconds.

let el: HTMLDivElement | null = null, timer = 0;
export function say(who: string, text: string, secs = 6) {
  if (!el) { el = document.createElement('div'); el.id = 'speech'; document.body.appendChild(el); }
  el.innerHTML = `<b>${who}:</b> ${text}`;
  el.style.opacity = '1';
  clearTimeout(timer); timer = window.setTimeout(() => { if (el) el.style.opacity = '0'; }, secs * 1000);
}
