// Synchronously include small shared HTML fragments (header/footer).
// This runs at the point where the script tag appears in the DOM,
// and inserts the requested include right after the script element.
(function(){
  const script = document.currentScript;
  if (!script) return;
  const which = script.dataset.include;
  if (!which) return;
  let path = '';
  if (which === 'header') path = 'includes/header.html';
  else if (which === 'footer') path = 'includes/footer.html';
  else return;

  // Load includes asynchronously and expose a promise `window.includeReady`
  // so other page scripts can `await window.includeReady` when they need the
  // included DOM to be present (for example `updateNav()` in pages).
  const loader = async () => {
    try {
      const resp = await fetch(path);
      if (!resp.ok) {
        console.error('Include failed:', path, resp.status);
        return;
      }
      const text = await resp.text();
      script.insertAdjacentHTML('afterend', text);
    } catch (e) {
      console.error('Include error:', e);
    }
  };

  if (window.includeReady && typeof window.includeReady.then === 'function') {
    window.includeReady = window.includeReady.then(loader);
  } else {
    window.includeReady = loader();
  }
})();
