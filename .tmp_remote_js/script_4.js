/*
 * Platz für eigenes Javascript
 * Die hier gemachten �?nderungen überschreiben ggfs. andere Funktionen, da diese Datei als letzte geladen wird.
 */
$(document).ready(function () {
  $(".recommendations.page-product .navigations .arrow-btn").click(function () {
    let type = $(this).data("type");
    $(`.slick-${type}.slick-arrow[type="button"]`)?.click();
  });

  const wrapper = document.querySelector("#image_wrapper");
  if (wrapper) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          if (!wrapper.classList.contains("fullscreen")) {
            document.getElementById("jtl-nav-wrapper").removeAttribute("style");
          }
        }
      });
    });
    observer.observe(wrapper, { attributes: true, attributeFilter: ["class"] });
  }

  const sectionAdditionalparts = $(
    ".section_additionalparts .select2-hidden-accessible"
  );
  sectionAdditionalparts.on("select2:select", function (e) {
    const data = e.params.data;
    const parent = $(this).closest(".conf-choise__select");
    if (parent.length > 0 && data) {
      if (Number.isInteger(parseInt(data?.id))) {
        parent?.find(".cursor-pointer-check")?.addClass("active");
      } else {
        parent?.find(".cursor-pointer-check")?.removeClass("active");
      }
    }
  });
  sectionAdditionalparts.each(function () {
    const value = $(this).val();
    if (Number.isInteger(parseInt(value))) {
      const parent = $(this).closest(".conf-choise__select");
      parent?.find(".cursor-pointer-check")?.addClass("active");
    }
  });

  $("#gallery_preview, #gallery").on(
    "lazyLoaded",
    function (event, slick, image, imageSource) {
      const $picture = $(image).closest("picture");
      $picture.find("source[data-lazy-srcset]").each(function () {
        const lazySrc = $(this).attr("data-lazy-srcset");
        if (lazySrc) {
          $(this).attr("srcset", lazySrc);
        }
      });

      const $img = $(image);
      const lazySrc = $img.attr("data-lazy-src");
      if (lazySrc) {
        $img.attr("src", lazySrc);
      }
    }
  );

  const observerG = new MutationObserver((mutationsList, observer) => {
    const iframe = document.querySelector(
      'iframe[src*="google.com/shopping/customerreviews"]'
    );
    if (iframe) {
      iframe.setAttribute("title", "Google Kundenrezensionen");
      iframe.setAttribute("aria-hidden", "true");
      iframe.setAttribute("tabindex", "-1");
      observer.disconnect();
    }
  });

  observerG.observe(document.body, { childList: true, subtree: true });
});

// Script for lazy loading initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("Initializing lazy loading for videos...");

  // Function to initialize lazy loading
  function initLazyLoading() {
    const lazyVideos = document.querySelectorAll("video.lazy");

    if ("IntersectionObserver" in window) {
      // Use Intersection Observer for modern browsers
      let lazyVideoObserver = new IntersectionObserver(function (
        entries,
        observer
      ) {
        entries.forEach(function (video) {
          if (video.isIntersecting) {
            loadVideo(video.target);
            lazyVideoObserver.unobserve(video.target);
          }
        });
      });

      lazyVideos.forEach(function (lazyVideo) {
        lazyVideoObserver.observe(lazyVideo);
      });
    } else {
      // Fallback for older browsers - load immediately
      lazyVideos.forEach(function (lazyVideo) {
        loadVideo(lazyVideo);
      });
    }
  }

  // Video loading function
  function loadVideo(video) {
    const poster = video.getAttribute("data-poster");
    if (poster) {
      video.poster = poster;
    }

    // Find source elements and set src
    const sources = video.querySelectorAll("source[data-src]");
    sources.forEach(function (source) {
      const src = source.getAttribute("data-src");
      if (src) {
        source.src = src;
      }
    });

    // Remove lazy class
    video.classList.remove("lazy");

    // Load video
    video.load();

    // Handle errors
    video.addEventListener("error", function (e) {
      console.error("Video loading error:", e);
      // Can add fallback or show message
    });

    video.addEventListener("loadeddata", function () {
      console.log("Video loaded successfully");
    });
  }

  // Additional check for videos already on screen
  function checkVisibleVideos() {
    const lazyVideos = document.querySelectorAll("video.lazy");
    lazyVideos.forEach(function (video) {
      const rect = video.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        loadVideo(video);
      }
    });
  }

  // Initialize
  initLazyLoading();

  // Check visible videos after one second (in case of issues)
  setTimeout(checkVisibleVideos, 1000);

  // Additional button for manual loading (for diagnostics)
  if (window.location.search.includes("debug")) {
    const debugBtn = document.createElement("button");
    debugBtn.textContent = "Load All Videos (Debug)";
    debugBtn.style.cssText = "position:fixed;top:10px;right:10px;z-index:9999;";
    debugBtn.onclick = function () {
      document.querySelectorAll("video.lazy").forEach(loadVideo);
    };
    document.body.appendChild(debugBtn);
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const trigger = document.querySelector(".contact-modal-wrapper > span");
  const modal = document.querySelector(".contact-modal");

  trigger.addEventListener("click", function (e) {
    e.stopPropagation();
    modal.classList.toggle("is-active");
  });

  document.addEventListener("click", function (e) {
    if (!modal.contains(e.target) && !trigger.contains(e.target)) {
      modal.classList.remove("is-active");
    }
  });
});

// gallery optimization
$('#gallery_preview').on('init', function(event, slick) {
    $(slick.$slides.slice(0, slick.options.slidesToShow)).each(function() {
        var $img = $(this).find('img[data-src]');
        var $source = $(this).find('source[data-srcset]');

        if ($source.length) {
            $source.attr('srcset', $source.data('srcset'));
        }
        if ($img.length) {
            $img.attr('src', $img.data('src'));
        }
    });
});

$('#gallery_preview').on('beforeChange', function(event, slick, currentSlide, nextSlide) {
    var start = nextSlide;
    var end = nextSlide + slick.options.slidesToShow;

    $(slick.$slides.slice(start, end)).each(function() {
        var $img = $(this).find('img[data-src]');
        var $source = $(this).find('source[data-srcset]');

        if ($source.length && !$source.attr('srcset')) {
            $source.attr('srcset', $source.data('srcset'));
        }
        if ($img.length && !$img.attr('src').includes('http')) {
            $img.attr('src', $img.data('src'));
        }
    });
});
