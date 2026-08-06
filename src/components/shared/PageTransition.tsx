import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  pageKey: string;
}

export default function PageTransition({ children, pageKey }: PageTransitionProps) {
  return (
    <div key={pageKey} className="page-enter min-h-screen">
      {children}
    </div>
  );
}
