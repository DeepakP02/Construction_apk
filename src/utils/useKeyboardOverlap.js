import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

const getWindowHeight = () => Dimensions.get('window').height;

export const useKeyboardOverlap = (bottomSafeArea = 0) => {
    const [overlap, setOverlap] = useState(0);
    const keyboardFrameRef = useRef(null);

    const updateOverlap = useCallback((endCoordinates) => {
        keyboardFrameRef.current = endCoordinates || null;

        if (!endCoordinates) {
            setOverlap(0);
            return;
        }

        const windowHeight = getWindowHeight();
        const keyboardTop = endCoordinates.screenY ?? windowHeight;
        const nextOverlap = Math.max(0, windowHeight - keyboardTop - bottomSafeArea);

        setOverlap(nextOverlap);
    }, [bottomSafeArea]);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, (event) => {
            updateOverlap(event.endCoordinates);
        });
        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            updateOverlap(null);
        });
        const dimensionSubscription = Dimensions.addEventListener('change', () => {
            updateOverlap(keyboardFrameRef.current);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
            dimensionSubscription.remove();
        };
    }, [updateOverlap]);

    return overlap;
};
