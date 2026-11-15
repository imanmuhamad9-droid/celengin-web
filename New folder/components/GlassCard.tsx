import type { HTMLAttributes, ReactNode } from 'react';

type Tone = 'default' | 'teal' | 'danger';

// Kartu kaca. tone="danger" = kaca merah transparan (status Krisis), bukan merah solid.
// Server-component-safe: tidak memakai hooks, jadi tidak perlu "use client".
export default function GlassCard({
  tone = 'default',
  padded = true,
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone; padded?: boolean; children: ReactNode }) {
  const toneCls = tone === 'teal' ? 'glass-teal' : tone === 'danger' ? 'glass-danger' : '';
  return (
    <div className={`glass rounded-[28px] ${padded ? 'p-4' : ''} ${toneCls} ${className}`} {...rest}>
      {children}
    </div>
  );
}
