<script>
    import { fade, fly } from 'svelte/transition';
    import { onMount } from 'svelte';
    import lottie from 'lottie-web';
    import { onboardingComplete } from '../stores/onboardingStore';
    import { Geolocation } from '@capacitor/geolocation';
    import { LocalNotifications } from '@capacitor/local-notifications';
    import { Capacitor } from '@capacitor/core';
  
    let currentSlide = 0;
    const totalSlides = 4;
    let locationAnimation;
    let locationAnimationInstance;
    let locationStatus = 'pending'; // 'pending', 'granted', 'denied'
    let notificationAnimation;
    let notificationAnimationInstance;
    let notificationStatus = 'pending';
  
    async function requestLocation() {
      try {
        // Request permission
        const permission = await Geolocation.requestPermissions();
        
        if (permission.location === 'granted') {
          // Test if we can actually get the location
          await Geolocation.getCurrentPosition();
          locationStatus = 'granted';
        } else {
          locationStatus = 'denied';
        }
      } catch (error) {
        locationStatus = 'denied';
        console.error('Location permission error:', error);
      }
    }
  
    async function requestNotification() {
      try {
        // Check if running on native platform
        const isNative = Capacitor.isNativePlatform();
        
        if (isNative) {
          // Request permission using Capacitor
          const permission = await LocalNotifications.requestPermissions();
          
          if (permission.display === 'granted') {
            notificationStatus = 'granted';
            // Test notification
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: 'Welcome to Deen Reflections',
                  body: 'You will receive prayer time notifications here',
                  id: 1,
                  schedule: { at: new Date(Date.now() + 1000) }
                }
              ]
            });
          } else {
            notificationStatus = 'denied';
          }
        } else {
          // Fallback for web
          const permission = await Notification.requestPermission();
          notificationStatus = permission;
        }
      } catch (error) {
        notificationStatus = 'denied';
        console.error('Notification permission error:', error);
      }
    }
  
    $: if (currentSlide === 1 && locationAnimation && !locationAnimationInstance) {
      locationAnimationInstance = lottie.loadAnimation({
        container: locationAnimation,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/animations/location.json'
      });
    }
  
    $: if (currentSlide !== 1 && locationAnimationInstance) {
      locationAnimationInstance.destroy();
      locationAnimationInstance = null;
    }
  
    $: if (currentSlide === 2 && notificationAnimation && !notificationAnimationInstance) {
      notificationAnimationInstance = lottie.loadAnimation({
        container: notificationAnimation,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/animations/notification.json'
      });
    }
  
    $: if (currentSlide !== 2 && notificationAnimationInstance) {
      notificationAnimationInstance.destroy();
      notificationAnimationInstance = null;
    }
  
    function nextSlide() {
      if (currentSlide === 1 && locationStatus !== 'granted') {
        // Don't proceed if location permission not granted
        return;
      }
      if (currentSlide === 2 && notificationStatus !== 'granted') {
        // Don't proceed if notification permission not granted
        return;
      }
      
      if (currentSlide < totalSlides - 1) {
        currentSlide++;
      } else {
        onboardingComplete.set(true);
      }
    }
  
    function prevSlide() {
      if (currentSlide > 0) {
        currentSlide--;
      }
    }
  </script>
  
  <div class="onboarding-container">
    <div class="slider-container">
      <div class="slider" style="transform: translateX(-{currentSlide * 100}vw)">
        <!-- Slide 1: Welcome -->
        <div class="slide welcome-slide">
          <div class="content welcome-content">
            {#key currentSlide}
              {#if currentSlide === 0}
                <div class="logo-container" in:fly="{{ y: 50, duration: 1000, delay: 300 }}">
                  <img src="/Logo.png" alt="Deen Reflections Logo" class="app-logo" />
                  <div class="logo-shine"></div>
                </div>
                <h1 in:fly="{{ y: 30, duration: 1000, delay: 600 }}">Deen Reflections</h1>
                <p class="tagline" in:fly="{{ y: 20, duration: 1000, delay: 800 }}">
                  Strengthening your connection with Allah <span class="swt">(swt)</span>
                </p>
                <p class="greeting" in:fly="{{ y: 20, duration: 1000, delay: 1000 }}">
                  <span class="greeting-box">
                    <span class="inner-box">
                      Assalamu'alaikum
                      <span class="welcome-text">Welcome to your spiritual companion</span>
                    </span>
                  </span>
                </p>
              {/if}
            {/key}
          </div>
        </div>
  
        <!-- Slide 2: Location -->
        <div class="slide">
          <div class="content">
            {#key currentSlide}
              {#if currentSlide === 1}
                <div class="icon-container" in:fly="{{ y: 30, duration: 800 }}">
                  <div bind:this={locationAnimation} class="lottie-animation"></div>
                </div>
                <h1 in:fly="{{ y: 30, duration: 800, delay: 200 }}">Location Access</h1>
                <p class="location-description" in:fly="{{ y: 20, duration: 800, delay: 400 }}">
                  We need your location to provide accurate prayer times based on your exact position. This helps ensure:
                </p>
                <button 
                  class="permission-button {locationStatus}" 
                  on:click={requestLocation}
                  in:fly="{{ y: 20, duration: 800, delay: 800 }}"
                >
                  {#if locationStatus === 'pending'}
                    Allow Location Access
                  {:else if locationStatus === 'granted'}
                    ✓ Location Access Granted
                  {:else}
                    Try Again
                  {/if}
                </button>
              {/if}
            {/key}
          </div>
        </div>
  
        <!-- Slide 3: Notifications -->
        <div class="slide">
          <div class="content">
            {#key currentSlide}
              {#if currentSlide === 2}
                <div class="icon-container" in:fly="{{ y: 30, duration: 800 }}">
                  <div bind:this={notificationAnimation} class="lottie-animation"></div>
                </div>
                <h1 in:fly="{{ y: 30, duration: 800, delay: 200 }}">Notification Access</h1>
                <p class="notification-description" in:fly="{{ y: 20, duration: 800, delay: 400 }}">
                  Enable notifications to never miss your prayer times and receive:
                </p>
                <button 
                  class="permission-button {notificationStatus}" 
                  on:click={requestNotification}
                  in:fly="{{ y: 20, duration: 800, delay: 800 }}"
                >
                  {#if notificationStatus === 'pending'}
                    Enable Notifications
                  {:else if notificationStatus === 'granted'}
                    ✓ Notifications Enabled
                  {:else}
                    Try Again
                  {/if}
                </button>
              {/if}
            {/key}
          </div>
        </div>
  
        <!-- Slide 4: Get Started -->
        <div class="slide">
          <div class="content">
            {#key currentSlide}
              {#if currentSlide === 3}
                <div class="icon-container final-logo" in:fly="{{ y: 30, duration: 800 }}">
                  <img src="/Logo.png" alt="Deen Reflections Logo" class="final-app-logo" />
                </div>
                <h1 in:fly="{{ y: 30, duration: 800, delay: 200 }}" class="final-heading">Ready to Begin</h1>
                <div class="final-content" in:fly="{{ y: 20, duration: 800, delay: 400 }}">
                  <p class="final-description">
                    Join thousands of Muslims strengthening their connection with Allah (swt) through:
                  </p>
                  <div class="features-grid">
                    <div class="feature-item">Accurate prayer times</div>
                    <div class="feature-item">Timely notifications</div>
                    <div class="feature-item">Daily Islamic journal</div>
                    <div class="feature-item">Track spiritual progress</div>
                  </div>
                  <p class="final-message">
                    Begin your journey towards a more mindful and connected spiritual life, as we strive to strengthen our bond with Allah (swt) together.
                  </p>
                </div>
              {/if}
            {/key}
          </div>
        </div>
      </div>
    </div>
  
    <!-- Navigation -->
    <div class="navigation" in:fade="{{ duration: 1000 }}">
      <div class="dots">
        {#each Array(totalSlides) as _, i}
          <div 
            class="dot" 
            class:active={currentSlide === i}
            style="transition-delay: {i * 100}ms"
          ></div>
        {/each}
      </div>
      <div class="buttons">
        {#if currentSlide > 0}
          <button on:click={prevSlide} class="nav-button">Previous</button>
        {/if}
        {#if currentSlide < totalSlides - 1}
          <button 
            on:click={nextSlide} 
            class="nav-button"
            class:disabled={(currentSlide === 1 && locationStatus !== 'granted') || 
                          (currentSlide === 2 && notificationStatus !== 'granted')}
            disabled={(currentSlide === 1 && locationStatus !== 'granted') || 
                     (currentSlide === 2 && notificationStatus !== 'granted')}
          >
            Next
          </button>
        {:else}
          <button on:click={nextSlide} class="nav-button get-started">Get Started</button>
        {/if}
      </div>
    </div>
  </div>
  
  <style>
    .onboarding-container {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      position: fixed;
      top: 0;
      left: 0;
      display: flex;
      flex-direction: column;
      background: #fff;
    }
  
    .slider-container {
      position: relative;
      flex: 1;
      overflow: hidden;
    }
  
    .slider {
      display: flex;
      height: 100%;
      width: 400vw; /* 4 slides * 100vw */
      transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }
  
    .slide {
      width: 100vw;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 2rem;
      box-sizing: border-box;
    }
  
    .welcome-slide {
      background: transparent;
    }
  
    .welcome-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
  
    .logo-container {
      position: relative;
      overflow: visible;
      padding: 1rem;
      background: transparent;
      box-shadow: none;
      border: none;
    }
  
    .app-logo {
      width: auto;
      height: 120px;
      object-fit: contain;
      transform-origin: center;
      animation: pulse 2s infinite;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.08));
    }
  
    .logo-shine {
      position: absolute;
      top: 0;
      left: -100%;
      width: 50px;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(247, 235, 230, 0.3),
        transparent
      );
      animation: shine 3s infinite;
      transform: skewX(-20deg);
    }
  
    .icon-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 2rem;
    }
  
    .feature-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      animation: bounce 2s infinite;
    }
  
    .content {
      width: 100%;
      max-width: 320px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
  
    h1 {
      font-size: 1.75rem;
      margin: 0;
      color: #2c3e50;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
  
    .tagline {
      font-size: 1rem;
      color: #666;
      margin: 0.5rem 0;
      font-weight: 500;
    }
  
    .swt {
      opacity: 0.7;
      font-size: 0.9em;
    }
  
    .greeting {
      font-size: 1.75rem;
      color: #216974;
      margin: 2rem 0 0.25rem;
      font-weight: 500;
      letter-spacing: -0.2px;
      position: relative;
      width: 100%;
      display: flex;
      justify-content: center;
    }
  
    .greeting-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 3rem;
      border-radius: 20px;
      position: relative;
      overflow: visible;
      z-index: 1;
      background: rgba(224, 148, 83, 0.08);
      max-width: 90%;
    }
  
    .greeting-box::before {
      content: '';
      position: absolute;
      top: -8px;
      left: -8px;
      right: -8px;
      bottom: -8px;
      background: rgba(224, 148, 83, 0.05);
      border-radius: 24px;
      z-index: -1;
    }
  
    .greeting-box::after {
      content: '';
      position: absolute;
      top: -16px;
      left: -16px;
      right: -16px;
      bottom: -16px;
      background: rgba(224, 148, 83, 0.03);
      border-radius: 28px;
      z-index: -2;
    }
  
    .inner-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
  
    .welcome-text {
      font-size: 1rem;
      color: #000000;
      margin-top: 0.75rem;
      font-weight: 400;
    }
  
    p {
      font-size: 1rem;
      color: #666;
      margin-bottom: 1.5rem;
      line-height: 1.4;
    }
  
    .navigation {
      padding: 2rem;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      box-sizing: border-box;
    }
  
    .dots {
      display: flex;
      gap: 8px;
    }
  
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: rgba(33, 105, 116, 0.2);
      transition: all 0.3s ease;
    }
  
    .dot.active {
      background-color: #E09453;
    }
  
    .buttons {
      display: flex;
      gap: 1rem;
      width: 100%;
      max-width: 320px;
      justify-content: center;
    }
  
    .nav-button {
      padding: 0.75rem 2rem;
      border: none;
      border-radius: 25px;
      background-color: #216974;
      color: white;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      min-width: 120px;
    }
  
    .nav-button:hover {
      background-color: #1a545d;
    }
  
    .get-started {
      background-color: #216974;
    }
  
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.03); opacity: 0.95; }
      100% { transform: scale(1); opacity: 1; }
    }
  
    @keyframes shine {
      0% { left: -100%; }
      20% { left: 100%; }
      100% { left: 100%; }
    }
  
    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-20px); }
      60% { transform: translateY(-10px); }
    }
  
    .lottie-animation {
      width: 180px;
      height: 180px;
      margin-bottom: 1rem;
    }
  
    .location-description {
      color: #216974;
      font-size: 1rem;
      line-height: 1.5;
      margin-bottom: 1rem;
    }
  
    .benefits-list {
      list-style: none;
      padding: 0;
      margin: 0;
      color: #666;
      font-size: 0.95rem;
      line-height: 1.6;
    }
  
    .benefits-list li {
      margin-bottom: 0.5rem;
      position: relative;
      padding-left: 1.5rem;
    }
  
    .benefits-list li::before {
      content: "•";
      color: #216974;
      position: absolute;
      left: 0.5rem;
      font-weight: bold;
    }
  
    .permission-button {
      margin-top: 1.5rem;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 25px;
      background-color: #216974;
      color: white;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      min-width: 200px;
      box-shadow: 0 2px 4px rgba(33, 105, 116, 0.15);
    }
  
    .permission-button:hover {
      background-color: #1a545d;
      transform: translateY(-1px);
      box-shadow: 0 4px 6px rgba(33, 105, 116, 0.2);
    }
  
    .permission-button.granted {
      background-color: #27ae60;
      cursor: default;
    }
  
    .permission-button.granted:hover {
      transform: none;
      box-shadow: 0 2px 4px rgba(39, 174, 96, 0.15);
    }
  
    .permission-button.denied {
      background-color: #e74c3c;
    }
  
    .notification-description {
      color: #216974;
      font-size: 1rem;
      line-height: 1.5;
      margin-bottom: 1rem;
    }
  
    .final-logo {
      margin-bottom: 2rem;
    }
  
    .final-app-logo {
      width: 80px;
      height: auto;
    }
  
    .final-heading {
      color: #216974;
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
  
    .final-content {
      width: 100%;
      max-width: 320px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
  
    .final-description {
      color: #216974;
      font-size: 1.1rem;
      line-height: 1.5;
      margin: 0;
    }
  
    .final-benefits {
      margin: 0;
      padding: 0 2rem;
      text-align: left;
    }
  
    .final-message {
      color: #666;
      font-size: 1rem;
      font-style: italic;
      line-height: 1.6;
      margin: 0;
    }
  
    .features-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
      width: 100%;
      margin: 1rem 0;
    }
  
    .feature-item {
      color: #216974;
      font-size: 1.1rem;
      padding: 1rem 1.5rem;
      background: rgba(33, 105, 116, 0.05);
      border-radius: 12px;
      text-align: center;
    }
  
    @media (min-width: 768px) {
      .content,
      .final-content {
        max-width: 400px;
      }
  
      .features-grid {
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
  
      .final-app-logo {
        width: 100px;
      }
  
      .nav-button {
        min-width: 140px;
      }
    }
  
    .nav-button.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background-color: #999;
    }
  
    .nav-button.disabled:hover {
      background-color: #999;
      transform: none;
    }
  </style> 