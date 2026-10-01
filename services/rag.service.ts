import { getLLMService, LLMService, EmbeddingResult } from './llm.service';
import { findTopChunks, ScoredChunk } from '@/lib/embedding';
import { extractTextFromFile } from '@/lib/pdf-parser';
import { chunkQueries } from '@/db/queries/messages';
import { embeddingIdentityCompatible } from '@/lib/mvp-policy';

const CHUNK_SIZE=500, CHUNK_OVERLAP=50;
export type RetrievalStatus='ok'|'empty_material'|'irrelevant'|'provider_error'|'incompatible_embeddings';
export interface RetrievalResult{status:RetrievalStatus;contextText:string;sources:string[];}
function minScore(){const n=Number(process.env.RAG_MIN_SCORE??'0.10'); return Number.isFinite(n)&&n>=-1&&n<=1?n:0.10;}

export class RAGService{
  constructor(private llm:LLMService=getLLMService()){}
  async processDocument(sessionId:string,file:Buffer,filename:string):Promise<number>{
    const raw=await extractTextFromFile(file,filename); if(!raw.trim()) throw new Error('Dokumen kosong atau tidak dapat dibaca.');
    const chunks=this.chunkText(raw); if(!chunks.length) throw new Error('Tidak ada konten yang dapat diekstrak.');
    const batch=await this.llm.embedBatchWithMeta(chunks); if(batch.vectors.length!==chunks.length) throw new Error('Jumlah embedding tidak sesuai jumlah potongan materi.');
    await chunkQueries.deleteBySession(sessionId);
    await chunkQueries.insertMany(chunks.map((chunk,i)=>({id:crypto.randomUUID(),sessionId,chunkText:chunk,embeddingJson:JSON.stringify(batch.vectors[i]),chunkIndex:i,embeddingProvider:batch.provider,embeddingModel:batch.model,embeddingDimensions:batch.dimensions})));
    return chunks.length;
  }
  async retrieve(sessionId:string,query:string,topK=3):Promise<RetrievalResult>{
    const dbChunks=await chunkQueries.getBySession(sessionId);
    if(!dbChunks.length) return {status:'empty_material',contextText:'',sources:[]};
    const first=dbChunks[0];
    if(!first.embeddingProvider||!first.embeddingModel||!first.embeddingDimensions||dbChunks.some(c=>c.embeddingProvider!==first.embeddingProvider||c.embeddingModel!==first.embeddingModel||c.embeddingDimensions!==first.embeddingDimensions)) return {status:'incompatible_embeddings',contextText:'',sources:[]};
    let q: EmbeddingResult; try{q=await this.llm.embedWithMeta(query);}catch{return {status:'provider_error',contextText:'',sources:[]};}
    if(!embeddingIdentityCompatible(q,{provider:first.embeddingProvider,model:first.embeddingModel,dimensions:first.embeddingDimensions})) return {status:'incompatible_embeddings',contextText:'',sources:[]};
    let chunks: Array<{chunkText:string;embedding:number[];chunkIndex:number}>; try{chunks=dbChunks.map(c=>{const e=JSON.parse(c.embeddingJson) as number[]; if(!Array.isArray(e)||e.length!==first.embeddingDimensions) throw new Error('bad'); return {chunkText:c.chunkText,embedding:e,chunkIndex:c.chunkIndex};});}catch{return {status:'incompatible_embeddings',contextText:'',sources:[]};}
    let top: ScoredChunk[]; try{top=findTopChunks(q.values,chunks,topK,minScore());}catch{return {status:'incompatible_embeddings',contextText:'',sources:[]};}
    if(!top.length) return {status:'irrelevant',contextText:'',sources:[]};
    const ordered=top.sort((a,b)=>a.chunkIndex-b.chunkIndex);
    return {status:'ok',contextText:ordered.map(c=>c.chunkText).join('\n\n---\n\n'),sources:ordered.map((c,i)=>`[${i+1}] Bagian ${c.chunkIndex+1} dokumen (relevansi: ${(c.score*100).toFixed(0)}%)`)};
  }
  private chunkText(text:string):string[]{const n=text.replace(/\s+/g,' ').trim(); if(!n)return[]; const out:string[]=[]; const step=Math.max(1,CHUNK_SIZE-CHUNK_OVERLAP); for(let start=0;start<n.length;start+=step){const end=Math.min(start+CHUNK_SIZE,n.length); const c=n.slice(start,end).trim(); if(c.length>20)out.push(c); if(end>=n.length)break;} return out;}
}
let _ragService:RAGService|null=null;
export function getRAGService():RAGService{if(!_ragService)_ragService=new RAGService();return _ragService;}
