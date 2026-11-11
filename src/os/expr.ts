/**
 * Safe arithmetic expression parser (shunting-yard → RPN). NEVER uses eval.
 * Supports + - * / % ^ parentheses, unary minus, and functions
 * sqrt, sin, cos, tan, log, ln, abs, and constants pi/e.
 */
type Token = { type: 'num'; value: number } | { type: 'op'; value: string } | { type: 'paren'; value: '(' | ')' };

const FUNCS: Record<string, (n: number) => number> = {
  sqrt: Math.sqrt,
  sin: (x) => Math.sin((x * Math.PI) / 180),
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
  log: Math.log10,
  ln: Math.log,
  abs: Math.abs,
};

const PRECEDENCE: Record<string, number> = {
  '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, 'u-': 4,
};

const RIGHT_ASSOC = new Set(['^', 'u-']);

export function evaluate(input: string): number {
  const tokens = tokenize(input);
  const rpn = toRPN(tokens);
  return evalRPN(rpn);
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  let expectUnary = true;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let num = '';
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      if ((num.match(/\./g) || []).length > 1) throw new Error('Bad number');
      tokens.push({ type: 'num', value: parseFloat(num) });
      expectUnary = false;
      continue;
    }
    if (/[a-z]/i.test(c)) {
      let name = '';
      while (i < s.length && /[a-z]/i.test(s[i])) name += s[i++];
      const lower = name.toLowerCase();
      if (lower === 'pi') { tokens.push({ type: 'num', value: Math.PI }); expectUnary = false; continue; }
      if (lower === 'e') { tokens.push({ type: 'num', value: Math.E }); expectUnary = false; continue; }
      if (!FUNCS[lower]) throw new Error(`Unknown function ${name}`);
      if (s[i] !== '(') throw new Error(`${name} needs parentheses`);
      tokens.push({ type: 'op', value: lower });
      expectUnary = false;
      continue;
    }
    if (c === '(') { tokens.push({ type: 'paren', value: '(' }); i++; expectUnary = true; continue; }
    if (c === ')') { tokens.push({ type: 'paren', value: ')' }); i++; expectUnary = false; continue; }
    if ('+-*/%^'.includes(c)) {
      if (expectUnary && (c === '-' || c === '+')) {
        tokens.push({ type: 'op', value: c === '-' ? 'u-' : 'u+' });
        i++;
        continue;
      }
      tokens.push({ type: 'op', value: c });
      i++;
      expectUnary = true;
      continue;
    }
    throw new Error(`Unexpected "${c}"`);
  }
  return tokens;
}

function toRPN(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const stack: Token[] = [];
  for (const t of tokens) {
    if (t.type === 'num') { out.push(t); continue; }
    if (t.type === 'op') {
      if (FUNCS[t.value]) { stack.push(t); continue; }
      if (t.value === 'u+') continue;
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type !== 'op') break;
        if (FUNCS[top.value]) { out.push(stack.pop()!); continue; }
        const p1 = PRECEDENCE[t.value] ?? 0;
        const p2 = PRECEDENCE[top.value] ?? 0;
        if (p2 > p1 || (p2 === p1 && !RIGHT_ASSOC.has(t.value))) out.push(stack.pop()!);
        else break;
      }
      stack.push(t);
      continue;
    }
    if (t.value === '(') { stack.push(t); continue; }
    if (t.value === ')') {
      while (stack.length && stack[stack.length - 1].type !== 'paren') out.push(stack.pop()!);
      stack.pop();
      if (stack.length && stack[stack.length - 1].type === 'op' && FUNCS[(stack[stack.length - 1] as any).value]) {
        out.push(stack.pop()!);
      }
      continue;
    }
  }
  while (stack.length) {
    const t = stack.pop()!;
    if (t.type === 'paren') throw new Error('Mismatched parentheses');
    out.push(t);
  }
  return out;
}

function evalRPN(rpn: Token[]): number {
  const stack: number[] = [];
  for (const t of rpn) {
    if (t.type === 'num') { stack.push(t.value); continue; }
    const op = t.value;
    if (FUNCS[op]) {
      const a = stack.pop();
      if (a === undefined) throw new Error('Syntax error');
      stack.push(FUNCS[op](a));
      continue;
    }
    if (op === 'u-') { const a = stack.pop(); if (a === undefined) throw new Error('Syntax error'); stack.push(-a); continue; }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) throw new Error('Syntax error');
    switch (op) {
      case '+': stack.push(a + b); break;
      case '-': stack.push(a - b); break;
      case '*': stack.push(a * b); break;
      case '/': if (b === 0) throw new Error('Divide by zero'); stack.push(a / b); break;
      case '%': stack.push(a % b); break;
      case '^': stack.push(Math.pow(a, b)); break;
      default: throw new Error(`Bad operator ${op}`);
    }
  }
  const result = stack.pop();
  if (result === undefined || !Number.isFinite(result)) throw new Error('Invalid result');
  return result;
}

export function formatResult(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-7)) return n.toExponential(6).replace(/e([+-])/, 'e$1');
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded);
}
