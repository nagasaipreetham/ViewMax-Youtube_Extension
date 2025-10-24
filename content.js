class ViewMax {
  constructor() {
    this.isFullWebMode = false;
    this.toggleElement = null;
    this.microToggleElement = null;
    this.microToggleProcessing = false;
    this.microToggleEventHandler = null;
    this.hiddenElements = [];
    this.originalStyles = new Map();
    this.mouseTrackingAdded = false;
    this.fullscreenChangeHandler = null;
    this.fullscreenExitTimeoutId = null;
    this.init();
  }

  async init() {
    console.log('ViewMax: Initializing extension...');

    // Always initialize the extension, but handle video pages specially
    this.setupGlobalListeners();

    // Wait for YouTube to load initially
    await this.waitForYouTube();

    // Check if we're on a video page and initialize accordingly
    if (this.isVideoPage()) {
      await this.initializeForVideoPage();
    } else {
      // On non-video pages, just observe for navigation to video pages
      console.log('ViewMax: Not on video page, waiting for navigation...');
    }

    // Listen for navigation changes (this handles YouTube SPA navigation)
    this.observeNavigation();
  }

  setupGlobalListeners() {
    // Keyboard shortcut (global)
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'toggle-viewmax') {
        this.toggleMode();
        sendResponse({ success: true });
      }
    });

    // Listen for window resize with debouncing
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
        this.handleResponsiveTogglePosition();
      }, 100);
    });

    // Listen for fullscreen changes to handle conflicts
    this.fullscreenChangeHandler = () => {
      console.log('ViewMax: Fullscreen change detected');
      if (this.isFullWebMode) {
        // If we're in ViewMax mode and user exits fullscreen, we need to restore ViewMax properly
        setTimeout(() => {
          this.handleFullscreenExit();
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', this.fullscreenChangeHandler);
    document.addEventListener('webkitfullscreenchange', this.fullscreenChangeHandler);
    document.addEventListener('mozfullscreenchange', this.fullscreenChangeHandler);
    document.addEventListener('MSFullscreenChange', this.fullscreenChangeHandler);
  }

  async initializeForVideoPage() {
    console.log('ViewMax: Initializing for video page...');

    // Ensure the watch page structure is ready (first-load SPA fix)
    await this.waitForWatchPageReady();

    // Create toggle with retry mechanism
    await this.createToggleWithRetry();

    // Create micro toggle (initially hidden)
    this.createMicroToggle();

    // Apply current state
    if (this.isFullWebMode) {
      this.enableFullWebMode();
      this.showMicroToggle();
    } else {
      this.hideMicroToggle();
      if (this.toggleElement) {
        this.ensureToggleVisibility();
        setTimeout(() => {
          this.handleResponsiveTogglePosition();
        }, 200);
      }
    }
  }

  isVideoPage() {
    // Check if URL contains watch?v= which indicates a video is playing
    return window.location.href.includes('watch?v=');
  }

  waitForYouTube() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 20; // 10 seconds max wait

      const checkForVideo = () => {
        attempts++;
        const videoElement = document.querySelector('video');
        const playerContainer = document.querySelector('#movie_player, .html5-video-player');
        const ytdApp = document.querySelector('ytd-app');

        // Check if basic YouTube structure is loaded
        if (ytdApp && (videoElement || !this.isVideoPage())) {
          console.log('ViewMax: YouTube structure loaded');
          resolve();
        } else if (attempts >= maxAttempts) {
          console.log('ViewMax: Max attempts reached, proceeding anyway');
          resolve();
        } else {
          setTimeout(checkForVideo, 500);
        }
      };
      checkForVideo();
    });
  }

  // New: wait until watch page containers are present (first-load safe)
  async waitForWatchPageReady() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 40; // ~10s at 250ms intervals

      const check = () => {
        attempts++;
        const moviePlayer = document.querySelector('#movie_player');
        const videoElement = document.querySelector('video');
        const container =
          document.querySelector('#secondary') ||
          document.querySelector('#player') ||
          document.querySelector('ytd-watch-flexy');

        if (moviePlayer && videoElement && container) {
          console.log('ViewMax: Watch page ready (containers found)');
          resolve(true);
        } else if (attempts >= maxAttempts) {
          console.log('ViewMax: Watch page not fully ready, proceeding anyway');
          resolve(false);
        } else {
          setTimeout(check, 250);
        }
      };

      check();
    });
  }



  async createToggleWithRetry() {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        if (await this.createToggle()) {
          return true;
        }
      } catch (error) {
        console.log(`ViewMax: Toggle creation attempt ${attempts + 1} failed:`, error);
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('ViewMax: Failed to create toggle after max attempts');
    return false;
  }

  createToggle() {
    return new Promise((resolve) => {
      // Load fonts first
      if (!document.querySelector('link[href*="Galada"]')) {
        const fontLink = document.createElement("link");
        fontLink.rel = "stylesheet";
        fontLink.href = "https://fonts.googleapis.com/css2?family=Galada&family=Poppins:ital,wght@0,300;0,400;1,300;1,400&display=swap";
        document.head.appendChild(fontLink);
      }

      // Remove ALL existing toggles to prevent duplicates
      const existingToggles = document.querySelectorAll('#viewmax-toggle, [id^="viewmax-toggle"]');
      existingToggles.forEach(toggle => {
        console.log('ViewMax: Removing existing toggle');
        toggle.remove();
      });

      // Enhanced sidebar detection with more selectors and fallbacks
      const sidebarSelectors = [
        '#secondary',
        '#secondary-inner',
        'ytd-watch-next-secondary-results-renderer',
        '#related',
        'ytd-secondary-pyv-renderer',
        '#watch-sidebar',
        '.watch-sidebar'
      ];

      let sidebar = null;
      let fallbackContainer = null;

      // Try to find sidebar
      for (const selector of sidebarSelectors) {
        sidebar = document.querySelector(selector);
        if (sidebar) {
          console.log(`ViewMax: Found sidebar using selector: ${selector}`);
          break;
        }
      }

      // If no sidebar found, try fallback locations
      if (!sidebar) {
        const playerDiv = document.querySelector('#player');
        const watchFlexy = document.querySelector('ytd-watch-flexy');

        if (playerDiv) {
          fallbackContainer = playerDiv;
          console.log("ViewMax: Using player div as fallback container");
        } else if (watchFlexy) {
          fallbackContainer = watchFlexy;
          console.log("ViewMax: Using watch-flexy as fallback container");
        }
      }

      const targetContainer = sidebar || fallbackContainer;

      if (!targetContainer) {
        console.log("ViewMax: No suitable container found, will retry...");
        resolve(false);
        return;
      }

      console.log("ViewMax: Injecting UI...");

      // Create toggle container
      const container = document.createElement("div");
      container.id = "viewmax-toggle";
      container.setAttribute('data-status', this.isFullWebMode ? 'active' : 'inactive');

      container.innerHTML = `
        <div class="viewmax-ui">
          <img src="${chrome.runtime.getURL('icon.png')}" class="viewmax-logo" />
          <span class="viewmax-label">ViewMax</span>
          <div class="viewmax-controls">
            <div class="viewmax-status-indicator" id="viewmaxStatus">${this.isFullWebMode ? 'Active' : 'Ready'}</div>
            <label class="viewmax-switch">
              <input type="checkbox" id="viewmax-checkbox" ${this.isFullWebMode ? 'checked' : ''}>
              <span class="viewmax-slider"></span>
            </label>
          </div>
        </div>
      `;

      // Insert based on container type
      if (sidebar) {
        sidebar.prepend(container);
      } else {
        // For fallback containers, insert after the element
        targetContainer.insertAdjacentElement('afterend', container);
        container.classList.add('viewmax-toggle-below-player');
      }

      // Add event listeners
      const toggle = document.getElementById("viewmax-checkbox");
      if (toggle) {
        toggle.addEventListener("change", (e) => {
          console.log("ViewMax: Toggle changed:", e.target.checked);
          this.toggleMode();
        });
      }

      // Add global mouse tracking for hover effect
      if (!this.mouseTrackingAdded) {
        document.addEventListener('mousemove', (e) => {
          const overlay = document.getElementById('viewmax-toggle');
          if (overlay) {
            const rect = overlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            overlay.style.setProperty('--mouse-x', `${x}px`);
            overlay.style.setProperty('--mouse-y', `${y}px`);
          }
        });
        this.mouseTrackingAdded = true;
      }

      this.toggleElement = container;

      // Handle initial responsive positioning
      setTimeout(() => {
        this.handleResponsiveTogglePosition();
      }, 100);

      console.log("✅ ViewMax UI injected successfully");
      resolve(true);
    });
  }

  getToggleClass() {
    return 'viewmax-toggle-container';
  }

  handleResize() {
    // Handle video resizing in full web mode
    if (this.isFullWebMode) {
      // Use debounced resize to prevent too many calls
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.maintainVideoAspectRatio();
        this.updateControlsResponsiveness();
      }, 150);
    }
  }

  toggleMode() {
    console.log('ViewMax: Toggling mode from', this.isFullWebMode ? 'ON' : 'OFF');
    this.isFullWebMode = !this.isFullWebMode;

    if (this.isFullWebMode) {
      this.enableFullWebMode();
      this.showMicroToggle();
    } else {
      this.disableFullWebMode();
      this.hideMicroToggle();
    }

    // Update checkbox state
    const checkbox = document.querySelector('#viewmax-checkbox');
    if (checkbox) {
      checkbox.checked = this.isFullWebMode;
    }

    // Update micro toggle state if it exists
    const microCheckbox = document.querySelector('#viewmax-micro-checkbox');
    if (microCheckbox) {
      microCheckbox.checked = this.isFullWebMode;
    }


  }

  enableFullWebMode() {
    console.log('ViewMax: Enabling full web mode');

    // Hide all distracting elements first
    this.hideElements();

    // Get all the necessary elements
    const playerContainer = document.querySelector('#movie_player');
    const video = document.querySelector('video');
    const videoContainer = document.querySelector('.html5-video-container');
    const pageContainer = document.querySelector('ytd-watch-flexy');

    if (playerContainer && video) {
      // Store original styles for all elements
      this.storeOriginalStyles(playerContainer);
      this.storeOriginalStyles(video);
      if (videoContainer) this.storeOriginalStyles(videoContainer);
      if (pageContainer) this.storeOriginalStyles(pageContainer);

      // Set body to prevent scrolling
      document.body.style.overflow = 'hidden';

      // Apply CSS class for full web mode
      playerContainer.classList.add('viewmax-fullscreen');

      // Force video to maintain aspect ratio and update controls
      setTimeout(() => {
        this.maintainVideoAspectRatio();
        this.updateControlsResponsiveness();
      }, 100);

      // Update toggle status and hide main toggle during ViewMax mode
      if (this.toggleElement) {
        this.toggleElement.setAttribute('data-status', 'active');
        this.toggleElement.style.zIndex = '10000';
        // Hide main toggle during ViewMax mode - only show micro toggle
        this.toggleElement.style.display = 'none';
        const statusIndicator = document.getElementById('viewmaxStatus');
        if (statusIndicator) {
          statusIndicator.textContent = 'Active';
        }
      }
    }
  }

  disableFullWebMode() {
    console.log('ViewMax: Disabling full web mode');

    // Cancel any pending fullscreen-exit recovery to avoid races
    if (this.fullscreenExitTimeoutId) {
      clearTimeout(this.fullscreenExitTimeoutId);
      this.fullscreenExitTimeoutId = null;
    }

    // Restore body overflow
    document.body.style.overflow = '';

    // Show all hidden elements first
    this.showElements();

    // Get all the elements
    const playerContainer = document.querySelector('#movie_player');
    const video = document.querySelector('video');
    const videoContainer = document.querySelector('.html5-video-container');

    if (playerContainer && video) {
      // Store current playback state
      const currentTime = video.currentTime;
      const isPaused = video.paused;
      const volume = video.volume;
      const playbackRate = video.playbackRate;

      // Remove ViewMax CSS class
      playerContainer.classList.remove('viewmax-fullscreen');

      // Clear any ViewMax-specific styles that might interfere with video rendering
      video.style.removeProperty('object-fit');
      video.style.removeProperty('position');
      video.style.removeProperty('margin');
      video.style.removeProperty('display');
      video.style.removeProperty('width');
      video.style.removeProperty('height');
      video.style.removeProperty('filter');
      video.style.removeProperty('transform');
      video.style.removeProperty('opacity');

      // Restore original styles ONLY (don't clear everything)
      this.restoreOriginalStyles(playerContainer);
      this.restoreOriginalStyles(video);
      if (videoContainer) {
        this.restoreOriginalStyles(videoContainer);
        // Clear container styles that might interfere
        videoContainer.style.removeProperty('display');
        videoContainer.style.removeProperty('align-items');
        videoContainer.style.removeProperty('justify-content');
      }

      // Reset only ViewMax-specific control modifications
      this.resetViewMaxControlStyles();

      // Force complete video refresh to prevent black screen
      this.forceVideoRefresh(video, currentTime, isPaused, volume, playbackRate);

      // Update toggle status and show main toggle when ViewMax is disabled
      if (this.toggleElement) {
        this.toggleElement.setAttribute('data-status', 'inactive');
        this.toggleElement.style.zIndex = '';
        // Show main toggle when ViewMax is disabled
        this.toggleElement.style.display = 'flex';
        this.toggleElement.style.visibility = 'visible';
        this.toggleElement.style.opacity = '1';

        const statusIndicator = document.getElementById('viewmaxStatus');
        if (statusIndicator) {
          statusIndicator.textContent = 'Ready';
        }
      }
    }
  }

  forceVideoRefresh(video, currentTime, isPaused, volume, playbackRate) {
    console.log('ViewMax: Soft refreshing video element');

    // Soft reflow to make the browser recompute layout
    video.style.display = 'none';
    video.offsetHeight; // Force reflow
    video.style.display = '';

    // Recalculate layout without touching the media pipeline
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize', { bubbles: true }));
    });

    // Restore playback state
    setTimeout(() => {
      if (Math.abs(video.currentTime - currentTime) > 0.1) {
        video.currentTime = currentTime;
      }
      if (video.volume !== volume) {
        video.volume = volume;
      }
      if (video.playbackRate !== playbackRate) {
        video.playbackRate = playbackRate;
      }

      if (!isPaused && video.paused) {
        // Prefer YouTube's player API when available
        const ytPlayer = document.querySelector('#movie_player');
        if (ytPlayer && ytPlayer.playVideo) {
          try {
            ytPlayer.seekTo(currentTime, true);
            ytPlayer.playVideo();
          } catch (e) {
            video.play().catch(() => console.log('ViewMax: Could not resume playback'));
          }
        } else {
          video.play().catch(() => console.log('ViewMax: Could not resume playback'));
        }
      }

      // Extra resize events to help controls settle
      setTimeout(() => {
        window.dispatchEvent(new Event('resize', { bubbles: true }));
      }, 100);
      setTimeout(() => {
        window.dispatchEvent(new Event('resize', { bubbles: true }));
      }, 300);
    }, 100);

    // Fallback: if video is still not rendered, poke the player API (no src changes)
    setTimeout(() => {
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.log('ViewMax: Video still needs refresh; using player API fallback');
        const ytPlayer = document.querySelector('#movie_player');
        if (ytPlayer && ytPlayer.getPlayerState) {
          try {
            ytPlayer.seekTo(currentTime, true);
            if (!isPaused) {
              ytPlayer.playVideo();
            }
          } catch (e) {
            console.log('ViewMax: YouTube player API not available');
          }
        } else {
          // Light click to prompt YouTube to redraw
          video.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          }));
        }
      }
    }, 500);
  }

  resetViewMaxControlStyles() {
    // Only reset styles that ViewMax specifically modified
    const controlSelectors = [
      '.ytp-chrome-bottom',
      '.ytp-progress-bar-container',
      '.ytp-progress-bar',
      '.ytp-chrome-controls',
      '.ytp-left-controls',
      '.ytp-right-controls',
      '.ytp-progress-bar-padding',
      '.ytp-scrubber-container'
    ];

    // Only remove ViewMax-specific style properties
    controlSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        // Remove only the specific properties ViewMax sets
        const viewMaxProperties = [
          'width', 'max-width', 'flex', 'min-width', 'margin',
          'box-sizing', 'flex-shrink', 'justify-content'
        ];

        viewMaxProperties.forEach(prop => {
          element.style.removeProperty(prop);
        });

        // Remove ViewMax-specific classes
        element.classList.remove('viewmax-modified');
      });
    });
  }

  maintainVideoAspectRatio() {
    // Simplified: Let CSS handle the centering and sizing
    // CSS object-fit: contain will automatically center and maintain aspect ratio
    const video = document.querySelector('video');
    const playerContainer = document.querySelector('#movie_player');
    if (!video || !this.isFullWebMode || !playerContainer) return;

    // Ensure proper centering, especially for viewports < 1015px
    video.style.setProperty('object-fit', 'contain', 'important');

    // Additional fix for smaller screens (< 1015px)
    if (window.innerWidth <= 1015) {
      video.style.setProperty('position', 'static', 'important');
      video.style.setProperty('margin', '0 auto', 'important');
      video.style.setProperty('display', 'block', 'important');

      // Ensure container is properly centered
      const videoContainer = document.querySelector('.html5-video-container');
      if (videoContainer) {
        videoContainer.style.setProperty('display', 'flex', 'important');
        videoContainer.style.setProperty('align-items', 'center', 'important');
        videoContainer.style.setProperty('justify-content', 'center', 'important');
      }
    }

    // Update controls responsiveness
    this.updateControlsResponsiveness();
  }

  updateControlsResponsiveness() {
    if (!this.isFullWebMode) return;

    const controls = document.querySelector('.ytp-chrome-bottom');
    const chromeControls = document.querySelector('.ytp-chrome-controls');
    const progressBarContainer = document.querySelector('.ytp-progress-bar-container');
    const progressBarPadding = document.querySelector('.ytp-progress-bar-padding');
    const progressBar = document.querySelector('.ytp-progress-bar');
    const leftControls = document.querySelector('.ytp-left-controls');
    const rightControls = document.querySelector('.ytp-right-controls');

    if (controls) {
      // Force controls to be responsive and stretch full width
      controls.style.setProperty('width', '100%', 'important');
      controls.style.setProperty('max-width', '100vw', 'important');
      controls.style.setProperty('display', 'flex', 'important');
      controls.style.setProperty('align-items', 'center', 'important');
      controls.style.setProperty('box-sizing', 'border-box', 'important');

      // Ensure chrome controls container stretches full width
      if (chromeControls) {
        chromeControls.style.setProperty('width', '100%', 'important');
        chromeControls.style.setProperty('max-width', 'none', 'important');
        chromeControls.style.setProperty('display', 'flex', 'important');
        chromeControls.style.setProperty('align-items', 'center', 'important');
        chromeControls.style.setProperty('justify-content', 'space-between', 'important');
      }

      // Fix left and right controls to not shrink
      if (leftControls) {
        leftControls.style.setProperty('flex-shrink', '0', 'important');
        leftControls.style.setProperty('display', 'flex', 'important');
        leftControls.style.setProperty('align-items', 'center', 'important');
      }

      if (rightControls) {
        rightControls.style.setProperty('flex-shrink', '0', 'important');
        rightControls.style.setProperty('display', 'flex', 'important');
        rightControls.style.setProperty('align-items', 'center', 'important');
      }

      // Make timeline stretch to fill available space between left and right controls
      if (progressBarContainer) {
        progressBarContainer.style.setProperty('width', '100%', 'important');
        progressBarContainer.style.setProperty('max-width', '100%', 'important');
        progressBarContainer.style.setProperty('flex', '1', 'important');
        progressBarContainer.style.setProperty('min-width', '0', 'important');
        progressBarContainer.style.setProperty('margin', '0 12px', 'important');
        progressBarContainer.style.setProperty('box-sizing', 'border-box', 'important');
      }

      if (progressBarPadding) {
        progressBarPadding.style.setProperty('width', '100%', 'important');
        progressBarPadding.style.setProperty('max-width', '100%', 'important');
        progressBarPadding.style.setProperty('flex', '1', 'important');
        progressBarPadding.style.setProperty('min-width', '0', 'important');
        progressBarPadding.style.setProperty('box-sizing', 'border-box', 'important');
      }

      if (progressBar) {
        progressBar.style.setProperty('width', '100%', 'important');
        progressBar.style.setProperty('max-width', '100%', 'important');
        progressBar.style.setProperty('box-sizing', 'border-box', 'important');
      }

      // Simple timeline width enforcement
      setTimeout(() => {
        this.ensureTimelineWithinBounds();
      }, 100);
    }
  }

  ensureTimelineWithinBounds() {
    if (!this.isFullWebMode) return;

    const timelineElements = [
      '.ytp-progress-bar-container',
      '.ytp-progress-bar-padding',
      '.ytp-progress-bar',
      '.ytp-scrubber-container'
    ];

    timelineElements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.style.setProperty('width', '100%', 'important');
        element.style.setProperty('max-width', '100%', 'important');
        element.style.setProperty('box-sizing', 'border-box', 'important');
      }
    });
  }



  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  hideElements() {
    const selectorsToHide = [
      // Header and navigation
      '#masthead-container',
      'ytd-mini-guide-renderer',

      // Video metadata and info
      '#above-the-fold #top-row',
      '#below-the-fold',
      'ytd-watch-metadata',
      'ytd-video-primary-info-renderer',
      'ytd-video-secondary-info-renderer',
      '#info',
      '#meta',

      // Comments section
      '#comments',
      'ytd-comments',
      'ytd-comments-header-renderer',
      'ytd-comment-thread-renderer',

      // Sidebar and recommendations
      '#secondary',
      '#related',
      'ytd-watch-next-secondary-results-renderer',

      // Other distracting elements
      'ytd-merch-shelf-renderer',
      '#chips-wrapper',
      'ytd-rich-metadata-renderer'
    ];

    this.hiddenElements = [];

    selectorsToHide.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element && !element.classList.contains('viewmax-hidden')) {
          // Store original display style
          const originalDisplay = window.getComputedStyle(element).display;
          this.hiddenElements.push({
            element: element,
            originalDisplay: originalDisplay
          });
          element.classList.add('viewmax-hidden');
        }
      });
    });

    console.log(`ViewMax: Hidden ${this.hiddenElements.length} elements`);
  }

  showElements() {
    // Restore from tracked list
    this.hiddenElements.forEach(({ element }) => {
      element.classList.remove('viewmax-hidden');
    });
    this.hiddenElements = [];

    // Fallback: remove lingering classes anywhere in the DOM
    document.querySelectorAll('.viewmax-hidden').forEach(el => {
      el.classList.remove('viewmax-hidden');
    });

    // Second pass after SPA settles (covers post-fullscreen DOM changes)
    setTimeout(() => {
      document.querySelectorAll('.viewmax-hidden').forEach(el => {
        el.classList.remove('viewmax-hidden');
      });
    }, 300);

    console.log('ViewMax: Restored all hidden elements');
  }

  storeOriginalStyles(element) {
    if (!element || this.originalStyles.has(element)) return;

    // Store the complete computed styles that we might modify
    const computedStyles = window.getComputedStyle(element);
    const originalStyles = {};

    const stylesToStore = [
      'position', 'top', 'left', 'right', 'bottom', 'width', 'height',
      'zIndex', 'backgroundColor', 'display', 'alignItems', 'justifyContent',
      'objectFit', 'maxWidth', 'maxHeight', 'minWidth', 'minHeight',
      'transform', 'filter', 'opacity'
    ];

    stylesToStore.forEach(style => {
      // Store both inline and computed values
      originalStyles[style] = {
        inline: element.style[style] || '',
        computed: computedStyles[style] || ''
      };
    });

    this.originalStyles.set(element, originalStyles);
    console.log('ViewMax: Stored original styles for element:', element.tagName);
  }

  restoreOriginalStyles(element) {
    if (!element) return;

    const originalStyles = this.originalStyles.get(element);
    if (originalStyles) {
      Object.keys(originalStyles).forEach(style => {
        // Restore the original inline style
        const originalValue = originalStyles[style].inline || '';
        if (originalValue) {
          element.style[style] = originalValue;
        } else {
          element.style.removeProperty(style);
        }
      });
      console.log('ViewMax: Restored original styles for element:', element.tagName);
    }
  }

  createMicroToggle() {
    // Remove existing micro toggle if present
    const existingMicroToggle = document.getElementById('viewmax-micro-toggle');
    if (existingMicroToggle) {
      existingMicroToggle.remove();
    }

    // Create micro toggle container
    const microContainer = document.createElement("div");
    microContainer.id = "viewmax-micro-toggle";

    microContainer.innerHTML = `
      <label class="viewmax-micro-switch">
        <input type="checkbox" id="viewmax-micro-checkbox" ${this.isFullWebMode ? 'checked' : ''}>
        <span class="viewmax-micro-slider"></span>
      </label>
    `;

    // Add to document body (will be positioned in title bar area via CSS)
    document.body.appendChild(microContainer);

    // Apply dynamic positioning based on viewport and YouTube layout
    this.updateMicroTogglePosition(microContainer);

    // Add event listener with improved error handling
    const microCheckbox = document.getElementById("viewmax-micro-checkbox");
    if (microCheckbox) {
      microCheckbox.addEventListener("change", (e) => {
        console.log("ViewMax: Micro toggle changed:", e.target.checked);

        // Prevent rapid clicking issues
        if (this.microToggleProcessing) {
          e.preventDefault();
          return;
        }

        this.microToggleProcessing = true;

        try {
          // Only allow disabling through micro toggle (not enabling)
          if (!e.target.checked && this.isFullWebMode) {
            this.toggleMode();
          } else if (e.target.checked && !this.isFullWebMode) {
            // Prevent enabling through micro toggle - reset to unchecked
            e.target.checked = false;
            console.log("ViewMax: Micro toggle can only disable, not enable");
          }
        } catch (error) {
          console.error("ViewMax: Error handling micro toggle change:", error);
          // Reset to current state on error
          e.target.checked = this.isFullWebMode;
        } finally {
          // Reset processing flag after a short delay
          setTimeout(() => {
            this.microToggleProcessing = false;
          }, 100);
        }
      });

      // Store reference for cleanup
      this.microToggleEventHandler = microCheckbox;
    } else {
      console.error("ViewMax: Could not find micro toggle checkbox for event binding");
    }

    this.microToggleElement = microContainer;
    console.log("✅ ViewMax Micro Toggle created");
  }

  handleResponsiveTogglePosition() {
    if (!this.toggleElement) {
      console.log('ViewMax: No toggle element found for responsive positioning');
      return;
    }

    const viewportWidth = window.innerWidth;
    console.log(`ViewMax: Handling responsive toggle position for width: ${viewportWidth}px`);

    // Don't reposition if ViewMax is active (main toggle should be hidden)
    if (this.isFullWebMode) {
      console.log("ViewMax: Skipping toggle repositioning - ViewMax mode is active");
      return;
    }

    // Force visibility first - critical for small windows
    this.ensureToggleVisibility();

    // Force responsive positioning based on viewport
    if (viewportWidth <= 1000) {
      // Small/Medium screens: Move toggle below player
      this.moveToggleBelowPlayer();
    } else {
      // Large screens: Move toggle back to sidebar
      this.moveToggleToSidebar();
    }

    // Additional fixes for very small screens
    if (viewportWidth <= 400) {
      this.applySmallScreenFixes();
    }
  }

  ensureToggleVisibility() {
    if (!this.toggleElement) return;

    // Force visibility with multiple approaches
    this.toggleElement.style.setProperty('display', 'flex', 'important');
    this.toggleElement.style.setProperty('visibility', 'visible', 'important');
    this.toggleElement.style.setProperty('opacity', '1', 'important');
    this.toggleElement.style.setProperty('position', 'relative', 'important');
    this.toggleElement.style.setProperty('z-index', '1000', 'important');

    // Remove any hidden attributes
    this.toggleElement.removeAttribute('hidden');
    this.toggleElement.classList.remove('hidden');

    // Ensure it's not being hidden by YouTube
    this.toggleElement.style.setProperty('pointer-events', 'auto', 'important');

    console.log('ViewMax: Toggle visibility enforced');
  }

  applySmallScreenFixes() {
    if (!this.toggleElement) return;

    // Special handling for very small screens
    this.toggleElement.style.setProperty('min-width', '200px', 'important');
    this.toggleElement.style.setProperty('font-size', '12px', 'important');
    this.toggleElement.style.setProperty('padding', '6px 10px', 'important');
    this.toggleElement.style.setProperty('margin', '6px 12px', 'important');

    // Ensure it doesn't get cut off
    this.toggleElement.style.setProperty('max-width', 'calc(100vw - 24px)', 'important');
    this.toggleElement.style.setProperty('box-sizing', 'border-box', 'important');

    console.log('ViewMax: Small screen fixes applied');
  }

  moveToggleBelowPlayer() {
    if (!this.toggleElement) return;

    // Try multiple selectors for player container with priority order
    const playerSelectors = [
      '#player',
      '#movie_player',
      '.html5-video-player',
      'ytd-player',
      '#primary',
      'ytd-watch-flexy #primary'
    ];
    let playerDiv = null;

    for (const selector of playerSelectors) {
      playerDiv = document.querySelector(selector);
      if (playerDiv) {
        console.log(`ViewMax: Found player container: ${selector}`);
        break;
      }
    }

    if (!playerDiv) {
      console.log("ViewMax: Player div not found, using fallback positioning");
      // Enhanced fallback options
      const fallbackSelectors = [
        'ytd-watch-flexy',
        '#content',
        'ytd-page-manager',
        'body'
      ];

      for (const selector of fallbackSelectors) {
        playerDiv = document.querySelector(selector);
        if (playerDiv) {
          console.log(`ViewMax: Using fallback container: ${selector}`);
          break;
        }
      }

      if (!playerDiv) {
        setTimeout(() => this.moveToggleBelowPlayer(), 500);
        return;
      }
    }

    // Store current parent to avoid unnecessary DOM manipulation
    const currentParent = this.toggleElement.parentNode;
    const isAlreadyBelowPlayer = this.toggleElement.classList.contains('viewmax-toggle-below-player') &&
      playerDiv.parentNode && playerDiv.parentNode.contains(this.toggleElement);

    // Only move if it's not already in the right position
    if (!isAlreadyBelowPlayer) {
      // Remove from current parent
      this.toggleElement.remove();

      // Add responsive class for styling
      this.toggleElement.classList.add('viewmax-toggle-below-player');
      this.toggleElement.classList.remove('viewmax-toggle-sidebar');

      // Try to insert after the player div, with fallback
      try {
        playerDiv.insertAdjacentElement('afterend', this.toggleElement);
      } catch (error) {
        // Fallback: append to player's parent
        if (playerDiv.parentNode) {
          playerDiv.parentNode.appendChild(this.toggleElement);
        } else {
          document.body.appendChild(this.toggleElement);
        }
      }

      console.log("ViewMax: Toggle moved below player");
    }

    // Force visibility after positioning
    this.ensureToggleVisibility();
  }

  moveToggleToSidebar() {
    if (!this.toggleElement) return;

    // Enhanced sidebar detection with more selectors
    const sidebarSelectors = [
      '#secondary',
      '#secondary-inner',
      'ytd-watch-next-secondary-results-renderer',
      '#related',
      'ytd-secondary-pyv-renderer',
      '#watch-sidebar',
      '.watch-sidebar',
      'ytd-watch-flexy #secondary'
    ];
    let sidebar = null;

    for (const selector of sidebarSelectors) {
      sidebar = document.querySelector(selector);
      if (sidebar) {
        console.log(`ViewMax: Found sidebar: ${selector}`);
        break;
      }
    }

    if (!sidebar) {
      console.log("ViewMax: Sidebar not found, keeping current position");
      // Don't return - still ensure visibility
      this.ensureToggleVisibility();
      return;
    }

    // Check if already in correct position
    const isAlreadyInSidebar = sidebar.contains(this.toggleElement) &&
      this.toggleElement.classList.contains('viewmax-toggle-sidebar');

    // Only move if it's not already in the sidebar
    if (!isAlreadyInSidebar) {
      // Remove from current parent
      this.toggleElement.remove();

      // Add sidebar class for styling
      this.toggleElement.classList.add('viewmax-toggle-sidebar');
      this.toggleElement.classList.remove('viewmax-toggle-below-player');

      // Insert at the top of sidebar
      sidebar.prepend(this.toggleElement);

      console.log("ViewMax: Toggle moved to sidebar");
    }

    // Force visibility after positioning
    this.ensureToggleVisibility();
  }



  updateMicroTogglePosition(microContainer) {
    if (!microContainer) return;

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate safe positioning to avoid YouTube UI conflicts
    let topPosition = 20;
    let rightPosition = 20;

    // Check for YouTube header elements that might interfere
    const youtubeHeader = document.querySelector('#masthead-container');
    if (youtubeHeader) {
      const headerRect = youtubeHeader.getBoundingClientRect();
      if (headerRect.height > 0) {
        topPosition = Math.max(20, headerRect.height + 10);
      }
    }

    // Adjust for smaller screens
    if (viewportWidth <= 768) {
      topPosition = Math.min(topPosition, 10);
      rightPosition = 10;
    } else if (viewportWidth <= 1200) {
      topPosition = Math.min(topPosition, 15);
      rightPosition = 15;
    }

    // Apply positioning with fallback
    try {
      microContainer.style.setProperty('top', `${topPosition}px`, 'important');
      microContainer.style.setProperty('right', `${rightPosition}px`, 'important');

      // Ensure it's above all YouTube elements
      microContainer.style.setProperty('z-index', '10001', 'important');
      microContainer.style.setProperty('position', 'fixed', 'important');
    } catch (error) {
      console.log('ViewMax: Could not set micro toggle position', error);
      // Fallback to CSS-only positioning
    }
  }

  showMicroToggle() {
    if (!this.microToggleElement) {
      this.createMicroToggle();
    }

    if (this.microToggleElement) {
      // Update position before showing
      this.updateMicroTogglePosition(this.microToggleElement);

      // Show with animation
      this.microToggleElement.classList.remove('viewmax-micro-hide');
      this.microToggleElement.classList.add('viewmax-micro-show');
      this.microToggleElement.style.display = 'block';
      console.log("ViewMax: Micro toggle shown");
    }
  }

  hideMicroToggle() {
    if (this.microToggleElement) {
      // Hide with animation
      this.microToggleElement.classList.remove('viewmax-micro-show');
      this.microToggleElement.classList.add('viewmax-micro-hide');

      // Hide after animation completes
      setTimeout(() => {
        if (this.microToggleElement) {
          this.microToggleElement.style.display = 'none';
          this.microToggleElement.classList.remove('viewmax-micro-hide');
        }
      }, 300);

      console.log("ViewMax: Micro toggle hidden");
    }
  }

  cleanup(removeGlobalListeners = true) {
    console.log('ViewMax: Cleaning up...');

    // Clean up event listeners
    if (this.resizeHandler && removeGlobalListeners) {
      window.removeEventListener('resize', this.resizeHandler);
    }

    // Clean up timeline observer
    if (this.timelineObserver) {
      this.timelineObserver.disconnect();
    }

    // Clean up micro toggle and its event listeners
    if (this.microToggleEventHandler) {
      try {
        // Remove event listeners if they exist
        const microCheckbox = document.getElementById("viewmax-micro-checkbox");
        if (microCheckbox) {
          microCheckbox.removeEventListener("change", this.microToggleEventHandler);
        }
      } catch (error) {
        console.log("ViewMax: Error cleaning up micro toggle event listeners:", error);
      }
      this.microToggleEventHandler = null;
    }

    if (this.microToggleElement) {
      this.microToggleElement.remove();
      this.microToggleElement = null;
    }

    // Clean up main toggle
    if (this.toggleElement && this.toggleElement.parentNode) {
      this.toggleElement.remove();
      this.toggleElement = null;
    }

    // Reset processing flags
    this.microToggleProcessing = false;

    // Clear stored styles
    this.originalStyles.clear();
    this.hiddenElements = [];
  }

  handleKeyboard(e) {
    // Ctrl + Shift + F to toggle
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      e.stopPropagation();
      console.log('ViewMax: Keyboard shortcut triggered');

      // Only allow toggle on video pages
      if (this.isVideoPage()) {
        // Add a small delay to prevent conflicts with browser fullscreen
        setTimeout(() => {
          this.toggleMode();
        }, 50);
      } else {
        console.log('ViewMax: Keyboard shortcut ignored - not on video page');
      }
    }
  }

  handleFullscreenExit() {
    // Check if we're no longer in fullscreen but ViewMax is still active
    const isInFullscreen = document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    if (!isInFullscreen && this.isFullWebMode) {
      console.log('ViewMax: Handling fullscreen exit while in ViewMax mode');

      // Small delay to let YouTube settle after fullscreen exit
      setTimeout(() => {
        // Abort if mode was turned OFF meanwhile (prevents race)
        if (!this.isFullWebMode) {
          console.log('ViewMax: Skip fullscreen-exit recovery because mode is OFF');
          return;
        }

        const video = document.querySelector('video');
        const playerContainer = document.querySelector('#movie_player');

        if (video && playerContainer) {
          // Store current state
          const currentTime = video.currentTime;
          const isPaused = video.paused;
          const volume = video.volume;
          const playbackRate = video.playbackRate;

          // Clear any problematic styles that might interfere with video rendering
          video.style.removeProperty('filter');
          video.style.removeProperty('transform');
          video.style.removeProperty('opacity');
          video.style.removeProperty('width');
          video.style.removeProperty('height');

          // Re-apply ViewMax class
          playerContainer.classList.add('viewmax-fullscreen');

          // Soft refresh after fullscreen exit
          this.forceVideoRefresh(video, currentTime, isPaused, volume, playbackRate);

          // Update controls
          this.updateControlsResponsiveness();
        }
      }, 300);
    }
  }

  observeNavigation() {
    // Watch for YouTube navigation changes
    let currentUrl = location.href;

    const observer = new MutationObserver((mutations) => {
      // Check for URL changes (YouTube SPA navigation)
      if (location.href !== currentUrl) {
        const oldUrl = currentUrl;
        currentUrl = location.href;
        console.log(`ViewMax: Navigation detected from ${oldUrl} to ${currentUrl}`);

        // Delay to allow YouTube to load new content
        setTimeout(() => {
          this.handleNavigation();
        }, 500);
      }

      // Also watch for specific YouTube elements being added/removed
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if video player was added
            if (node.querySelector && (node.querySelector('#movie_player') || node.id === 'movie_player')) {
              console.log('ViewMax: Video player detected in DOM');
              setTimeout(() => {
                this.handleNavigation();
              }, 300);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen for YouTube's custom events
    window.addEventListener('yt-navigate-finish', () => {
      console.log('ViewMax: YouTube navigation finished');
      setTimeout(() => {
        this.handleNavigation();
      }, 300);
    });
  }

  async handleNavigation() {
    console.log('ViewMax: Handling navigation...');

    // Clean up existing state first
    this.cleanup(false); // Don't remove global listeners

    // Check if we're on a video page
    if (!this.isVideoPage()) {
      console.log('ViewMax: Not on video page after navigation');
      const existingToggle = document.getElementById('viewmax-toggle');
      if (existingToggle) {
        existingToggle.remove();
        this.toggleElement = null;
      }
      if (this.isFullWebMode) {
        this.isFullWebMode = false;
        this.disableFullWebMode();
      }
      return;
    }

    console.log('ViewMax: On video page, initializing...');

    // Wait for video and YouTube structure
    await this.waitForYouTube();

    // EXTRA: wait until watch page containers exist (first-load SPA fix)
    await this.waitForWatchPageReady();

    // Initialize for the new video page
    await this.initializeForVideoPage();
  }
}

// Initialize ViewMax when page loads with better timing
let viewMaxInstance = null;
let initializationAttempts = 0;
const maxInitAttempts = 5;

function initializeViewMax() {
  // Prevent multiple instances
  if (viewMaxInstance && viewMaxInstance.toggleElement) {
    console.log('ViewMax: Instance already exists and is functional, skipping initialization');
    return;
  }

  initializationAttempts++;

  if (viewMaxInstance) {
    console.log('ViewMax: Instance exists but not functional, cleaning up first');
    try {
      viewMaxInstance.cleanup(true);
    } catch (error) {
      console.log('ViewMax: Error during cleanup:', error);
    }
  }

  // Remove any orphaned toggles before creating new instance
  const orphanedToggles = document.querySelectorAll('#viewmax-toggle, [id^="viewmax-toggle"]');
  orphanedToggles.forEach(toggle => {
    console.log('ViewMax: Removing orphaned toggle');
    toggle.remove();
  });

  console.log(`ViewMax: Creating new instance (attempt ${initializationAttempts})`);
  try {
    viewMaxInstance = new ViewMax();
  } catch (error) {
    console.error('ViewMax: Failed to create instance:', error);
    if (initializationAttempts < maxInitAttempts) {
      setTimeout(initializeViewMax, 1000);
    }
  }
}

// Enhanced initialization with multiple strategies
function setupInitialization() {
  // Strategy 1: Standard DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeViewMax);
  } else if (document.readyState === 'interactive') {
    setTimeout(initializeViewMax, 100);
  } else {
    initializeViewMax();
  }

  // Strategy 2: YouTube-specific events
  window.addEventListener('yt-navigate-start', () => {
    console.log('ViewMax: YouTube navigation started');
  });

  window.addEventListener('yt-navigate-finish', () => {
    console.log('ViewMax: YouTube navigation finished');
    setTimeout(() => {
      if (viewMaxInstance) {
        viewMaxInstance.handleNavigation();
      } else {
        initializeViewMax();
      }
    }, 500);
  });

  window.addEventListener('yt-page-data-updated', () => {
    console.log('ViewMax: YouTube page data updated');
    setTimeout(() => {
      if (viewMaxInstance) {
        viewMaxInstance.handleNavigation();
      }
    }, 300);
  });

  // Strategy 3: Fallback timers
  setTimeout(() => {
    if (!viewMaxInstance && document.querySelector('ytd-app')) {
      console.log('ViewMax: Fallback initialization (2s)');
      initializeViewMax();
    }
  }, 2000);

  setTimeout(() => {
    if (!viewMaxInstance && document.querySelector('ytd-app')) {
      console.log('ViewMax: Fallback initialization (5s)');
      initializeViewMax();
    }
  }, 5000);

  // Strategy 4: URL change detection
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      console.log('ViewMax: URL change detected via polling');
      lastUrl = location.href;
      setTimeout(() => {
        if (viewMaxInstance) {
          viewMaxInstance.handleNavigation();
        } else {
          initializeViewMax();
        }
      }, 1000);
    }
  }, 1000);
}

// Start initialization
setupInitialization();