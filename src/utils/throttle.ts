/**
 * Harmonia Vision - Throttle Utility
 *
 * Simple throttle implementation for debouncing preview updates.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (this: unknown, ...args: Parameters<T>): void {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;

        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        if (timeSinceLastCall >= delay) {
            lastCall = now;
            fn.apply(this, args);
        } else {
            // Schedule a call for when the delay expires
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                fn.apply(this, args);
                timeoutId = null;
            }, delay - timeSinceLastCall);
        }
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (this: unknown, ...args: Parameters<T>): void {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    };
}
