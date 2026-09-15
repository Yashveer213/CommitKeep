import Dashboard from './dashboard';
import {getChatGPTUser} from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home(){const user=await getChatGPTUser();return <Dashboard account={user?{displayName:user.displayName,githubLogin:user.githubLogin,avatarUrl:user.avatarUrl}:null}/>;}
