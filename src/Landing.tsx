import { ArrowRight, Map as MapIcon, Navigation, Shield, Zap, Menu, Timer, RefreshCw, Users, BarChart3, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './components/Logo';
import { AuthButton } from './components/AuthButton';

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans selection:bg-blue-500/30 selection:text-blue-200">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo className="h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(96,165,250,0.3)]" />
            <span className="text-3xl font-black tracking-tight text-white">GlideCalc</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Features</a>
            <a href="#compare" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Comparison</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <AuthButton />
            <Link to="/app" className="h-10 px-5 bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-bold rounded-lg flex items-center justify-center transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]">
              Drop Calculator
            </Link>
          </div>

          <button className="md:hidden p-2 text-zinc-400 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-16 inset-x-0 bg-[#0A0A0A] border-b border-white/10 p-6 flex flex-col gap-4 z-40 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
               <span className="text-sm font-medium text-zinc-400">Account</span>
               <AuthButton />
            </div>
            <a href="#features" className="text-sm font-medium text-zinc-300" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#compare" className="text-sm font-medium text-zinc-300" onClick={() => setMobileMenuOpen(false)}>Comparison</a>
            <div className="h-px bg-white/5 w-full my-2"></div>
            <Link to="/app" className="h-12 w-full bg-zinc-100 hover:bg-white text-zinc-950 text-base font-bold rounded-lg flex items-center justify-center transition-all" onClick={() => setMobileMenuOpen(false)}>
              Drop Calculator
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px] opacity-50 pointer-events-none"></div>
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-blue-400/5 rounded-full blur-[100px] opacity-30 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center"
          >
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ delay: 0.2, duration: 0.5 }}
               className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8"
            >
              <Navigation className="w-3.5 h-3.5" />
              Pro Drop Tool
            </motion.div>
            
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tight leading-[1.05] mb-8 drop-shadow-2xl uppercase">
              Own Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#93C5FD]">Dropspot.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-zinc-400 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">
              Get simple, optimized drop paths so you can land faster and win more off-spawn fights using GlideCalc’s Drop Calculator.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/app" className="group relative h-16 px-10 bg-white hover:bg-zinc-200 text-zinc-950 text-lg font-black rounded-2xl flex items-center gap-3 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] hover:-translate-y-1 w-full sm:w-auto justify-center overflow-hidden">
                Open Calculator <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#features" className="h-16 px-10 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white text-lg font-black rounded-2xl flex items-center gap-3 transition-all hover:-translate-y-1 w-full sm:w-auto justify-center">
                See Features
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Marquee */}
      <section className="py-8 bg-[#050505] border-y border-white/5 relative overflow-hidden flex z-20">
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none"></div>
        <div className="flex whitespace-nowrap items-center w-max animate-marquee">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-around shrink-0 px-8 gap-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center"><RefreshCw className="w-5 h-5 text-blue-400" /></div>
                <div className="flex items-baseline gap-2"><span className="text-3xl font-black text-white">24/7</span><span className="text-zinc-500 font-bold text-sm uppercase tracking-wide">Auto Updates</span></div>
              </div>
              <div className="w-px h-8 bg-white/10 mx-4"></div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center"><MapIcon className="w-5 h-5 text-blue-400" /></div>
                <div className="flex items-baseline gap-2"><span className="text-3xl font-black text-white">100%</span><span className="text-zinc-500 font-bold text-sm uppercase tracking-wide">Map Coverage</span></div>
              </div>
              <div className="w-px h-8 bg-white/10 mx-4"></div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center"><MapPin className="w-5 h-5 text-blue-400" /></div>
                <div className="flex items-baseline gap-2"><span className="text-3xl font-black text-white">200+</span><span className="text-zinc-500 font-bold text-sm uppercase tracking-wide">Premade Spots</span></div>
              </div>
              <div className="w-px h-8 bg-white/10 mx-4"></div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center"><Users className="w-5 h-5 text-blue-400" /></div>
                <div className="flex items-baseline gap-2"><span className="text-3xl font-black text-white">2K+</span><span className="text-zinc-500 font-bold text-sm uppercase tracking-wide">Pro Players</span></div>
              </div>
              <div className="w-px h-8 bg-white/10 mx-4 hidden lg:block"></div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Overview */}
      <section id="features" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-6">Why Use <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#93C5FD]">GlideCalc?</span></h2>
            <p className="text-zinc-400 max-w-2xl mx-auto text-lg">Leave the guesswork behind. Our engine does the math so you can focus on the fight.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Timer, color: "blue", title: "Perfect Timing", desc: "Know exactly when to leave the Battle Bus and calculate the ideal drop point to land faster." },
              { icon: MapIcon, color: "blue", title: "Smart Avoidance", desc: "Route analysis accounts for terrain and POIs so you don’t stall over mountains or land late in tall structures." },
              { icon: Zap, color: "blue", title: "Algorithm Precision", desc: "The GlideCalc engine runs thousands of simulations to determine the fastest possible landing." }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-[#0f0f0f] border border-white/5 p-8 rounded-3xl hover:bg-[#151515] hover:border-white/10 transition-colors"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 shadow-inner">
                  <feature.icon className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed font-medium">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="compare" className="py-32 bg-[#050505] border-y border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
               initial={{ opacity: 0, x: -20 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               whileHover={{ y: -5 }}
               className="group flex flex-col gap-6"
            >
              <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-[#0A0A0A] border border-white/10 relative shadow-2xl">
                 {/* Topographical Grid / Pattern Pattern */}
                 <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10,10 Q50,90 90,10 M20,20 Q60,100 100,20' stroke='white' stroke-width='1' fill='none' opacity='0.3'/%3E%3Cpath d='M0,50 Q40,0 80,50 T160,50' stroke='white' stroke-width='1' fill='none' opacity='0.3'/%3E%3C/svg%3E")`, backgroundSize: '100px 100px' }}></div>
                 
                 {/* Terrain / Island Shape */}
                 <svg className="absolute inset-0 w-full h-full opacity-80" viewBox="0 0 400 225" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="terrain1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1a1c23" />
                        <stop offset="100%" stopColor="#0f1115" />
                      </linearGradient>
                    </defs>
                    <path d="M20,120 Q80,20 200,60 T380,100 T300,210 T100,190 Z" fill="url(#terrain1)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    <path d="M60,110 Q100,60 180,80 T320,120 T260,180 T120,160 Z" fill="#222630" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <path d="M90,105 Q120,70 170,85 T280,125 T230,170 T130,150 Z" fill="#2a2e38" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <path d="M80,100 Q120,80 160,90 T240,110" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 3" />
                 </svg>
                 <div className="absolute inset-x-0 h-full w-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent to-[#0A0A0A]/90 pointer-events-none"></div>
                 {/* Route Nodes */}
                 <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 225">
                   {/* Bus line */}
                   <line x1="50" y1="200" x2="350" y2="50" stroke="#3b82f6" strokeWidth="3" strokeOpacity="0.5" />
                   {/* Bus position */}
                   <g transform="translate(150, 150)">
                     <circle cx="0" cy="0" r="8" fill="#3b82f6" stroke="white" strokeWidth="2" />
                   </g>
                   {/* Target Drop Marker */}
                   <circle cx="280" cy="180" r="6" fill="#ef4444" stroke="white" strokeWidth="2" />
                   <circle cx="280" cy="180" r="16" fill="rgba(239,68,68,0.2)" className="animate-ping" />
                   {/* Glide path */}
                   <path d="M 150 150 L 280 180" fill="none" stroke="#60A5FA" strokeWidth="2" strokeDasharray="6 6" className="animate-pulse" />
                   {/* Deploy Marker */}
                   <circle cx="225" cy="167" r="4" fill="#60A5FA" stroke="white" strokeWidth="2" />
                 </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">Calculate your perfect drop</h3>
                <p className="text-zinc-400 font-medium">Map out your bus path and landing spot and DropCalc will automatically find the best glide path for you.</p>
              </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, x: 20 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               whileHover={{ y: -5 }}
               className="group flex flex-col gap-6"
            >
              <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-[#0A0A0A] border border-white/10 relative shadow-2xl">
                 {/* Topographical Grid / Pattern Pattern */}
                 <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10,10 Q50,90 90,10 M20,20 Q60,100 100,20' stroke='white' stroke-width='1' fill='none' opacity='0.3'/%3E%3Cpath d='M0,50 Q40,0 80,50 T160,50' stroke='white' stroke-width='1' fill='none' opacity='0.3'/%3E%3C/svg%3E")`, backgroundSize: '100px 100px' }}></div>
                 
                 {/* Terrain / Island Shape */}
                 <svg className="absolute inset-0 w-full h-full opacity-80" viewBox="0 0 400 225" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="terrain2" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#1a1c23" />
                        <stop offset="100%" stopColor="#0f1115" />
                      </linearGradient>
                    </defs>
                    <path d="M10,80 Q100,-20 250,40 T390,120 T320,220 T80,200 Z" fill="url(#terrain2)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    <path d="M40,90 Q120,20 220,60 T340,130 T280,200 T100,180 Z" fill="#222630" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <path d="M70,110 Q140,50 200,80 T300,140 T240,190 T120,150 Z" fill="#2a2e38" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                 </svg>
                 <div className="absolute inset-x-0 h-full w-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent to-[#0A0A0A]/90 pointer-events-none"></div>
                 {/* Generate scattered markers for dropmap */}
                 <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 225">
                   <g transform="translate(200, 112)">
                      {/* Center Drop (Red) */}
                      <circle cx="0" cy="0" r="20" fill="rgba(239,68,68,0.2)" className="animate-ping" />
                      <circle cx="0" cy="0" r="8" fill="#ef4444" stroke="white" strokeWidth="2" />
                      
                      {/* Surrounding drop markers */}
                      {[
                        [-30, -20], [40, -10], [-10, 35], [25, 25], 
                        [-45, 10], [15, -40], [-20, -50], [55, 5],
                        [-60, -15], [30, 45], [-35, 55]
                      ].map((pos, i) => (
                         <g key={i} transform={`translate(${pos[0]}, ${pos[1]})`}>
                           <circle cx="0" cy="0" r="4.5" fill="#60A5FA" stroke="white" strokeWidth="1.5" />
                           <path d={`M 0 0 L ${-pos[0]*0.4} ${-pos[1]*0.4}`} stroke="rgba(96,165,250,0.4)" strokeWidth="1" strokeDasharray="2 2" />
                         </g>
                      ))}
                   </g>
                 </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">Create a Dropmap</h3>
                <p className="text-zinc-400 font-medium">Generate perfect dropmaps with multiple markers for any dropspot.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-32 relative overflow-hidden bg-[#0A0A0A] border-t border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-500/10 pointer-events-none"></div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent pointer-events-none"></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto px-6 text-center relative z-10"
        >
          <div className="w-24 h-24 mx-auto mb-8 bg-[#050505] rounded-2xl border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden relative">
             <div className="absolute inset-0 bg-blue-500/20 blur-xl pointer-events-none"></div>
             <Logo className="w-16 h-16 object-contain relative z-10" />
          </div>
          
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-8 uppercase">
            Ready to Drop Smarter?
          </h2>
          
          <p className="text-xl text-zinc-400 mb-12 leading-relaxed">
            Join the players who stopped guessing and started dominating their drops. It's completely free.
          </p>
          <Link to="/app" className="inline-flex h-16 px-12 bg-white hover:bg-zinc-200 text-zinc-950 text-lg font-black rounded-2xl items-center justify-center transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] hover:-translate-y-1">
            Open the Calculator Now
          </Link>
        </motion.div>
      </section>
      
      {/* Footer */}
      <footer className="bg-[#050505] py-12 text-center text-sm text-zinc-600 font-medium border-t border-white/5 relative z-10">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Logo className="w-10 h-10 object-contain" />
          <span className="text-xl font-black tracking-tight text-white">GlideCalc</span>
        </div>
        <p>&copy; {new Date().getFullYear()} GlideCalc. All rights reserved.</p>
      </footer>
    </div>
  );
}
