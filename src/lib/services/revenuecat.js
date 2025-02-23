import { Purchases } from '@revenuecat/purchases-capacitor';
import { writable } from 'svelte/store';
import { Capacitor } from '@capacitor/core';

// Store for subscription status
export const subscriptionStore = writable({
    isSubscribed: false,
    activeSubscription: null,
    entitlements: null
});

// Product IDs
export const PRODUCT_IDS = {
    MONTHLY: 'monthly',
    ANNUAL: 'annual'
};

// Entitlement IDs - this should match what you set in RevenueCat dashboard
export const ENTITLEMENT_ID = 'premium_access';

// Initialize RevenueCat
export async function initializeRevenueCat() {
    try {
        // Get platform-specific API key
        const platform = Capacitor.getPlatform();
        let apiKey;
        
        if (platform === 'android') {
            apiKey = process.env.REVENUECAT_API_KEY_ANDROID;
        } else if (platform === 'ios') {
            apiKey = process.env.REVENUECAT_API_KEY_IOS;
        } else {
            // For web testing, use Android key
            apiKey = process.env.REVENUECAT_API_KEY_ANDROID;
        }

        // Configure RevenueCat
        await Purchases.configure({
            apiKey,
            appUserID: null // RevenueCat will generate a random ID
        });
        
        // Set debug logs in development
        if (process.env.NODE_ENV === 'development') {
            await Purchases.setLogLevel({ level: 'debug' });
        }
        
        // Check initial subscription status
        await checkSubscriptionStatus();
    } catch (error) {
        console.error('Failed to initialize RevenueCat:', error);
    }
}

// Get available packages
export async function getOfferings() {
    try {
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
        const { customerInfo } = await Purchases.purchasePackage({ 
            aPackage: packageToPurchase 
        });
        await checkSubscriptionStatus();
        return customerInfo;
    } catch (error) {
        if (error.code === 'PURCHASE_CANCELLED') {
            console.log('User cancelled the purchase');
            return null;
        }
        throw error;
    }
}

// Check subscription status
export async function checkSubscriptionStatus() {
    try {
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
        const offerings = await Purchases.getOfferings();
        if (!offerings.current) return null;

        // Get the monthly and annual packages
        const monthlyPackage = offerings.current.availablePackages.find(
            pkg => pkg.identifier === PRODUCT_IDS.MONTHLY
        );
        
        const annualPackage = offerings.current.availablePackages.find(
            pkg => pkg.identifier === PRODUCT_IDS.ANNUAL
        );

        return {
            monthly: monthlyPackage,
            annual: annualPackage
        };
    } catch (error) {
        console.error('Failed to get current offering:', error);
        return null;
    }
} 