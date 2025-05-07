import { ShieldCheck } from 'lucide-react';
import type { SVGProps } from 'react';

interface LogoProps extends SVGProps<SVGSVGElement> {
  iconColor?: string;
  textColor?: string;
}

export function Logo({ className, iconColor = "hsl(var(--accent))", textColor = "hsl(var(--foreground))", ...props }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <ShieldCheck className="h-8 w-8" style={{ color: iconColor }} />
      <span className="text-2xl font-bold" style={{ color: textColor }}>
        ExamGuard
      </span>
    </div>
  );
}
