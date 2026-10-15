/**
 * @jest-environment jsdom
 */
import { startKeyboardCapture, stopKeyboardCapture } from '../src/capture/keyboard';
import type { RawSignal } from '../src/types';

const fire = (el: Element, type: string, key = 'a', code = 'KeyA') =>
  el.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true }));

describe('keyboard collector privacy', () => {
  let sent: RawSignal[];
  beforeEach(() => { sent = []; startKeyboardCapture(s => sent.push(s)); });
  afterEach(() => { stopKeyboardCapture(); document.body.innerHTML = ''; });

  it('never emits key or code', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    fire(input, 'keydown');
    fire(input, 'keyup');
    expect(sent.length).toBe(2);
    expect(JSON.stringify(sent)).not.toMatch(/"key"|"code"|KeyA/);
  });

  it('skips password, email, tel and ignored fields', () => {
    const els: HTMLInputElement[] = ['password', 'email', 'tel'].map(t => {
      const el = document.createElement('input'); el.type = t; return el;
    });
    const ignored = document.createElement('input');
    ignored.setAttribute('data-certilayer-ignore', '');
    [...els, ignored].forEach(el => {
      document.body.appendChild(el);
      fire(el, 'keydown'); fire(el, 'keyup');
    });
    expect(sent.length).toBe(0);
  });

  it('flags backspace as boolean only', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    fire(input, 'keydown', 'Backspace', 'Backspace');
    expect((sent[0].data as any).backspace).toBe(true);
  });
});
