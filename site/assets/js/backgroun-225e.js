(function (window, document) {
  "use strict";

  function toCssUrl(path) {
    var url = String(path || "");
    try {
      url = new URL(url, window.location.href).href;
    } catch (error) {
      // Keep the original path when URL parsing is unavailable.
    }
    return 'url("' + url.replace(/"/g, '\\"') + '")';
  }

  function setTone(element, tone) {
    if (!element) {
      return;
    }
    var nextTone = tone === "light" ? "light" : "dark";
    element.setAttribute("data-bg-tone", nextTone);
  }

  function sampleBrightness(image) {
    var canvas = document.createElement("canvas");
    var size = 24;
    canvas.width = size;
    canvas.height = size;
    var context = canvas.getContext("2d", {
      willReadFrequently: true
    });
    context.drawImage(image, 0, 0, size, size);

    var data = context.getImageData(0, 0, size, size).data;
    var total = 0;
    var count = 0;

    for (var index = 0; index < data.length; index += 4) {
      var red = data[index];
      var green = data[index + 1];
      var blue = data[index + 2];
      total += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      count += 1;
    }

    return total / Math.max(count, 1);
  }

  function apply(element, config) {
    var pageElement = element || document.body;
    var heroElement = document.getElementById("heroPanel");

    if (!pageElement) {
      return;
    }

    var display = config.display || {};
    var imagePath = display.backgroundImage || "";
    var keepDynamicPageImage = display.dynamicTimeBackground !== false
      && pageElement.hasAttribute("data-time-background");
    if (!keepDynamicPageImage) {
      pageElement.style.removeProperty("--page-image");
    }
    pageElement.style.removeProperty("--scenic-image");
    if (heroElement) {
      heroElement.style.removeProperty("--hero-image");
    }

    if (!imagePath) {
      setTone(pageElement, "dark");
      setTone(heroElement, "dark");
      return;
    }

    if (!keepDynamicPageImage) {
      pageElement.style.setProperty("--page-image", toCssUrl(imagePath));
    }
    pageElement.style.setProperty("--scenic-image", toCssUrl(imagePath));

    if (display.backgroundTone === "light" || display.backgroundTone === "dark") {
      setTone(pageElement, display.backgroundTone);
      setTone(heroElement, display.backgroundTone);
      return;
    }

    var image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = function () {
      try {
        var brightness = sampleBrightness(image);
        var tone = brightness > 150 ? "light" : "dark";
        setTone(pageElement, tone);
        setTone(heroElement, tone);
      } catch (error) {
        setTone(pageElement, "dark");
        setTone(heroElement, "dark");
      }
    };
    image.onerror = function () {
      setTone(pageElement, "dark");
      setTone(heroElement, "dark");
    };
    image.src = imagePath;
  }

  window.BackgroundContrast = {
    apply: apply
  };
})(window, document);
