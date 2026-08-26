import { useEffect } from 'react';
import { useRouter } from 'next/router';

const TOKEN_KEY = 'signvault_token';

export const getToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

export const setToken = (token: string) => {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = () => {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
};

/** Redirects to /login if there's no session token. Call at the top of any protected page. */
export const useRequireAuth = () => {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
