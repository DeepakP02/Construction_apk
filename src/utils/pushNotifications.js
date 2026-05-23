import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import api from './api';

// Detect if we are running inside the Expo Go client
const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

let Notifications = null;
if (!isExpoGo) {
    try {
        Notifications = require('expo-notifications');
    } catch (e) {
        console.warn('[PushNotifications] Failed to load expo-notifications module:', e);
    }
} else {
    console.warn('[PushNotifications] Running in Expo Go. Push notifications are bypassed to prevent crashes.');
}

// Ensure the high importance channel exists for Android Firebase background messages
export async function createNotificationChannel() {
    if (Platform.OS === 'android' && Notifications) {
        try {
            await Notifications.setNotificationChannelAsync('high_importance_channel', {
                name: 'Important Notifications',
                importance: Notifications.AndroidImportance.HIGH,
                sound: 'default',
            });
            console.log('[PushNotifications] Android notification channel set.');
        } catch (err) {
            console.error('[PushNotifications] Error setting channel:', err);
        }
    }
}

// Ensure channel exists on app start
createNotificationChannel();

/**
 * Request notification permission from user
 */
export async function requestUserPermission() {
    if (!Notifications) {
        console.warn('[PushNotifications] requestUserPermission bypassed (running in Expo Go).');
        return false;
    }
    try {
        const { status } = await Notifications.requestPermissionsAsync();
        const enabled = status === 'granted';
        if (enabled) {
            console.log('[PushNotifications] Permission granted.');
            return true;
        }
        console.log('[PushNotifications] Permission denied.');
        return false;
    } catch (error) {
        console.error('[PushNotifications] Permission request error:', error);
        return false;
    }
}

/**
 * Get FCM Token
 */
export async function getFcmToken() {
    if (!Notifications) {
        console.warn('[PushNotifications] getFcmToken bypassed (running in Expo Go).');
        return null;
    }
    try {
        // First check stored Expo push token
        let token = await AsyncStorage.getItem('expo_push_token');
        if (!token) {
            const expoToken = await Notifications.getExpoPushTokenAsync();
            token = expoToken.data;
            if (token) {
                await AsyncStorage.setItem('expo_push_token', token);
            }
        }
        console.log('[PushNotifications] Current Expo push token:', token);
        return token;
    } catch (error) {
        console.error('[PushNotifications] Error getting Expo push token:', error);
        return null;
    }
}

/**
 * Upload/Register FCM token to the backend
 */
export async function registerFcmToken(userId) {
    try {
        const hasPermission = await requestUserPermission();
        if (!hasPermission) return false;

        const token = await getFcmToken();
        if (!token) {
            console.log('[PushNotifications] No FCM token available.');
            return false;
        }

        console.log('[PushNotifications] Registering FCM token with backend:', token);
        const response = await api.post('/notifications/expo-token', {
            token,
            platform: Platform.OS
        });
        if (response.data?.success) {
            console.log('[PushNotifications] Expo push token registered successfully on backend.');
            return true;
        }
        return false;
    } catch (error) {
        console.error('[PushNotifications] Error uploading FCM Token:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Deactivate FCM Token on the backend (on logout)
 */
export async function deactivateFcmToken() {
    try {
        const token = await AsyncStorage.getItem('expo_push_token');
        if (!token) {
            console.log('[PushNotifications] No token found in storage to deactivate.');
            return;
        }

        console.log('[PushNotifications] Deactivating Expo push token on backend:', token);
        try {
            await api.post('/notifications/expo-token/deactivate', { token });
        } catch (apiErr) {
            console.log('[PushNotifications] Deactivate API call error (may already be cleared).');
        }

        // Remove token locally so next login fetches a fresh one
        await AsyncStorage.removeItem('expo_push_token');
        console.log('[PushNotifications] Expo push token cleared from local storage.');
    } catch (error) {
        console.error('[PushNotifications] Error deactivating Expo token:', error.message);
    }
}

/**
 * Set up message listeners for foreground, background, and quit states
 */
export function setupNotificationListeners(navigationRef) {
    if (!Notifications) {
        console.warn('[PushNotifications] setupNotificationListeners bypassed (running in Expo Go).');
        return () => {};
    }

    // Ensure channel exists
    createNotificationChannel();

    // 1. FOREGROUND LISTENER
    const subscription = Notifications.addNotificationReceivedListener(notification => {
        console.log('[PushNotifications] Foreground notification received:', notification);
    });

    // 2. RESPONSE LISTENER (when user taps a notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('[PushNotifications] Notification response received:', response);
        const remoteMessage = response.notification.request.content;
        handleNotificationNavigation({ data: remoteMessage.data }, navigationRef);
    });

    return () => {
        subscription.remove();
        responseSubscription.remove();
    };
}

/**
 * Direct navigation on Notification tap
 */
function handleNotificationNavigation(remoteMessage, navigationRef) {
    try {
        const data = remoteMessage?.data || {};
        if (data.roomId) {
            console.log('[PushNotifications] Navigating to WorkerChat screen with roomId:', data.roomId);
            if (navigationRef && navigationRef.current) {
                navigationRef.current.navigate('WorkerChat', {
                    room: {
                        id: data.roomId,
                        name: data.senderName || 'Discussion Room',
                        type: data.senderId ? 'private' : 'group'
                    }
                });
            } else {
                console.warn('[PushNotifications] NavigationRef is not available.');
            }
        }
    } catch (err) {
        console.error('[PushNotifications] Navigation error:', err.message);
    }
}
