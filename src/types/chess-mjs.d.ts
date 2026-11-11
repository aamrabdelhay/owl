declare module 'chess.mjs' {
  export type Square = string;
  export type Color = 'w' | 'b';
  export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

  export interface Piece {
    color: Color;
    type: PieceSymbol;
    square?: Square;
  }

  export interface Move {
    color: Color;
    from: Square;
    to: Square;
    piece: PieceSymbol;
    captured?: PieceSymbol;
    promotion?: PieceSymbol;
    flags: string;
    san: string;
  }

  export interface ChessInstance {
    fen(): string;
    turn(): Color;
    board(): (Piece | null)[][];
    get(square: Square): Piece | null;
    moves(options?: { square?: Square; verbose?: boolean }): string[] | Move[];
    move(move: string | { from: Square; to: Square; promotion?: PieceSymbol }): Move | null;
    undo(): Move | null;
    history(options?: { verbose?: boolean }): string[] | Move[];
    isCheck(): boolean;
    isCheckmate(): boolean;
    isStalemate(): boolean;
    isDraw(): boolean;
    isGameOver(): boolean;
  }

  export const Chess: {
    new(fen?: string | null, options?: { chess960?: boolean }): ChessInstance;
    (fen?: string | null, options?: { chess960?: boolean }): ChessInstance;
  };
}
