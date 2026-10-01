import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

export interface LLMMessage { role:'system'|'user'|'assistant'; content:string; }
export type ModelProvenance = 'model'|'demo'|'unavailable';
export interface ChatResult { text:string; degraded:boolean; provenance:ModelProvenance; }
export interface EmbeddingResult { values:number[]; provider:string; model:string; dimensions:number; provenance:'model'|'demo'; }
export interface EmbeddingBatchResult { vectors:number[][]; provider:string; model:string; dimensions:number; provenance:'model'|'demo'; }
export interface ChatOptions { temperature?:number; maxTokens?:number; }
export interface LLMService {
  chatWithMeta(messages:LLMMessage[],options?:ChatOptions):Promise<ChatResult>;
  chat(messages:LLMMessage[],options?:ChatOptions):Promise<string>;
  embedWithMeta(text:string):Promise<EmbeddingResult>;
  embedBatchWithMeta(texts:string[]):Promise<EmbeddingBatchResult>;
  embed(text:string):Promise<number[]>;
  embedBatch(texts:string[]):Promise<number[][]>;
}
const UNAVAILABLE_TEXT='Maaf, layanan AI sedang tidak tersedia. Coba lagi nanti atau minta bantuan gurumu.';
const demoModeEnabled=()=>process.env.PAMONG_DEMO_MODE==='true';
const dimensions=(vectors:number[][])=>{
  const d=vectors[0]?.length??0;
  if(!d||vectors.some(v=>v.length!==d)) throw new Error('Embedding provider returned inconsistent dimensions.');
  return d;
};

abstract class BaseLLMService {
  protected mockEmbed(text:string):number[] {
    const vec=new Array(64).fill(0); const words=text.toLowerCase().split(/\s+/);
    for(let i=0;i<words.length;i++) for(let j=0;j<words[i].length;j++) vec[(words[i].charCodeAt(j)*(j+1)+i)%64]+=1;
    const mag=Math.sqrt(vec.reduce((s,v)=>s+v*v,0))||1; return vec.map(v=>v/mag);
  }
  protected mockChat(messages:LLMMessage[]):string {
    const last=messages[messages.length-1]?.content||''; const lower=last.toLowerCase();
    const sys=messages.find(m=>m.role==='system')?.content||'';
    if(sys.includes('pengklasifikasi bentuk pertanyaan')){
      if(lower.includes('analisis')||lower.includes('jika')||lower.includes('dampak')||lower.includes('evaluasi')||lower.includes('bandingkan')) return 'analisis';
      if(lower.includes('mengapa')||lower.includes('kenapa')||lower.includes('bagaimana proses')||lower.includes('jelaskan')) return 'pemahaman';
      return 'hafalan';
    }
    return '[MODE DEMO] Contoh antarmuka: layanan model tidak aktif. Balasan ini bukan jawaban dari modul guru dan tidak boleh dipakai sebagai materi belajar.';
  }
  protected demoEmbedding(text:string):EmbeddingResult {
    const values=this.mockEmbed(text); return {values,provider:'demo',model:'heuristic-64-v1',dimensions:values.length,provenance:'demo'};
  }
  protected demoBatch(texts:string[]):EmbeddingBatchResult {
    const vectors=texts.map(t=>this.mockEmbed(t)); return {vectors,provider:'demo',model:'heuristic-64-v1',dimensions:dimensions(vectors),provenance:'demo'};
  }
}

export class GeminiLLMService extends BaseLLMService implements LLMService {
  private ai:GoogleGenAI; private model:string; private embeddingModel:string; private apiKey:string;
  constructor(apiKey?:string){
    super(); this.apiKey=apiKey||process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||'';
    this.ai=new GoogleGenAI({apiKey:this.apiKey||'dummy-key-for-build'});
    this.model=process.env.GEMINI_MODEL||'gemini-3.7-flash';
    this.embeddingModel=process.env.GEMINI_EMBEDDING_MODEL||'gemini-embedding-001';
  }
  private hasValidKey(){return Boolean(this.apiKey&&this.apiKey.trim()&&!this.apiKey.startsWith('sk-...')&&!this.apiKey.startsWith('YOUR_')&&this.apiKey!=='dummy-key-for-build');}
  async chat(messages:LLMMessage[],options:ChatOptions={}){return (await this.chatWithMeta(messages,options)).text;}
  async chatWithMeta(messages:LLMMessage[],options:ChatOptions={}):Promise<ChatResult>{
    if(!this.hasValidKey()) return demoModeEnabled()?{text:this.mockChat(messages),degraded:true,provenance:'demo'}:{text:UNAVAILABLE_TEXT,degraded:true,provenance:'unavailable'};
    try{
      const system=messages.find(m=>m.role==='system'); const contents=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
      const response=await this.ai.models.generateContent({model:this.model,contents:contents.length?contents:[{role:'user',parts:[{text:'Halo'}]}],config:{systemInstruction:system?.content,temperature:options.temperature??0.3,maxOutputTokens:options.maxTokens??1000}});
      const text=response.text?.trim(); if(!text) throw new Error('empty'); return {text,degraded:false,provenance:'model'};
    }catch{console.warn('[Gemini LLM] Provider call failed.'); return demoModeEnabled()?{text:this.mockChat(messages),degraded:true,provenance:'demo'}:{text:UNAVAILABLE_TEXT,degraded:true,provenance:'unavailable'};}
  }
  async embed(text:string){return (await this.embedWithMeta(text)).values;}
  async embedBatch(texts:string[]){return (await this.embedBatchWithMeta(texts)).vectors;}
  async embedWithMeta(text:string):Promise<EmbeddingResult>{
    if(!this.hasValidKey()){if(demoModeEnabled()) return this.demoEmbedding(text); throw new Error('Embedding provider unavailable.');}
    try{const r=await this.ai.models.embedContent({model:this.embeddingModel,contents:text.slice(0,8000)}); const values=r.embeddings?.[0]?.values; if(!values?.length) throw new Error('empty'); return {values,provider:'gemini',model:this.embeddingModel,dimensions:values.length,provenance:'model'};}
    catch{console.warn('[Gemini Embedding] Provider call failed.'); if(demoModeEnabled()) return this.demoEmbedding(text); throw new Error('Embedding provider unavailable.');}
  }
  async embedBatchWithMeta(texts:string[]):Promise<EmbeddingBatchResult>{
    if(!this.hasValidKey()){if(demoModeEnabled()) return this.demoBatch(texts); throw new Error('Embedding provider unavailable.');}
    try{const vectors:number[][]=[]; for(let i=0;i<texts.length;i+=50){const batch=texts.slice(i,i+50).map(t=>t.slice(0,8000)); const r=await this.ai.models.embedContent({model:this.embeddingModel,contents:batch}); const v=(r.embeddings??[]).map(e=>e.values??[]); if(v.length!==batch.length||v.some(x=>!x.length)) throw new Error('incomplete'); vectors.push(...v);} return {vectors,provider:'gemini',model:this.embeddingModel,dimensions:dimensions(vectors),provenance:'model'};}
    catch{console.warn('[Gemini Embedding] Batch provider call failed.'); if(demoModeEnabled()) return this.demoBatch(texts); throw new Error('Embedding provider unavailable.');}
  }
}

export class OpenAILLMService extends BaseLLMService implements LLMService {
  private client:OpenAI; private model:string; private embeddingModel:string; private apiKey:string;
  constructor(client?:OpenAI){super(); this.apiKey=process.env.OPENAI_API_KEY||''; this.client=client??new OpenAI({apiKey:this.apiKey||'dummy-key-for-build',baseURL:process.env.OPENAI_BASE_URL??'https://api.openai.com/v1'}); this.model=process.env.OPENAI_MODEL??'gpt-4o-mini'; this.embeddingModel=process.env.OPENAI_EMBEDDING_MODEL??'text-embedding-3-small';}
  private hasValidKey(){return Boolean(this.apiKey&&this.apiKey.trim()&&!this.apiKey.startsWith('sk-...'));}
  async chat(messages:LLMMessage[],options:ChatOptions={}){return (await this.chatWithMeta(messages,options)).text;}
  async chatWithMeta(messages:LLMMessage[],options:ChatOptions={}):Promise<ChatResult>{
    if(!this.hasValidKey()) return demoModeEnabled()?{text:this.mockChat(messages),degraded:true,provenance:'demo'}:{text:UNAVAILABLE_TEXT,degraded:true,provenance:'unavailable'};
    try{const r=await this.client.chat.completions.create({model:this.model,messages,temperature:options.temperature??0.3,max_tokens:options.maxTokens??1000}); const text=r.choices[0]?.message?.content?.trim(); if(!text) throw new Error('empty'); return {text,degraded:false,provenance:'model'};}
    catch{console.warn('[OpenAI LLM] Provider call failed.'); return demoModeEnabled()?{text:this.mockChat(messages),degraded:true,provenance:'demo'}:{text:UNAVAILABLE_TEXT,degraded:true,provenance:'unavailable'};}
  }
  async embed(text:string){return (await this.embedWithMeta(text)).values;}
  async embedBatch(texts:string[]){return (await this.embedBatchWithMeta(texts)).vectors;}
  async embedWithMeta(text:string):Promise<EmbeddingResult>{
    if(!this.hasValidKey()){if(demoModeEnabled()) return this.demoEmbedding(text); throw new Error('Embedding provider unavailable.');}
    try{const r=await this.client.embeddings.create({model:this.embeddingModel,input:text.slice(0,8000)}); const values=r.data[0]?.embedding; if(!values?.length) throw new Error('empty'); return {values,provider:'openai',model:this.embeddingModel,dimensions:values.length,provenance:'model'};}
    catch{console.warn('[OpenAI Embedding] Provider call failed.'); if(demoModeEnabled()) return this.demoEmbedding(text); throw new Error('Embedding provider unavailable.');}
  }
  async embedBatchWithMeta(texts:string[]):Promise<EmbeddingBatchResult>{
    if(!this.hasValidKey()){if(demoModeEnabled()) return this.demoBatch(texts); throw new Error('Embedding provider unavailable.');}
    try{const vectors:number[][]=[]; for(let i=0;i<texts.length;i+=100){const batch=texts.slice(i,i+100).map(t=>t.slice(0,8000)); const r=await this.client.embeddings.create({model:this.embeddingModel,input:batch}); vectors.push(...r.data.map(d=>d.embedding));} return {vectors,provider:'openai',model:this.embeddingModel,dimensions:dimensions(vectors),provenance:'model'};}
    catch{console.warn('[OpenAI Embedding] Batch provider call failed.'); if(demoModeEnabled()) return this.demoBatch(texts); throw new Error('Embedding provider unavailable.');}
  }
}
let _llmService:LLMService|null=null;
export function getLLMService():LLMService{
  if(!_llmService){const g=Boolean(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY); const o=Boolean(process.env.OPENAI_API_KEY&&!process.env.OPENAI_API_KEY.startsWith('sk-...')); _llmService=o&&!g?new OpenAILLMService():new GeminiLLMService();}
  return _llmService;
}
export function setLLMService(service:LLMService){_llmService=service;}
