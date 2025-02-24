import { Purchases } from '@revenuecat/purchases-capacitor';
import { writable } from 'svelte/store';
import { Capacitor } from '@capacitor/core';

// Store for subscription status
export const subscriptionStore = writable({
    isSubscribed: false,
    activeSubscription: null,
    entitlements: null
});

// Store for initialization status
export const initializationStore = writable({
    isInitialized: false,
    error: null
});

// Product IDs
export const PRODUCT_IDS = {
    MONTHLY: '$rc_monthly',
    ANNUAL: '$rc_annual'
};

// Entitlement IDs - this should match what you set in RevenueCat dashboard
export const ENTITLEMENT_ID = 'premium_access';

let initializationPromise = null;
let initializationTimeout = null;

// Initialize RevenueCat
export async function initializeRevenueCat() {
    console.log('Initializing RevenueCat...');
    
    // Clear any existing timeout
    if (initializationTimeout) {
        clearTimeout(initializationTimeout);
    }

    // Check if already initialized
    let initialized = false;
    initializationStore.subscribe(state => {
        initialized = state.isInitialized;
    })();

    if (initialized) {
        console.log('RevenueCat already initialized');
        return;
    }

    // If there's an existing promise but it's been pending for too long, clear it
    if (initializationPromise) {
        console.log('Checking existing initialization promise...');
        initializationTimeout = setTimeout(() => {
            console.log('Initialization timed out, resetting...');
            initializationPromise = null;
            initializationStore.set({ isInitialized: false, error: 'Initialization timed out' });
        }, 10000); // 10 second timeout
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            // Get platform-specific API key
            const platform = Capacitor.getPlatform();
            console.log('Current platform:', platform);
            let apiKey;
            
            if (platform === 'android') {
                apiKey = 'goog_MBpdkiamsffNEdoHRLekmHKItBj';
                console.log('Using Android API key');
            } else if (platform === 'ios') {
                apiKey = 'YOUR_IOS_API_KEY';
                console.log('Using iOS API key');
            } else {
                apiKey = 'goog_MBpdkiamsffNEdoHRLekmHKItBj';
                console.log('Using default Android API key for web');
            }

            if (!apiKey) {
                throw new Error('RevenueCat API key not configured');
            }

            console.log('Configuring RevenueCat with API key...');
            try {
                await Purchases.configure({
                    apiKey,
                    appUserID: null
                });
                console.log('RevenueCat configured successfully');
            } catch (configError) {
                // If already configured, consider it a success
                if (configError.message?.includes('already set')) {
                    console.log('RevenueCat was already configured, proceeding...');
                } else {
                    throw configError;
                }
            }

            // Set as initialized immediately after configure
            initializationStore.set({ isInitialized: true, error: null });
            
            // Check subscription status in the background
            checkSubscriptionStatus().catch(error => {
                console.error('Background subscription check failed:', error);
            });

            console.log('RevenueCat initialization complete');
        } catch (error) {
            console.error('Failed to initialize RevenueCat:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            initializationStore.set({ isInitialized: false, error: error.message });
            throw error;
        } finally {
            if (initializationTimeout) {
                clearTimeout(initializationTimeout);
            }
            initializationPromise = null;
        }
    })();

    return initializationPromise;
}

// Get available packages
export async function getOfferings() {
    try {
        await initializeRevenueCat();
        const offerings = await Purchases.getOfferings();
        return offerings.current;
    } catch (error) {
        console.error('Failed to get offerings:', error);
        return null;
    }
}

// Purchase a package
export async function purchasePackage(packageToPurchase) {
    try {
        await initializeRevenueCat();
        console.log('Attempting to purchase package:', packageToPurchase);
        
        // Enable test mode for development
        if (process.env.NODE_ENV === 'development') {
            console.log('Running in development mode - using test purchase flow');
            await Purchases.setSimulatesAskToBuyInSandbox({
                simulatesAskToBuyInSandbox: true
            });
        }
        
        const { customerInfo } = await Purchases.purchasePackage({ 
            aPackage: packageToPurchase,
            googleProductChangeInfo: {
                oldProductIdentifier: null,
                prorationMode: null
            }
        });
        await checkSubscriptionStatus();
        return customerInfo;
    } catch (error) {
        if (error.code === 'PURCHASE_CANCELLED') {
            console.log('User cancelled the purchase');
            return null;
        }
        console.error('Purchase error:', error);
        throw error;
    }
}

// Check subscription status
export async function checkSubscriptionStatus() {
    try {
        await initializeRevenueCat();
        const { customerInfo } = await Purchases.getCustomerInfo();
        const entitlements = customerInfo.entitlements.active;
        const hasAccess = entitlements[ENTITLEMENT_ID] !== undefined;
        
        subscriptionStore.set({
            isSubscribed: hasAccess,
            activeSubscription: hasAccess ? entitlements[ENTITLEMENT_ID] : null,
            entitlements: entitlements
        });
        
        return hasAccess;
    } catch (error) {
        console.error('Failed to check subscription status:', error);
        return false;
    }
}

// Restore purchases
export async function restorePurchases() {
    try {
        await initializeRevenueCat();
        const { customerInfo } = await Purchases.restorePurchases();
        await checkSubscriptionStatus();
        return customerInfo;
    } catch (error) {
        console.error('Failed to restore purchases:', error);
        throw error;
    }
}

// Get current offering
export async function getCurrentOffering() {
    try {
        await Promise.race([
            initializeRevenueCat(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Initialization timeout')), 15000)
            )
        ]);
        
        try {
            const offerings = await Purchases.getOfferings();

            if (!offerings?.current) {
                throw new Error(
                    'No products are configured in RevenueCat. ' +
                    'Please ensure you have:\n' +
                    '1. Created an Offering (e.g., "default")\n' +
                    '2. Added your products to that Offering\n' +
                    '3. Set it as the current Offering\n' +
                    '4. Published the changes'
                );
            }

            if (!offerings.current.availablePackages?.length) {
                throw new Error(
                    'No packages found in the current offering. ' +
                    'Please add your products to an offering in the RevenueCat dashboard.'
                );
            }

            // Get the monthly and annual packages
            const monthlyPackage = offerings.current.availablePackages.find(
                pkg => pkg.identifier === PRODUCT_IDS.MONTHLY
            );
            
            const annualPackage = offerings.current.availablePackages.find(
                pkg => pkg.identifier === PRODUCT_IDS.ANNUAL
            );

            if (!monthlyPackage && !annualPackage) {
                throw new Error(
                    'No matching packages found. Please ensure:\n' +
                    '1. You have created products with IDs "monthly:monthly" and "monthly:annual"\n' +
                    '2. Added these products to an offering\n' +
                    '3. Set that offering as the current offering\n' +
                    '4. Published all changes'
                );
            }

            return {
                monthly: monthlyPackage,
                annual: annualPackage
            };
        } catch (offeringsError) {
            // Check for specific RevenueCat configuration errors
            if (offeringsError.code === 'ConfigurationError' || 
                offeringsError.message?.includes('configuration')) {
                throw new Error(
                    'RevenueCat configuration error: ' +
                    (offeringsError.underlyingErrorMessage || offeringsError.message) +
                    '\n\nTo fix this:\n' +
                    '1. Go to your RevenueCat dashboard\n' +
                    '2. Create an Offering (e.g., "default")\n' +
                    '3. Add your existing products to that Offering\n' +
                    '4. Set it as the current Offering\n' +
                    '5. Publish all changes'
                );
            }
            throw offeringsError;
        }
    } catch (error) {
        console.error('Failed to get current offering:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack,
            underlyingErrorMessage: error.underlyingErrorMessage
        });
        throw error;
    }
} 