import { ImgHTMLAttributes } from 'react';

export function Logo({ className = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img 
      src="/logo.png" 
      alt="DropIQ Logo"
      className={className}
      {...props}
    />
  );
}
