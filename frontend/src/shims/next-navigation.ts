import {
  useNavigate,
  useLocation,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
  UNSAFE_NavigationContext,
} from 'react-router-dom';
import { useContext, useMemo } from 'react';

export function useRouter() {
  const navContext = useContext(UNSAFE_NavigationContext);
  if (!navContext || !navContext.navigator) {
    return {
      push: (href: string) => { if (typeof window !== 'undefined') window.location.href = href; },
      replace: (href: string) => { if (typeof window !== 'undefined') window.location.replace(href); },
      back: () => { if (typeof window !== 'undefined') window.history.back(); },
      forward: () => { if (typeof window !== 'undefined') window.history.forward(); },
      refresh: () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('router-refresh')); },
      prefetch: () => {},
    };
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useRouterInternal();
}

function useRouterInternal() {
  const navigate = useNavigate();
  return useMemo(() => ({
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => {
      window.dispatchEvent(new Event('router-refresh'));
    },
    prefetch: () => {},
  }), [navigate]);
}

export function usePathname(): string {
  const navContext = useContext(UNSAFE_NavigationContext);
  if (!navContext || !navContext.navigator) {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  const navContext = useContext(UNSAFE_NavigationContext);
  if (!navContext || !navContext.navigator) {
    return typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [searchParams] = useRouterSearchParams();
  return searchParams;
}

export function useParams<T extends Record<string, string | string[] | undefined> = Record<string, string>>(): T {
  const navContext = useContext(UNSAFE_NavigationContext);
  if (!navContext || !navContext.navigator) {
    return {} as T;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const params = useRouterParams();
  return params as unknown as T;
}

export function redirect(url: string): never {
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
  throw new Error(`Redirecting to ${url}`);
}
