// src/hooks/useDebounce.ts
import {useState, useEffect} from 'react'

/**
 * @name useDebounce
 * @description A custom hook that debounces a value. It will only update the returned value
 * after the input value has not changed for a specified delay. This is critical for performance
 * when dealing with expensive operations tied to user input, like API calls or heavy computations.
 *
 * @param {T} value The value to debounce (e.g., a search query or editor text).
 * @param {number} delay The debounce delay in milliseconds (e.g., 500).
 * @returns {T} The debounced value, which updates only after the delay has passed.
 */
export function useDebounce<T>(value: T, delay: number): T {
    // State to store the debounced value.
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(
        () => {
            // Set up a timer. When it fires, update the debounced value to the latest input value.
            const handler = setTimeout(() => {
                setDebouncedValue(value)
            }, delay)

            // This is the cleanup function that runs before the effect runs again.
            // If the `value` changes, the previous timer is cleared, and a new one is started.
            // This prevents the debounced value from updating while the user is still typing.
            return () => {
                clearTimeout(handler)
            }
        },
        [value, delay], // The effect will re-run only if the input value or the delay changes.
    )

    return debouncedValue
}