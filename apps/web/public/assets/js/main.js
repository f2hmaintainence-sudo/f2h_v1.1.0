(function ($) {
  'use strict';
  /*=================================
      JS Index Here
  ==================================*/
  /*
    01. Preloader or Preloader Must Needed In Your Project
    02. Swiper Slider Active for All Home Pages Hero Section
    03. Global Swiper Initialization
    04. Swiper Connected Nav With Thumbs for Shop Details Page
    05. Program Section Swiper Slider Active Used In index,index-2,index-3
    06. Swiper Feedback Slider
    07. Swiper Client Slider
    08. Start With Lenis & GSAP Activation
    09. Back To Top
    10. Animate Counter
    11. Magic Hover
    12. GSAP Title Animation
    13. Element Movement On Mouse Enter With GSAP Plugins
    14. Parallax Zoom Animation
    15. Mobile Menu Active
    16. Sticky Menu
    17. Dynamic Background Image
    18. Skill Progressbar - Intersection Observer
    19. Woocommerce color Swatch
    20. Quantity Increase and Decrease
    21. Ajax Contact Form
    22. Magnify Popup
    23. Section Position
    24. WOW Js Active
    25. Button Background Indicator
    26. Current Year Set
    27. SVG Assets in Inline
    28. Active Menu Item Based On URL
    29. Custom Toggle Expand
    30. Custom Range Slider
    31. Woocommerce Toggle
    32. Popup Search Box
    33. Popup SideCart
    34. Popup Sidebar Canvas Menu
    35. Countdown Timer for Coming Soon
    36. Team Social On Mouse Enter
    37. VS Hover Magic
    38. VS Hover Image Card
    39. Section Ball
  */
  /*=================================
      JS Index End
  ==================================*/
  /*

  /**************************************
   ***** 01. Preloader or Preloader Must Needed In Your Project *****
   **************************************/
  $(window).on('load', function () {
    // Define GSAP animation for the preloader
    if ($('.preloader').length) {
      gsap.to('.preloader', {
        y: '-100%',
        duration: 1.2,
        ease: 'power3.inOut',
        onComplete: function () {
          $('.preloader').hide();
        },
      });

      // Handle preloader close event
      $('.preloaderCls').on('click', function (e) {
        e.preventDefault(); // Prevent default action
        gsap.to('.preloader', {
          y: '-100%',
          duration: 1.2,
          ease: 'power3.inOut',
          onComplete: function () {
            $('.preloader').hide();
          },
        });
      });
    }
  });

  /**************************************
   ***** 02. Swiper Slider Active for All Home Pages Hero Section *****
   **************************************/
  const hero_slider = new Swiper(".vs-hero__active--zoom", {
    slidesPerView: 1,
    speed: 1500,
    spaceBetween: 0,
    effect: "fade",
    fadeEffect: {
      crossFade: true,
    },
    loop: true,
    autoplay: false,
    navigation: {
      nextEl: ".vs-swiper-button-next",
      prevEl: ".vs-swiper-button-prev",
    },
    pagination: {
      el: ".vs-hero-pagination", // Custom class to avoid conflicts
      clickable: true,
      renderBullet: function (index, className) {
        return `<span class="${className}"><i class="fas fa-star"></i></span>`;
      },
    },
  });

  function applyAnimationDelays() {
    // Get all animatable elements and reset them
    const slideActiveClass = document.querySelectorAll(".vs-hero__active--zoom .swiper-slide-active:not(.swiper-slide-duplicate)");
    slideActiveClass.forEach((el) => {
      el.classList.remove("manimated");
      el.style.animationDelay = ""; // Reset inline delay
    });

    // Select active slide (visible and fully visible)
    const activeSlide = document.querySelector(
      ".vs-hero__active--zoom .swiper-slide-active:not(.swiper-slide-duplicate)"
    );

    if (!activeSlide) return;

    // Animate elements inside only the active slide
    const animElements = activeSlide.querySelectorAll(".vs-hero__anim");
    animElements.forEach((el, index) => {
      const delay = 1.1 + index * 0.2;
      el.style.animationDelay = `${delay}s`;

      // Force reflow and add animation class
      void el.offsetWidth;
      el.classList.add("manimated");
    });
  }

  // Run on load
  applyAnimationDelays();

  // Run on Swiper slide change
  hero_slider.on("slideChangeTransitionStart", applyAnimationDelays);

  /**************************************
     ***** 03. Global Swiper Initialization *****
     **************************************/
  document.querySelectorAll('.vs-carousel').forEach((carousel) => {
    // Convert kebab-case to camelCase and parse integer safely
    const getData = (attr, fallback) => {
      const camelAttr = attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const val = carousel.dataset[camelAttr];
      return val !== undefined ? parseInt(val, 10) : fallback; // ✅ radix added
    };

    const autoplayDelay = getData('autoplay-delay', 3000);
    const navNext = carousel.dataset.navNext || null;
    const navPrev = carousel.dataset.navPrev || null;
    const paginationSelector = carousel.dataset.pagination;
    const paginationEl = paginationSelector ? document.querySelector(paginationSelector) : null;

    const totalSlides = carousel.querySelectorAll('.swiper-slide').length;

    // Slides per view for each breakpoint
    const slidesXs = getData('xs', 1);
    const slidesSm = getData('sm', 1);
    const slidesMd = getData('md', 2);
    const slidesLg = getData('lg', 3);
    const slidesXl = getData('xl', 4);

    // Spacing for each breakpoint
    const spaceXs = getData('space-xs', 10);
    const spaceSm = getData('space-sm', 15);
    const spaceMd = getData('space-md', 20);
    const spaceLg = getData('space-lg', 24);
    const spaceXl = getData('space-xl', 30);

    const enableLoop = totalSlides > slidesLg;

    new Swiper(carousel, {
      slidesPerView: slidesLg,
      spaceBetween: spaceLg,
      loop: enableLoop,
      autoplay: carousel.dataset.autoplay === "false" ? false : {
        delay: autoplayDelay,
        disableOnInteraction: false,
      },
      navigation: {
        nextEl: navNext && document.querySelector(navNext),
        prevEl: navPrev && document.querySelector(navPrev),
      },
      pagination: paginationEl ? {
        el: paginationEl,
        clickable: true,
        dynamicBullets: true,
        renderBullet: function (index, className) {
          return `<span class="${className}"><i class="fa-solid fa-star"></i></span>`;
        },
      } : false,
      breakpoints: {
        320: {
          slidesPerView: slidesXs,
          spaceBetween: spaceXs,
        },
        576: {
          slidesPerView: slidesSm,
          spaceBetween: spaceSm,
        },
        768: {
          slidesPerView: slidesMd,
          spaceBetween: spaceMd,
        },
        992: {
          slidesPerView: slidesLg,
          spaceBetween: spaceLg,
        },
        1200: {
          slidesPerView: slidesXl,
          spaceBetween: spaceXl,
        }
      }
    });
  });

  /**************************************
   ***** 04. Swiper Connected Nav With Thumbs for Shop Details Page *****
   **************************************/
  const shopThumbs = document.querySelector('.myShopSwiperThumbs');
  const shopMain = document.querySelector('.myShopSwiperMain');

  if (shopThumbs && shopMain) {
    const shopSwiperThumbs = new Swiper(shopThumbs, {
      loop: false,
      spaceBetween: 10,
      slidesPerView: 4,
      freeMode: true,
      watchSlidesProgress: true,
    });

    new Swiper(shopMain, {
      loop: false,
      spaceBetween: 10,
      thumbs: {
        swiper: shopSwiperThumbs,
      },
    });
  }

  /**************************************
   ***** 05. Program Section Swiper Slider Active Used In index,index-2,index-3 *****
   **************************************/
  const pro_slider = new Swiper(".vs-pro--slider", {
    slidesPerView: 3,
    spaceBetween: 20,
    loop: true,
    autoplay: false,
    navigation: {
      nextEl: ".vs-pro--slider__next",
      prevEl: ".vs-pro--slider__prev",
    },
    breakpoints: {
      320: {
        slidesPerView: 1,
        spaceBetween: 10,
      },
      640: {
        slidesPerView: 3,
        spaceBetween: 15,
      },
      1024: {
        slidesPerView: 3,
        spaceBetween: 10,
      }
    }
  });

  /**************************************
   ***** 06. Swiper Feedback Slider *****
   **************************************/
  const feedback_slider = new Swiper(".feedback-slider", {
    slidesPerView: 1,
    speed: 1500,
    spaceBetween: 0,
    effect: "fade",
    fadeEffect: {
      crossFade: true,
    },
    loop: true,
    autoplay: {
      delay: 6000,
    },
    pagination: {
      el: ".vs-feedback-pagination",
      clickable: true,
    },
    navigation: {
      nextEl: ".vs-swiper-button-next",
      prevEl: ".vs-swiper-button-prev",
    },
  });

  /**************************************
   ***** 07. Swiper Client Slider *****
   **************************************/
  const client_slider = new Swiper(".vs-client--slider", {
    slidesPerView: 2,
    spaceBetween: 24,
    loop: true,
    autoplay: {
      delay: 6000,
    },
    navigation: {
      nextEl: ".vs-client--slider__next",
      prevEl: ".vs-client--slider__prev",
    },
    breakpoints: {
      320: {
        slidesPerView: 1,
        spaceBetween: 10,
      },
      640: {
        slidesPerView: 2,
        spaceBetween: 15,
      },
      1024: {
        slidesPerView: 2,
        spaceBetween: 24,
      }
    }
  });

  /**************************************
   ***** 08. Start With Lenis & GSAP Activation *****
   **************************************/
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

  const lenis = new Lenis({
    lerp: 0.1, // animation smoothness (between 0 & 1)
    touchMultiplier: 0, // scrolling speed for touch events
    smoothWheel: true, // smooth scrolling for while events
    smoothTouch: false, // smooth scrolling for touche events
    mouseWheel: false, // smooth scrolling for mouse events
    autoResize: true,
    smooth: true,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    syncTouch: true,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1200);
  });

  /**************************************
   ***** 09. Back To Top *****
   **************************************/
  // Get references to DOM elements
  const backToTopBtn = document.getElementById('backToTop');
  const progressCircle = document.querySelector('.progress');
  const progressPercentage = document.getElementById('progressPercentage');

  // Circle properties
  const CIRCLE_RADIUS = 40;
  const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

  // Set initial styles for the circle
  progressCircle.style.strokeDasharray = CIRCUMFERENCE;
  progressCircle.style.strokeDashoffset = CIRCUMFERENCE;

  // Update progress based on scroll position
  const updateProgress = () => {
    const scrollPosition = window.scrollY;
    const totalHeight =
      document.documentElement.scrollHeight - window.innerHeight;

    if (totalHeight > 0) {
      const scrollPercentage = (scrollPosition / totalHeight) * 100;
      const offset = CIRCUMFERENCE * (1 - scrollPercentage / 100);

      // Update the circle and percentage display
      progressCircle.style.strokeDashoffset = offset.toFixed(2);
      progressPercentage.textContent = `${Math.round(scrollPercentage)}%`;

      // Show or hide the back-to-top button
      if (scrollPercentage > 5) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }
  };

  // Scroll to top using smooth animation
  const scrollToTop = () => {
    gsap.to(window, { duration: 1, scrollTo: 0 });
  };

  // Throttle function to limit function execution frequency
  const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function (...args) {
      const context = this;
      if (!lastRan) {
        func.apply(context, args);
        lastRan = Date.now();
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(() => {
          if (Date.now() - lastRan >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        }, limit - (Date.now() - lastRan));
      }
    };
  };

  // Attach event listeners
  window.addEventListener('scroll', throttle(updateProgress, 50));
  backToTopBtn.addEventListener('click', scrollToTop);

  // Initial update to set the correct progress on page load
  updateProgress();

  /**************************************
   ***** 10. Animate Counter *****
   **************************************/
  function animateCounter(counter) {
    const targetValue = parseInt(counter.getAttribute('data-counter'), 10); // ✅ radix added
    const animationDuration = 1000; // milliseconds
    const startTimestamp = performance.now();

    function updateCounter(timestamp) {
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / animationDuration, 1);
      const currentValue = Math.floor(targetValue * progress);
      counter.textContent = currentValue;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    }

    requestAnimationFrame(updateCounter);
  }

  function startCounterAnimation(entries, observer) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const counter = entry.target.querySelector('.counter-number');
        animateCounter(counter);
        // observer.unobserve(entry.target); // Uncomment if one-time animation needed
      }
    });
  }

  const counterObserver = new IntersectionObserver(startCounterAnimation, {
    rootMargin: '0px',
    threshold: 0.2,
  });

  document.querySelectorAll('.counter-style').forEach((counterBlock) => {
    counterObserver.observe(counterBlock);
  });

  /**************************************
   ***** 11. Magic Hover *****
   **************************************/
  $('.project-item,.team-style,.price-style2').hover(function () {
    $('.project-item,.team-style,.price-style2').removeClass('active');
    $(this).addClass('active');
  });

  // Activate li on click
  $(document).on('click', function () {
    $('.vs-blog__share > ul > li').removeClass('active');
  });

  $('.vs-blog__share > ul > li').on('click', function (e) {
    e.stopPropagation();

    const $this = $(this);
    const isActive = $this.hasClass('active');

    $('.vs-blog__share > ul > li').removeClass('active');

    if (!isActive) {
      $this.addClass('active');
    }
  });

  $(function () {
    const $shareItems = $('.vs-blog__footer--share');

    const deactivateAll = () => $shareItems.removeClass('active');

    $shareItems.on('click', function (e) {
      e.stopPropagation();

      const $this = $(this);
      const isActive = $this.hasClass('active');

      deactivateAll();

      if (!isActive) {
        $this.addClass('active');
      }
    });

    $(document).on('click', deactivateAll);
  });




  /**************************************
   ***** 12. GSAP Title Animation *****
   **************************************/
  gsap.config({
    nullTargetWarn: false,
    trialWarn: false,
  });

  function vsTitleAnimation() {
    const vsElements = document.querySelectorAll('.title-anime');
    if (!vsElements.length || window.innerWidth < 768) return; // Skip on mobile

    vsElements.forEach((container) => {
      const quotes = container.querySelectorAll('.title-anime__wrap');

      quotes.forEach((quote) => {
        // Kill old animation and SplitText if already exists
        if (quote.animation) {
          quote.animation.scrollTrigger.kill();
          quote.animation.kill();
          quote.split.revert();
        }

        const animationClass = container.className.match(/animation-(style\d+)/);
        if (!animationClass || animationClass[1] === 'style4') return;

        // Split text into lines, words, and chars
        quote.split = new SplitText(quote, {
          type: 'lines,words,chars',
          linesClass: 'split-line',
          charsClass: 'char'
        });

        // REMOVE INLINE STYLES:
        const splitLines = quote.querySelectorAll('.split-line');
        splitLines.forEach(line => {
          line.style.textAlign = '';
        });

        const chars = quote.split.chars;
        const style = animationClass[1];

        // Set initial transform styles with responsive-friendly units
        const initialStates = {
          style1: { opacity: 0, y: '30vh', rotateX: '-40deg' },
          style2: { opacity: 0, x: '5vw' },
          style3: { opacity: 0 },
          style4: { opacity: 0, skewX: '-30deg', scale: 0.8 },
          style5: { opacity: 0, scale: 0.5 },
          style6: { opacity: 0, y: '-50vh', rotate: '45deg' },
        };

        gsap.set(quote, { perspective: 1000 });
        gsap.set(chars, initialStates[style]);

        // Create ScrollTrigger-based animation
        quote.animation = gsap.to(chars, {
          x: 0,
          y: 0,
          rotateX: 0,
          rotate: 0,
          opacity: 1,
          skewX: 0,
          scale: 1,
          duration: 1,
          ease: 'expo.out',
          stagger: 0.02,
          scrollTrigger: {
            trigger: quote,
            start: 'top 95%',
            end: 'bottom 5%',
            toggleActions: 'restart none restart none',
            markers: false,
            onEnter: () => runAnimationAgain(quote),
            onEnterBack: () => runAnimationAgain(quote),
          }
        });
      });
    });
  }

  // Function to rerun animation when re-entered
  function runAnimationAgain(quote) {
    if (quote.animation) {
      quote.animation.restart(true);
    }
  }

  // Clean up SplitText before refresh
  ScrollTrigger.addEventListener('refreshInit', () => {
    document.querySelectorAll('.title-anime__wrap').forEach((quote) => {
      if (quote.split) quote.split.revert();
    });
  });

  // Re-run animation setup on refresh
  ScrollTrigger.addEventListener('refresh', vsTitleAnimation);

  // Re-run animation on window resize (debounced)
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 200);
  });

  // Run on DOM load (only for larger devices)
  document.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth >= 768) {
      vsTitleAnimation();
      ScrollTrigger.refresh();
    }
  });

  /**************************************
   ***** 13. Element Movement On Mouse Enter With GSAP Plugins *****
   **************************************/
  // Loop over all .parallax-wrap containers
  document.querySelectorAll('.parallax-wrap').forEach(function (wrap) {
    wrap.addEventListener('mousemove', function (event) {
      const elements = wrap.querySelectorAll('.parallax-element');
      elements.forEach(function (element) {
        const move = parseFloat(element.dataset.move) || 20; // default to 20 if not set
        applyParallaxEffect(event, wrap, element, move);
      });
    });

    wrap.addEventListener('mouseleave', function () {
      const elements = wrap.querySelectorAll('.parallax-element');
      elements.forEach(function (element) {
        gsap.to(element, {
          duration: 0.3,
          x: 0,
          y: 0,
          ease: Power2.easeOut,
        });
      });
    });
  });

  /**************************************
   ***** 14. Parallax Zoom Animation *****
   **************************************/
  gsap.utils.toArray('[data-vs-gsap-parallax-speed]').forEach((container) => {
    const img = container.querySelector('img');
    const speed =
      parseFloat(container.getAttribute('data-vs-gsap-parallax-speed')) || 1; // Default speed is 1
    const zoomEnabled = container.hasAttribute('data-vs-gsap-parallax-zoom'); // Check if zoom attribute exists

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        scrub: true,
        pin: false,
      },
    });

    const fromVars = {
      yPercent: -10 * speed,
      ease: 'none',
    };

    const toVars = {
      yPercent: 10 * speed,
      ease: 'none',
    };

    if (zoomEnabled) {
      fromVars.scale = 1; // Initial scale
      toVars.scale = 1.2; // Target scale
    }

    tl.fromTo(img, fromVars, toVars);
  });

  /**
   * Applies parallax movement to a target element based on cursor position
   */
  function applyParallaxEffect(event, container, target, intensity) {
    const rect = container.getBoundingClientRect();
    const relX = event.clientX - rect.left;
    const relY = event.clientY - rect.top;

    const moveX = ((relX - rect.width / 2) / rect.width) * intensity;
    const moveY = ((relY - rect.height / 2) / rect.height) * intensity;

    gsap.to(target, {
      duration: 0.3,
      x: moveX,
      y: moveY,
      ease: Power2.easeOut,
    });
  }

  /**************************************
   ***** 15. Mobile Menu Active *****
   **************************************/
  $.fn.vsmobilemenu = function (options) {
    var opt = $.extend(
      {
        menuToggleBtn: '.vs-menu-toggle',
        bodyToggleClass: 'vs-body-visible',
        subMenuClass: 'vs-submenu',
        subMenuParent: 'vs-item-has-children',
        subMenuParentToggle: 'vs-active',
        meanExpandClass: 'vs-mean-expand',
        appendElement: '<span class="vs-mean-expand"></span>',
        subMenuToggleClass: 'vs-open',
        toggleSpeed: 400,
      },
      options
    );

    return this.each(function () {
      var menu = $(this); // Select menu

      // Menu Show & Hide
      function menuToggle() {
        menu.toggleClass(opt.bodyToggleClass);

        // collapse submenu on menu hide or show
        var subMenu = '.' + opt.subMenuClass;
        $(subMenu).each(function () {
          if ($(this).hasClass(opt.subMenuToggleClass)) {
            $(this).removeClass(opt.subMenuToggleClass);
            $(this).css('display', 'none');
            $(this).parent().removeClass(opt.subMenuParentToggle);
          }
        });
      }

      // Class Set Up for every submenu
      menu.find('li').each(function () {
        var submenu = $(this).find('ul');
        submenu.addClass(opt.subMenuClass);
        submenu.css('display', 'none');
        submenu.parent().addClass(opt.subMenuParent);
        submenu.prev('a').append(opt.appendElement);
        submenu.next('a').append(opt.appendElement);
      });

      // Toggle Submenu
      function toggleDropDown($element) {
        if ($($element).next('ul').length > 0) {
          $($element).parent().toggleClass(opt.subMenuParentToggle);
          $($element).next('ul').slideToggle(opt.toggleSpeed);
          $($element).next('ul').toggleClass(opt.subMenuToggleClass);
        } else if ($($element).prev('ul').length > 0) {
          $($element).parent().toggleClass(opt.subMenuParentToggle);
          $($element).prev('ul').slideToggle(opt.toggleSpeed);
          $($element).prev('ul').toggleClass(opt.subMenuToggleClass);
        }
      }

      // Submenu toggle Button
      var expandToggler = '.' + opt.meanExpandClass;
      $(expandToggler).each(function () {
        $(this).on('click', function (e) {
          e.preventDefault();
          toggleDropDown($(this).parent());
        });
      });

      // Menu Show & Hide On Toggle Btn click
      $(opt.menuToggleBtn).each(function () {
        $(this).on('click', function () {
          menuToggle();
        });
      });

      // Hide Menu On out side click
      menu.on('click', function (e) {
        e.stopPropagation();
        menuToggle();
      });

      // Stop Hide full menu on menu click
      menu.find('div').on('click', function (e) {
        e.stopPropagation();
      });
    });
  };

  $('.vs-menu-wrapper').vsmobilemenu();
  /**************************************
   ***** 16. Sticky Menu *****
   **************************************/
  var lastScrollTop = '';
  var scrollToTopBtn = '.scrollToTop';

  function stickyMenu($targetMenu, $toggleClass, $parentClass) {
    var st = $(window).scrollTop();
    var height = $targetMenu.css('height');
    $targetMenu.parent().css('min-height', height);
    if ($(window).scrollTop() > 800) {
      $targetMenu.parent().addClass($parentClass);

      if (st > lastScrollTop) {
        $targetMenu.removeClass($toggleClass);
      } else {
        $targetMenu.addClass($toggleClass);
      }
    } else {
      $targetMenu.parent().css('min-height', '').removeClass($parentClass);
      $targetMenu.removeClass($toggleClass);
    }
    lastScrollTop = st;
  }
  $(window).on('scroll', function () {
    stickyMenu($('.sticky-active'), 'active', 'will-sticky');
    if ($(this).scrollTop() > 500) {
      $(scrollToTopBtn).addClass('show');
    } else {
      $(scrollToTopBtn).removeClass('show');
    }
  });


  /**************************************
   ***** 17. Dynamic Background Image *****
   **************************************/
  if ($('[data-bg-src]').length > 0) {
    $('[data-bg-src]').each(function () {
      var src = $(this).attr('data-bg-src');
      $(this).css('background-image', 'url(' + src + ')');
      $(this).removeAttr('data-bg-src').addClass('background-image');
    });
  }

  /**************************************
   ***** 18. Skill Progressbar - Intersection Observer *****
   **************************************/
  document.addEventListener('DOMContentLoaded', function () {
    const progressBoxes = document.querySelectorAll('.progress-box');

    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Intersection observer threshold
    };

    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateProgressBar(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, options);

    progressBoxes.forEach((progressBox) => {
      observer.observe(progressBox);
    });

    function animateProgressBar(progressBox) {
      try {
        const progressBar = progressBox.querySelector('.progress-box__bar');
        const progressNumber = progressBox.querySelector(
          '.progress-box__number'
        );

        // Retrieve target width from data attribute
        const targetWidth = parseInt(progressBar.dataset.width, 10);
        let width = 0;

        const countInterval = setInterval(() => {
          width++;
          progressBar.style.width = width + '%';

          // Safely update the progress number
          if (progressNumber) {
            progressNumber.textContent = width + '%';
          }

          if (width >= targetWidth) {
            clearInterval(countInterval);
          }
        }, 20);
      } catch (error) {
        console.error('Error animating progress bar:', error);
      }
    }
  });

  /**************************************
   ***** 19. Woocommerce color Swatch *****
   **************************************/
  document.addEventListener("DOMContentLoaded", function () {
    const swatches = document.querySelectorAll(".swatch");

    // Add click event to each swatch
    swatches.forEach((swatch) => {
      swatch.addEventListener("click", function () {
        // Remove 'active' class from all swatches
        swatches.forEach((s) => s.classList.remove("active"));

        // Add 'active' class to the clicked swatch
        this.classList.add("active");
      });
    });
  });

  document.addEventListener("DOMContentLoaded", function () {
    const sizes = document.querySelectorAll(".size");

    // Add click event to each swatch
    sizes.forEach((swatch) => {
      swatch.addEventListener("click", function () {
        // Remove 'active' class from all sizes
        sizes.forEach((s) => s.classList.remove("active"));

        // Add 'active' class to the clicked swatch
        this.classList.add("active");
      });
    });
  });

  /**************************************
   ***** 20. Quantity Increase and Decrease *****
   **************************************/
  $(".quantity-plus, .quantity-minus").on("click", function (e) {
    e.preventDefault();
    let $qty = $(this).closest(".quantity-container").find(".qty-input");
    let currentVal = parseInt($qty.val(), 10);

    if (isNaN(currentVal)) return;

    let isPlus = $(this).hasClass("quantity-plus");
    let newVal = isPlus ? currentVal + 1 : currentVal - 1;

    if (newVal >= 1) {
      $qty.val(formatNumber(newVal));
    }
  });

  function formatNumber(num) {
    return num.toString().padStart(2, "0");
  }

  /**************************************
   ***** 21. Ajax Contact Form *****
   **************************************/
  function ajaxContactForm(selectForm) {
    var form = selectForm;
    var invalidCls = "is-invalid";
    var $email = '[name="email"]';
    var $validation =
      '[name="name"],[name="email"],[name="phone"],[name="message"]'; // Remove [name="subject"]
    var formMessages = $(selectForm).next(".form-messages");

    function sendContact() {
      var formData = $(form).serialize();
      var valid;
      valid = validateContact();
      if (valid) {
        jQuery
          .ajax({
            url: $(form).attr("action"),
            data: formData,
            type: "POST",
          })
          .done(function (response) {
            // Make sure that the formMessages div has the 'success' class.
            formMessages.removeClass("error");
            formMessages.addClass("success");
            // Set the message text.
            formMessages.text(response);
            // Clear the form.
            $(form + ' input:not([type="submit"]),' + form + " textarea").val(
              ""
            );
          })
          .fail(function (data) {
            // Make sure that the formMessages div has the 'error' class.
            formMessages.removeClass("success");
            formMessages.addClass("error");
            // Set the message text.
            if (data.responseText !== "") {
              formMessages.html(data.responseText);
            } else {
              formMessages.html(
                "Oops! An error occurred and your message could not be sent."
              );
            }
          });
      }
    }

    function validateContact() {
      var valid = true;
      var formInput;
      function unvalid($validation) {
        $validation = $validation.split(",");
        for (var i = 0; i < $validation.length; i++) {
          formInput = form + " " + $validation[i];
          if (!$(formInput).val()) {
            $(formInput).addClass(invalidCls);
            valid = false;
          } else {
            $(formInput).removeClass(invalidCls);
            valid = true;
          }
        }
      }
      unvalid($validation);

      if (
        !$(form + " " + $email).val() ||
        !$(form + " " + $email)
          .val()
          .match(/^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/)
      ) {
        $(form + " " + $email).addClass(invalidCls);
        valid = false;
      } else {
        $(form + " " + $email).removeClass(invalidCls);
        valid = true;
      }
      return valid;
    }

    $(form).on("submit", function (element) {
      element.preventDefault();
      sendContact();
    });
  }
  ajaxContactForm(".ajax-contact");

  /**************************************
   ***** 22. Magnify Popup *****
   **************************************/
  /* magnificPopup img view */
  $('.popup-image').magnificPopup({
    type: 'image',
    gallery: {
      enabled: true,
    },
  });

  /* magnificPopup video view */
  $('.popup-video').magnificPopup({
    type: 'iframe',
  });

  /**************************************
   ***** 23. Section Position *****
   **************************************/
  // Interger Converter
  function convertInteger(str) {
    return parseInt(str, 10);
  }

  $.fn.sectionPosition = function (mainAttr, posAttr, getPosValue) {
    $(this).each(function () {
      var section = $(this);

      function setPosition() {
        var sectionHeight = Math.floor(section.height() / 2), // Main Height of section
          posValue = convertInteger(section.attr(getPosValue)), // positioning value
          posData = section.attr(mainAttr), // how much to position
          posFor = section.attr(posAttr), // On Which section is for positioning
          parentPT = convertInteger($(posFor).css('padding-top')), // Default Padding of  parent
          parentPB = convertInteger($(posFor).css('padding-bottom')); // Default Padding of  parent

        if (posData === 'top-half') {
          $(posFor).css('padding-bottom', parentPB + sectionHeight + 'px');
          section.css('margin-top', '-' + sectionHeight + 'px');
        } else if (posData === 'bottom-half') {
          $(posFor).css('padding-top', parentPT + sectionHeight + 'px');
          section.css('margin-bottom', '-' + sectionHeight + 'px');
        } else if (posData === 'top') {
          $(posFor).css('padding-bottom', parentPB + posValue + 'px');
          section.css('margin-top', '-' + posValue + 'px');
        } else if (posData === 'bottom') {
          $(posFor).css('padding-top', parentPT + posValue + 'px');
          section.css('margin-bottom', '-' + posValue + 'px');
        }
      }
      setPosition(); // Set Padding On Load
    });
  };

  var postionHandler = '[data-sec-pos]';
  if ($(postionHandler).length) {
    $(postionHandler).imagesLoaded(function () {
      $(postionHandler).sectionPosition(
        'data-sec-pos',
        'data-pos-for',
        'data-pos-amount'
      );
    });
  }

  /**************************************
   ***** 24. WOW Js Active *****
   **************************************/
  var wow = new WOW({
    boxClass: 'wow', // animated element css class (default is wow)
    animateClass: 'wow-animated', // animation css class (default is animated)
    offset: 0, // distance to the element when triggering the animation (default is 0)
    mobile: false, // trigger animations on mobile devices (default is true)
    live: true, // act on asynchronously loaded content (default is true)
    scrollContainer: null, // optional scroll container selector, otherwise use window,
    resetAnimation: false, // reset animation on end (default is true)
  });
  wow.init();

  /**************************************
   ***** 25. Button Background Indicator *****
   **************************************/
  function setPos(element) {
    var indicator = element.siblings('.indicator'),
      btnWidth = element.css('width'),
      btnHiehgt = element.css('height'),
      btnLeft = element.position().left,
      btnTop = element.position().top;
    element.addClass('active').siblings().removeClass('active');
    indicator.css({
      left: btnLeft + 'px',
      top: btnTop + 'px',
      width: btnWidth,
      height: btnHiehgt,
    });
  }

  $('.login-tab a').each(function () {
    var link = $(this);
    if (link.hasClass('active')) setPos(link);
    link.on('mouseover', function () {
      setPos($(this));
    });
  });

  /**************************************
   ***** 26. Current Year Set *****
   **************************************/
  document.addEventListener('DOMContentLoaded', () => {
    const currentYear = new Date().getFullYear();
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
      yearElement.textContent = currentYear;
    }
  });



  /**************************************
   ***** 27. SVG Assets in Inline *****
   **************************************/
  // Svg line animation
  // Wait for the DOM to fully load
  document.addEventListener('DOMContentLoaded', () => {
    // Select all paths within .vs-svg-assets in .main-menu
    const paths = document.querySelectorAll(
      '.main-menu .vs-svg-assets svg path'
    );

    paths.forEach((path) => {
      // Get the total length of the current path
      const pathLength = path.getTotalLength();

      // Dynamically set the stroke-dasharray and stroke-dashoffset
      path.style.strokeDasharray = pathLength;
      path.style.strokeDashoffset = pathLength; // Initially hide the stroke
    });
  });

  /**************************************
   ***** 28. Active Menu Item Based On URL *****
   **************************************/
  document.addEventListener('DOMContentLoaded', () => {
    const navMenu = document.querySelector('.main-menu'); // Select the main menu container once
    const windowPathname = window.location.pathname;

    if (navMenu) {
      const navLinkEls = navMenu.querySelectorAll('a'); // Only get <a> tags inside the main menu

      navLinkEls.forEach((navLinkEl) => {
        const navLinkPathname = new URL(navLinkEl.href, window.location.origin)
          .pathname;

        // Match current URL with link's href
        if (
          windowPathname === navLinkPathname ||
          (windowPathname === '/index.html' && navLinkPathname === '/')
        ) {
          navLinkEl.classList.add('active');

          // Add 'active' class to all parent <li> elements
          let parentLi = navLinkEl.closest('li');
          while (parentLi && parentLi !== navMenu) {
            parentLi.classList.add('active');
            parentLi = parentLi.parentElement.closest('li'); // Traverse up safely
          }
        }
      });
    }
  });
  $('.menu-item-has-children > a.active').each(function () {
    var parentItem = $(this).closest('.menu-item-has-children');
    parentItem.removeClass('active');  // Remove 'active' from parent item
    $(this).removeClass('active');     // Remove 'active' from the <a> tag
  });

  /**************************************
   ***** 29. Custom Toggle Expand *****
   **************************************/
  // Function to set the initial expanded state for a single widget
  function setInitialWidgetState(widgetInstance) {
    const toggleButton = widgetInstance.querySelector('.widget__toggle');
    const expandableContent = widgetInstance.querySelector('.widget__toggle__expand');
    const arrowIcon = widgetInstance.querySelector('.widget-arrow-icon');

    if (toggleButton && expandableContent && arrowIcon) {
      expandableContent.classList.add('expanded');
      toggleButton.classList.add('expanded-button');
      arrowIcon.classList.add('expanded-arrow');
      // Set max-height to the scrollHeight to fit content
      expandableContent.style.maxHeight = expandableContent.scrollHeight + "px";
    }
  }

  // Function to toggle the expansion for a single widget
  function toggleWidgetExpansion(widgetInstance) {
    const toggleButton = widgetInstance.querySelector('.widget__toggle');
    const expandableContent = widgetInstance.querySelector('.widget__toggle__expand');
    const arrowIcon = widgetInstance.querySelector('.widget-arrow-icon');

    if (!toggleButton || !expandableContent || !arrowIcon) {
      console.error("Required elements not found in widget instance:", widgetInstance);
      return;
    }

    const isExpanded = expandableContent.classList.contains('expanded');

    if (isExpanded) {
      // Collapse the content
      expandableContent.classList.remove('expanded');
      toggleButton.classList.remove('expanded-button');
      arrowIcon.classList.remove('expanded-arrow');
      expandableContent.style.maxHeight = '0px';
    } else {
      // Expand the content
      expandableContent.classList.add('expanded');
      toggleButton.classList.add('expanded-button');
      arrowIcon.classList.add('expanded-arrow');
      expandableContent.style.maxHeight = expandableContent.scrollHeight + "px";
    }
  }

  // Initialize all widget instances on the page
  document.addEventListener('DOMContentLoaded', () => {
    const widgetInstances = document.querySelectorAll('.smooth-toggle-widget-instance');

    widgetInstances.forEach(instance => {
      // Set initial state (expanded)
      setInitialWidgetState(instance);

      // Add click listener to the toggle button of this instance
      const toggleButton = instance.querySelector('.widget__toggle');
      if (toggleButton) {
        toggleButton.addEventListener('click', function () {
          toggleWidgetExpansion(instance);
        });
      }
    });

    // Adjust max-height on window resize for all expanded widgets
    window.addEventListener('resize', () => {
      widgetInstances.forEach(instance => {
        const expandableContent = instance.querySelector('.widget__toggle__expand');
        if (expandableContent && expandableContent.classList.contains('expanded')) {
          expandableContent.style.maxHeight = expandableContent.scrollHeight + "px";
        }
      });
    });
  });

  /**************************************
   ***** 30. Custom Range Slider *****
   **************************************/
  document.addEventListener('DOMContentLoaded', () => {
    const sliderWrapper = document.querySelector('.slider-wrapper');
    const sliderTrack = document.querySelector('.slider-track');
    const minThumb = document.querySelector('.min-thumb');
    const maxThumb = document.querySelector('.max-thumb');
    const priceLabel = document.getElementById('price-label');

    // Check if both thumbs are found, and if not, skip the script without error message
    if (!minThumb || !maxThumb) return;

    let minPrice = 0;
    let maxPrice = 200;
    const minLimit = 0;
    const maxLimit = 200;

    // Function to set the positions of thumbs and track
    function updateSlider() {
      const range = maxLimit - minLimit;
      const minPercent = ((minPrice - minLimit) / range) * 100;
      const maxPercent = ((maxPrice - minLimit) / range) * 100;

      minThumb.style.left = `${minPercent}%`;
      maxThumb.style.left = `${maxPercent}%`;

      sliderTrack.style.left = `${minPercent}%`;
      sliderTrack.style.right = `${100 - maxPercent}%`;

      const roundedMinPrice = Math.round(minPrice);
      const roundedMaxPrice = Math.round(maxPrice);

      priceLabel.textContent = `$${roundedMinPrice} — $${roundedMaxPrice}`;
    }

    // Dragging logic for thumbs
    function dragThumb(event, isMinThumb) {
      const sliderWidth = sliderWrapper.offsetWidth;
      const sliderLeft = sliderWrapper.getBoundingClientRect().left;

      function moveThumb(moveEvent) {
        const position =
          ((moveEvent.clientX - sliderLeft) / sliderWidth) *
          (maxLimit - minLimit) +
          minLimit;

        if (isMinThumb) {
          minPrice = Math.min(Math.max(minLimit, position), maxPrice - 1);
        } else {
          maxPrice = Math.max(Math.min(maxLimit, position), minPrice + 1);
        }

        updateSlider();
      }

      function stopDrag() {
        window.removeEventListener('mousemove', moveThumb);
        window.removeEventListener('mouseup', stopDrag);
      }

      window.addEventListener('mousemove', moveThumb);
      window.addEventListener('mouseup', stopDrag);
    }

    minThumb.addEventListener('mousedown', (event) => dragThumb(event, true));
    maxThumb.addEventListener('mousedown', (event) => dragThumb(event, false));

    // Initialize slider
    updateSlider();
  });

  /**************************************
   ***** 31. Woocommerce Toggle *****
   **************************************/
  // Ship To Different Address
  $(document).ready(function () {
    $('#ship-to-different-address-checkbox').on('change', function () {
      if ($(this).is(':checked')) {
        $('#ship-to-different-address').next('.shipping_address').slideDown();
      } else {
        $('#ship-to-different-address').next('.shipping_address').slideUp();
      }
    });
  });

  // Login Toggle
  $('.woocommerce-form-login-toggle a').on('click', function (e) {
    e.preventDefault();
    $('.woocommerce-form-login').slideToggle();
  });

  // Coupon Toggle
  $('.woocommerce-form-coupon-toggle a').on('click', function (e) {
    e.preventDefault();
    $('.woocommerce-form-coupon').slideToggle();
  });

  // Woocommerce Shipping Method
  $('.shipping-calculator-button').on('click', function (e) {
    e.preventDefault();
    $(this).next('.shipping-calculator-form').slideToggle();
  });

  // Woocommerce Payment Toggle
  $('.wc_payment_methods input[type="radio"]:checked')
    .siblings('.payment_box')
    .show();
  $('.wc_payment_methods input[type="radio"]').each(function () {
    $(this).on('change', function () {
      $('.payment_box').slideUp();
      $(this).siblings('.payment_box').slideDown();
    });
  });

  // Woocommerce Rating Toggle
  $('.rating-select .stars a').each(function () {
    $(this).on('click', function (e) {
      e.preventDefault();
      $(this).siblings().removeClass('active');
      $(this).parent().parent().addClass('selected');
      $(this).addClass('active');
    });
  });

  // Select All Checkbox
  document.addEventListener('change', function (e) {
    // Handle "Select All" checkbox
    if (e.target.matches('.vs-checkbox__input--all')) {
      const isChecked = e.target.checked;
      document.querySelectorAll('.vs-checkbox__input--item').forEach(cb => {
        cb.checked = isChecked;
      });
    }

    // Sync "Select All" if all item checkboxes are selected manually
    if (e.target.matches('.vs-checkbox__input--item')) {
      const allItems = document.querySelectorAll('.vs-checkbox__input--item');
      const allChecked = Array.from(allItems).every(cb => cb.checked);
      const selectAll = document.querySelector('.vs-checkbox__input--all');
      if (selectAll) selectAll.checked = allChecked;
    }
  });

  /**************************************
   ***** 32. Popup Search Box *****
   **************************************/
  function popupSarchBox($searchBox, $searchOpen, $searchCls, $toggleCls) {
    $($searchOpen).on('click', function (e) {
      e.preventDefault();
      $($searchBox).addClass($toggleCls);
    });
    $($searchBox).on('click', function (e) {
      e.stopPropagation();
      $($searchBox).removeClass($toggleCls);
    });
    $($searchBox)
      .find('form')
      .on('click', function (e) {
        e.stopPropagation();
        $($searchBox).addClass($toggleCls);
      });
    $($searchCls).on('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      $($searchBox).removeClass($toggleCls);
    });
  }
  popupSarchBox(
    '.popup-search-box',
    '.searchBoxTggler',
    '.searchClose',
    'show'
  );

  /**************************************
   ***** 33. Popup SideCart *****
   **************************************/
  document.addEventListener('DOMContentLoaded', () => {
    const sideCartTogglers = document.querySelectorAll(
      '.sideCartToggler, .sideCartTogglerTo'
    );
    const sideCart = document.querySelector('.sideCart-wrapper');
    const sideCartContent = sideCart.querySelector('.cart-sidebar-content');
    const closeButton = sideCart.querySelector('.cart-close-button');
    const body = document.body;
    const cartItems = sideCart.querySelectorAll('.cart-animation-item'); // Cart items selector

    // GSAP Timeline for sideCart
    const tl = gsap.timeline({ paused: true });

    // SideCart Open Animations (from left to right)
    tl.fromTo(
      sideCart,
      {
        opacity: 0,
        visibility: 'hidden',
        x: '-100%', // Start off-screen to the left
      },
      {
        opacity: 1,
        visibility: 'visible',
        x: '0%', // Move to the visible position
        duration: 0.5,
        ease: 'power2.out',
      }
    )
      .fromTo(
        sideCartContent,
        {
          opacity: 0,
          x: -20, // Slightly off-screen horizontally from the left
        },
        {
          opacity: 1,
          x: 0,
          duration: 0.5,
          ease: 'power2.out',
        },
        '<' // Synchronize with the sideCart animation
      )
      .fromTo(
        cartItems,
        {
          opacity: 0,
          y: 20, // Slightly below
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
          stagger: 0.1,
        },
        '<'
      );

    // Open SideCart
    const openSideCart = () => {
      sideCart.classList.add('cartshow');
      tl.play();
    };

    // Close SideCart
    const closeSideCart = () => {
      tl.reverse().then(() => {
        sideCart.classList.remove('cartshow');
      });
    };

    // Toggle SideCart
    const toggleSideCart = () => {
      if (sideCart.classList.contains('cartshow')) {
        closeSideCart();
      } else {
        openSideCart();
      }
    };

    // Add click event listener to each toggler
    sideCartTogglers.forEach((sideCartToggle) => {
      sideCartToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleSideCart();
      });
    });

    // Close sideCart when clicking outside .cart-sidebar-content
    body.addEventListener('click', (event) => {
      if (
        sideCart.classList.contains('cartshow') &&
        !sideCartContent.contains(event.target) &&
        ![...sideCartTogglers].some((toggler) => toggler.contains(event.target))
      ) {
        closeSideCart();
      }
    });

    // Close sideCart when clicking the close button
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeSideCart();
    });
  });

  /**************************************
   ***** 34. Popup Sidebar Canvas Menu *****
   **************************************/
  document.addEventListener('DOMContentLoaded', () => {
    const menuTogglers = document.querySelectorAll('.sideMenuToggler');
    const menuList = document.querySelector('.sidemenu-wrapper');
    const menuContent = menuList.querySelector('.sidemenu-content');
    const menuItems = menuList.querySelectorAll('.sidemenu-item');
    const closeButton = menuList.querySelector('.closeButton');
    const body = document.body;

    // GSAP Timeline
    const tl = gsap.timeline({ paused: true });

    // Menu Animations
    tl.fromTo(
      menuList,
      {
        opacity: 0,
        visibility: 'hidden',
        x: '100%',
      },
      {
        opacity: 1,
        visibility: 'visible',
        x: '0%',
        duration: 0.5,
        ease: 'power2.out',
      }
    )
      .fromTo(
        menuContent,
        {
          opacity: 0,
          x: 20, // Slightly off-screen horizontally
        },
        {
          opacity: 1,
          x: 0,
          duration: 0.5,
          ease: 'power2.out',
        },
        '<' // Synchronize with menuList animation
      )
      .fromTo(
        menuItems,
        {
          opacity: 0,
          y: 20, // Slightly below
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
          stagger: 0.1,
        },
        '<'
      );

    // Open Menu
    const openMenu = () => {
      menuList.classList.add('show');
      tl.play();
    };

    // Close Menu
    const closeMenu = () => {
      tl.reverse().then(() => {
        menuList.classList.remove('show');
      });
    };

    // Toggle Menu
    const toggleMenu = () => {
      if (menuList.classList.contains('show')) {
        closeMenu();
      } else {
        openMenu();
      }
    };

    // Add click event listener to each toggler
    menuTogglers.forEach((menuToggle) => {
      menuToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleMenu();
      });
    });

    // Close menu when clicking outside menu content
    body.addEventListener('click', (event) => {
      if (
        menuList.classList.contains('show') &&
        !menuContent.contains(event.target) &&
        ![...menuTogglers].some((toggler) => toggler.contains(event.target))
      ) {
        closeMenu();
      }
    });

    // Close menu when clicking the close button
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeMenu();
    });
  });

  /**************************************
   ***** 35. Countdown Timer for Coming Soon *****
   **************************************/
  $.fn.countdown = function () {
    this.each(function () {
      var $this = $(this),
        offerDate = new Date($this.data('offer-date')).getTime();

      function findElement(selector) {
        return $this.find(selector);
      }

      var interval = setInterval(function () {
        var now = new Date().getTime(),
          timeDiff = offerDate - now,
          days = Math.floor(timeDiff / 864e5),
          hours = Math.floor((timeDiff % 864e5) / 36e5),
          minutes = Math.floor((timeDiff % 36e5) / 6e4),
          seconds = Math.floor((timeDiff % 6e4) / 1e3);

        days < 10 && (days = '0' + days),
          hours < 10 && (hours = '0' + hours),
          minutes < 10 && (minutes = '0' + minutes),
          seconds < 10 && (seconds = '0' + seconds);

        if (timeDiff < 0) {
          clearInterval(interval);
          $this.addClass('expired');
          findElement('.message').css('display', 'block');
        } else {
          findElement('.day').html(days);
          findElement('.hour').html(hours);
          findElement('.minute').html(minutes);
          findElement('.seconds').html(seconds);
        }
      }, 1000);
    });
  };

  $('.offer-counter').length && $('.offer-counter').countdown();

  /**************************************
   ***** 36. Team Social On Mouse Enter *****
   **************************************/
  document.addEventListener('DOMContentLoaded', () => {
    const hoverBtns = document.querySelectorAll('.vs-team__share--hover');

    if (hoverBtns.length === 0) return;

    const deactivateAll = () => {
      document.querySelectorAll('.vs-team.active, .vs-team__share--hover.active, .vs-team__share--list.active')
        .forEach(el => el.classList.remove('active'));
    };

    hoverBtns.forEach(hoverBtn => {
      hoverBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const teamBox = hoverBtn.closest('.vs-team');
        const shareList = teamBox.querySelector('.vs-team__share--list');

        const isActive = teamBox.classList.contains('active');

        deactivateAll();

        if (!isActive) {
          teamBox.classList.add('active');
          hoverBtn.classList.add('active');
          if (shareList) shareList.classList.add('active');
        }
      });
    });

    document.addEventListener('click', deactivateAll);

    document.querySelectorAll('.vs-team').forEach(teamBox => {
      teamBox.addEventListener('click', (e) => e.stopPropagation());
    });
  });



  /**************************************
   ***** 37. VS Hover Magic *****
   **************************************/
  document.addEventListener('DOMContentLoaded', () => {
    const hoverItems = document.querySelectorAll('.vs-hover-magic');

    if (hoverItems.length === 0) return;

    hoverItems.forEach(item => {
      item.addEventListener('mouseenter', () => {
        // Remove active from all
        hoverItems.forEach(el => el.classList.remove('active'));

        // Add active to current
        item.classList.add('active');
      });
    });
  });

  /**************************************
   ***** 38. VS Hover Image Card *****
   **************************************/
  document.querySelectorAll('.vs-image-effect').forEach(wrapper => {
    const image = wrapper.querySelector('.vs-image-effect__image');
    const overlay = wrapper.querySelector('.vs-image-effect__overlay');

    wrapper.addEventListener('mouseenter', () => {
      gsap.to(image, {
        scale: 1.1,
        rotateX: 8,
        rotateY: -5,
        duration: 0.6,
        ease: "power3.inOut"
      });

      gsap.to(overlay, {
        opacity: 0.8,
        scale: 1.1,
        xPercent: 0,
        yPercent: 0,
        filter: "blur(3px)",
        duration: 0.6,
        ease: "power2.out"
      });
    });

    wrapper.addEventListener('mouseleave', () => {
      gsap.to(image, {
        scale: 1,
        rotateX: 0,
        rotateY: 0,
        duration: 0.7,
        ease: "power3.inOut",
      });

      gsap.to(overlay, {
        opacity: 0,
        scale: 1,
        xPercent: 0,
        yPercent: 0,
        filter: "blur(3px)",
        duration: 0.6,
        ease: "power3.inOut"
      });
    });
  });

  /**************************************
   ***** 39. Section Ball *****
   **************************************/
  (() => {
    const BALL_SIZE = 14;
    const OVERLAP = 0.1;
    const STEP = BALL_SIZE - OVERLAP;

    function buildBallStrip(strip) {
      const topAttr = strip.dataset.ballsTop;
      const bottomAttr = strip.dataset.ballsBottom;
      const colorAttr = strip.dataset.ballsColor;

      strip.style.top = topAttr ?? '';
      strip.style.bottom = topAttr ? '' : (bottomAttr ?? '-8px');

      const ballColor = colorAttr || '#ffffff';

      strip.innerHTML = ''; // clear previous

      const needed = Math.ceil(strip.offsetWidth / STEP) + 5;

      for (let i = 0; i < needed; i++) {
        const ball = document.createElement('div');
        ball.className = 'vs-balls__ball';
        ball.style.left = `${i * STEP}px`;
        ball.style.backgroundColor = ballColor;
        strip.appendChild(ball);
      }
    }

    function renderAllStrips() {
      document.querySelectorAll('.vs-balls').forEach(buildBallStrip);
    }

    window.addEventListener('DOMContentLoaded', renderAllStrips);
    window.addEventListener('resize', renderAllStrips);
  })();
})(jQuery);
