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

  /**
   * Apply [fn] to all expression of the given [classes]
   * @param {Function|[Function]} classes
   * @param {function(Expression)} fn
   */
  applyTo(classes, fn) {
    classes = classes[0] ? classes : [classes]; // eslint-disable-line no-param-reassign
    this.traverse((expression) => {
      if (classes.some(className => expression instanceof className)) fn(expression);
    });
  }
}

const Expressions = {};
Expressions.Statement = class Statement extends Expression {};
Expressions.Instruction = class Instruction extends Expressions.Statement {};
Expressions.Constraint = class Constraint extends Expression {};
Expressions.Pattern = class Pattern extends Expressions.Constraint {
  constructor(value) {
    super('pattern', []);
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
Expressions.Number = class Number extends Expression {
  constructor(value) {
    super();
    this.value = value;
  }
  toString() {
    return `${this.value}`;
  }
};
Expressions.Enter = class Enter extends Expressions.Instruction {
  constructor(spaceId, statement) {
    super();
    this.spaceId = spaceId;
    this.statement = statement;
  }
  toString() {
    return `enter ${this.spaceId} do ${this.statement}`;
  }
};
Expressions.Exit = class Exit extends Expressions.Instruction {
  constructor(spaceId, statement) {
    super();
    this.spaceId = spaceId;
    this.statement = statement;
  }
  toString() {
    return `exit ${this.spaceId} do ${this.statement}`;
  }
};
Expressions.Define = class Define extends Expressions.Instruction {
  constructor(name, statement) {
    super();
    this.name = name;
    this.statement = statement;
  }
  toString() {
    return `def ${this.name} as ${this.statement}`;
  }
};
Expressions.ParallelExecution = class ParallelExecution extends Expressions.Statement {
  constructor(left, right) {
    super();
    this.statements = right instanceof Expressions.ParallelExecution ? right.statements : [right];
    this.statements.unshift(left);
  }
  toString() {
    return `(${this.statements.join(' || ')})`;
  }
};
Expressions.PatternAnd = class PatternAnd extends Expressions.Pattern {
  constructor(left, right) {
    super();
    this.patterns = right instanceof Expressions.PatternAnd ? right.constraints : [right];
    this.patterns.unshift(left);
  }
  toString() {
    return `(${this.patterns.join(' & ')})`;
  }
};
Expressions.PatternOr = class PatternOr extends Expressions.Pattern {
  constructor(left, right) {
    super();
    this.patterns = right instanceof Expressions.PatternOr ? right.patterns : [right];
    this.patterns.unshift(left);
  }
  toString() {
    return `${this.patterns.join(' v ')}`;
  }
};
Expressions.LogicalAnd = class LogicalAnd extends Expressions.Constraint {
  constructor(left, right) {
    super();
    this.constraints = right instanceof Expressions.LogicalAnd ? right.constraints : [right];
    this.constraints.unshift(left);
  }
  toString() {
    return `(${this.constraints.join(' & ')})`;
  }
};
Expressions.LogicalOr = class LogicalOr extends Expressions.Constraint {
  constructor(left, right) {
    super();
    this.constraints = right instanceof Expressions.LogicalOr ? right.constraints : [right];
    this.constraints.unshift(left);
  }
  toString() {
    return `${this.constraints.join(' v ')}`;
  }
};
Expressions.Match = class Match extends Expression {
  constructor(name, pattern) {
    super();
    this.name = name;
    this.pattern = pattern;
  }
  toString() {
    return `${this.name}: ${this.pattern}`;
  }
};
Expressions.MatchList = class MatchList extends Expressions.Constraint {
  constructor(item1, item2) {
    super();
    this.list = {};
    this.list[item1.name] = item1;
    if (item2) this.list[item2.name] = item2;
  }
  toString() {
    return `{ ${Object.values(this.list).join(', ')} }`;
  }
};

Expressions.ParametersList = class ParametersList extends Expression {
  constructor(list) {
    super();
    this.list = list;
  }
};
Expressions.Procedure = class Procedure extends Expressions.Statement {
  constructor(name, params) {
    super();
    this.name = name;
    this.params = params || new Expressions.ParametersList([]);
  }
  pushParam(param) {
    if (typeof param === 'string') {
      this.params.list.push(new Expressions.String(param));
    } else if (param instanceof Expression) {
      this.params.list.push(param);
    } else {
      throw new TypeError(`param type ${param.constructor.className} is not String or Expression`);
    }
  }
  toString() {
    return this.params.list.length ? `${this.name}(${this.params.list.join(', ')})` : this.name;
  }
};
Expressions.Identifier = class Identifier extends Expression {
  constructor(name) {
    super();
    this.name = name;
  }
  toString() {
    return this.name;
  }
};
Expressions.If = class If extends Expressions.Instruction {
  constructor(condition, statement) {
    super();
    this.condition = condition;
    this.statement = statement;
  }
  toString() {
    return `if ${this.condition} then ${this.statement}`;
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
  constructor(statement) {
    super();
    this.statement = statement;
  }
  toString() {
    return `next ${this.statement}`;
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
Expressions.While = class While extends Expressions.Instruction {
  constructor(condition, statement) {
    super();
    this.condition = condition;
    this.statement = statement;
  }
  toString() {
    return `while ${this.condition} do ${this.statement}`;
  }
};
Expressions.Until = class Until extends Expressions.Instruction {
  constructor(condition, statement) {
    super();
    this.condition = condition;
    this.statement = statement;
  }
  toString() {
    return `do ${this.statement} until ${this.condition}`;
  }
};
Expressions.Unless = class Unless extends Expressions.Instruction {
  constructor(condition, statement) {
    super();
    this.condition = condition;
    this.statement = statement;
  }
  toString() {
    return `unless ${this.condition} next ${this.statement}`;
  }
};
Expressions.Skip = class Skip extends Expressions.Instruction {
  toString() { // eslint-disable-line class-methods-use-this
    return 'skip';
  }
};
Expressions.SpacePath = class SpacePath extends Expressions.Instruction {
  constructor(path) {
    super();
    this.path = path;
  }
  toString() {
    return `@ ${this.path}`;
  }
};

const Tokens = {
  End: class End extends Token {
    constructor() {
      super(-1, 'EOF', null);
    }
  },
  Instructions: {
    As: class As extends Token {
      constructor(parser) {
        super(10, 'as', parser);
      }
    },
    Do: class Do extends Token {
      constructor(parser) {
        super(0, 'do', parser);
      }
      nud() {
        const statement = this.parser.parseNextExpression(30, Expressions.Statement);
        this.parser.skipToken(Tokens.Instructions.Until);
        const condition = this.parser.parseNextExpression(30, Expressions.Constraint);
        return new Expressions.Until(condition, statement);
      }
    },
    Exit: class Exit extends Token {
      constructor(parser) {
        super(10, 'exit', parser);
      }
      nud() {
        const path = this.parser.parseNextExpression(this.leftBindingPower, Expressions.SpacePath);
        this.parser.skipToken(Tokens.Instructions.Do);
        const statement = this.parser.parseNextExpression(30, Expressions.Statement);
        return new Expressions.Exit(path, statement);
      }
    },
    Enter: class Enter extends Token {
      constructor(parser) {
        super(10, 'enter', parser);
      }
      nud() {
        const path = this.parser.parseNextExpression(this.leftBindingPower, Expressions.SpacePath);
        this.parser.skipToken(Tokens.Instructions.Do);
        const statement = this.parser.parseNextExpression(30, Expressions.Statement);
        return new Expressions.Enter(path, statement);
      }
    },
    Define: class Define extends Token {
      constructor(parser) {
        super(90, 'def', parser);
      }
      nud() {
        const name = this.parser.parseNextExpression(this.leftBindingPower, Expressions.String);
        this.parser.skipToken(Tokens.Instructions.As);
        const statement = this.parser.parseNextExpression(30, Expressions.Statement);
        return new Expressions.Define(name, statement);
      }
    },
    If: class If extends Token {
      constructor(parser) {
        super(90, 'if', parser);
      }
      nud() {
        const condition =
          this.parser.parseNextExpression(this.leftBindingPower, Expressions.Constraint);
        this.parser.skipToken(Tokens.Instructions.Then);
        const statement = this.parser.parseNextExpression(30, Expressions.Statement);
        return new Expressions.If(condition, statement);
      }
    },
    Next: class Next extends Token {
      constructor(parser) {
        super(15, 'next', parser);
      }
      nud() {
        const statement =
          this.parser.parseNextExpression(this.leftBindingPower, Expression.Statement);
        return new Expressions.SequentialExecution(statement);
      }
    },
    Repeat: class Repeat extends Token {
      constructor(parser) {
        super(10, 'repeat', parser);
      }
      nud() {
        const statement =
          this.parser.parseNextExpression(this.leftBindingPower, Expressions.Statement);
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
    Then: class Then extends Token {
      constructor(parser) {
        super(10, 'then', parser);
      }
    },
    Unless: class Unless extends Token {
      constructor(parser) {
        super(90, 'unless', parser);
      }
      nud() {
        const condition =
          this.parser.parseNextExpression(this.leftBindingPower, Expressions.Constraint);
        this.parser.skipToken(Tokens.Instructions.Next);
        const statement = this.parser.parseNextExpression(30, Expressions.statement);
        return new Expressions.Unless(condition, statement);
      }
    },
    Until: class Until extends Token {
      constructor(parser) {
        super(20, 'until', parser);
      }
    },
    When: class When extends Token {
      constructor(parser) {
        super(90, 'when', parser);
      }
      nud() {
        const condition =
          this.parser.parseNextExpression(this.leftBindingPower, Expressions.Constraint);
        this.parser.skipToken(Tokens.Instructions.Do);
        const statement = this.parser.parseNextExpression(30, Expressions.statement);
        return new Expressions.When(condition, statement);
      }
    },
    Whenever: class Whenever extends Token {
      constructor(parser) {
        super(90, 'whenever', parser);
      }
      nud() {
        const condition =
          this.parser.parseNextExpression(this.leftBindingPower, Expressions.Constraint);
        this.parser.skipToken(Tokens.Instructions.Do);
        const statement = this.parser.parseNextExpression(30, Expressions.statement);
        return new Expressions.Whenever(condition, statement);
      }
    },
    While: class While extends Token {
      constructor(parser) {
        super(90, 'while', parser);
      }
      nud() {
        const condition =
          this.parser.parseNextExpression(this.leftBindingPower, Expressions.Constraint);
        this.parser.skipToken(Tokens.Instructions.Do);
        const statement = this.parser.parseNextExpression(30, Expressions.statement);
        return new Expressions.While(condition, statement);
      }
    },
  },
  Literals: {
    String: class String extends Token {
      constructor(value, parser) {
        super(10, 'string', parser);
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
    Colon: class Colon extends Token {
      constructor(parser) {
        super(0, ':', parser);
      }
    },
    LeftParentheses: class LeftParentheses extends Token {
      constructor(parser) {
        super(40, '(', parser);
      }
      nud() {
        const expression = this.parser.parseNextExpression(10);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        return expression;
      }
      led(left) {
        if (!(left instanceof Expressions.Identifier) ||
          !(left.name in this.parser.validSignatures)
        ) {
          throw new SyntaxError(`Unexpected ${left}, expecting Identifier`);
        }
        let params = this.parser.parseNextExpression(10);
        this.parser.skipToken(Tokens.Operators.RightParentheses);
        if (!(params instanceof Expressions.ParametersList)) {
          params = new Expressions.ParametersList([params]);
        }
        if (params.list.length !== this.parser.validSignatures[left.name].length) {
          throw new SyntaxError(`Procedure ${left.name} requires ${this.parser.validSignatures[left.name].length} parameters instead of ${params.list.length}.`);
        }
        this.parser.validSignatures[left.name].forEach((className, i) => {
          if (!(params.list[i] instanceof className)) {
            throw TypeError(`Parameter at position ${i} of ${left.name} must be of type ${className.name} instead of ${params.list[i].constructor.name}.`);
          }
        });
        return new Expressions.Procedure(left.name, params);
      }
    },
    LeftBracket: class LeftBracket extends Token {
      constructor(parser) {
        super(90, '{', parser);
      }
      nud() {
        const list = this.parser.parseNextExpression(
          this.leftBindingPower,
          [Expressions.MatchList, Expressions.Match],
        );
        this.parser.skipToken(Tokens.Operators.RightBracket);
        return list instanceof Expressions.MatchList ? list : new Expressions.MatchList(list);
      }
    },
    LeftSquareBracket: class LeftSquareBracket extends Token {
      constructor(parser) {
        super(90, '[', parser);
      }
      nud() {
        const pattern = this.parser.parseNextExpression(this.leftBindingPower, Expressions.Pattern);
        this.parser.skipToken(Tokens.Operators.RightSquareBracket);
        this.parser.skipToken(Tokens.Operators.Asterisk);
        return new Expressions.Pattern(`[${pattern}]*`);
      }
    },
    ListSeparator: class ListSeparator extends Token {
      constructor(parser) {
        super(100, ',', parser);
      }
      led(left) {
        const right = this.parser.parseNextExpression(10);
        if (right instanceof Expressions.ParametersList) {
          right.list.unshift(left);
          return right;
        } else if (right instanceof Expressions.MatchList) {
          right.list[left.name] = left;
          return right;
        } else if (right instanceof Expressions.Match) {
          return new Expressions.MatchList(left, right);
        }
        return new Expressions.ParametersList([left, right]);
      }
    },
    RightBracket: class RightBracket extends Token {
      constructor(parser) {
        super(0, '}', parser);
      }
    },
    RightSquareBracket: class RightSquareBracket extends Token {
      constructor(parser) {
        super(0, ']', parser);
      }
    },
    RightParentheses: class RightParentheses extends Token {
      constructor(parser) {
        super(0, ')', parser);
      }
    },
    Asterisk: class Asterisk extends Token {
      constructor(parser) {
        super(0, '*', parser);
      }
      nud() {
        return new Expressions.Pattern(this.symbol);
      }
    },
    MatchBody: class MatchBody extends Token {
      constructor(parser) {
        super(110, 'txt', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.Colon);
        const content = this.parser.parseNextExpression(this.leftBindingPower, Expressions.Pattern);
        return new Expressions.Match('txt', content);
      }
    },
    MatchPID: class MatchPID extends Token {
      constructor(parser) {
        super(110, 'pid', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.Colon);
        const content = this.parser.parseNextExpression(this.leftBindingPower, Expressions.Pattern);
        return new Expressions.Match('pid', content);
      }
    },
    MatchUser: class MatchUser extends Token {
      constructor(parser) {
        super(110, 'user', parser);
      }
      nud() {
        this.parser.skipToken(Tokens.Operators.Colon);
        const user = this.parser.parseNextExpression(this.leftBindingPower, Expressions.Pattern);
        return new Expressions.Match('usr', user);
      }
    },
    At: class At extends Token {
      constructor(parser) {
        super(25, '@', parser);
      }
      nud() {
        const path = this.parser.parseNextExpression(this.leftBindingPower, Expressions.String);
        return new Expressions.SpacePath(path);
      }
    },
    PatternConcatenation: class PatternConcatenation extends Token {
      constructor(parser) {
        super(120, '.', parser);
      }
      led(left) {
        const right = this.parser.parseNextExpression(this.leftBindingPower, Expressions.Pattern);
        if (left instanceof Expressions.Pattern) return new Expressions.Pattern(`${left} . ${right}`);
        throw SyntaxError(`Expecting String or Pattern but found ${left.constructor.name}`);
      }
    },
    Parallel: class Parallel extends Token {
      constructor(parser) {
        super(20, '||', parser);
      }
      led(left) {
        const right = this.parser.parseNextExpression(this.leftBindingPower, Expressions.Statement);
        if (left instanceof Expressions.Statement) {
          return new Expressions.ParallelExecution(left, right);
        }
        throw SyntaxError(`Expecting Statement but found ${left.constructor.name}`);
      }
    },
    Placeholder: class Placeholder extends Token {
      constructor(parser) {
        super(999, '$', parser);
      }
      nud() {
        const identifier =
          this.parser.parseNextExpression(this.leftBindingPower, Expressions.Identifier);
        if (identifier.name in this.parser.inserts) {
          return this.parser.inserts[[identifier.name]];
        }
        throw new ReferenceError(`Insert for placeholder '${identifier.name}' not found.`);
      }
    },
    LogicalAnd: class LogicalAnd extends Token {
      constructor(parser) {
        super(100, '&', parser);
      }
      led(left) {
        const right = this.parser.parseNextExpression(
          this.leftBindingPower,
          [Expressions.Constraint, Expressions.Pattern],
        );
        if (left instanceof Expressions.Pattern && right instanceof Expressions.Pattern) {
          return new Expressions.PatternAnd(left, right);
        } else if (
          left instanceof Expressions.Constraint &&
          right instanceof Expressions.Constraint
        ) {
          return new Expressions.LogicalAnd(left, right);
        }
        throw SyntaxError(`Invalid operation And between ${left.constructor.name} and ${right.constructor.name}`);
      }
    },
    LogicalOr: class LogicalOr extends Token {
      constructor(parser) {
        super(95, 'v', parser);
      }
      led(left) {
        const right = this.parser.parseNextExpression(
          this.leftBindingPower,
          [Expressions.Constraint, Expressions.Pattern],
        );
        if (left instanceof Expressions.Pattern && right instanceof Expressions.Pattern) {
          return new Expressions.PatternOr(left, right);
        } else if (
          left instanceof Expressions.Constraint &&
          right instanceof Expressions.Constraint
        ) {
          return new Expressions.LogicalOr(left, right);
        }
        throw SyntaxError(`Invalid operation Or between ${left.constructor.name} and ${right.constructor.name}`);
      }
    },
  },
  Identifier: class Identifier extends Token {
    constructor(name, parser) {
      super(0, name, parser);
    }
    nud() {
      if (this.parser.validSignatures[this.symbol] &&
          this.parser.validSignatures[this.symbol].length === 0
      ) {
        return new Expressions.Procedure(this.symbol);
      }
      return new Expressions.Identifier(this.symbol);
    }
  },
};

class SculpParser {
  constructor(validSignatures) {
    this.validSignatures = validSignatures;
    this.inserts = [];
  }
  /**
   * @param {String} raw sculp code
   * @param {[Expression]=} inserts expressions to insert in placeholders
   */
  parse(raw, inserts) {
    this.inserts = inserts || [];
    this.isInTemplateMode = this.inserts !== undefined;
    this.tokenStream = this.tokenizeRaw(raw);
    this.nextToken();
    const result = this.parseNextExpression();
    if (!this.isInTemplateMode && !(result instanceof Expressions.Statement)) {
      throw SyntaxError(`Unexpected token ${this.result.constructor.name}, expecting Statement`);
    }
    return result;
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
      } else if (this.isInTemplateMode && token[1] === '$') {
        // Meta-Operators
        yield new Tokens.Operators.Placeholder(this);
        token = tokenRegex.exec(raw);
        yield new Tokens.Identifier(token[1], this);
      } else {
        switch (token[1].toLowerCase()) {
          // Operators
          case '@': yield new Tokens.Operators.At(this); break;
          case '*': yield new Tokens.Operators.Asterisk(this); break;
          case '.': yield new Tokens.Operators.PatternConcatenation(this); break;
          case '(': yield new Tokens.Operators.LeftParentheses(this); break;
          case ')': yield new Tokens.Operators.RightParentheses(this); break;
          case ',': yield new Tokens.Operators.ListSeparator(this); break;
          case '||': yield new Tokens.Operators.Parallel(this); break;
          case ':': yield new Tokens.Operators.Colon(this); break;
          case '&': yield new Tokens.Operators.LogicalAnd(this); break;
          case 'v': yield new Tokens.Operators.LogicalOr(this); break;
          case '{': yield new Tokens.Operators.LeftBracket(this); break;
          case '}': yield new Tokens.Operators.RightBracket(this); break;
          case '[': yield new Tokens.Operators.LeftSquareBracket(this); break;
          case ']': yield new Tokens.Operators.RightSquareBracket(this); break;

          // Constraints
          case 'txt': yield new Tokens.Operators.MatchBody(this); break;
          case 'pid': yield new Tokens.Operators.MatchPID(this); break;
          case 'usr': yield new Tokens.Operators.MatchUser(this); break;

          // Instructions
          case 'as': yield new Tokens.Instructions.As(this); break;
          case 'do': yield new Tokens.Instructions.Do(this); break;
          case 'enter': yield new Tokens.Instructions.Enter(this); break;
          case 'exit': yield new Tokens.Instructions.Exit(this); break;
          case 'def': yield new Tokens.Instructions.Define(this); break;
          case 'if': yield new Tokens.Instructions.If(this); break;
          case 'next': yield new Tokens.Instructions.Next(this); break;
          case 'repeat': yield new Tokens.Instructions.Repeat(this); break;
          case 'skip': yield new Tokens.Instructions.Skip(this); break;
          case 'then': yield new Tokens.Instructions.Then(this); break;
          case 'until': yield new Tokens.Instructions.Until(this); break;
          case 'unless': yield new Tokens.Instructions.Unless(this); break;
          case 'when': yield new Tokens.Instructions.When(this); break;
          case 'whenever': yield new Tokens.Instructions.Whenever(this); break;
          case 'while': yield new Tokens.Instructions.While(this); break;

          // Literals
          case '"': stringStart = tokenRegex.lastIndex; break;
          default:
            if (!(token[1] in this.validSignatures)) {
              throw new SyntaxError(`Unknown token '${token[1]}'.`);
            }
            yield new Tokens.Identifier(token[1], this);
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
  parseNextExpression(rightBindingPower = 0, accepted) {
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
    const acceptedNames = accepted.map(className => className.name).join(' or ');
    throw new SyntaxError(`Expecting ${acceptedNames} but found ${left.constructor.name}.`);
  }
}

module.exports = { SculpParser, Expressions, Tokens };
