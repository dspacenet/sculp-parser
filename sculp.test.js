/* global describe it expect */
const { SculpParser, Expressions } = require('./index');

function patchPosts(procedure) {
  if (procedure.name === 'post') {
    procedure.params.list[0].value = `patched ${procedure.params.list[0].value}`;
  }
}

function translatePaths(expression) {
  if (expression instanceof Expressions.SpacePath) {
    return new Expressions.Number(6);
  }
  return expression;
}

const validSignatures = {
  notify: [Expressions.String],
  signal: [Expressions.String],
  post: [Expressions.String],
  rm: [Expressions.Pattern, Expressions.Pattern, Expressions.Pattern],
  abort: [],
};

describe('The SCULP Parser', () => {
  const parser = new SculpParser(validSignatures);

  it('should properly parse parallel expressions ', () => {
    const result = parser.parse('skip || skip || skip');
    expect(result.toString()).toBe('(skip || skip || skip)');
  });

  it('should properly parse "next process"', () => {
    const result = parser.parse('next skip');
    expect(result.toString()).toBe('next skip');
  });

  it('should properly parse "notify(message)"', () => {
    const result = parser.parse('notify("New Message!")');
    expect(result.toString()).toBe('notify("New Message!")');
  });

  it('should properly parse "abort"', () => {
    const result = parser.parse('abort');
    expect(result.toString()).toBe('abort');
  });

  it('should properly parse "enter @ space do process"', () => {
    const result = parser.parse('enter @ "clock" do signal("tick")');
    expect(result.toString()).toBe('enter @ "clock" do signal("tick")');
  });

  it('should properly parse "exit @ space do process"', () => {
    const result = parser.parse('exit @ "clock" do skip');
    expect(result.toString()).toBe('exit @ "clock" do skip');
  });

  it('should properly parse "do process until constraint"', () => {
    const result = parser.parse('do post("Bla Bla Bla") until *."stop!".*');
    expect(result.toString()).toBe('do post("Bla Bla Bla") until * . "stop!" . *');
  });

  it('should properly parse "if condition then process"', () => {
    const result = parser.parse('if * then post("pass")');
    expect(result.toString()).toBe('if * then post("pass")');
  });

  it('should properly parse "unless condition next process"', () => {
    const result = parser.parse('unless * next post("next")');
    expect(result.toString()).toBe('unless * next post("next")');
  });

  it('should properly parse "while condition do process"', () => {
    const result = parser.parse('while * do post("is running")');
    expect(result.toString()).toBe('while * do post("is running")');
  });

  it('should properly parse "def name as process"', () => {
    const result = parser.parse('def "clear" as rm(*,*,*)');
    expect(result.toString()).toBe('def "clear" as rm(*, *, *)');
  });

  it('should properly parse message constraints', () => {
    const result = parser.parse('when {usr:"frank", body:*."?"} do post("Hi Frank! I will answer your question asap.")');
    expect(result.toString()).toBe('when { usr: "frank", body: * . "?" } do post("Hi Frank! I will answer your question asap.")');
  });

  it('should replace a placeholder with its corresponding insert', () => {
    const result = parser.parse('post($message)', { message: new Expressions.String('Hello World!') });
    expect(result.toString()).toBe('post("Hello World!")');
  });

  it('should throw type error when the type of the parameter is not the expected', () => {
    expect(() => parser.parse('post(*)'))
      .toThrow(new TypeError('Parameter at position 0 of post must be of type String instead of Pattern.'));
  });

  it('should throw reference error when a placeholder is set without its corresponding insert', () => {
    expect(() => parser.parse('post($message)', { text: new Expressions.String('Hi!') }))
      .toThrow(new ReferenceError('Insert for placeholder \'message\' not found.'));
  });

  it('should throw syntax error when a token is not recognized', () => {
    expect(() => parser.parse('test'))
      .toThrow(new SyntaxError('Unknown token \'test\'.'));
  });

  describe('when the translation is done', () => {
    it('should be able to traverse simple expressions', () => {
      const result = parser.parse('post("message")');
      result.applyTo(Expressions.Procedure, patchPosts);
      expect(result.toString()).toBe('post("patched message")');
    });

    it('should be able to traverse complex expressions', () => {
      const result = parser.parse('post("message") || signal("un-patched") || post("another message")');
      result.applyTo(Expressions.Procedure, patchPosts);
      expect(result.toString()).toBe('(post("patched message") || signal("un-patched") || post("patched another message"))');
    });

    it('should be able to patch simple expressions', () => {
      const result = parser.parse('enter @ "clock" do post("tick")');
      result.patch(translatePaths);
      expect(result.toString()).toBe('enter 6 do post("tick")');
    });

    it('should be able to patch complex expressions', () => {
      const result = parser.parse('enter @ "clock" do when "tick" do exit @ "clock" do post("tack")');
      result.patch(translatePaths);
      expect(result.toString()).toBe('enter 6 do when "tick" do exit 6 do post("tack")');
    });
  });
});
