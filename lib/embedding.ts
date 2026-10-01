function dot(a:number[],b:number[]):number{if(a.length!==b.length) throw new Error(`Embedding dimension mismatch: ${a.length} !== ${b.length}`); return a.reduce((s,v,i)=>s+v*b[i],0);}
function norm(v:number[]):number{return Math.sqrt(v.reduce((s,x)=>s+x*x,0));}
export function cosineSimilarity(a:number[],b:number[]):number{if(a.length!==b.length) throw new Error(`Embedding dimension mismatch: ${a.length} !== ${b.length}`); const na=norm(a),nb=norm(b); if(!na||!nb)return 0; return dot(a,b)/(na*nb);}
export interface ScoredChunk{chunkText:string;score:number;chunkIndex:number;}
export function findTopChunks(queryEmbedding:number[],chunks:Array<{chunkText:string;embedding:number[];chunkIndex:number}>,topK=3,minScore=0.1):ScoredChunk[]{return chunks.map(c=>({chunkText:c.chunkText,score:cosineSimilarity(queryEmbedding,c.embedding),chunkIndex:c.chunkIndex})).filter(c=>c.score>=minScore).sort((a,b)=>b.score-a.score).slice(0,topK);}
