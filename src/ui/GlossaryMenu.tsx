import { useEffect, useId, useRef, useState } from 'react';
import { GLOSSARY, GLOSSARY_TIERS } from '../content/glossary';
import { Button } from './Button';

/**
 * The player-facing glossary, as a scrollable header disclosure.
 *
 * Terms run simple to complex down the panel rather than alphabetically: a
 * beginner opening this wants "what is a rank" near the top, and someone
 * hunting "zugzwang" already knows enough to scroll. Alphabetical order would
 * serve the second reader at the first one's expense.
 *
 * The keyboard contract is `LessonMenu`'s exactly — Escape closes and returns
 * focus to the trigger, an outside click closes without moving focus, and
 * there is no `aria-modal` because Tab is not trapped. Three disclosures now
 * share that contract; it is written once per component rather than abstracted
 * because the effect is nine lines and a shared hook would have to take the
 * refs, the open flag and the setter anyway.
 */
export function GlossaryMenu() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <div className="glossary-menu">
      <Button
        ref={buttonRef}
        variant="ghost"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Glossary
      </Button>

      {open && (
        <div id={panelId} ref={panelRef} className="glossary-panel">
          {GLOSSARY_TIERS.map((tier) => {
            const entries = GLOSSARY.filter((entry) => entry.tier === tier.id);
            if (entries.length === 0) return null;
            return (
              <section key={tier.id} aria-label={tier.heading}>
                <h3 className="glossary-heading">{tier.heading}</h3>
                <p className="glossary-blurb">{tier.blurb}</p>
                {/* A description list, because that is what this is: the
                    pairing is the content, and a screen reader announces the
                    term with its definition rather than as two loose lines. */}
                <dl className="glossary-list">
                  {entries.map((entry) => (
                    <div key={entry.term} className="glossary-item">
                      <dt className="glossary-term">{entry.term}</dt>
                      <dd className="glossary-definition">{entry.definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
