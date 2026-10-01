import { getLLMService, LLMService } from './llm.service';
import { findTopChunks } from '@/lib/embedding';
import { extractTextFromFile } from '@/lib/pdf-parser';
import { chunkQueries } from '@/db/queries/messages';
import { retrieveFromStoredChunks } from '@/lib/mvp-policy';

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
    return await retrieveFromStoredChunks({
      dbChunks,
      query,
      embedQuery:(text:string)=>this.llm.embedWithMeta(text),
      rankChunks:findTopChunks,
      topK,
      minScore:minScore(),
    }) as RetrievalResult;
  }
  private chunkText(text:string):string[]{const n=text.replace(/\s+/g,' ').trim(); if(!n)return[]; const out:string[]=[]; const step=Math.max(1,CHUNK_SIZE-CHUNK_OVERLAP); for(let start=0;start<n.length;start+=step){const end=Math.min(start+CHUNK_SIZE,n.length); const c=n.slice(start,end).trim(); if(c.length>20)out.push(c); if(end>=n.length)break;} return out;}
}
let _ragService:RAGService|null=null;
export function getRAGService():RAGService{if(!_ragService)_ragService=new RAGService();return _ragService;}
