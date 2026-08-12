import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
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

// forwardRef so a caller can manage focus on the underlying <button> — e.g.
// LessonMenu returning focus to its trigger when the panel closes. Every
// other prop and behaviour is unchanged.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', sound = true, children, onClick, className, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
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
});
