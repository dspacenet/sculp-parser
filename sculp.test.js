/* global describe it expect */
const { SculpParser } = require('./index');

describe('The SCULP Parser', () => {
  it('should properly translate "next process"', () => {
    const parser = new SculpParser('next skip');
    expect(parser.toString()).toBe('skip next skip');
  });

  it('should properly translate "notify(message)"', () => {
    const parser = new SculpParser('notify("New Message!")');
    expect(parser.toString()).toBe('enter @ "inbox" do post("New Message!")');
  });

  it('should throw syntax error when the type of the parameter is not the expected', () => {
    expect(() => new SculpParser('post(*)'))
      .toThrow(new SyntaxError('Expecting String but found Pattern.'));
  });
});
