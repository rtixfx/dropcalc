import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AuthButton } from '../../components/AuthButton';
import { ChevronLeft, Edit, Trash2, Pin } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Logo } from '../../components/Logo';

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

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

    fetch(`/api/posts/${slug}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        setPost(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [slug]);

  const handleDelete = async () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE', headers });
      if (res.ok) {
        navigate('/blogs');
      } else {
        const errorData = await res.json();
        console.error(`Failed to delete: ${errorData.error}`);
        setIsConfirmingDelete(false);
      }
    } catch (err) {
      console.error(err);
      setIsConfirmingDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white">
        <h1 className="text-3xl font-bold mb-4">Post not found</h1>
        <Link to="/blogs" className="text-blue-400 hover:text-blue-300">Return to blogs</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans text-white relative">
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Logo className="h-8 w-auto object-contain drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]" />
            </Link>
            <div className="w-px h-6 bg-white/10" />
            <Link to="/" className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors">
              Home
            </Link>
            <Link to="/app" className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors">
              Drop Calc
            </Link>
            <Link to="/blogs" className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors">
              Blogs
            </Link>
            <div className="w-px h-6 bg-white/10 mx-2" />
            <Link to="/blogs" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
          <AuthButton />
        </div>
      </nav>

      <main className="pt-24 pb-24 px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {isAdmin && (
            <div className="flex items-center gap-2 mb-8 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <span className="text-blue-400 text-sm font-bold ml-2">Admin Actions</span>
              <div className="ml-auto flex gap-2">
                <Link to={`/blogs/${post.id}/edit`} className="h-8 px-3 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors">
                  <Edit className="w-3 h-3" /> Edit
                </Link>
                {isConfirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsConfirmingDelete(false)} className="h-8 px-3 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 text-xs font-bold transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleDelete} className="h-8 px-3 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 text-xs font-bold transition-colors">
                      Confirm Delete
                    </button>
                  </div>
                ) : (
                  <button onClick={handleDelete} className="h-8 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center flex-wrap gap-3 text-sm font-semibold text-blue-400 mb-6">
            {post.isPinned ? (
              <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-md">
                <Pin className="w-3.5 h-3.5" />
                <span>Pinned</span>
              </div>
            ) : null}
            <span>{new Date(post.publishDate).toLocaleDateString()}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <span>{post.readTime || '2 min read'}</span>
            {post.tags && (
               <>
                 <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                 <span className="text-zinc-400">
                   {post.tags.split(',').map((t: string) => t.trim()).join(' • ')}
                 </span>
               </>
            )}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-8 leading-tight">
            {post.title}
          </h1>

          <div className="flex items-center gap-4 mb-10 pb-10 border-b border-white/5">
            <div className="w-12 h-12 rounded-full bg-[#050505] flex items-center justify-center border border-white/10 shadow-lg overflow-hidden">
              <Logo className="w-[110%] h-[110%] object-contain drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
            </div>
            <div>
              <div className="font-bold text-zinc-200">GlideCalc</div>
              <div className="text-sm tracking-wide text-zinc-500">Author</div>
            </div>
          </div>

          {post.bannerImage && (
            <div className="relative aspect-[21/9] w-full rounded-3xl overflow-hidden mb-12 border border-white/10 bg-zinc-900 shadow-2xl">
              <img src={post.bannerImage} alt={post.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="prose prose-invert prose-blue max-w-none prose-img:rounded-2xl prose-headings:font-bold prose-headings:tracking-tight prose-a:text-blue-400">
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
