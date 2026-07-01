import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrandColorTokens } from '../src/lib/theme.js';

test('buildBrandColorTokens generates primary variants from a base brand color', () => {
  const tokens = buildBrandColorTokens('#2563eb');

  assert.equal(tokens['--color-primary'], '#2563eb');
  assert.equal(tokens['--color-primary-hover'], '#1d4ed8');
  assert.equal(tokens['--color-primary-light'], '#5b8ef4');
  assert.equal(tokens['--color-primary-dark'], '#0f2f74');
  assert.equal(tokens['--color-accent'], '#5f7dff');
  assert.equal(tokens['--color-focus-ring'], 'rgba(37, 99, 235, 0.28)');
});
