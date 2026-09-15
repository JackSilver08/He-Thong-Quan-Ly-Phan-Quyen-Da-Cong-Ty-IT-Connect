'use client';
import {useEffect,useState} from 'react';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';
import {api} from '@/lib/api';

type C={id:string;name:string};
type D={id:string;company_id:string;name:string};

export default function Departments(){
 const [items,setItems]=useState<D[]>([]);const [companies,setCompanies]=useState<C[]>([]);const [companyId,setCompanyId]=useState('');const [name,setName]=useState('');const [q,setQ]=useState('');const [editing,setEditing]=useState<D|null>(null);const [error,setError]=useState('');
 const load=async()=>{try{const x=await api<{data:D[]}>(`/departments?company_id=${encodeURIComponent(companyId)}&q=${encodeURIComponent(q)}`);setItems(x.data)}catch(e){setError((e as Error).message)}};
 useEffect(()=>{api<{data:C[]}>('/companies').then(x=>setCompanies(x.data)).catch(e=>setError(e.message));},[]);useEffect(()=>{load()},[companyId]);
 const save=async()=>{setError('');try{if(!name.trim()||!companyId)return setError('Vui lòng chọn công ty và nhập tên phòng ban.');const body=JSON.stringify({company_id:companyId,name:name.trim()});if(editing)await api(`/departments/${editing.id}`,{method:'PUT',body});else await api('/departments',{method:'POST',body});setName('');setEditing(null);await load()}catch(e){setError((e as Error).message)}};
 const remove=async(id:string)=>{if(!confirm('Xóa phòng ban này? Phòng ban đang có nhân viên sẽ không thể xóa.'))return;try{await api(`/departments/${id}`,{method:'DELETE'});await load()}catch(e){setError((e as Error).message)}};
 return <AuthGuard><Layout><div className="topbar"><div><div className="title">Phòng ban</div><div className="subtitle">Quản lý phòng ban theo từng công ty</div></div></div>{error&&<div className="error" style={{marginBottom:12}}>{error}</div>}<div className="card"><div className="toolbar"><select className="select" value={companyId} onChange={e=>setCompanyId(e.target.value)}><option value="">Chọn công ty</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="input" placeholder="Tên phòng ban" value={name} onChange={e=>setName(e.target.value)} /><button className="button primary" onClick={save}>{editing?'Lưu thay đổi':'Thêm phòng ban'}</button>{editing&&<button className="button" onClick={()=>{setEditing(null);setName('')}}>Hủy</button>}</div></div><div className="toolbar"><input className="input" placeholder="Tìm phòng ban..." value={q} onChange={e=>setQ(e.target.value)}/><button className="button" onClick={load}>Tìm kiếm</button></div><div className="table-wrap"><table className="table"><thead><tr><th>Tên phòng ban</th><th>Thao tác</th></tr></thead><tbody>{items.map(d=><tr key={d.id}><td>{d.name}</td><td><button className="button" onClick={()=>{setEditing(d);setCompanyId(d.company_id);setName(d.name)}}>Sửa</button>{' '}<button className="button danger" onClick={()=>remove(d.id)}>Xóa</button></td></tr>)}</tbody></table>{!items.length&&<div className="empty">Chưa có phòng ban.</div>}</div></Layout></AuthGuard>
}
