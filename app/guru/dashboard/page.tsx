'use client';
import React,{Suspense,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {Session,StudentStats} from '@/types';
import {StudentTable} from '@/components/guru/StudentTable';
import {OnboardingTour} from '@/components/guru/OnboardingTour';

function DashboardContent(){
 const router=useRouter(); const params=useSearchParams(); const [sessions,setSessions]=useState<Session[]>([]); const [active,setActive]=useState<Session|null>(null); const [stats,setStats]=useState<StudentStats[]>([]); const [loading,setLoading]=useState(true); const [live,setLive]=useState(false); const [tour,setTour]=useState(false);
 useEffect(()=>{const token=localStorage.getItem('guru_token'); if(!token){router.push('/guru/login');return;} fetch('/api/sesi',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json()).then(d=>{const list=d.sessions||[];setSessions(list);const wanted=params.get('sesiId');setActive(list.find((s:Session)=>s.id===wanted)||list[0]||null);}).finally(()=>setLoading(false));},[router,params]);
 useEffect(()=>{if(!active)return;const token=localStorage.getItem('guru_token');if(!token)return;const es=new EventSource('/api/dashboard/'+active.id+'/stream?token='+encodeURIComponent(token));es.onopen=()=>setLive(true);es.onmessage=e=>{try{setStats(JSON.parse(e.data));}catch{}};es.onerror=()=>setLive(false);return()=>{es.close();setLive(false);};},[active]);
 const activeCount=stats.filter(s=>s.chatUsed>0).length; const valid=stats.reduce((n,s)=>n+s.validClassified,0); const unknown=stats.reduce((n,s)=>n+s.unclassified,0);
 if(loading)return <div className="min-h-screen flex items-center justify-center"><div className="spinner"/></div>;
 return <div className="min-h-screen" style={{background:'var(--bg-base)',paddingBottom:64}}>
  <header className="page-header justify-between"><div><h1 className="font-bold">🦉 Pamong AI</h1><p className="text-xs text-muted">{live?'Live • SSE aktif':'Menghubungkan...'}</p></div><div className="flex gap-2"><button className="btn btn-ghost" onClick={()=>setTour(true)}>❓ Panduan</button><button className="btn btn-primary" onClick={()=>router.push('/guru/sesi/buat')}>+ Sesi Baru</button></div></header>
  <main className="page-container mt-6 flex flex-col gap-6">{sessions.length===0?<div className="card text-center"><h2 className="font-bold">Belum ada sesi kelas</h2><button className="btn btn-primary mt-4" onClick={()=>router.push('/guru/sesi/buat')}>Buat Sesi</button></div>:<>
   <div className="card"><div className="flex flex-wrap gap-2">{sessions.map(s=><button key={s.id} className={'btn '+(s.id===active?.id?'btn-primary':'btn-secondary')} style={{width:'auto'}} onClick={()=>setActive(s)}>{s.title}</button>)}</div></div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16}}>
    <Metric label="Total siswa" value={stats.length} sub={String(activeCount)+' sudah bertanya'}/>
    <Metric label="Klasifikasi model valid" value={valid} sub="Denominator distribusi pertanyaan"/>
    <Metric label="Belum terklasifikasi" value={unknown} sub="Error, degraded, legacy, atau synthetic"/>
    <Metric label="Kuota per siswa" value={active?.quotaPerStudent||0} sub="Pesan pengguna maksimum"/>
   </div>
   <div><h2 className="font-bold">Distribusi bentuk pertanyaan</h2><p className="text-xs text-muted mb-3">Ini observasi jenis pertanyaan, bukan diagnosis kemampuan atau progres belajar.</p>{active&&<StudentTable students={stats} quotaTotal={active.quotaPerStudent}/>}</div>
  </>}</main>
  <OnboardingTour isOpen={tour} onClose={()=>setTour(false)}/>
 </div>;
}
function Metric({label,value,sub}:{label:string;value:number;sub:string}){return <div className="card"><div className="text-xs text-secondary">{label}</div><div className="font-mono" style={{fontSize:'2rem',fontWeight:800}}>{value}</div><div className="text-xs text-muted">{sub}</div></div>;}
export default function GuruDashboardPage(){return <Suspense fallback={<div className="spinner"/>}><DashboardContent/></Suspense>;}
