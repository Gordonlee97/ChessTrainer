import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { sounds } from '../sound';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  /**
   * Set to false to suppress the shared `buttonPress` click sound — for a
   * caller that already plays its own, more specific sound (e.g. a
   * candidate move row playing its move sound) and doesn't want the two
   * layered on top of each other. Defaults to true.
   */
  sound?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', sound = true, children, onClick, className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={className ? `btn ${className}` : 'btn'}
      data-variant={variant}
      onClick={(event) => {
        if (sound) sounds.play('buttonPress');
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
