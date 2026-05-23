import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- BACKEND SWITCH TOGGLE ---
// Priority:
// 1) EXPO_PUBLIC_API_URL (if provided)
// 2) Known production host candidates (auto-failover)
const BASE_URL_CANDIDATES = [
    process.env.EXPO_PUBLIC_API_URL,
    // Prefer local backend endpoints during development/testing
    // 'http://192.168.1.23:8080',  // Physical phone local Wi-Fi IP
    // 'http://10.0.2.2:8080',      // Android Emulator loopback
    // 'http://localhost:8080',     // iOS Simulator/Fallback
    'https://construction-production-b18f.up.railway.app',
].filter(Boolean);

let currentBaseIndex = 0;
const getActiveBaseUrl = () => BASE_URL_CANDIDATES[currentBaseIndex];
const getApiBaseUrl = () => `${getActiveBaseUrl()}/api`;
const moveToNextBaseUrl = () => {
    if (currentBaseIndex >= BASE_URL_CANDIDATES.length - 1) return false;
    currentBaseIndex += 1;
    return true;
};
const isRailwayAppNotFound = (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;
    return status === 404 && typeof message === 'string' && message.toLowerCase().includes('application not found');
};


const api = axios.create({
    baseURL: getApiBaseUrl(),
    // Keep chat UX snappy; slow hosts fail over quickly.
    timeout: 10000,
});

let inMemoryToken = null;

export const setAuthToken = (token) => {
    inMemoryToken = token;
};

// Add interceptor to include JWT token in requests
api.interceptors.request.use(
    async (config) => {
        // Always keep request baseURL synced with active candidate.
        config.baseURL = getApiBaseUrl();

        // use memory token if available (faster), else fallback to AsyncStorage
        let token = inMemoryToken;
        if (!token) {
            token = await AsyncStorage.getItem('token');
            if (token) {
                inMemoryToken = token; // Sync back to memory
                console.log(`DEBUG [api]: Restored token from AsyncStorage for ${config.url}`);
            }
        }

        if (token) {
            if (config.headers) {
                if (typeof config.headers.set === 'function') {
                    config.headers.set('Authorization', `Bearer ${token}`);
                } else {
                    config.headers['Authorization'] = `Bearer ${token}`;
                }
            } else {
                config.headers = { Authorization: `Bearer ${token}` };
            }
        } else {
            console.log(`DEBUG [api]: No token found for request to ${config.url}`);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const canRetry = !!error.config && (error.config.__hostFailoverAttempt || 0) < (BASE_URL_CANDIDATES.length - 1);
        const shouldRetryOnNextHost =
            canRetry && (!error.response || isRailwayAppNotFound(error));

        // Automatic host failover for network failures and Railway "Application not found" responses.
        if (shouldRetryOnNextHost && moveToNextBaseUrl()) {
            const nextAttempt = (error.config.__hostFailoverAttempt || 0) + 1;
            const failingUrl = error.config.baseURL;
            const nextUrl = getApiBaseUrl();

            console.warn(`[api] FAILOVER: ${failingUrl} failed with 404/Network. Attempt ${nextAttempt} using ${nextUrl}`);

            const retryConfig = {
                ...error.config,
                __hostFailoverAttempt: nextAttempt,
                baseURL: nextUrl,
            };
            api.defaults.baseURL = nextUrl;
            return api.request(retryConfig);
        }

        if (error.response?.status === 401) {
            const token = inMemoryToken || await AsyncStorage.getItem('token');
            if (token) {
                console.warn(`Unauthorized access [${error.config?.url}] - Token invalid/expired - Clearing session`);
                inMemoryToken = null;
                await AsyncStorage.multiRemove(['token', 'user']);
            } else {
                console.log(`DEBUG [api]: 401 received for ${error.config?.url} but session already cleared.`);
            }
        }
        return Promise.reject(error);
    }
);

export const getServerUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('https') || path.startsWith('file://')) return path;
    if (path.startsWith('//')) return `https:${path}`;
    const baseUrl = getActiveBaseUrl();
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};

export default api;
