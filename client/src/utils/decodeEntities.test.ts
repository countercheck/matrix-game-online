import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities } from './decodeEntities';

describe('decodeHtmlEntities', () => {
  it('should decode &quot; to double quotes', () => {
    expect(decodeHtmlEntities('The &quot;best&quot; plan')).toBe('The "best" plan');
  });

  it('should decode &amp; to ampersand', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });

  it('should decode &lt; and &gt; to angle brackets', () => {
    expect(decodeHtmlEntities('value &lt; 10 &gt; 5')).toBe('value < 10 > 5');
  });

  it('should decode &#x27; to apostrophe', () => {
    expect(decodeHtmlEntities('It&#x27;s fine')).toBe("It's fine");
  });

  it('should decode multiple mixed entities', () => {
    expect(decodeHtmlEntities('She said &quot;it&#x27;s &lt;fine&gt;&quot; &amp; left')).toBe(
      `She said "it's <fine>" & left`
    );
  });

  it('should return unchanged text without entities', () => {
    expect(decodeHtmlEntities('Plain text')).toBe('Plain text');
  });

  it('should handle empty string', () => {
    expect(decodeHtmlEntities('')).toBe('');
  });

  it('should decode &amp; before other entities to avoid double-decoding', () => {
    // &amp;quot; should become &quot; not "
    expect(decodeHtmlEntities('&amp;quot;')).toBe('&quot;');
  });
});
