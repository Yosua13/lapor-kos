import React, { forwardRef, useContext } from 'react';
import { Link as RouterLink, UNSAFE_NavigationContext, type LinkProps as RouterLinkProps } from 'react-router-dom';

export interface NextLinkProps extends Omit<RouterLinkProps, 'to' | 'prefetch'> {
  href: string;
  children?: React.ReactNode;
  prefetch?: boolean | 'none' | 'intent' | 'render' | 'viewport';
}

export const Link = forwardRef<HTMLAnchorElement, NextLinkProps>(({ href, children, prefetch: _prefetch, ...props }, ref) => {
  const navContext = useContext(UNSAFE_NavigationContext);

  // If outside a React Router provider (e.g. in standalone unit tests), fallback to standard <a>
  if (!navContext || !navContext.navigator) {
    return (
      <a ref={ref} href={href} {...props}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink ref={ref} to={href} {...props}>
      {children}
    </RouterLink>
  );
});

Link.displayName = 'NextLinkCompat';

export default Link;
