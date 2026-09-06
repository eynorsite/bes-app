// Content script injecté sur linkedin.com

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'INJECT_MESSAGE') {
    injectLinkedInMessage(msg.message, msg.prospectName);
  }
});

async function injectLinkedInMessage(message, prospectName) {
  // Chercher le bouton "Message" ou "Se connecter" sur le profil
  await waitForElement('button', 10000);

  // Essai 1 : bouton "Message" direct (profil déjà connecté)
  let msgBtn = findButtonByText('Message');
  if (msgBtn) {
    msgBtn.click();
    await sleep(1500);
    await typeInMessageBox(message);
    showNotification(`✅ Message prêt pour ${prospectName}. Vérifiez avant d'envoyer.`);
    return;
  }

  // Essai 2 : bouton "Se connecter" (pas encore connecté)
  let connectBtn = findButtonByText('Se connecter') || findButtonByText('Connect');
  if (connectBtn) {
    connectBtn.click();
    await sleep(1200);

    // Chercher "Ajouter une note"
    const noteBtn = findButtonByText('Ajouter une note') || findButtonByText('Add a note');
    if (noteBtn) {
      noteBtn.click();
      await sleep(800);
      const textarea = document.querySelector('textarea[name="message"]') ||
                       document.querySelector('.send-invite__custom-message');
      if (textarea) {
        textarea.focus();
        const limited = message.substring(0, 300);
        setNativeValue(textarea, limited);
        showNotification(`✅ Note de connexion prête pour ${prospectName} (${limited.length}/300 car.)`);
        return;
      }
    }
    showNotification(`📋 Clique sur "Se connecter" puis "Ajouter une note" et colle le message.`);
    return;
  }

  showNotification(`⚠️ Bouton Message non trouvé. Rafraîchis la page.`);
}

async function typeInMessageBox(text) {
  // Chercher la zone de message ouverte
  const selectors = [
    '.msg-form__contenteditable',
    '[contenteditable="true"]',
    'div[role="textbox"]',
    'textarea.msg-form__textarea'
  ];

  let box = null;
  for (const sel of selectors) {
    box = document.querySelector(sel);
    if (box) break;
  }

  if (!box) {
    // Copier dans le presse-papier en fallback
    await navigator.clipboard.writeText(text).catch(() => {});
    showNotification('📋 Message copié dans le presse-papier — colle-le dans la zone de message.');
    return;
  }

  box.focus();
  await sleep(300);

  // Insérer le texte
  if (box.tagName === 'TEXTAREA') {
    setNativeValue(box, text);
  } else {
    // ContentEditable
    box.innerHTML = '';
    document.execCommand('insertText', false, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  }

  showNotification('✅ Message inséré — vérifiez et cliquez Envoyer.');
}

function findButtonByText(text) {
  const buttons = document.querySelectorAll('button, a.pvs-profile-actions__action');
  for (const btn of buttons) {
    if (btn.textContent.trim().toLowerCase().includes(text.toLowerCase())) {
      return btn;
    }
  }
  return null;
}

function setNativeValue(el, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ||
                       Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  if (nativeSetter) nativeSetter.set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const obs = new MutationObserver(() => {
      const el2 = document.querySelector(selector);
      if (el2) { obs.disconnect(); resolve(el2); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showNotification(msg) {
  // Banner flottant sur la page
  const existing = document.getElementById('bes-notif');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'bes-notif';
  div.style.cssText = `
    position:fixed;top:20px;right:20px;z-index:99999;
    background:#6D1FE0;color:#fff;padding:14px 20px;
    border-radius:10px;font-family:system-ui,sans-serif;
    font-size:14px;max-width:340px;line-height:1.5;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
  `;
  div.innerHTML = `<b style="display:block;margin-bottom:4px">⚡ BES</b>${msg}`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 6000);
}
