import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, Save, Image as ImageIcon } from 'lucide-react';
import { AuthButton } from '../../components/AuthButton';

export default function BlogEditor() {
  const { id } = useParams(); // if id exists, we are editing
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    content: '',
    bannerImage: '',
    readTime: '2 min read',
    tags: '',
    isPinned: false
  });

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/auth/me', { headers })
      .then(res => res.json())
      .then(data => {
        if (!data.isAdmin) {
          navigate('/blogs');
        } else {
          setIsAdmin(true);
          if (!id) {
             setLoading(false);
          }
        }
      });
  }, [id, navigate]);

  useEffect(() => {
    if (isAdmin && id) {
       fetch('/api/posts', { cache: 'no-store' })
        .then(r => r.json())
        .then(posts => {
           const post = posts.find((p: any) => p.id === id);
           if (post) {
             setFormData({
               title: post.title || '',
               slug: post.slug || '',
               description: post.description || '',
               content: post.content || '',
               bannerImage: post.bannerImage || '',
               readTime: post.readTime || '',
               tags: post.tags || '',
               isPinned: !!post.isPinned
             });
           }
           setLoading(false);
        });
    }
  }, [isAdmin, id]);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
    if (name === 'title' && !id) {
      setFormData(prev => ({
        ...prev,
        slug: val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = id ? `/api/posts/${id}` : '/api/posts';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Save failed');
      }
      const data = await res.json();
      // Redirect to the post
      navigate(`/blogs/${formData.slug || data.slug}`);
    } catch (err: any) {
      console.error(err);
      alert(`Error saving post: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans text-white pb-20">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold">
              <ChevronLeft className="w-4 h-4" />
              Cancel
            </button>
          </div>
          <AuthButton />
        </div>
      </nav>

      <main className="pt-24 px-6 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-black">{id ? 'Edit Post' : 'New Post'}</h1>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="h-10 px-6 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Post'}
            </button>
          </div>

          <div className="space-y-6 bg-[#050505] p-8 rounded-3xl border border-white/5 shadow-2xl">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Title</label>
              <input
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Blog post title"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Slug URL</label>
                <input
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  placeholder="my-blog-post"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Read Time</label>
                <input
                  name="readTime"
                  value={formData.readTime}
                  onChange={handleChange}
                  placeholder="E.g. 5 min read"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div className="flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3">
                <input
                  type="checkbox"
                  name="isPinned"
                  checked={formData.isPinned}
                  onChange={handleChange}
                  id="isPinned"
                  className="w-5 h-5 rounded border-white/10 bg-[#050505] text-blue-500 focus:ring-blue-500/50"
                />
                <label htmlFor="isPinned" className="text-sm font-bold text-white tracking-wide cursor-pointer">
                  Pin this post to the top
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Banner Image URL</label>
              <div className="flex gap-4">
                <input
                  name="bannerImage"
                  value={formData.bannerImage}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              {formData.bannerImage && (
                <div className="mt-4 aspect-[21/9] w-full rounded-2xl overflow-hidden border border-white/10 bg-zinc-900">
                  <img src={formData.bannerImage} alt="Banner preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Short Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                placeholder="A short summary of the post..."
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Tags (Comma separated)</label>
              <input
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                placeholder="News, Updates, Tutorial"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Content (Markdown format)</span>
              </label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleChange}
                rows={15}
                placeholder="Write your post content here using Markdown..."
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors font-mono text-sm leading-relaxed"
              />
            </div>

          </div>
        </motion.div>
      </main>
    </div>
  );
}
