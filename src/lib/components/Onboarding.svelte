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
    <div class="slider" style="transform: translateX(-{currentSlideValue * 100}%)">
        {#each slides as slide, index}
            <div class="slide" class:active={index === currentSlideValue} in:fade>
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
        {/each}
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
        width: 100%;
        height: 100vh;
        overflow: hidden;
        position: relative;
        background-color: #f8f9fa;
    }

    .slider {
        display: flex;
        transition: transform 0.3s ease-in-out;
        height: 100%;
    }

    .slide {
        min-width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        text-align: center;
    }

    .image-container {
        width: 250px;
        height: 250px;
        margin: 2rem 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .image-container :global(svg) {
        width: 100%;
        height: 100%;
    }

    h2 {
        font-size: 1.8rem;
        color: #2c3e50;
        margin-bottom: 1rem;
    }

    p {
        font-size: 1.1rem;
        color: #666;
        max-width: 80%;
        margin: 0 auto;
    }

    .navigation {
        position: absolute;
        bottom: 2rem;
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }

    .dots {
        display: flex;
        gap: 0.5rem;
    }

    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #ccc;
        transition: background-color 0.3s ease;
    }

    .dot.active {
        background-color: #4CAF50;
    }

    .next-button, .permission-button {
        padding: 0.8rem 2rem;
        border: none;
        border-radius: 25px;
        background-color: #4CAF50;
        color: white;
        font-size: 1rem;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }

    .next-button:hover, .permission-button:hover {
        background-color: #45a049;
    }

    .permission-button {
        margin-top: 1rem;
        background-color: #2196F3;
    }

    .permission-button:hover {
        background-color: #1976D2;
    }
</style> 