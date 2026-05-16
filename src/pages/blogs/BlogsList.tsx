import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { AuthButton } from '../../components/AuthButton';
import { ChevronLeft, Plus, Pin } from 'lucide-react';
import { Logo } from '../../components/Logo';

export default function BlogsList() {
  const [posts, setPosts] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/auth/me', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.isAdmin) setIsAdmin(true);
      })
      .catch(() => {});

    fetch('/api/posts', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setPosts(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans text-white relative">
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Logo className="h-12 w-auto object-contain drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]" />
              <span>GlideCalc</span>
            </Link>
            <div className="w-px h-6 bg-white/10 mx-2" />
            <Link to="/" className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors">
              Home
            </Link>
            <Link to="/app" className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors">
              Drop Calc
            </Link>
            <Link to="/blogs" className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors">
              Blogs
            </Link>
          </div>
          <AuthButton />
        </div>
      </nav>

      <main className="pt-24 pb-16 px-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2">Latest Updates</h1>
            <p className="text-zinc-400 text-lg">Read the latest news and updates from the team.</p>
          </div>
          {isAdmin && (
            <Link to="/blogs/new" className="h-10 px-4 bg-blue-500 hover:bg-blue-400 text-white rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Plus className="w-4 h-4" />
              New Post
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-blue-500 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-32 border border-white/5 rounded-3xl bg-[#050505]">
            <h3 className="text-xl font-bold text-zinc-300 mb-2">No posts yet</h3>
            <p className="text-zinc-500">Check back later for new updates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link to={`/blogs/${post.slug}`} className="block h-full bg-[#050505] rounded-3xl border border-white/5 overflow-hidden hover:border-blue-500/30 transition-all hover:-translate-y-1 group hover:shadow-[0_10px_40px_rgba(59,130,246,0.1)]">
                  <div className="aspect-[16/9] w-full bg-zinc-900 border-b border-white/5 overflow-hidden relative">
                    {post.bannerImage ? (
                      <img src={post.bannerImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 text-xs font-semibold text-blue-400 mb-3">
                      {post.isPinned ? (
                        <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                          <Pin className="w-3 h-3" />
                          <span>Pinned</span>
                        </div>
                      ) : null}
                      <span>{new Date(post.publishDate).toLocaleDateString()}</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>{post.readTime || '2 min read'}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 leading-tight">
                      {post.title}
                    </h3>
                    <p className="text-zinc-400 text-sm line-clamp-3 leading-relaxed mb-6">
                      {post.description}
                    </p>
                    <div className="flex items-center gap-3 mt-auto">
                      <div className="w-8 h-8 rounded-full bg-[#050505] flex items-center justify-center border border-white/10 shadow-lg overflow-hidden">
                        <Logo className="w-[110%] h-[110%] object-contain drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                      </div>
                      <span className="text-sm font-medium text-zinc-300">GlideCalc</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
