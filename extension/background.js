// Background service worker — BES Extension

// Écoute les messages de la webapp ou du content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Ouvrir un profil LinkedIn et injecter le message
  if (msg.type === 'SEND_LINKEDIN_MESSAGE') {
    const { profileUrl, message, prospectName } = msg;

    chrome.tabs.create({ url: profileUrl, active: true }, (tab) => {
      // Attendre que la page charge
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'INJECT_MESSAGE',
              message,
              prospectName
            });
          }, 2500);
        }
      });
    });
    sendResponse({ ok: true });
  }

  // Récupérer les leads depuis le storage
  if (msg.type === 'GET_LEADS') {
    chrome.storage.local.get(['bes_leads'], (result) => {
      sendResponse({ leads: result.bes_leads || [] });
    });
    return true;
  }

  // Sauvegarder les leads
  if (msg.type === 'SAVE_LEADS') {
    chrome.storage.local.set({ bes_leads: msg.leads }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  return true;
});

// Écouter les connexions depuis la webapp via externally_connectable
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'BES_SEND_MESSAGE') {
    chrome.runtime.sendMessage({ type: 'SEND_LINKEDIN_MESSAGE', ...msg.data });
    sendResponse({ ok: true });
  }
  return true;
});
