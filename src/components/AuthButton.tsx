import { useEffect, useState } from 'react';

interface User {
  id: string;
  username: string;
  avatar: string;
}

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (event.data.user) {
          setUser(event.data.user);
        } else {
          fetchUser();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/discord/url');
      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=800,left=200,top=100'
      );

      if (!authWindow) {
        alert('Please allow popups for this site to connect your Discord account.');
      }
    } catch (error) {
      console.error('OAuth error:', error);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
    setUser(null);
  };

  if (loading) {
    return (
      <div className="h-10 px-4 bg-zinc-900/50 rounded-lg flex items-center justify-center border border-white/5">
        <div className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-zinc-200 animate-spin" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3 bg-zinc-900/80 px-2 pl-3 py-1.5 rounded-xl border border-white/10 shadow-inner">
        <div className="flex items-center gap-2">
          {user.avatar ? (
            <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} alt={user.username} className="w-6 h-6 rounded-full bg-zinc-800" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-zinc-200 max-w-[100px] truncate">{user.username}</span>
        </div>
        <div className="w-px h-4 bg-white/10"></div>
        <button onClick={handleLogout} className="text-xs font-medium text-zinc-400 hover:text-white transition-colors px-2 py-1">
          Logout
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleLogin} className="h-10 px-4 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(88,101,242,0.3)] hover:shadow-[0_0_20px_rgba(88,101,242,0.5)]">
      <svg width="20" height="20" viewBox="0 0 127 127" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
         <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.3,46,96.19,53,91.08,65.69,84.69,65.69Z"/>
      </svg>
      Login
    </button>
  );
}
