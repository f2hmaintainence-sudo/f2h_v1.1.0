import { parseDurationToSeconds } from './auth.service';

/**
 * Token lifetimes and the Redis session TTL are derived from the same strings, so a
 * parsing mistake would silently reintroduce the century-long sessions of F-07.
 */
describe('parseDurationToSeconds', () => {
  it.each([
    ['15m', 900],
    ['30d', 2_592_000],
    ['1h', 3600],
    ['45s', 45],
    ['2w', 1_209_600],
    ['3600', 3600],
  ])('parses %s as %i seconds', (input, expected) => {
    expect(parseDurationToSeconds(input)).toBe(expected);
  });

  it.each(['', '15 minutes', '100y', 'abc', '-5m'])(
    'rejects the unsupported duration %p rather than guessing',
    (input) => {
      expect(() => parseDurationToSeconds(input)).toThrow(/Unsupported token duration/);
    },
  );
});
