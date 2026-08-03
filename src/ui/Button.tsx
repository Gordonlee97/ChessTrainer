import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { sounds } from '../sound';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

export function Button({ variant = 'primary', children, onClick, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className="btn"
      data-variant={variant}
      onClick={(event) => {
        sounds.play('buttonPress');
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
