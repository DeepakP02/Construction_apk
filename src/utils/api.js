import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- BACKEND SWITCH TOGGLE ---
// Priority:
// 1) EXPO_PUBLIC_API_URL (if provided)
// 2) Known production host candidates (auto-failover)
const BASE_URL_CANDIDATES = [
    process.env.EXPO_PUBLIC_API_URL,
    // Prefer local backend endpoints during development/testing
    // 'http://192.168.1.45:5000',  // Current Physical phone local Wi-Fi IP
    // 'http://192.168.1.23:5000',  // Previous Physical phone local Wi-Fi IP
    // 'http://10.0.2.2:5000',      // Android Emulator loopback
    // 'http://localhost:5000',     // iOS Simulator/Fallback
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
        // Default new requests to the active candidate, but preserve baseURL for failover retries.
        if (config.__hostFailoverAttempt === undefined) {
            config.baseURL = getApiBaseUrl();
        }

        const isMultipart =
            config.data &&
            (
                config.data instanceof FormData ||
                Object.prototype.toString.call(config.data) === '[object FormData]' ||
                config.data?.constructor?.name === 'FormData'
            );

        if (isMultipart) {
            if (config.headers?.['Content-Type']) {
                delete config.headers['Content-Type'];
            }
            if (config.headers?.common?.['Content-Type']) {
                delete config.headers.common['Content-Type'];
            }
        }

        // use memory token if available (faster), else fallback to AsyncStorage
        let token = inMemoryToken;
        if (!token) {
            token = await AsyncStorage.getItem('token');
            if (token) {
                inMemoryToken = token; // Sync back to memory
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
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => {
        // If this request succeeded via failover, update the global currentBaseIndex
        if (response.config && response.config.__hostFailoverAttempt !== undefined) {
            currentBaseIndex = response.config.__hostFailoverAttempt;
        }
        return response;
    },
    async (error) => {
        const canRetry = !!error.config && (error.config.__hostFailoverAttempt || 0) < (BASE_URL_CANDIDATES.length - 1);
        const shouldRetryOnNextHost =
            canRetry && (!error.response || isRailwayAppNotFound(error));

        // Automatic host failover for network failures and Railway "Application not found" responses.
        if (shouldRetryOnNextHost) {
            const nextAttempt = (error.config.__hostFailoverAttempt || 0) + 1;
            const failingUrl = error.config.baseURL;
            const nextUrl = `${BASE_URL_CANDIDATES[nextAttempt]}/api`;

            console.warn(`[api] FAILOVER: ${failingUrl} failed. Attempt ${nextAttempt} using ${nextUrl}. Error: ${error.message}`);

            const retryConfig = {
                ...error.config,
                __hostFailoverAttempt: nextAttempt,
                baseURL: nextUrl,
            };
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

// Add native fetch wrapper for multipart uploads due to Axios FormData handling issues on React Native
export const uploadMultipart = async (endpoint, formData, options = {}) => {
    let token = inMemoryToken;
    if (!token) {
        token = await AsyncStorage.getItem('token');
        if (token) {
            inMemoryToken = token;
        }
    }

    const headers = new Headers({
        Accept: 'application/json, text/plain, */*',
    });

    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
    }

    // Attempt to upload trying each base URL until one succeeds
    for (let i = currentBaseIndex; i < BASE_URL_CANDIDATES.length; i++) {
        const baseUrl = `${BASE_URL_CANDIDATES[i]}/api`;
        const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

        try {
            console.log(`[uploadMultipart] Attempting upload to: ${url}`);
            const response = await fetch(url, {
                method: options.method || 'POST',
                headers,
                body: formData,
                signal: controller.signal,
                // Do NOT set Content-Type header manually when sending FormData via fetch
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                // Return json response, simulating axios
                const data = await response.json();
                // Update current base index if this succeeded
                currentBaseIndex = i;
                return { data, status: response.status };
            } else if (response.status === 404) {
                console.warn(`[uploadMultipart] 404 at ${url}, might retry...`);
            } else {
                let errorData;
                try {
                    errorData = await response.json();
                } catch {
                    errorData = await response.text();
                }
                const errorObj = new Error(errorData.message || `Upload failed with status ${response.status}`);
                errorObj.response = { status: response.status, data: errorData };
                throw errorObj;
            }
        } catch (error) {
            clearTimeout(timeoutId);
            const isAbort = error.name === 'AbortError';
            console.warn(`[uploadMultipart] Request to ${url} failed: ${isAbort ? 'Timeout' : error.message}`);
            // If it's the last candidate or a 4xx error (except 404), throw
            if (i === BASE_URL_CANDIDATES.length - 1 || (error.response && error.response.status >= 400 && error.response.status !== 404)) {
                throw error;
            }
        }
    }
    throw new Error('Upload failed across all available endpoints');
};

export default api;
