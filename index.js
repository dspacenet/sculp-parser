/**
 * Abstract class for tokens
 */
class Token {
  /**
   * @param {Number} leftBindingPower left binding power
   * @param {String} symbol string representation of the token
   * @param {SculpParser} parser SculpParser instance to be used for expression parsing
   */
  constructor(leftBindingPower, symbol, parser) {
    this.leftBindingPower = leftBindingPower;
    this.parser = parser;
    this.symbol = symbol;
  }
  led() {
    throw SyntaxError(`Unexpected token ${this.symbol}.`);
  }
  nud() {
    throw SyntaxError(`Unexpected token ${this.symbol}.`);
  }
}

class Expression {
  /**
   * Calls function [fn] with the current expression and [context] as parameter,
   * then traverse is called recursively over the children expressions, using
   * [fn] and the context returned from previous [fn] call as parameter,
   *
   * If [fn] return false, the propagation is stopped.
   * @param {function(Expression, Object): Object} fn
   * @param {Object} context
   */
  traverse(fn, context) {
    const newContext = fn(this, Object.assign({}, context));
    if (newContext !== false) {
      Object.getOwnPropertyNames(this).forEach((child) => {
        if (this[child] instanceof Expression) {
          this[child].traverse(fn, newContext);
        } else if (this[child] instanceof Array) {
          this.traverse.call(this[child], fn, newContext);
        }
      });
    }
  }
  patch(fn) {
    const expression = fn(this);
    Object.getOwnPropertyNames(expression).forEach((child) => {
      if (expression[child] instanceof Expression) {
        expression[child] = expression[child].patch(fn);
      } else if (expression[child] instanceof Array) {
        expression.patch.call(expression[child], fn);
      }
    });
    return expression;
  }
}

const Expressions = {};
Expressions.Statement = class Statement extends Expression {};
Expressions.Instruction = class Instruction extends Expressions.Statement {};
Expressions.Pattern = class Pattern extends Expression {
  constructor(value) {
    super();
    this.value = value;
  }
  toString() {
    return this.value;
  }
};
Expressions.String = class String extends Expressions.Pattern {
  toString() {
    return `"${this.value}"`;
  }
};
Expressions.Enter = class Enter extends Expressions.Instruction {
  constructor(spaceId, statement) {
    super();
    this.spaceId = spaceId;
    this.statement = statement;
  }
  toString() {
    return `enter @ ${this.spaceId} do ${this.statement}`;
  }
};
Expressions.Exit = class Exit extends Expressions.Instruction {
  constructor(spaceId, statement) {
    super();
    this.spaceId = spaceId;
    this.statement = statement;
  }
  toString() {
    return `exit @ ${this.spaceId} do ${this.statement}`;
  }
};
Expressions.ParallelExecution = class ParallelExecution extends Expressions.Statement {
  constructor(left, right) {
    super();
    this.statements = left instanceof Expressions.ParallelExecution ? left.statements : [left];
    this.statements.push(right);
  }
  toString() {
    return `(${this.statements.reduce((res, x, i) => (i ? `${res} || ${x}` : x))})`;
  }
};
Expressions.Procedure = class Procedure extends Expressions.Statement {
  constructor(name, params) {
    super();
    this.name = name;
    this.params = params || [];
  }
  pushParam(param) {
    if (typeof param === 'string') {
      this.params.push(new Expressions.String(param));
    } else if (param instanceof Expression) {
      this.params.push(param);
    } else {
      throw new TypeError(`param type ${param.constructor.className} is not String or Expression`);
    }
  }
  toString() {
    return this.params.length ? `${this.name}(${this.params.reduce((res, x, i) => (i ? `${res}, ${x}` : x))})` : this.name;
  }
};
Expressions.Notify = class Notify extends Expressions.Procedure {
  constructor(message) {
    super('notify', [message]);
  }
  toString() {
    return `enter @ "inbox" do post(${this.params[0]})`;
  }
};
Expressions.Repeat = class Repeat extends Expressions.Instruction {
  constructor(statement) {
    super();
    this.statement = statement;
  }
  toString() {
    return `repeat ${this.statement}`;
  }
};
Expressions.SequentialExecution = class SequentialExecution extends Expressions.Statement {
  constructor(left, right) {
    super();
    this.statements = left instanceof Expressions.SequentialExecution ? left.statements : [left];
    this.statements.push(right);
  }
  toString() {
    return `${this.statements.reduce((res, x, i) => (i ? `${res} next ${x}` : x))}`;
  }
};
Expressions.When = class When extends Expressions.Instruction {
  constructor(condition, statement) {
    super();
    this.condition = condition;
    this.statement = statement;
  }
  toString() {
    return `when ${this.condition} do ${this.statement}`;
  }
};
Expressions.Whenever = class Whenever extends Expressions.Instruction {
  constructor(condition, statement) {
    super();
    this.condition = condition;
    this.statement = statement;
  }
  toString() {
    return `whenever ${this.condition} do ${this.statement}`;
  }
};
Expressions.Until = class Until extends Expressions.Instruction {
  constructor(condition, statement) {
    super();
    this.condition = condition;
    this.statement = statement;
  }
  toString() {
    return `until ${this.condition} do ${this.statement}`;
  }
};
Expressions.Unless = class Unless extends Expressions.Instruction {
  constructor(condition, statement) {
    super();
    this.condition = condition;
    this.statement = statement;
  }
  toString() {
    return `unless ${this.condition} do ${this.statement}`;
  }
};
Expressions.Skip = class Skip extends Expressions.Instruction {
  toString() { // eslint-disable-line class-methods-use-this
    return 'skip';
  }
};

const Tokens = {
  End: class End extends Token {
    constructor() {
      super(-1, 'EOF', null);
    }
  },
  Instructions: {
    Do: class Do extends Token {
      constructor(parser) {
        super(0, 'do', parser);
      }
    },
    Exit: class Exit extends Token {
      constructor(parser) {
        super(10, 'exit', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.At);
        const spaceId = this.parser.parseExpression(this.leftBindingPower, Expressions.String);
        this.parser.skipToken(Tokens.Instructions.Do);
        const statement =
          this.parser.parseExpression(30, Expressions.Statement);
        return new Expressions.Exit(spaceId, statement);
      }
    },
    Enter: class Enter extends Token {
      constructor(parser) {
        super(10, 'enter', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.At);
        const spaceId = this.parser.parseExpression(this.leftBindingPower, Expressions.String);
        this.parser.skipToken(Tokens.Instructions.Do);
        const statement = this.parser.parseExpression(30, Expressions.Statement);
        return new Expressions.Enter(spaceId, statement);
      }
    },
    Next: class Next extends Token {
      constructor(parser) {
        super(15, 'next', parser);
      }
      nud() {
        const statement = this.parser.parseExpression(this.leftBindingPower, Expression.Statement);
        return new Expressions.SequentialExecution(new Expressions.Skip(), statement);
      }
      led(left) {
        const right = this.parser.parseExpression(this.leftBindingPower, Expressions.Statement);
        if (left instanceof Expressions.Statement) {
          return new Expressions.SequentialExecution(left, right);
        }
        throw SyntaxError(`Expecting Statement but found ${left.constructor.name}`);
      }
    },
    Repeat: class Repeat extends Token {
      constructor(parser) {
        super(10, 'repeat', parser);
      }
      nud() {
        const statement = this.parser.parseExpression(this.leftBindingPower, Expressions.Statement);
        return new Expressions.Repeat(statement);
      }
    },
    Skip: class Skip extends Token {
      constructor(parser) {
        super(90, 'skip', parser);
      }
      nud() { // eslint-disable-line class-methods-use-this
        return new Expressions.Skip();
      }
    },
    Unless: class Unless extends Token {
      constructor(parser) {
        super(90, 'unless', parser);
      }
      nud() {
        const condition = this.parser.parseExpression(this.leftBindingPower, Expressions.Pattern);
        this.parser.skipToken(Tokens.Instructions.Do);
        const statement = this.parser.parseExpression(30, Expressions.statement);
        return new Expressions.Unless(condition, statement);
      }
    },
    Until: class Until extends Token {
      constructor(parser) {
        super(90, 'until', parser);
      }
      nud() {
        const condition = this.parser.parseExpression(this.leftBindingPower, Expressions.Pattern);
        this.parser.skipToken(Tokens.Instructions.Do);
        const statement = this.parser.parseExpression(30, Expressions.statement);
        return new Expressions.Until(condition, statement);
      }
    },
    When: class When extends Token {
      constructor(parser) {
        super(90, 'when', parser);
      }
      nud() {
        const condition = this.parser.parseExpression(this.leftBindingPower, Expressions.Pattern);
        this.parser.skipToken(Tokens.Instructions.Do);
        const statement = this.parser.parseExpression(30, Expressions.statement);
        return new Expressions.When(condition, statement);
      }
    },
    Whenever: class Whenever extends Token {
      constructor(parser) {
        super(90, 'whenever', parser);
      }
      nud() {
        const condition = this.parser.parseExpression(this.leftBindingPower, Expressions.Pattern);
        this.parser.skipToken(Tokens.Instructions.Do);
        const statement = this.parser.parseExpression(30, Expressions.statement);
        return new Expressions.Whenever(condition, statement);
      }
    },
  },
  Literals: {
    String: class String extends Token {
      constructor(value, parser) {
        super(0, 'string', parser);
        this.value = value;
      }
      nud() {
        return new Expressions.String(this.value);
      }
    },
    Number: class Number extends Token {
      constructor(value, parser) {
        super(0, 'number', parser);
        this.value = value;
      }
    },
  },
  Operators: {
    LeftParentheses: class LeftParentheses extends Token {
      constructor(parser) {
        super(0, '(', parser);
      }
      nud() {
        const expression = this.parser.parseExpression(10);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        return expression;
      }
    },
    ListSeparator: class ListSeparator extends Token {
      constructor(parser) {
        super(0, ',', parser);
      }
    },
    RightParentheses: class RightParentheses extends Token {
      constructor(parser) {
        super(0, ')', parser);
      }
    },
    MatchAll: class MatchAll extends Token {
      constructor(parser) {
        super(0, '*', parser);
      }
      nud() {
        return new Expressions.Pattern(this.symbol);
      }
    },
    At: class At extends Token {
      constructor(parser) {
        super(0, '@', parser);
      }
    },
    PatternConcatenation: class PatternConcatenation extends Token {
      constructor(parser) {
        super(100, '.', parser);
      }
      led(left) {
        const right = this.parser.parseExpression(this.leftBindingPower, Expressions.Pattern);
        if (left instanceof Expressions.Pattern) return new Expressions.Pattern(`${left} . ${right}`);
        throw SyntaxError(`Expecting String or Pattern but found ${left.constructor.name}`);
      }
    },
    Parallel: class Parallel extends Token {
      constructor(parser) {
        super(20, '||', parser);
      }
      led(left) {
        const right = this.parser.parseExpression(this.leftBindingPower, Expressions.Statement);
        if (left instanceof Expressions.Statement) {
          return new Expressions.ParallelExecution(left, right);
        }
        throw SyntaxError(`Expecting Statement but found ${left.constructor.name}`);
      }
    },
  },
  Procedures: {
    Clock: class Clock extends Token {
      constructor(parser) {
        super(100, 'clock', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.LeftParentheses);
        const crontab = this.parser.parseExpression(this.leftBindingPower, Expressions.String);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        return new Expressions.Procedure('clock', [crontab]);
      }
    },
    CreatePoll: class CreatePoll extends Token {
      constructor(parser) {
        super(100, 'create-poll', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.LeftParentheses);
        const title = this.parser.parseExpression(this.leftBindingPower, Expressions.String);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        return new Expressions.Procedure('create-poll', [title]);
      }
    },
    ClosePoll: class ClosePoll extends Token {
      constructor(parser) {
        super(100, 'close-poll', parser);
      }
      nud() {
        return new Expressions.Procedure(this.symbol);
      }
    },
    Kill: class Kill extends Token {
      constructor(parser) {
        super(100, 'kill', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.LeftParentheses);
        const pid = this.parser.parseExpression(this.leftBindingPower, Expressions.Pattern);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        return new Expressions.Procedure('kill', [pid]);
      }
    },
    Notify: class Notify extends Token {
      constructor(parser) {
        super(100, 'notify', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.LeftParentheses);
        const message = this.parser.parseExpression(this.leftBindingPower, Expressions.String);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        return new Expressions.Notify(message);
      }
    },
    Post: class Post extends Token {
      constructor(parser) {
        super(100, 'post', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.LeftParentheses);
        const message = this.parser.parseExpression(this.leftBindingPower, Expressions.String);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        return new Expressions.Procedure('post', [message]);
      }
    },
    Remove: class Remove extends Token {
      constructor(parser) {
        super(100, 'remove', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.LeftParentheses);
        const user = this.parser.parseExpression(this.leftBindingPower, Expressions.Pattern);
        this.parser.skipToken(Tokens.Operators.ListSeparator);
        const pid = this.parser.parseExpression(this.leftBindingPower, Expressions.Pattern);
        this.parser.skipToken(Tokens.Operators.ListSeparator);
        const message = this.parser.parseExpression(this.leftBindingPower, Expressions.Pattern);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        return new Expressions.Procedure('rm', [user, pid, message]);
      }
    },
    Say: class Say extends Token {
      constructor(parser) {
        super(100, 'say', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.LeftParentheses);
        const message = this.parser.parseExpression(this.leftBindingPower, Expressions.String);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        return new Expressions.Procedure('say', [message]);
      }
    },
    Signal: class Signal extends Token {
      constructor(parser) {
        super(100, 'signal', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.LeftParentheses);
        const message = this.parser.parseExpression(this.leftBindingPower, Expressions.String);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        return new Expressions.Procedure('signal', [message]);
      }
    },
    Vote: class Vote extends Token {
      constructor(parser) {
        super(100, 'vote', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.LeftParentheses);
        const choice = this.parser.parseExpression(this.leftBindingPower, Expressions.String);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        return new Expressions.Procedure('vote', [choice]);
      }
    },
  },
};

class SculpParser {
  /**
   * @param {String} raw sculp code
   */
  constructor(raw) {
    this.tokenStream = this.tokenizeRaw(raw);
    this.nextToken();
    this.result = this.parseExpression();
  }
  /**
   * Tokenize the given [raw] code and return an iterator of tokens
   * @param {String} raw raw code to tokenize
   * @returns {IterableIterator<Token>}
   */
  * tokenizeRaw(raw) {
    const tokenRegex = /\s*(\|\||[\w-]+|[^\w\s])/y;
    let stringStart = 0;
    let token = tokenRegex.exec(raw);
    while (token) {
      // if stringStart > 0, a string is being read
      if (stringStart > 0) {
        // stop string read when " is found
        if (token[1] === '"') {
          const string = raw.substring(stringStart, tokenRegex.lastIndex - 1);
          stringStart = 0;
          yield new Tokens.Literals.String(string, this);
        }
      } else {
        switch (token[1].toLowerCase()) {
          // Operators
          case '@': yield new Tokens.Operators.At(this); break;
          case '*': yield new Tokens.Operators.MatchAll(this); break;
          case '.': yield new Tokens.Operators.PatternConcatenation(this); break;
          case '(': yield new Tokens.Operators.LeftParentheses(this); break;
          case ')': yield new Tokens.Operators.RightParentheses(this); break;
          case ',': yield new Tokens.Operators.ListSeparator(this); break;
          case '||': yield new Tokens.Operators.Parallel(this); break;

          // Instructions
          case 'do': yield new Tokens.Instructions.Do(this); break;
          case 'enter': yield new Tokens.Instructions.Enter(this); break;
          case 'exit': yield new Tokens.Instructions.Exit(this); break;
          case 'repeat': yield new Tokens.Instructions.Repeat(this); break;
          case 'skip': yield new Tokens.Instructions.Skip(this); break;
          case 'until': yield new Tokens.Instructions.Until(this); break;
          case 'unless': yield new Tokens.Instructions.Unless(this); break;
          case 'when': yield new Tokens.Instructions.When(this); break;
          case 'whenever': yield new Tokens.Instructions.Whenever(this); break;
          case 'next': yield new Tokens.Instructions.Next(this); break;

          // Procedures
          case 'clock': yield new Tokens.Procedures.Clock(this); break;
          case 'close-poll': yield new Tokens.Procedures.ClosePoll(this); break;
          case 'create-poll': yield new Tokens.Procedures.CreatePoll(this); break;
          case 'kill': yield new Tokens.Procedures.Kill(this); break;
          case 'notify': yield new Tokens.Procedures.Notify(this); break;
          case 'post': yield new Tokens.Procedures.Post(this); break;
          case 'rm': yield new Tokens.Procedures.Remove(this); break;
          case 'signal': yield new Tokens.Procedures.Signal(this); break;
          case 'say': yield new Tokens.Procedures.Say(this); break;
          case 'vote': yield new Tokens.Procedures.Vote(this); break;

          // Literals
          case '"': stringStart = tokenRegex.lastIndex; break;
          default: throw new SyntaxError(`Unexpected token ${token[1]}`);
        }
      }
      token = tokenRegex.exec(raw);
    }
    if (stringStart === 0) {
      yield new Tokens.End();
    } else throw new SyntaxError('Unexpected EOF');
  }

  /**
   * Advances to the next token in the token stream
   */
  nextToken() {
    this.token = this.tokenStream.next().value;
  }

  /**
   * Advances to the next token if the current token is of the given [tokenClass], throws if not.
   * @param {Function} tokenClass
   * @throws {SyntaxError} if the current token is not of the given [tokenClass]
   */
  skipToken(tokenClass) {
    if (tokenClass && this.token instanceof tokenClass) {
      this.nextToken();
    } else throw SyntaxError(`Unexpected ${this.token.constructor.name} token, expecting ${tokenClass.name}`);
  }

  /**
   * Process the current and following tokens until a token with less left binding power than the
   * given [rightBindingPower] is found
   *
   * Returns the the resulted expression if it is any of the [accepted] ones, throws if not.
   * @throws {SyntaxError} if the resulted expression is not of the [accepted] ones
   * @param {Number=} rightBindingPower
   * @param {Function|[Function]=} accepted
   * @returns {Expressions.Statement}
   */
  parseExpression(rightBindingPower = 0, accepted) {
    accepted = // eslint-disable-line no-param-reassign
      !accepted || accepted[0] ? accepted : [accepted];
    let currentToken = this.token;
    this.nextToken();
    let left = currentToken.nud();
    while (rightBindingPower <= this.token.leftBindingPower) {
      currentToken = this.token;
      this.nextToken();
      left = currentToken.led(left);
    }
    if (!accepted || accepted.some(className => left instanceof className)) {
      return left;
    }
    const acceptedNames = accepted.map(className => className.name).reduce((res, x, i) => (i ? `${res} or ${x}` : x));
    throw new SyntaxError(`Expecting ${acceptedNames} but found ${left.constructor.name}.`);
  }

  /**
   * Apply [fn] to all expression of the given [classes]
   * @param {Function|[Function]} classes
   * @param {function(Expression)} fn
   */
  applyTo(classes, fn) {
    classes = classes[0] ? classes : [classes]; // eslint-disable-line no-param-reassign
    this.result.traverse((expression) => {
      if (classes.some(className => expression instanceof className)) fn(expression);
    });
  }
  toString() {
    return this.result.toString();
  }
  /**
   * Calls the function **fn** over all nodes of the abstract syntax tree, using
   * the current expression and the given **context** as parameter, then
   * traverse is called recursively over the children expressions, using **fn**
   * and the context returned from previous **fn** call as parameter,
   *
   * If **fn** returns false, the propagation is stopped.
   * @param {function(Expression, Object): Object} fn
   * @param {Object} contexts
   */
  traverse(fn) {
    return this.result.traverse(fn);
  }
  /**
   * Calls the function **fn** over all nodes of the abstract syntax tree, using
   * the current expression as parameter, then the expression returned by **fn**
   * is used to replace the current expression
   * @param {function(Expression)} fn
   */
  patch(fn) {
    this.result = this.result.patch(fn);
  }
}

module.exports = { SculpParser, Expressions, Tokens };
