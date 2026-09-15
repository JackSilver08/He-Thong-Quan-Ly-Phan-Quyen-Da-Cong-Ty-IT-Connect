'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
export default function AuthGuard({children}:{children:React.ReactNode}){const r=useRouter();const [ok,setOk]=useState(false);useEffect(()=>{if(localStorage.getItem('itc_token'))setOk(true);else r.replace('/login')},[r]);return ok?<>{children}</>:null}
