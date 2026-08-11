import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Rendering <App /> in the last test pulls in Board, which plays the shared
// buttonPress/move sounds; without this mock jsdom logs real
// HTMLMediaElement "not implemented" errors from howler, which the project's
// "test output must be pristine" rule treats as a failure. Same pattern as
// LessonPicker.test.tsx and SavedLines.test.tsx.
const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { App } from '../App';
import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { ProgressNotice } from './ProgressNotice';

describe('ProgressNotice', () => {
  it('renders nothing when there is nothing to say', () => {
    act(() => useProgressStore.getState().dismissNotice());
    const { container } = render(<ProgressNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('can be dismissed', async () => {
    const user = userEvent.setup();
    act(() => useProgressStore.setState({ recovered: true }));
    render(<ProgressNotice />);
    expect(screen.getByRole('status')).toHaveTextContent(
      /saved progress could not be read/i,
    );
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  // Moved from LessonPicker.test.tsx: that component no longer renders the
  // notice at all, so these assertions belong here now.
  it('tells the player when stored progress could not be read', () => {
    act(() => useProgressStore.setState({ recovered: true }));
    render(<ProgressNotice />);
    expect(screen.getByRole('status')).toHaveTextContent(/could not be read|starting fresh/i);
    act(() => useProgressStore.getState().dismissNotice());
  });

  it('tells the player when progress cannot be saved', () => {
    act(() => useProgressStore.setState({ saveFailed: true }));
    render(<ProgressNotice />);
    expect(screen.getByRole('status')).toHaveTextContent(/not being saved/i);
    act(() => useProgressStore.getState().dismissNotice());
  });

  // The reason this component exists. Both former render sites are in the
  // left rail, which Task 2 replaces with the lesson rail — so before this
  // change, starting a lesson made the notice vanish undismissable.
  //
  // Rendering the whole App pulls in Board's own aria-live "status" region
  // (Task 4's move-announcement element), so a plain getByRole('status')
  // would throw on finding two matches. Scoped with getAllByRole plus a
  // text-content filter instead of a data-testid, to keep asserting on the
  // same accessible role a screen reader would key off, rather than an
  // attribute invisible to one.
  it('stays visible in the header once a lesson starts', () => {
    act(() => useProgressStore.setState({ recovered: true }));
    render(<App />);

    function notice() {
      const matches = screen
        .getAllByRole('status')
        .filter((el) => /saved progress could not be read/i.test(el.textContent ?? ''));
      expect(matches).toHaveLength(1);
      return matches[0];
    }

    expect(notice()).toHaveTextContent(/saved progress could not be read/i);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    expect(notice()).toHaveTextContent(/saved progress could not be read/i);
  });
});
