<script>
    import { onMount } from 'svelte';
    import { currentSlide, onboardingComplete, locationPermissionGranted, notificationPermissionGranted, completeOnboarding } from '../stores/onboardingStore';
    import { Geolocation } from '@capacitor/geolocation';
    import { LocalNotifications } from '@capacitor/local-notifications';
    import { welcomeImage, locationImage, notificationImage, bismillahImage } from './OnboardingImages.js';
    import { fade, slide } from 'svelte/transition';

    let slides = [
        {
            title: "Assalamualaikum",
            description: "Welcome to Islamic Journal App - Your companion for spiritual growth and daily Islamic practices.",
            image: welcomeImage
        },
        {
            title: "Location Access",
            description: "We need your location to provide accurate prayer times for your area.",
            image: locationImage
        },
        {
            title: "Stay Connected",
            description: "Enable notifications to receive prayer time alerts and important reminders.",
            image: notificationImage
        },
        {
            title: "بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
            description: "Let's begin our journey together",
            image: bismillahImage
        }
    ];

    let showNextButton = true;
    let currentSlideValue;

    currentSlide.subscribe(value => {
        currentSlideValue = value;
        if (value === 1) {
            showNextButton = false;
            checkLocationPermission();
        } else if (value === 2) {
            showNextButton = false;
            checkNotificationPermission();
        } else {
            showNextButton = true;
        }
    });

    async function checkLocationPermission() {
        try {
            const permission = await Geolocation.checkPermissions();
            if (permission.location === 'granted') {
                locationPermissionGranted.set(true);
                showNextButton = true;
            }
        } catch (error) {
            console.error('Error checking location permission:', error);
        }
    }

    async function requestLocationPermission() {
        try {
            const permission = await Geolocation.requestPermissions();
            if (permission.location === 'granted') {
                locationPermissionGranted.set(true);
                showNextButton = true;
            }
        } catch (error) {
            console.error('Error requesting location permission:', error);
        }
    }

    async function checkNotificationPermission() {
        try {
            const permission = await LocalNotifications.checkPermissions();
            if (permission.display === 'granted') {
                notificationPermissionGranted.set(true);
                showNextButton = true;
            }
        } catch (error) {
            console.error('Error checking notification permission:', error);
        }
    }

    async function requestNotificationPermission() {
        try {
            const permission = await LocalNotifications.requestPermissions();
            if (permission.display === 'granted') {
                notificationPermissionGranted.set(true);
                showNextButton = true;
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    }

    function nextSlide() {
        if (currentSlideValue < slides.length - 1) {
            currentSlide.set(currentSlideValue + 1);
        } else {
            completeOnboarding();
        }
    }
</script>

<div class="onboarding-container">
    <div class="slider-container">
        <div class="slider" style="transform: translateX(-{currentSlideValue * 100}vw)">
            {#each slides as slide, index}
                <div class="slide" class:active={index === currentSlideValue}>
                    <div class="slide-content">
                        <div class="content-wrapper">
                            <h2>{slide.title}</h2>
                            <div class="image-container">
                                {@html slide.image}
                            </div>
                            <p>{slide.description}</p>
                            
                            {#if index === 1 && !$locationPermissionGranted}
                                <button class="permission-button" on:click={requestLocationPermission}>
                                    Enable Location
                                </button>
                            {/if}
                            
                            {#if index === 2 && !$notificationPermissionGranted}
                                <button class="permission-button" on:click={requestNotificationPermission}>
                                    Enable Notifications
                                </button>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </div>

    <div class="navigation">
        <div class="dots">
            {#each slides as _, index}
                <span class="dot" class:active={index === currentSlideValue}></span>
            {/each}
        </div>
        {#if showNextButton}
            <button class="next-button" on:click={nextSlide}>
                {currentSlideValue === slides.length - 1 ? 'Get Started' : 'Next'}
            </button>
        {/if}
    </div>
</div>

<style>
    .onboarding-container {
        width: 100vw;
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
        position: fixed;
        top: 0;
        left: 0;
        background-color: #f8f9fa;
        display: flex;
        flex-direction: column;
    }

    .slider-container {
        position: relative;
        flex: 1;
        overflow: hidden;
    }

    .slider {
        display: flex;
        transition: transform 0.3s ease-in-out;
        height: 100%;
        width: 400vw; /* 100vw * number of slides */
    }

    .slide {
        width: 100vw;
        height: 100%;
        flex-shrink: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
    }

    .slide-content {
        min-height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 1rem;
        box-sizing: border-box;
    }

    .content-wrapper {
        max-width: 500px;
        margin: 0 auto;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1rem;
    }

    .image-container {
        width: min(180px, 50vw);
        height: min(180px, 50vw);
        margin: 1.5rem 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .image-container :global(svg) {
        width: 100%;
        height: 100%;
    }

    h2 {
        font-size: clamp(1.3rem, 4vw, 1.6rem);
        color: #2c3e50;
        margin-bottom: 0.5rem;
        padding: 0 1rem;
        text-align: center;
        width: 100%;
    }

    p {
        font-size: clamp(0.9rem, 3.5vw, 1rem);
        color: #666;
        max-width: 90%;
        margin: 0 auto 1rem;
        line-height: 1.5;
        text-align: center;
    }

    .navigation {
        position: relative;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        background: linear-gradient(to top, rgba(248, 249, 250, 1), rgba(248, 249, 250, 0.8));
    }

    .dots {
        display: flex;
        gap: 0.5rem;
    }

    .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: #ccc;
        transition: background-color 0.3s ease;
    }

    .dot.active {
        background-color: #216974;
    }

    .next-button, .permission-button {
        padding: 0.8rem 2rem;
        border: none;
        border-radius: 25px;
        background-color: #216974;
        color: white;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.3s ease;
        min-width: 120px;
        -webkit-tap-highlight-color: transparent;
    }

    .next-button:hover, .permission-button:hover {
        background-color: #1a5761;
    }

    .next-button:active, .permission-button:active {
        transform: scale(0.98);
    }

    .permission-button {
        margin-top: 1rem;
        background-color: #E09453;
    }

    .permission-button:hover {
        background-color: #c87f43;
    }

    @media (max-height: 600px) {
        .image-container {
            width: min(140px, 40vw);
            height: min(140px, 40vw);
            margin: 1rem 0;
        }

        h2 {
            margin-bottom: 0.3rem;
            font-size: clamp(1.1rem, 3.5vw, 1.4rem);
        }

        p {
            margin-bottom: 0.5rem;
            font-size: clamp(0.8rem, 3vw, 0.9rem);
        }

        .navigation {
            padding: 1rem;
        }

        .next-button, .permission-button {
            padding: 0.6rem 1.5rem;
            font-size: 0.8rem;
        }
    }

    @media (min-width: 768px) {
        .content-wrapper {
            padding: 2rem;
        }
    }
</style> 