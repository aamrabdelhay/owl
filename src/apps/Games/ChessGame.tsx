import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppFrame } from '../../components/Shell';

type Piece = string | null;
type Board = Piece[][];
type Move = { from: [number, number]; to: [number, number]; ep?: boolean; castle?: boolean };
type Rights = { wk: boolean; wq: boolean; bk: boolean; bq: boolean };
type Position = { board: Board; white: boolean; rights: Rights; ep: [number, number] | null; history: string[] };
const GLYPHS: Record<string, string> = { K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟' };
const START: Board = [
  ['r','n','b','q','k','b','n','r'], Array(8).fill('p'),
  ...Array.from({length:4},()=>Array(8).fill(null)),
  Array(8).fill('P'), ['R','N','B','Q','K','B','N','R'],
];
const initial = (): Position => ({ board: START.map(r=>[...r]), white: true, rights:{wk:true,wq:true,bk:true,bq:true}, ep:null, history:[] });
const inside=(r:number,c:number)=>r>=0&&r<8&&c>=0&&c<8;
const whitePiece=(p:Piece)=>!!p&&p===p.toUpperCase();
function attacked(b:Board,r:number,c:number,byWhite:boolean):boolean {
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    const p=b[y][x]; if(!p||whitePiece(p)!==byWhite)continue;
    const t=p.toLowerCase(), dr=r-y, dc=c-x;
    if(t==='p'&&dr===(byWhite?-1:1)&&Math.abs(dc)===1)return true;
    if(t==='n'&&((Math.abs(dr)===2&&Math.abs(dc)===1)||(Math.abs(dr)===1&&Math.abs(dc)===2)))return true;
    if(t==='k'&&Math.max(Math.abs(dr),Math.abs(dc))===1)return true;
    const diagonal=Math.abs(dr)===Math.abs(dc)&&dr!==0;
    const straight=(dr===0)!==(dc===0);
    if((t==='b'&&diagonal)||(t==='r'&&straight)||(t==='q'&&(diagonal||straight))){
      const sy=Math.sign(dr),sx=Math.sign(dc);let yy=y+sy,xx=x+sx,clear=true;
      while(yy!==r||xx!==c){if(b[yy][xx]){clear=false;break;}yy+=sy;xx+=sx;}
      if(clear)return true;
    }
  }
  return false;
}
function inCheck(b:Board,white:boolean):boolean {
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(b[r][c]===(white?'K':'k'))return attacked(b,r,c,!white);
  return true;
}
function pseudo(pos:Position,r:number,c:number):Move[] {
  const b=pos.board,p=b[r][c];if(!p)return [];
  const white=whitePiece(p),t=p.toLowerCase(),out:Move[]=[];
  const add=(y:number,x:number,extra:Partial<Move>={})=>{if(!inside(y,x))return false;const q=b[y][x];if(q&&whitePiece(q)===white)return false;out.push({from:[r,c],to:[y,x],...extra});return !q;};
  if(t==='p'){
    const d=white?-1:1,start=white?6:1;
    if(inside(r+d,c)&&!b[r+d][c]){add(r+d,c);if(r===start&&!b[r+2*d][c])add(r+2*d,c);}
    for(const dx of [-1,1]){const y=r+d,x=c+dx;if(inside(y,x)&&b[y][x]&&whitePiece(b[y][x])!==white)add(y,x);if(pos.ep?.[0]===y&&pos.ep?.[1]===x)add(y,x,{ep:true});}
  } else if(t==='n'){
    for(const [dy,dx] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])add(r+dy,c+dx);
  } else if(t==='k'){
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dy||dx)add(r+dy,c+dx);
    const row=white?7:0,enemy=!white;
    if(r===row&&c===4&&!attacked(b,row,4,enemy)){
      const kingSide=white?pos.rights.wk:pos.rights.bk,queenSide=white?pos.rights.wq:pos.rights.bq;
      if(kingSide&&b[row][7]===(white?'R':'r')&&!b[row][5]&&!b[row][6]&&!attacked(b,row,5,enemy)&&!attacked(b,row,6,enemy))out.push({from:[r,c],to:[row,6],castle:true});
      if(queenSide&&b[row][0]===(white?'R':'r')&&!b[row][1]&&!b[row][2]&&!b[row][3]&&!attacked(b,row,3,enemy)&&!attacked(b,row,2,enemy))out.push({from:[r,c],to:[row,2],castle:true});
    }
  } else {
    const dirs:number[][]=[];
    if(t==='b'||t==='q')dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
    if(t==='r'||t==='q')dirs.push([-1,0],[1,0],[0,-1],[0,1]);
    for(const [dy,dx] of dirs){let y=r+dy,x=c+dx;while(inside(y,x)){const keep=add(y,x);if(!keep)break;y+=dy;x+=dx;}}
  }
  return out;
}
function apply(pos:Position,m:Move):Position {
  const b=pos.board.map(row=>[...row]),p=b[m.from[0]][m.from[1]] as string;
  const captured=b[m.to[0]][m.to[1]];
  b[m.from[0]][m.from[1]]=null;b[m.to[0]][m.to[1]]=p;
  if(m.ep)b[m.from[0]][m.to[1]]=null;
  if(m.castle){const row=m.from[0];if(m.to[1]===6){b[row][5]=b[row][7];b[row][7]=null;}else{b[row][3]=b[row][0];b[row][0]=null;}}
  if(p.toLowerCase()==='p'&&(m.to[0]===0||m.to[0]===7))b[m.to[0]][m.to[1]]=pos.white?'Q':'q';
  const rights={...pos.rights};
  if(p==='K'){rights.wk=false;rights.wq=false;}if(p==='k'){rights.bk=false;rights.bq=false;}
  if(m.from[0]===7&&m.from[1]===0||captured==='R'&&m.to[0]===7&&m.to[1]===0)rights.wq=false;
  if(m.from[0]===7&&m.from[1]===7||captured==='R'&&m.to[0]===7&&m.to[1]===7)rights.wk=false;
  if(m.from[0]===0&&m.from[1]===0||captured==='r'&&m.to[0]===0&&m.to[1]===0)rights.bq=false;
  if(m.from[0]===0&&m.from[1]===7||captured==='r'&&m.to[0]===0&&m.to[1]===7)rights.bk=false;
  const ep=p.toLowerCase()==='p'&&Math.abs(m.to[0]-m.from[0])===2?[(m.to[0]+m.from[0])/2,m.from[1]] as [number,number]:null;
  const note=`${String.fromCharCode(97+m.from[1])}${8-m.from[0]}–${String.fromCharCode(97+m.to[1])}${8-m.to[0]}${m.castle?(m.to[1]===6?' O-O':' O-O-O'):''}`;
  return {board:b,white:!pos.white,rights,ep,history:[...pos.history,note]};
}
function legal(pos:Position,r:number,c:number):Move[] {
  const p=pos.board[r][c];if(!p||whitePiece(p)!==pos.white)return [];
  return pseudo(pos,r,c).filter(m=>!inCheck(apply(pos,m).board,pos.white));
}
function allLegal(pos:Position):Move[] {
  const out:Move[]=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)out.push(...legal(pos,r,c));return out;
}
/* ------------------------------- computer player ------------------------------ */
const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
function evaluate(b: Board): number {
  let score = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c]; if (!p) continue;
    const t = p.toLowerCase(), white = whitePiece(p);
    let v = VALUE[t];
    const centre = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5)); // 0..3
    if (t === 'n' || t === 'b') v += centre * 8; else if (t === 'p') { v += centre * 3; v += (white ? 6 - r : r - 1) * 4; } else if (t === 'q') v += centre * 2;
    score += white ? v : -v;
  }
  return score;
}
function pseudoAll(pos: Position): Move[] {
  const out: Move[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = pos.board[r][c];
    if (p && whitePiece(p) === pos.white) out.push(...pseudo(pos, r, c));
  }
  return out;
}
const captureScore = (pos: Position, m: Move) => { const q = pos.board[m.to[0]][m.to[1]]; return q ? VALUE[q.toLowerCase()] * 10 - VALUE[(pos.board[m.from[0]][m.from[1]] as string).toLowerCase()] : 0; };
/** Negamax with alpha-beta over pseudo-legal moves (king capture = huge score). Score is from the side to move. */
function negamax(pos: Position, depth: number, alpha: number, beta: number): number {
  if (depth === 0) return (pos.white ? 1 : -1) * evaluate(pos.board);
  const moves = pseudoAll(pos).sort((a, b) => captureScore(pos, b) - captureScore(pos, a));
  if (!moves.length) return 0;
  let best = -Infinity;
  for (const m of moves) {
    const q = pos.board[m.to[0]][m.to[1]];
    const score = q && q.toLowerCase() === 'k' ? 100000 + depth : -negamax(apply(pos, m), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
export const LEVELS = [
  { id: 1, label: 'Beginner', depth: 0 },
  { id: 2, label: 'Easy', depth: 1 },
  { id: 3, label: 'Medium', depth: 2 },
  { id: 4, label: 'Hard', depth: 3 },
] as const;
function chooseMove(pos: Position, level: number): Move | null {
  const moves = allLegal(pos);
  if (!moves.length) return null;
  const depth = LEVELS.find((l) => l.id === level)?.depth ?? 1;
  if (depth === 0) return moves[Math.floor(Math.random() * moves.length)];
  let best: Move[] = [], bestScore = -Infinity;
  for (const m of moves) {
    const q = pos.board[m.to[0]][m.to[1]];
    const next = apply(pos, m);
    const score = q && q.toLowerCase() === 'k' ? 100000 : -negamax(next, depth - 1, -Infinity, Infinity);
    if (score > bestScore + 0.001) { bestScore = score; best = [m]; } else if (Math.abs(score - bestScore) <= 0.001) best.push(m);
  }
  return best[Math.floor(Math.random() * best.length)];
}

export default function ChessGame(){
  const [pos,setPos]=useState<Position>(initial);
  const [past,setPast]=useState<Position[]>([]);
  const [selected,setSelected]=useState<[number,number]|null>(null);
  const [vsComputer,setVsComputer]=useState(true);
  const [level,setLevel]=useState(2);
  const [thinking,setThinking]=useState(false);
  const [last,setLast]=useState<Move|null>(null);
  const moves=useMemo(()=>selected?legal(pos,...selected):[],[pos,selected]);
  const targets=new Set(moves.map(m=>m.to.join(',')));
  const checked=inCheck(pos.board,pos.white);
  const remaining=useMemo(()=>allLegal(pos),[pos]);
  const ended=remaining.length===0;
  const computerTurn=vsComputer&&!pos.white&&!ended;
  const status=ended?(checked?(pos.white?'Black wins — checkmate':'White wins — checkmate'):'Draw — stalemate'):thinking?'Thinking…':(checked?'Check!':vsComputer?(pos.white?'Your move (White)':'Computer…'):pos.white?'White to move':'Black to move');
  const timer=useRef<number|undefined>(undefined);

  /* computer replies as Black */
  useEffect(()=>{
    if(!computerTurn)return;
    setThinking(true);
    timer.current=window.setTimeout(()=>{
      const m=chooseMove(pos,level);
      setThinking(false);
      if(m){setPast(v=>[...v,pos]);setPos(apply(pos,m));setLast(m);setSelected(null);}
    },260);
    return()=>{window.clearTimeout(timer.current);setThinking(false);};
  },[computerTurn,pos,level]);

  const choose=(r:number,c:number)=>{
    if(ended||computerTurn)return;
    const target=moves.find(m=>m.to[0]===r&&m.to[1]===c);
    if(target){setPast(v=>[...v,pos]);setPos(apply(pos,target));setLast(target);setSelected(null);return;}
    const p=pos.board[r][c];if(p&&whitePiece(p)===pos.white)setSelected([r,c]);else setSelected(null);
  };
  const reset=()=>{window.clearTimeout(timer.current);setPos(initial());setPast([]);setSelected(null);setLast(null);};
  const undo=()=>{
    if(!past.length)return;
    window.clearTimeout(timer.current);
    // against the computer, take back both plies so it is your move again
    const steps=vsComputer&&past.length>=2&&pos.white?2:1;
    setPos(past[past.length-steps]);setPast(v=>v.slice(0,-steps));setSelected(null);setLast(null);
  };
  const setMode=(vs:boolean)=>{setVsComputer(vs);reset();};
  const lastMove=pos.history[pos.history.length-1];

  return <AppFrame title="Chess" icon="game" actions={<><button className="hbtn" onClick={undo} disabled={!past.length||thinking}>Undo</button><button className="hbtn" onClick={reset}>New</button></>}>
    <div className="appBody" style={{padding:'4px 5px',display:'flex',flexDirection:'column',alignItems:'stretch',gap:4,overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,fontSize:11,lineHeight:1.1}}>
        <b style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{status}</b>
        <span className="tiny" style={{whiteSpace:'nowrap'}}>{lastMove?`${pos.history.length}. ${lastMove}`:'0 moves'}</span>
      </div>
      <div style={{flex:'1 1 0',minHeight:0,display:'grid',placeItems:'center'}}>
        <div style={{height:'100%',maxWidth:'100%',aspectRatio:'1',containerType:'inline-size',display:'grid',gridTemplateColumns:'repeat(8,minmax(0,1fr))',gridTemplateRows:'repeat(8,minmax(0,1fr))',border:'2px solid #8d7957',borderRadius:5,overflow:'hidden',boxShadow:'0 5px 15px #0007',boxSizing:'border-box'}}>
          {pos.board.map((row,r)=>row.map((piece,c)=>{
            const light=(r+c)%2===0,chosen=selected?.[0]===r&&selected?.[1]===c,possible=targets.has(`${r},${c}`);
            const wasLast=!!last&&((last.from[0]===r&&last.from[1]===c)||(last.to[0]===r&&last.to[1]===c));
            const kingInCheck=checked&&piece===(pos.white?'K':'k');
            return <button key={r+'-'+c} onClick={()=>choose(r,c)} aria-label={`${String.fromCharCode(97+c)}${8-r} ${piece||'empty'}`} style={{minWidth:0,minHeight:0,padding:0,border:0,position:'relative',display:'grid',placeItems:'center',background:kingInCheck?'#c85a4a':chosen?'#d4a94d':wasLast?(light?'#e4d58f':'#a9b36a'):light?'#e8dfc9':'#788b76',color:piece&&whitePiece(piece)?'#fff':'#17191c',textShadow:piece&&whitePiece(piece)?'0 1px 3px #222, 0 0 2px #222':'0 1px 1px #fff8',fontSize:'10.5cqw',lineHeight:1}}>
              {piece&&GLYPHS[piece]}{possible&&<i style={{position:'absolute',width:piece?'85%':'24%',height:piece?'85%':'24%',borderRadius:'50%',border:'3px solid #e1aa36',background:piece?'transparent':'#e1aa3670'}}/>}
            </button>;
          }))}
        </div>
      </div>
      <div style={{display:'flex',gap:3,alignItems:'center',flexWrap:'wrap'}}>
        <button className={`chip ${!vsComputer?'on':''}`} onClick={()=>setMode(false)}>2 Players</button>
        <button className={`chip ${vsComputer?'on':''}`} onClick={()=>setMode(true)}>vs Computer</button>
        {vsComputer&&<>
          <span className="tiny">Level</span>
          {LEVELS.map(l=><button key={l.id} className={`chip ${level===l.id?'on':''}`} onClick={()=>setLevel(l.id)} title={l.label} style={{padding:'1px 5px'}}>{l.id}</button>)}
          <span className="tiny">{LEVELS.find(l=>l.id===level)?.label}</span>
        </>}
      </div>
    </div>
  </AppFrame>;
}
