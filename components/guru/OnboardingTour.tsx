'use client';
import React,{useState} from 'react';

interface OnboardingTourProps{
  isOpen:boolean;
  onClose:()=>void;
  onQuickStudentDemo?:()=>void;
}

export function OnboardingTour({isOpen,onClose,onQuickStudentDemo}:OnboardingTourProps){
  const [tab,setTab]=useState<'flow'|'categories'|'demo'>('flow');
  if(!isOpen)return null;
  return <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20,background:'hsla(230,25%,4%,.88)'}} onClick={onClose}>
    <div className="card-elevated" style={{width:'100%',maxWidth:680,maxHeight:'90vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}>
      <div className="flex justify-between items-center"><div><h2 className="font-bold">Panduan Guru — Pamong AI</h2><p className="text-xs text-muted">MVP tutor berbasis modul dengan observasi bentuk pertanyaan</p></div><button className="btn btn-ghost" onClick={onClose}>✕</button></div>
      <div className="divider"/>
      <div className="flex gap-2 mb-4">
        <button className={'btn '+(tab==='flow'?'btn-primary':'btn-secondary')} style={{width:'auto'}} onClick={()=>setTab('flow')}>🚀 Alur</button>
        <button className={'btn '+(tab==='categories'?'btn-primary':'btn-secondary')} style={{width:'auto'}} onClick={()=>setTab('categories')}>📊 Kategori</button>
        <button className={'btn '+(tab==='demo'?'btn-primary':'btn-secondary')} style={{width:'auto'}} onClick={()=>setTab('demo')}>🎭 Demo</button>
      </div>
      {tab==='flow'&&<div className="flex flex-col gap-3">
        <div className="card"><strong>1. Buat sesi & unggah modul</strong><p className="text-xs text-secondary mt-1">Materi diindeks untuk retrieval khusus sesi. Grounding berbasis prompt tetap bersifat eksperimental dan perlu evaluasi.</p></div>
        <div className="card"><strong>2. Bagikan akun siswa</strong><p className="text-xs text-secondary mt-1">Setiap siswa memakai akun pada sesi yang sama; quota dicek sebelum model dipanggil.</p></div>
        <div className="card"><strong>3. Siswa bertanya</strong><p className="text-xs text-secondary mt-1">Pertanyaan diklasifikasikan menurut bentuk permintaannya. Kegagalan classifier ditandai sebagai belum terklasifikasi, bukan dipaksa menjadi kategori fakta.</p></div>
        <div className="card"><strong>4. Guru melihat distribusi</strong><p className="text-xs text-secondary mt-1">Dashboard menampilkan distribusi pertanyaan yang valid dan jumlah unknown secara terpisah. Ini bukan diagnosis kemampuan atau progres belajar.</p></div>
      </div>}
      {tab==='categories'&&<div className="flex flex-col gap-3">
        <div className="card"><strong>📖 Pertanyaan fakta</strong><p className="text-xs text-secondary mt-1">Definisi, istilah, nama, waktu, lokasi, daftar, atau fakta langsung dari materi.</p></div>
        <div className="card"><strong>💡 Pertanyaan penjelasan</strong><p className="text-xs text-secondary mt-1">Proses, hubungan, sebab-akibat, perbandingan, atau alasan.</p></div>
        <div className="card"><strong>🧠 Pertanyaan penerapan atau penalaran</strong><p className="text-xs text-secondary mt-1">Penerapan pada situasi, prediksi konsekuensi, pemecahan masalah, evaluasi kasus, atau penalaran berbasis bukti.</p></div>
        <p className="text-xs text-muted">Kategori di atas mendeskripsikan pertanyaan. Kategori tersebut tidak membuktikan level Bloom, kemampuan kognitif, mastery, atau learning outcome siswa.</p>
      </div>}
      {tab==='demo'&&<div className="card"><p className="text-sm">Untuk demo jujur, gunakan provider live bila ingin menunjukkan jawaban AI. Jika memakai <code>PAMONG_DEMO_MODE=true</code>, jelaskan bahwa keluaran tersebut hanya mode demonstrasi dan tidak masuk statistik classifier valid.</p>{onQuickStudentDemo&&<button className="btn btn-primary mt-4" onClick={onQuickStudentDemo}>Buka akun siswa demo</button>}</div>}
    </div>
  </div>;
}
