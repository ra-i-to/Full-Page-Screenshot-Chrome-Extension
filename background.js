chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.action === "takeScreenshot") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      sendResponse(dataUrl);
    });
    return true;
  }
});
