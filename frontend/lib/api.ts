const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
export async function api<T>(path:string, init:RequestInit={}) : Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('itc_token') : null;
  const headers = new Headers(init.headers);
  headers.set('Content-Type','application/json');
  if(token) headers.set('Authorization',`Bearer ${token}`);
  const res = await fetch(`${API}${path}`,{...init,headers,cache:'no-store'});
  if(!res.ok){let message='Request failed';try{const body=await res.json();message=body.error||message}catch{};throw new Error(message)}
  if(res.status===204)return undefined as T;
  return res.json();
}
export function setToken(token:string){localStorage.setItem('itc_token',token)}
export function logout(){localStorage.removeItem('itc_token');window.location.href='/login'}
