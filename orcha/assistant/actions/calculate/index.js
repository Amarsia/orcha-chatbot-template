const CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
};

const FUNCTIONS = {
  abs: Math.abs,
  ceil: Math.ceil,
  cos: Math.cos,
  exp: Math.exp,
  floor: Math.floor,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  log2: Math.log2,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
};

function tokenize(expression) {
  const tokens = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = "";
      let dots = 0;
      while (i < expression.length && /[0-9.]/.test(expression[i])) {
        if (expression[i] === ".") dots += 1;
        if (dots > 1) throw new Error(`Invalid number in expression near "${num}".`);
        num += expression[i];
        i += 1;
      }
      const value = Number(num);
      if (!Number.isFinite(value)) throw new Error(`Invalid number "${num}".`);
      tokens.push({ type: "number", value });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < expression.length && /[a-zA-Z0-9_]/.test(expression[i])) {
        ident += expression[i];
        i += 1;
      }
      tokens.push({ type: "ident", value: ident.toLowerCase() });
      continue;
    }
    if ("+-*/%^(),".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i += 1;
      continue;
    }
    throw new Error(`Unsupported character "${ch}" in expression.`);
  }
  return tokens;
}

function evaluateExpression(source) {
  const tokens = tokenize(source);
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpr() {
    let left = parseTerm();
    while (peek()?.type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = consume().value;
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parsePower();
    while (peek()?.type === "op" && (peek().value === "*" || peek().value === "/" || peek().value === "%")) {
      const op = consume().value;
      const right = parsePower();
      if ((op === "/" || op === "%") && right === 0) {
        throw new Error("Division by zero.");
      }
      left = op === "*" ? left * right : op === "/" ? left / right : left % right;
    }
    return left;
  }

  function parsePower() {
    const base = parseUnary();
    if (peek()?.type === "op" && peek().value === "^") {
      consume();
      const exp = parsePower();
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary() {
    if (peek()?.type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = consume().value;
      const val = parseUnary();
      return op === "-" ? -val : val;
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const token = peek();
    if (!token) throw new Error("Unexpected end of expression.");

    if (token.type === "number") {
      consume();
      return token.value;
    }

    if (token.type === "op" && token.value === "(") {
      consume();
      const val = parseExpr();
      const closing = consume();
      if (!closing || closing.type !== "op" || closing.value !== ")") {
        throw new Error("Missing closing parenthesis.");
      }
      return val;
    }

    if (token.type === "ident") {
      consume();
      if (peek()?.type === "op" && peek().value === "(") {
        const fn = FUNCTIONS[token.value];
        if (!fn) throw new Error(`Unknown function "${token.value}".`);
        consume();
        const args = [];
        if (!(peek()?.type === "op" && peek().value === ")")) {
          args.push(parseExpr());
          while (peek()?.type === "op" && peek().value === ",") {
            consume();
            args.push(parseExpr());
          }
        }
        const closing = consume();
        if (!closing || closing.type !== "op" || closing.value !== ")") {
          throw new Error(`Missing closing parenthesis for "${token.value}".`);
        }
        return fn(...args);
      }
      if (token.value in CONSTANTS) {
        return CONSTANTS[token.value];
      }
      throw new Error(`Unknown identifier "${token.value}".`);
    }

    throw new Error(`Unexpected token "${token.value}".`);
  }

  const result = parseExpr();
  if (pos < tokens.length) {
    throw new Error(`Unexpected token "${tokens[pos].value}".`);
  }
  if (!Number.isFinite(result)) {
    throw new Error("Expression did not evaluate to a finite number.");
  }
  return result;
}

export default async function calculate({ expression }) {
  const cleaned = String(expression ?? "").trim();
  if (!cleaned) {
    throw new Error("expression must be a non-empty string.");
  }
  return {
    expression: cleaned,
    result: evaluateExpression(cleaned),
  };
}
