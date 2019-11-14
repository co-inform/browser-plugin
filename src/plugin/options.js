// Init the theshold value
const init = () => {
  chrome.storage.local.get(['treshold'], (data) => {
    if (data.treshold === 'low') {
      document.getElementById('treshold_1').checked = true;
    } else if (data.treshold === 'high') {
      document.getElementById('treshold_3').checked = true;
    } else {
      document.getElementById('treshold_2').checked = true;
    }
  })
};

// Saves options to Chrome local Storage.
const saveOptions = () => {
  const tresholdValue = document.querySelector('input[name="treshold"]:checked').value || 'medium';
  chrome.storage.local.set({'treshold': tresholdValue});
  window.close();
};

const saveButton = document.getElementById('save_button');
saveButton.addEventListener('click', (event) => {
  saveOptions();
});

init();
