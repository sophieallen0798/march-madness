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

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', path, false); // synchronous so page scripts can rely on DOM
    xhr.send(null);
    if (xhr.status === 200) {
      script.insertAdjacentHTML('afterend', xhr.responseText);
    } else {
      console.error('Include failed:', path, xhr.status);
    }
  } catch (e) {
    console.error('Include error:', e);
  }
})();
