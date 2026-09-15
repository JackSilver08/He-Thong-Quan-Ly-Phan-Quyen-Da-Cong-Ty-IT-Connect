'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {logout} from '@/lib/api';
const items=[['/','Dashboard'],['/users','Users'],['/companies','Companies'],['/projects','Projects'],['/permissions','Permissions'],['/resigned','Resigned'],['/audit','Audit Logs']];
export default function Layout({children}:{children:React.ReactNode}){const path=usePathname();return <div className="shell"><aside className="sidebar"><div className="brand">IT Connect</div><nav className="nav">{items.map(([href,label])=><Link key={href} href={href} className={path===href?'active':''}>{label}</Link>)}</nav><button className="button" style={{marginTop:24,width:'100%'}} onClick={logout}>Đăng xuất</button></aside><main className="main">{children}</main></div>}
