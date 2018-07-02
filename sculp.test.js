/* global describe it expect */
const { SculpParser, Expressions } = require('./index');

function patchPosts(procedure) {
  if (procedure.name === 'post') {
    procedure.params[0].value = `patched ${procedure.params[0].value}`;
  }
}

function translatePaths(expression) {
  if (expression instanceof Expressions.SpacePath) {
    return new Expressions.Number(6);
  }
  return expression;
}

describe('The SCULP Parser', () => {
  it('should properly parse parallel expressions ', () => {
    const parser = new SculpParser('skip || skip || skip');
    expect(parser.toString()).toBe('(skip || skip || skip)');
  });

  it('should properly parse "next process"', () => {
    const parser = new SculpParser('next skip');
    expect(parser.toString()).toBe('skip next skip');
  });

  it('should properly parse "enter @ space do process"', () => {
    const parser = new SculpParser('enter @ "clock" do signal("tick")');
    expect(parser.toString()).toBe('enter @ "clock" do signal("tick")');
  });

  it('should properly parse "exit @ space do process"', () => {
    const parser = new SculpParser('exit @ "clock" do skip');
    expect(parser.toString()).toBe('exit @ "clock" do skip');
  });

  it('should properly parse "notify(message)"', () => {
    const parser = new SculpParser('notify("New Message!")');
    expect(parser.toString()).toBe('notify("New Message!")');
  });

  it('should properly parse "do process until constraint"', () => {
    const parser = new SculpParser('do post("Bla Bla Bla") until *."stop!".*');
    expect(parser.toString()).toBe('do post("Bla Bla Bla") until * . "stop!" . *');
  });

  it('should properly parse message constraints', () => {
    const parser = new SculpParser('when msg:"frank":*."?" do post("Hi Frank! I will answer your question asap.")');
    expect(parser.toString()).toBe('when msg:"frank":* . "?" do post("Hi Frank! I will answer your question asap.")');
  });

  it('should properly parse message-content constraint', () => {
    const parser = new SculpParser('when msg-content:"Hello" do post("Hi!")');
    expect(parser.toString()).toBe('when msg-content:"Hello" do post("Hi!")');
  });

  it('should properly parse message-user constraint', () => {
    const parser = new SculpParser('when msg-user:"frank" do rm(*,"frank",*)');
    expect(parser.toString()).toBe('when msg-user:"frank" do rm(*, "frank", *)');
  });

  it('should replace a placeholder with its corresponding insert', () => {
    const parser = new SculpParser('post($message)', { message: new Expressions.String('Hello World!') });
    expect(parser.toString()).toBe('post("Hello World!")');
  });

  it('should throw syntax error when the type of the parameter is not the expected', () => {
    expect(() => new SculpParser('post(*)'))
      .toThrow(new SyntaxError('Expecting String but found Pattern.'));
  });

  it('should throw reference error when a placeholder is set without its corresponding insert', () => {
    expect(() => new SculpParser('post($message)', { text: new Expressions.String('Hi!') }))
      .toThrow(new ReferenceError('Insert for placeholder \'message\' not found.'));
  });

  describe('when the translation is done', () => {
    it('should be able to traverse simple expressions', () => {
      const parser = new SculpParser('post("message")');
      parser.applyTo(Expressions.Procedure, patchPosts);
      expect(parser.toString()).toBe('post("patched message")');
    });

    it('should be able to traverse complex expressions', () => {
      const parser = new SculpParser('post("message") || signal("un-patched") || post("another message")');
      parser.applyTo(Expressions.Procedure, patchPosts);
      expect(parser.toString()).toBe('(post("patched message") || signal("un-patched") || post("patched another message"))');
    });

    it('should be able to patch simple expressions', () => {
      const parser = new SculpParser('enter @ "clock" do post("tick")');
      parser.patch(translatePaths);
      expect(parser.toString()).toBe('enter 6 do post("tick")');
    });

    it('should be able to patch complex expressions', () => {
      const parser = new SculpParser('enter @ "clock" do when "tick" do exit @ "clock" do post("tack")');
      parser.patch(translatePaths);
      expect(parser.toString()).toBe('enter 6 do when "tick" do exit 6 do post("tack")');
    });
  });
});
