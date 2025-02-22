document.addEventListener("DOMContentLoaded", () => {
  document.title = chrome.i18n.getMessage("appName");
  document.querySelector("#capture .label").textContent = chrome.i18n.getMessage("captureButtonLabel");
  document.querySelector(".hide_fixed_elements_label").textContent = chrome.i18n.getMessage("hideFixedElementsLabel");
});

document.getElementById("capture").addEventListener("click", () => {
  const hideFixedElements = document.getElementById("hide_fixed_elements").checked;

  // アクティブなタブで関数を実行し、引数を渡す
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: captureFullPage,
      args: [hideFixedElements],
    });
  });
});

// スクリーンショット撮影と追従コンテンツの非表示処理
function captureFullPage(hideFixedElements) {
  (async () => {
    try {
      // スクロールバーを非表示にする
      const originalOverflowStyle = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // 追従コンテンツを非表示にする
      const fixedElements = [];
      if (hideFixedElements) {
        document.querySelectorAll("*").forEach((el) => {
          const style = window.getComputedStyle(el);
          if (style.position === "fixed" || style.position === "sticky") {
            fixedElements.push({ element: el, display: el.style.display });
            el.style.display = "none"; // 非表示にする
          }
        });
      }

      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      let totalHeight = document.documentElement.scrollHeight;
      let viewportHeight = window.innerHeight;
      let screenshots = [];
      let currentScrollY = 0;

      // スクロールしてスクリーンショットを撮影
      while (currentScrollY < totalHeight) {
        window.scrollTo(0, currentScrollY);
        await delay(500);

        const screenshot = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: "takeScreenshot" }, (response) => {
            if (response) {
              resolve(response);
            } else {
              reject("Failed to capture screenshot");
            }
          });
        });
        screenshots.push(screenshot);

        currentScrollY += viewportHeight;
      }

      // スクロールバーを元に戻す
      document.body.style.overflow = originalOverflowStyle;

      // 追従コンテンツを元に戻す
      if (hideFixedElements) {
        fixedElements.forEach(({ element, display }) => {
          element.style.display = display;
        });
      }

      // ページを一番上に戻す
      window.scrollTo(0, 0);

      // 画像を結合して1枚のPNGを作成
      const stitchedImage = await stitchImages(screenshots, viewportHeight, totalHeight);

      // ダウンロードリンクを作成して画像を保存
      const link = document.createElement("a");
      link.href = stitchedImage;
      const currentTime = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `ss_${currentTime}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 画像結合の関数
      async function stitchImages(screenshots, viewportHeight, totalHeight) {
        const canvas = document.createElement("canvas");
        const img = new Image();
        img.src = screenshots[0];
        await new Promise((resolve) => (img.onload = resolve));
        canvas.width = img.width;
        canvas.height = totalHeight;

        const context = canvas.getContext("2d");

        for (let i = 0; i < screenshots.length; i++) {
          const img = new Image();
          img.src = screenshots[i];
          await new Promise((resolve) => (img.onload = resolve));

          const yPos = i * viewportHeight;
          const remainingHeight = totalHeight - yPos;
          const drawHeight = Math.min(viewportHeight, remainingHeight);
          if (i === screenshots.length - 1 && drawHeight < viewportHeight) {
            const clipStartY = viewportHeight - drawHeight;
            context.drawImage(img, 0, clipStartY, img.width, drawHeight, 0, yPos, canvas.width, drawHeight);
          } else {
            context.drawImage(img, 0, 0, img.width, viewportHeight, 0, yPos, canvas.width, viewportHeight);
          }
        }

        return canvas.toDataURL("image/png");
      }
    } catch (error) {
      alert(chrome.i18n.getMessage("errorMessage"));
    }
  })();
}
