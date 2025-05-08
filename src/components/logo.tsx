import { ShieldCheck } from 'lucide-react';
import type { SVGProps } from 'react';
import { cn } from "@/lib/utils"; // Added import

interface LogoProps extends SVGProps<SVGSVGElement> {
  iconColor?: string;
  textColor?: string;
  size?: 'default' | 'large'; // Add size prop
}

export function Logo({ className, iconColor = "hsl(var(--accent))", textColor = "hsl(var(--foreground))", size = 'default', ...props }: LogoProps) {
  const iconSizeClass = size === 'large' ? "h-10 w-10" : "h-8 w-8";
  const textSizeClass = size === 'large' ? "text-3xl" : "text-2xl";
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ShieldCheck className={cn(iconSizeClass)} style={{ color: iconColor }} />
      <span className={cn("font-bold", textSizeClass)} style={{ color: textColor }}>
        ExamGuard
      </span>
    </div>
  );
}
