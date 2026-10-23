import type { Health } from '../backend';

const COLOR: Record<Health['state'], string> = {
  checking: 'var(--amber)',
  ok: 'var(--green)',
  error: 'var(--danger)',
};

export default function StatusDot({ state, size = 8 }: { state: Health['state']; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: COLOR[state] }}
    />
  );
}
