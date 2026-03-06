'use client';

import { Lock } from 'lucide-react';
import { Button } from './Button';

interface ProGateProps {
  children: React.ReactNode;
  isAllowed: boolean;
  feature?: string;
}

export function ProGate({ children, isAllowed, feature }: ProGateProps) {
  if (isAllowed) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-bg/80 backdrop-blur-sm">
        <Lock className="mb-3 h-8 w-8 text-orange" />
        <h3 className="mb-1 text-lg font-semibold text-text">Pro Feature</h3>
        <p className="mb-4 text-sm text-dim">
          {feature ? `${feature} requires` : 'This feature requires'} a Pro subscription
        </p>
        <Button variant="primary" size="sm">
          Upgrade to Pro
        </Button>
      </div>
    </div>
  );
}
