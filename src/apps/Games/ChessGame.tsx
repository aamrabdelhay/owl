import React, { useMemo, useState } from 'react';
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
export default function ChessGame(){
  const [pos,setPos]=useState<Position>(initial);
  const [past,setPast]=useState<Position[]>([]);
  const [selected,setSelected]=useState<[number,number]|null>(null);
  const moves=useMemo(()=>selected?legal(pos,...selected):[],[pos,selected]);
  const targets=new Set(moves.map(m=>m.to.join(',')));
  const checked=inCheck(pos.board,pos.white);
  const remaining=useMemo(()=>allLegal(pos),[pos]);
  const ended=remaining.length===0;
  const status=ended?(checked?(pos.white?'Black wins by checkmate':'White wins by checkmate'):'Draw by stalemate'):(checked?'Check!':pos.white?'White to move':'Black to move');
  const choose=(r:number,c:number)=>{
    const target=moves.find(m=>m.to[0]===r&&m.to[1]===c);
    if(target){setPast(v=>[...v,pos]);setPos(apply(pos,target));setSelected(null);return;}
    const p=pos.board[r][c];if(p&&whitePiece(p)===pos.white)setSelected([r,c]);else setSelected(null);
  };
  const reset=()=>{setPos(initial());setPast([]);setSelected(null);};
  const undo=()=>{if(!past.length)return;setPos(past[past.length-1]);setPast(v=>v.slice(0,-1));setSelected(null);};
  return <AppFrame title="Chess" icon="game" actions={<><button className="hbtn" onClick={undo} disabled={!past.length}>Undo</button><button className="hbtn" onClick={reset}>New</button></>}>
    <div className="appBody" style={{padding:7,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
      <div className="card" style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px'}}>
        <b style={{fontSize:11}}>{status}</b><span className="tiny">{pos.history.length} moves</span>
      </div>
      <div style={{width:'min(100%, 310px)',display:'grid',gridTemplateColumns:'repeat(8,1fr)',border:'2px solid #8d7957',borderRadius:5,overflow:'hidden',boxShadow:'0 5px 15px #0007'}}>
        {pos.board.map((row,r)=>row.map((piece,c)=>{
          const light=(r+c)%2===0,chosen=selected?.[0]===r&&selected?.[1]===c,possible=targets.has(`${r},${c}`);
          return <button key={r+'-'+c} onClick={()=>choose(r,c)} aria-label={`${String.fromCharCode(97+c)}${8-r} ${piece||'empty'}`} style={{aspectRatio:'1',minWidth:0,padding:0,border:0,position:'relative',display:'grid',placeItems:'center',background:chosen?'#d4a94d':light?'#e8dfc9':'#788b76',color:piece&&whitePiece(piece)?'#fff':'#17191c',textShadow:piece&&whitePiece(piece)?'0 1px 3px #222, 0 0 2px #222':'0 1px 1px #fff8',fontSize:'clamp(19px,6vw,34px)',lineHeight:1}}>
            {piece&&GLYPHS[piece]}{possible&&<i style={{position:'absolute',width:piece?'85%':'24%',height:piece?'85%':'24%',borderRadius:'50%',border:'3px solid #e1aa36',background:piece?'transparent':'#e1aa3670'}}/>}
          </button>;
        }))}
      </div>
      <div className="card" style={{width:'100%',padding:6}}>
        <div className="fieldLabel">Move history</div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',fontSize:9,maxHeight:42,overflow:'auto'}}>{pos.history.slice(-12).map((m,i)=><span key={i} className="chip">{pos.history.length- Math.min(12,pos.history.length)+i+1}. {m}</span>)}</div>
      </div>
      <div className="tiny">Local two-player chess · legal moves · castling · en passant · automatic queen promotion.</div>
    </div>
  </AppFrame>;
}
