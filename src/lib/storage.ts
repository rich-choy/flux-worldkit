import { useState, useMemo, useRef, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';

/**
 * @description
 * useStorage is a hook that returns a value from local or session storage.
 * @param key The storage key
 * @param initialValue The initial value to use.
 * @param type The type of storage to use.
 * @returns [T, Dispatch<SetStateAction<T>>]
 */
const useStorage = <T = any>(key: string, initialValue: T, type: 'local' | 'session'): [T, Dispatch<SetStateAction<T>>] => {
  const storageRef = useRef(type === 'local' ? window.localStorage : window.sessionStorage);
  const isStorageAvailable = typeof window !== 'undefined';

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (!isStorageAvailable) {
      return initialValue;
    }
    const json: string | null = storageRef.current.getItem(key);
    if (json) {
      try {
        return JSON.parse(json);
      } catch (e) {
        // parse error; ignore it
      }
    }
    return initialValue;
  });

  useEffect(() => {
    if (!isStorageAvailable) {
      return;
    }
    const onStorageEvent = (event: StorageEvent) => {
      if (event.storageArea === storageRef.current && event.key === key) {
        const nextValue = event.newValue ? JSON.parse(event.newValue) : null;
        setStoredValue(nextValue);
      }
    };
    window.addEventListener('storage', onStorageEvent);
    return () => {
      window.removeEventListener('storage', onStorageEvent);
    };
  }, [isStorageAvailable, key]);

  const setValue: Dispatch<SetStateAction<T>> = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (isStorageAvailable) {
        const serializedValue = JSON.stringify(valueToStore);
        storageRef.current.setItem(key, serializedValue);
      }
    } catch (error) {
      throw new Error("PrimeReact useStorage: Failed to serialize the value at key: ".concat(key));
    }
  }, [isStorageAvailable, key, storedValue]);

  return useMemo(() => [storedValue, setValue], [storedValue, setValue]);
};


export const useLocalStorage = <T>(key: string, initialValue: T) => {
  return useStorage<T>(key, initialValue, 'local');
};

export const useSessionStorage = <T>(key: string, initialValue: T) => {
  return useStorage<T>(key, initialValue, 'session');
};
