'use client';
import React,{useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {BottomNav} from '@/components/ui/BottomNav';
import {InstallPrompt} from '@/components/pwa/InstallPrompt';
import {Message,Session} from '@/types';

export default function SiswaProgressPage(){
  const router=useRouter(); const [messages,setMessages]=useState<Message[]>([]); const [session,setSession]=useState<Session|null>(null); const [student,setStudent]=useState<any>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{const token=localStorage.getItem('siswa_token'); const ss=localStorage.getItem('siswa_data'); const se=localStorage.getItem('siswa_session'); if(!token||!ss){router.push('/siswa/login');return;} setStudent(JSON.parse(ss)); if(se)setSession(JSON.parse(se)); fetch('/api/chat/history',{headers:{Authorization:'Bearer '+token}}).then(r=>r.ok?r.json():null).then(d=>d&&setMessages(d.messages||[])).finally(()=>setLoading(false));},[router]);
  const user=messages.filter(m=>m.role==='user');
  const valid=user.filter(m=>m.classificationProvenance==='model'&&(m.questionLevel==='hafalan'||m.questionLevel==='pemahaman'||m.questionLevel==='analisis'));
  const counts={hafalan:valid.filter(m=>m.questionLevel==='hafalan').length,pemahaman:valid.filter(m=>m.questionLevel==='pemahaman').length,analisis:valid.filter(m=>m.questionLevel==='analisis').length};
  const unknown=user.length-valid.length; const total=valid.length;
  const pct=(n:number)=>total?Math.round(n/total*100):0;
  if(loading)return <div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{width:32,height:32}}/></div>;
  return <div className="min-h-screen has-bottom-nav pb-16" style={{background:'var(--bg-base)'}}>
    <header className="page-header"><h1 className="font-bold text-base">📊 Pola Pertanyaan Saya</h1></header>
    <main className="page-container mt-6 flex flex-col gap-6">
      <div className="card-elevated"><h2 className="font-bold text-base">{student?.displayName}</h2><p className="text-xs text-muted">{session?.title||'Sesi Kelas'}</p><div className="divider"/><p className="text-xs text-secondary">Pesan terpakai: <strong>{user.length} / {session?.quotaPerStudent||20}</strong></p></div>
      <div className="card">
        <h3 className="font-bold text-sm mb-1">Distribusi bentuk pertanyaan</h3>
        <p className="text-xs text-muted mb-4">Persentase hanya memakai klasifikasi valid dari model. Ini bukan nilai kemampuan atau progres belajar.</p>
        {[
          ['hafalan','📖 Pertanyaan fakta',counts.hafalan,'var(--level-hafalan)'],
          ['pemahaman','💡 Pertanyaan penjelasan',counts.pemahaman,'var(--level-pemahaman)'],
          ['analisis','🧠 Penerapan / penalaran',counts.analisis,'var(--level-analisis)'],
        ].map(([key,label,count,color])=><div key={String(key)} className="mb-4"><div className="flex justify-between text-xs font-semibold mb-1"><span style={{color:String(color)}}>{String(label)}</span><span>{Number(count)} ({pct(Number(count))}%)</span></div><div className="quota-track"><div style={{width:String(pct(Number(count)))+'%',height:'100%',backgroundColor:String(color),borderRadius:2}}/></div></div>)}
        <div className="divider"/><p className="text-xs text-secondary">Belum terklasifikasi / provenance tidak valid: <strong>{unknown}</strong></p>
      </div>
      <div className="card"><h3 className="font-bold text-sm mb-1">Cara membaca</h3><p className="text-xs text-secondary leading-relaxed">Grafik ini hanya menunjukkan <strong>jenis pertanyaan yang kamu ajukan</strong>. Banyak pertanyaan penerapan tidak otomatis membuktikan kemampuan analisis, dan banyak pertanyaan fakta tidak berarti kamu “terjebak” pada hafalan.</p></div>
    </main><InstallPrompt variant="siswa"/><BottomNav/>
  </div>;
}
