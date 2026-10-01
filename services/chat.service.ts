import { getLLMService, LLMService } from './llm.service';
import { getRAGService, RAGService } from './rag.service';
import { getClassifierService, ClassifierService } from './classifier.service';
import { messageQueries } from '@/db/queries/messages';
import { studentQueries } from '@/db/queries/students';
import { sessionQueries } from '@/db/queries/sessions';
import { ChatResponse, Message, QuestionCategory } from '@/types';
import { FIXED_RETRIEVAL_REPLIES, QUESTION_CATEGORY_RUBRIC, belongsToConversation, hasQuota, summarizeQuestionDistribution } from '@/lib/mvp-policy';
import aiThemes from '@/config/ai-themes.json';

const RAG_SYSTEM_PROMPT=`Kamu adalah asisten AI bernama {AI_FULL_NAME} untuk mata pelajaran {SUBJECT}.
KONTEKS MATERI RESMI GURU:
---
{CONTEXT}
---
Jawab HANYA berdasarkan konteks. Jika konteks tidak cukup, katakan bahwa bagian modul yang ditemukan belum cukup mendukung jawaban dan sarankan bertanya ke guru.
BENTUK PERTANYAAN: {QUESTION_CATEGORY_LABEL}
Label ini hanya mendeskripsikan bentuk pertanyaan, bukan kemampuan atau capaian belajar siswa.
{QUESTION_STYLE_INSTRUCTION}
Gunakan bahasa Indonesia yang ramah, ringkas, dan terstruktur.`;

function style(category:QuestionCategory){
  if(category==='hafalan') return {label:QUESTION_CATEGORY_RUBRIC.hafalan.label,instruction:'Jawab langsung dan ringkas; tambahkan satu contoh hanya bila didukung konteks.'};
  if(category==='pemahaman') return {label:QUESTION_CATEGORY_RUBRIC.pemahaman.label,instruction:'Jelaskan proses, hubungan, atau sebab-akibat secara terstruktur.'};
  if(category==='analisis') return {label:QUESTION_CATEGORY_RUBRIC.analisis.label,instruction:'Tunjukkan penerapan atau langkah penalaran yang didukung materi tanpa menilai kemampuan siswa.'};
  return {label:'Belum terklasifikasi',instruction:'Gunakan gaya penjelasan umum yang jelas dan jangan menebak kategori.'};
}
export interface ChatInput{studentId:string;sessionId:string;message:string;}
export class ChatService{
  constructor(private llm:LLMService=getLLMService(),private rag:RAGService=getRAGService(),private classifier:ClassifierService=getClassifierService()){}
  async chat(input:ChatInput):Promise<ChatResponse>{
    const {studentId,sessionId,message}=input; const session=await sessionQueries.getById(sessionId); if(!session)throw new Error('Sesi tidak ditemukan.');
    const used=(await studentQueries.getMessageCount(studentId))?.count??0;
    if(!hasQuota(used,session.quotaPerStudent)) return {reply:`Kamu sudah menggunakan ${used} dari ${session.quotaPerStudent} pesan untuk sesi ini. Terima kasih sudah belajar bersama! 🎉`,questionLevel:'unclassified',classificationProvenance:'not_run',quotaRemaining:0,sources:[],degraded:false,aiProvenance:'application'};
    const theme=(aiThemes as Record<string,typeof aiThemes.umum>)[session.aiTheme]??aiThemes.umum;
    const [retrieval,classification]=await Promise.all([this.rag.retrieve(sessionId,message),this.classifier.classify(message)]);
    const student=await studentQueries.getById(studentId); if(!student||student.sessionId!==sessionId)throw new Error('Siswa tidak sesuai dengan sesi.');
    let reply:string; let aiProvenance:ChatResponse['aiProvenance']; let sources:string[]=[];
    if(retrieval.status!=='ok'){reply=FIXED_RETRIEVAL_REPLIES[retrieval.status]; aiProvenance='application';}
    else{
      const q=style(classification.questionCategory);
      const system=RAG_SYSTEM_PROMPT.replace('{AI_FULL_NAME}',theme.fullName).replace('{SUBJECT}',session.subject).replace('{CONTEXT}',retrieval.contextText).replace('{QUESTION_CATEGORY_LABEL}',q.label).replace('{QUESTION_STYLE_INSTRUCTION}',q.instruction);
      let history:Message[]=student.roomCode?await messageQueries.getByRoom(sessionId,student.roomCode):await messageQueries.getBySoloStudent(studentId);
      const safe=history.filter(m=>belongsToConversation(m,{sessionId,studentId,roomCode:student.roomCode??null})).slice(-6).map(m=>({role:m.role as 'user'|'assistant',content:m.content}));
      const generated=await this.llm.chatWithMeta([{role:'system',content:system},...safe,{role:'user',content:message}],{temperature:.4,maxTokens:800});
      reply=generated.text; aiProvenance=generated.provenance; sources=retrieval.sources;
    }
    const now=Date.now();
    await messageQueries.insert({id:crypto.randomUUID(),sessionId,studentId,roomCode:student.roomCode??null,role:'user',content:message,questionLevel:classification.questionCategory,classificationProvenance:classification.provenance,createdAt:now});
    await messageQueries.insert({id:crypto.randomUUID(),sessionId,studentId,roomCode:student.roomCode??null,role:'assistant',content:reply,questionLevel:null,classificationProvenance:null,createdAt:now+1});
    return {reply,questionLevel:classification.questionCategory,classificationProvenance:classification.provenance,quotaRemaining:Math.max(0,session.quotaPerStudent-used-1),sources,degraded:aiProvenance==='demo'||aiProvenance==='unavailable',aiProvenance};
  }
  async computeStudentStats(sessionId:string){
    const studentsData=await studentQueries.getBySession(sessionId); const session=await sessionQueries.getById(sessionId); if(!session)return[];
    return Promise.all(studentsData.map(async student=>{const chatUsed=(await studentQueries.getMessageCount(student.id))?.count??0; const d=summarizeQuestionDistribution(await studentQueries.getLevelDistribution(student.id)); return {id:student.id,username:student.username,displayName:student.displayName,chatUsed,quotaTotal:session.quotaPerStudent,categories:d.categories,unclassified:d.unclassified,validClassified:d.validClassified,totalQuestions:d.totalQuestions};}));
  }
}
let _chatService:ChatService|null=null;
export function getChatService():ChatService{if(!_chatService)_chatService=new ChatService();return _chatService;}
