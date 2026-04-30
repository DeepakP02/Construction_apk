import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect, useState, Component } from 'react';
import { View, Text, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigation from './src/navigation/AppNavigation';
import { AppProvider } from './src/context/AppContext';
import SplashScreen from './src/screens/auth/SplashScreen';

class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, info) { console.error('CRITICAL APP ERROR:', error, info); }
    render() {
        if (this.state.hasError) {
            return (
                <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 18 }}>Critical App Error</Text>
                    <Text style={{ color: '#fff', marginTop: 10, textAlign: 'center' }}>{this.state.error?.toString()}</Text>
                </View>
            );
        }
        return this.props.children;
    }
}

// Suppress specific internal Expo development errors that occur during hot reloads
LogBox.ignoreLogs([
    "Error: Call to function 'ExpoKeepAwake.activate' has been rejected",
    "The current activity is no longer available"
]);

// Catch unhandled promise rejections that might be coming from internal Expo modules
if (__DEV__) {
    const originalHandler = global.ErrorUtils?.getGlobalHandler();
    if (global.ErrorUtils) {
        global.ErrorUtils.setGlobalHandler((error, isFatal) => {
            if (error?.message?.includes('ExpoKeepAwake.activate')) {
                console.log('--- SUPPRESSED INTERNAL EXPO ERROR: ExpoKeepAwake.activate rejected (Activity not ready) ---');
                return;
            }
            if (originalHandler) originalHandler(error, isFatal);
        });
    }
}

// Paper theme (minimal — just to avoid import error)
const paperTheme = {
    version: 3,
    colors: { primary: '#1D4ED8' },
};

export default function App() {
    const [splashDone, setSplashDone] = useState(false);

    console.log('--- APP RENDERING ---', { splashDone });

    useEffect(() => {
        // Ensure Android system navigation bar matches the dark tab bar (prevents white strip).
        NavigationBar.setBackgroundColorAsync('#0F172A').catch(() => {});
        NavigationBar.setButtonStyleAsync('light').catch(() => {});
    }, []);

    if (!splashDone) {
        return (
            <ErrorBoundary>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <StatusBar style="light" />
                    <SplashScreen onFinish={() => {
                        console.log('--- SPLASH FINISHED, TRANSITIONING ---');
                        setSplashDone(true);
                    }} />
                </GestureHandlerRootView>
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <AppProvider>
                        <PaperProvider theme={paperTheme}>
                            <StatusBar style="light" />
                            <AppNavigation />
                        </PaperProvider>
                    </AppProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}
