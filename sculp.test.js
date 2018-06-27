/* global test expect */
const { SculpParser } = require('./index');

test('"next skip" translates to "skip next skip"', () => {
  const parser = new SculpParser('next skip');
  expect(parser.toString()).toBe('skip next skip');
});

test('translating "post(*) throws a SyntaxError', () => {
  expect(() => new SculpParser('post(*)'))
    .toThrow(new SyntaxError('Expecting String but found Pattern.'));
});

