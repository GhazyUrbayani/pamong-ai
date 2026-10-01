'use client';
import React,{useState} from 'react';
import {Message,StudentStats} from '@/types';
import {Badge} from '@/components/ui/Badge';

export function StudentTable({students,quotaTotal}:{students:StudentStats[];quotaTotal:number}){
  type FilterKey = 'all'|'active'|'unknown'|'inactive';
  const filters: Array<{key:FilterKey;label:string}> = [{key:'all',label:'Semua'},{key:'active',label:'Sudah bertanya'},{key:'unknown',label:'Ada belum terklasifikasi'},{key:'inactive',label:'Belum aktif'}];
  const [filter,setFilter]=useState<FilterKey>('all'); const [search,setSearch]=useState(''); const [selected,setSelected]=useState<StudentStats|null>(null); const [messages,setMessages]=useState<Message[]>([]); const [loading,setLoading]=useState(false);
  const filtered=students.filter(s=>{const match=s.displayName.toLowerCase().includes(search.toLowerCase())||s.username.toLowerCase().includes(search.toLowerCase()); if(!match)return false; if(filter==='active')return s.chatUsed>0; if(filter==='unknown')return s.unclassified>0; if(filter==='inactive')return s.chatUsed===0; return true;});
  const open=async(s:StudentStats)=>{setSelected(s);setLoading(true);try{const token=localStorage.getItem('guru_token');const r=await fetch('/api/guru/student-chat/'+s.id,{headers:{Authorization:'Bearer '+token}});if(r.ok)setMessages((await r.json()).messages||[]);}finally{setLoading(false);}};
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap gap-2 items-center">{filters.map(item=><button key={item.key} onClick={()=>setFilter(item.key)} className="btn btn-secondary" style={{width:'auto',minHeight:36}}>{item.label}</button>)}<input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari siswa..." style={{maxWidth:300}}/></div>
    <div className="card" style={{padding:0,overflowX:'auto'}}><table className="student-table"><thead><tr><th>Siswa</th><th>Chat</th><th>Distribusi pertanyaan valid</th><th>Belum terklasifikasi</th><th>Catatan</th></tr></thead><tbody>{filtered.map(s=>{const d=s.validClassified; const p=(n:number)=>d?Math.round(n/d*100):0; return <tr key={s.id} onClick={()=>open(s)} style={{cursor:'pointer'}}>
      <td><strong>{s.displayName}</strong><div className="font-mono text-xs text-muted">{s.username}</div></td>
      <td>{s.chatUsed} / {quotaTotal}</td>
      <td><div className="level-bar" style={{minWidth:180,height:8}}><div className="level-bar-segment hafalan" style={{width:String(p(s.categories.hafalan))+'%'}}/><div className="level-bar-segment pemahaman" style={{width:String(p(s.categories.pemahaman))+'%'}}/><div className="level-bar-segment analisis" style={{width:String(p(s.categories.analisis))+'%'}}/></div><div className="text-xs mt-1">F {p(s.categories.hafalan)}% · P {p(s.categories.pemahaman)}% · R {p(s.categories.analisis)}%</div></td>
      <td>{s.unclassified}</td><td className="text-xs text-secondary">{d?'Distribusi dari '+d+' klasifikasi model valid.':'Belum ada klasifikasi model valid.'}</td>
    </tr>})}</tbody></table></div>
    {selected&&<div style={{position:'fixed',inset:0,zIndex:100,background:'hsla(230,25%,4%,.88)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setSelected(null)}><div className="card-elevated" style={{maxWidth:720,width:'100%',maxHeight:'88vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}><div className="flex justify-between"><div><h3 className="font-bold">{selected.displayName}</h3><p className="text-xs text-muted">{selected.chatUsed} pesan · {selected.unclassified} belum terklasifikasi</p></div><button className="btn btn-ghost" onClick={()=>setSelected(null)}>✕</button></div><div className="divider"/>{loading?<div className="spinner"/>:messages.map(m=><div key={m.id} style={{marginBottom:14,textAlign:m.role==='user'?'right':'left'}}>{m.role==='user'&&m.questionLevel&&<div style={{marginBottom:4}}>{m.classificationProvenance==='model'?<Badge level={m.questionLevel}/>:<span className="text-xs text-muted">❔ Belum terklasifikasi ({m.classificationProvenance||'legacy'})</span>}</div>}<div style={{display:'inline-block',maxWidth:'85%',padding:'10px 14px',borderRadius:12,background:m.role==='user'?'var(--brand-primary)':'var(--bg-elevated)',whiteSpace:'pre-wrap'}}>{m.content}</div></div>)}</div></div>}
  </div>;
}
