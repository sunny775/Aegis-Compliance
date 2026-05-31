import { describe, it, expect } from 'vitest';
import { parseTableOfContents } from '../src/ingestion/tableOfContents';
import type { ParsedPage } from '../src/providers/DocumentParser';

describe('parseTableOfContents', () => {
  it('parses the RS13-style "section … page" contents into a clause→page map', () => {
    const pages: ParsedPage[] = [
      {
        page: 2,
        text: [
          'Contents',
          '1.0 PURPOSE 4',
          '2.0 SCOPE 4',
          '3.1 General 4',
          '4.5 Maintenance and Upkeep of Tyres, Wheels and Rims 23',
          '4.10 Systems Review 35',
        ].join('\n'),
      },
    ];

    const map = parseTableOfContents(pages);
    expect(map.get('1.0')).toBe(4);
    expect(map.get('3.1')).toBe(4);
    expect(map.get('4.5')).toBe(23);
    expect(map.get('4.10')).toBe(35);
  });

  it('parses RS17-style dotted-leader contents', () => {
    const pages: ParsedPage[] = [
      {
        page: 4,
        text: [
          'Table of Contents',
          '1.1 What are the obligations in relation to labelling hazardous chemicals? .......... 11',
          '1.2 When must a hazardous chemical be classified? ............ 12',
          '1.3.1 Mineral or Quarry product .................................. 13',
        ].join('\n'),
      },
    ];

    const map = parseTableOfContents(pages);
    expect(map.get('1.1')).toBe(11);
    expect(map.get('1.2')).toBe(12);
    expect(map.get('1.3.1')).toBe(13);
  });

  it('returns an empty map for prose with no table of contents', () => {
    const pages: ParsedPage[] = [
      { page: 1, text: 'This procedure manages tyres, wheels and rims at the mine site.' },
    ];
    expect(parseTableOfContents(pages).size).toBe(0);
  });
});
