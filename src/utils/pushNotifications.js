import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Ensure the high importance channel exists for Android Firebase background messages
export async function createNotificationChannel() {
    if (Platform.OS === 'android') {
        try {
            await notifee.createChannel({
                id: 'high_importance_channel',
                name: 'Important Notifications',
                importance: AndroidImportance.HIGH,
                sound: 'default',
            });
            console.log('[PushNotifications] High importance channel ensured/created.');
        } catch (err) {
            console.error('[PushNotifications] Error creating channel:', err);
        }
    }
}

// Execute immediately when bundle loads (critical for background/killed state channel existence)
createNotificationChannel();


// Register background message handler outside of any React lifecycles
messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('[PushNotifications] Background Message handled:', remoteMessage);
});

/**
 * Request notification permission from user
 */
export async function requestUserPermission() {
    try {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const { PermissionsAndroid } = require('react-native');
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
            console.log('[PushNotifications] Android 13+ POST_NOTIFICATIONS Permission result:', granted);
        }

        const authStatus = await messaging().requestPermission();
        const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
            console.log('[PushNotifications] Permission granted. Authorization status:', authStatus);
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
    try {
        // First check stored token
        let token = await AsyncStorage.getItem('fcm_token');
        if (!token) {
            token = await messaging().getToken();
            if (token) {
                await AsyncStorage.setItem('fcm_token', token);
            }
        }
        console.log('[PushNotifications] Current Mobile FCM Token:', token);
        return token;
    } catch (error) {
        console.error('[PushNotifications] Error getting FCM Token:', error);
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
        const response = await api.post('/notifications/fcm-token', {
            token,
            platform: Platform.OS
        });

        if (response.data?.success) {
            console.log('[PushNotifications] FCM Token registered successfully on backend. API Response:', response.data);
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
        const token = await AsyncStorage.getItem('fcm_token');
        if (!token) {
            console.log('[PushNotifications] No token found in storage to deactivate.');
            return;
        }

        console.log('[PushNotifications] Deactivating FCM token on backend:', token);
        try {
            await api.post('/notifications/fcm-token/deactivate', { token });
        } catch (apiErr) {
            console.log('[PushNotifications] Deactivate API call returned non-2xx status (already cleared on backend).');
        }
        
        // Remove token locally so next login fetches a fresh one
        await AsyncStorage.removeItem('fcm_token');
        console.log('[PushNotifications] FCM Token deactivated and cleared from local storage.');
    } catch (error) {
        console.error('[PushNotifications] Error deactivating FCM Token:', error.message);
    }
}

/**
 * Set up message listeners for foreground, background, and quit states
 */
export function setupNotificationListeners(navigationRef) {
    // Channel is already ensured at the module root, but we can call it again safely
    createNotificationChannel();

    // 1. FOREGROUND MESSAGES
    const unsubscribeMessage = messaging().onMessage(async remoteMessage => {
        console.log('[PushNotifications] Foreground Notification received:', remoteMessage);
        // Socket.IO already manages real-time updates and sounds in the foreground,
        // so we don't double-sound, but let's log the event.
    });

    // 2. NOTIFICATION CLICK - WHEN APP IS RUNNING IN BACKGROUND
    const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp(remoteMessage => {
        console.log('[PushNotifications] Notification clicked when app was in background:', remoteMessage);
        handleNotificationNavigation(remoteMessage, navigationRef);
    });

    // 3. NOTIFICATION CLICK - WHEN APP WAS CLOSED / QUIT STATE
    messaging()
        .getInitialNotification()
        .then(remoteMessage => {
            if (remoteMessage) {
                console.log('[PushNotifications] Notification clicked from quit state:', remoteMessage);
                // Delay navigation slightly to let App Navigation mount completely
                setTimeout(() => {
                    handleNotificationNavigation(remoteMessage, navigationRef);
                }, 1500);
            }
        });

    // 4. TOKEN REFRESH LISTENER
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async token => {
        console.log('[PushNotifications] FCM Token refreshed:', token);
        await AsyncStorage.setItem('fcm_token', token);
        try {
            await api.post('/notifications/fcm-token', {
                token,
                platform: Platform.OS
            });
        } catch (err) {
            console.error('[PushNotifications] Error registering refreshed token:', err.message);
        }
    });

    return () => {
        unsubscribeMessage();
        unsubscribeNotificationOpened();
        unsubscribeTokenRefresh();
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
