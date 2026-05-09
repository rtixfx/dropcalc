import { ArrowRight, Map as MapIcon, Navigation, Shield, Zap, Menu, Timer, RefreshCw, Users, BarChart3, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './components/Logo';

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-violet-500/30 overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#09090b]/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-auto object-contain drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]" />
            <span className="text-xl font-black tracking-tight text-white">DropIQ</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Features</a>
            <a href="#compare" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Comparison</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <a href="/app" className="h-9 px-4 bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-bold rounded-lg flex items-center justify-center transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]">
              Drop Calculator
            </a>
          </div>

          <button className="md:hidden p-2 text-zinc-400 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-16 bg-[#09090b]/95 backdrop-blur-xl border-b border-white/5 z-40 p-6 flex flex-col gap-4 md:hidden"
          >
            <a href="#features" className="text-sm font-medium text-zinc-300" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#compare" className="text-sm font-medium text-zinc-300" onClick={() => setMobileMenuOpen(false)}>Comparison</a>
            <div className="h-px bg-white/5 w-full my-2"></div>
            <a href="/app" className="h-10 w-full bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-bold rounded-lg flex items-center justify-center transition-all" onClick={() => setMobileMenuOpen(false)}>
              Drop Calculator
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        {/* Very subtle top gradient */}
        <div className="absolute top-0 inset-x-0 h-[200px] bg-gradient-to-b from-violet-900/10 to-transparent pointer-events-none"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold uppercase tracking-widest mb-8 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
            >
              <Zap className="w-3.5 h-3.5" /> Mathematical perfect drops
            </motion.div>
            
            <h1 className="text-5xl md:text-8xl font-black text-white tracking-tight leading-[1.05] mb-6 drop-shadow-2xl">
              OWN YOUR <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400 pr-2">DROPSPOT.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed font-medium">
              Never lose off-spawn again. Turn every landing into a victory and beat opponents to the best loot with DropIQ's precision routing engine.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/app" className="group relative h-14 px-8 bg-zinc-100 hover:bg-white text-zinc-950 text-base font-bold rounded-2xl flex items-center gap-2 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] hover:-translate-y-1 w-full sm:w-auto justify-center overflow-hidden">
                Launch Drop Calculator <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Marquee */}
      <section className="py-8 bg-[#09090b] border-y border-white/5 relative overflow-hidden flex z-20">
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#09090b] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#09090b] to-transparent z-10 pointer-events-none"></div>
        <div className="flex whitespace-nowrap items-center w-max animate-marquee">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-around shrink-0 px-6 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center"><RefreshCw className="w-5 h-5 text-violet-500" /></div>
                <div className="flex items-baseline gap-2"><span className="text-3xl font-black text-white">24/7</span><span className="text-zinc-400 font-bold text-sm">Auto Updates</span></div>
              </div>
              <div className="w-px h-8 bg-white/10 mx-2"></div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center"><MapIcon className="w-5 h-5 text-violet-500" /></div>
                <div className="flex items-baseline gap-2"><span className="text-3xl font-black text-white">100%</span><span className="text-zinc-400 font-bold text-sm">Map Coverage</span></div>
              </div>
              <div className="w-px h-8 bg-white/10 mx-2"></div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center"><MapPin className="w-5 h-5 text-violet-500" /></div>
                <div className="flex items-baseline gap-2"><span className="text-3xl font-black text-white">200+</span><span className="text-zinc-400 font-bold text-sm">Premade Locations</span></div>
              </div>
              <div className="w-px h-8 bg-white/10 mx-2"></div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center"><Users className="w-5 h-5 text-violet-500" /></div>
                <div className="flex items-baseline gap-2"><span className="text-3xl font-black text-white">2K</span><span className="text-zinc-400 font-bold text-sm">Active Players</span></div>
              </div>
              <div className="w-px h-8 bg-white/10 mx-2"></div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-violet-500" /></div>
                <div className="flex items-baseline gap-2"><span className="text-3xl font-black text-white">42K</span><span className="text-zinc-400 font-bold text-sm">Drops Calculated</span></div>
              </div>
              <div className="w-px h-8 bg-white/10 mx-2 hidden lg:block"></div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Overview */}
      <section id="features" className="py-24 px-6 relative z-10 border-t border-white/5 bg-zinc-950/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            <motion.div 
               initial={{ opacity: 0, x: -40 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 0.8, ease: "easeOut" }}
               className="relative"
            >
              <div className="absolute inset-0 bg-violet-600/20 blur-[120px] rounded-full"></div>
              {/* Interactive App Mockup */}
              <div className="relative bg-[#09090b] border border-white/10 rounded-3xl p-2 shadow-2xl relative z-10 aspect-[4/3] overflow-hidden flex items-center justify-center group">
                 <div className="absolute inset-0 bg-[#0f1117] rounded-2xl flex items-center justify-center overflow-hidden transition-transform duration-700 group-hover:scale-[1.02]">
                    <div className="absolute w-[200%] h-[200%] bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-50"></div>
                    
                    {/* Animated Route Line */}
                    <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <motion.path 
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
                        d="M 20 80 Q 50 20 80 80" 
                        fill="none" 
                        stroke="rgba(139,92,246,0.5)" 
                        strokeWidth="0.8" 
                        strokeDasharray="2 2" 
                      />
                      <circle cx="80" cy="80" r="2" fill="#8b5cf6" className="animate-pulse" />
                      <circle cx="20" cy="80" r="1.5" fill="#8b5cf6" />
                    </svg>
                    
                    {/* Floating UI Widget */}
                    <div className="relative bg-[#09090b]/90 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-2xl w-64 translate-y-12 translate-x-12 transition-transform duration-500 group-hover:-translate-y-2 group-hover:translate-x-8">
                       <div className="flex gap-3 items-center mb-4">
                         <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                           <Timer className="w-4 h-4 text-violet-400" />
                         </div>
                         <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Perfect Timing</span>
                           <span className="text-sm font-mono text-white">42.5s</span>
                         </div>
                       </div>
                       <div className="space-y-3">
                         <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                           <motion.div 
                             initial={{ width: "0%" }}
                             animate={{ width: "100%" }}
                             transition={{ duration: 3, repeat: Infinity }}
                             className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                           />
                         </div>
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, x: 40 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 0.8, ease: "easeOut" }}
               className="space-y-10"
            >
              <div>
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
                  What is DropIQ?
                </h2>
                <p className="text-lg text-zinc-400 leading-relaxed font-medium">
                  We built a physical simulation engine for Fortnite's Battle Bus and freefall mechanics. It calculates the mathematically perfect trajectory to guarantee you hit the ground first.
                </p>
              </div>

              <div className="space-y-8">
                 {[
                   { icon: Timer, color: "violet", title: "Perfect Jump Timing", desc: "Know exactly when to leave the battle bus, calculate the perfect horizontal distance needed to pop your glider." },
                   { icon: MapIcon, color: "indigo", title: "Smart Obstacle Avoidance", desc: "Advanced routing calculations map terrain height so you don't stall out over a mountain or tall POI building." },
                   { icon: Zap, color: "violet", title: "Algorithm Precision", desc: "Our DropIQ engine tests thousands of permutations per second to find the most optimal glide angle." }
                 ].map((feature, i) => (
                   <motion.div 
                     key={i}
                     whileHover={{ x: 10 }}
                     className="flex gap-5 group cursor-default"
                   >
                     <div className={`w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center flex-shrink-0 transition-colors group-hover:border-${feature.color}-500/30 group-hover:bg-${feature.color}-500/10`}>
                       <feature.icon className={`w-6 h-6 text-${feature.color}-400`} />
                     </div>
                     <div>
                       <h4 className="text-xl font-bold text-white mb-2">{feature.title}</h4>
                       <p className="text-zinc-400 leading-relaxed">{feature.desc}</p>
                     </div>
                   </motion.div>
                 ))}
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Advantage Feature Grid (From Screenshot) */}
      <section className="py-24 relative overflow-hidden bg-zinc-950 border-t border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-violet-950/10"></div>
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
              The Advantage You've Been Waiting For
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-medium">
              Stop guessing and start winning. Our suite of powerful, easy-to-use tools gives you the data and insights needed to conquer every drop.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            
            {/* Card 1 */}
            <motion.div 
               whileHover={{ y: -5 }}
               className="group flex flex-col gap-6"
            >
              <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-[#1c1f26] border border-white/10 relative shadow-2xl">
                 {/* Topographical Grid / Pattern Pattern */}
                 <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10,10 Q50,90 90,10 M20,20 Q60,100 100,20' stroke='white' stroke-width='1' fill='none' opacity='0.3'/%3E%3Cpath d='M0,50 Q40,0 80,50 T160,50' stroke='white' stroke-width='1' fill='none' opacity='0.3'/%3E%3C/svg%3E")`, backgroundSize: '100px 100px' }}></div>
                 
                 {/* Terrain / Island Shape */}
                 <svg className="absolute inset-0 w-full h-full opacity-80" viewBox="0 0 400 225" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="terrain1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#2e3846" />
                        <stop offset="100%" stopColor="#1c212b" />
                      </linearGradient>
                    </defs>
                    <path d="M20,120 Q80,20 200,60 T380,100 T300,210 T100,190 Z" fill="url(#terrain1)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    <path d="M60,110 Q100,60 180,80 T320,120 T260,180 T120,160 Z" fill="#384355" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <path d="M90,105 Q120,70 170,85 T280,125 T230,170 T130,150 Z" fill="#435066" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <path d="M80,100 Q120,80 160,90 T240,110" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 3" />
                 </svg>
                 <div className="absolute inset-x-0 h-full w-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent to-[#09090b]/90 pointer-events-none"></div>
                 {/* Route Nodes */}
                 <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 225">
                  <path d="M 80 150 Q 150 80 250 110 T 330 170" fill="none" stroke="rgba(139,92,246,0.8)" strokeWidth="3" strokeDasharray="6 6" />
                  <path d="M 120 180 Q 200 120 280 80" fill="none" stroke="rgba(139,92,246,0.8)" strokeWidth="3" strokeDasharray="6 6" />
                  <circle cx="80" cy="150" r="6" fill="#8b5cf6" stroke="white" strokeWidth="2" />
                  <circle cx="250" cy="110" r="6" fill="#8b5cf6" stroke="white" strokeWidth="2" />
                  <circle cx="330" cy="170" r="8" fill="#8b5cf6" stroke="white" strokeWidth="2" />
                  <circle cx="120" cy="180" r="6" fill="#8b5cf6" stroke="white" strokeWidth="2" />
                  <circle cx="280" cy="80" r="8" fill="#8b5cf6" stroke="white" strokeWidth="2" />
                  <path d="M 326 160 L 330 170 L 334 160 Z" fill="white" />
                  <path d="M 276 70 L 280 80 L 284 70 Z" fill="white" />
                 </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">Design Your Perfect Drop</h3>
                <p className="text-zinc-400 leading-relaxed font-medium">Take full control. Create and save your own custom Dropmaps by placing markers anywhere on the map. Guarantee a perfect landing, no matter how unique your spot is.</p>
              </div>
            </motion.div>

            {/* Card 2 */}
            <motion.div 
               whileHover={{ y: -5 }}
               className="group flex flex-col gap-6"
            >
              <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-[#1c1f26] border border-white/10 relative shadow-2xl">
                 {/* Topographical Grid / Pattern Pattern */}
                 <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10,10 Q50,90 90,10 M20,20 Q60,100 100,20' stroke='white' stroke-width='1' fill='none' opacity='0.3'/%3E%3Cpath d='M0,50 Q40,0 80,50 T160,50' stroke='white' stroke-width='1' fill='none' opacity='0.3'/%3E%3C/svg%3E")`, backgroundSize: '100px 100px' }}></div>
                 
                 {/* Terrain / Island Shape */}
                 <svg className="absolute inset-0 w-full h-full opacity-80" viewBox="0 0 400 225" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="terrain2" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#2e3846" />
                        <stop offset="100%" stopColor="#1c212b" />
                      </linearGradient>
                    </defs>
                    <path d="M10,80 Q100,-20 250,40 T390,120 T320,220 T80,200 Z" fill="url(#terrain2)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    <path d="M40,90 Q120,20 220,60 T340,130 T280,200 T100,180 Z" fill="#384355" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <path d="M70,110 Q140,50 200,80 T300,140 T240,190 T120,150 Z" fill="#435066" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                 </svg>
                 <div className="absolute inset-x-0 h-full w-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent to-[#09090b]/90 pointer-events-none"></div>
                 {/* Generate scattered markers */}
                 <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 225">
                   {[
                     [120, 80], [140, 60], [220, 50], [280, 70], [310, 100], [330, 140], 
                     [290, 160], [250, 180], [210, 190], [160, 170], [110, 150], [80, 120],
                     [200, 90], [240, 120], [180, 130], [270, 110], [150, 110], [90, 170],
                     [100, 100], [340, 170], [300, 190], [180, 70], [260, 140], [220, 150]
                   ].map((pos, i) => (
                     <g key={i} transform={`translate(${pos[0]}, ${pos[1]})`}>
                       <circle cx="0" cy="0" r="5" fill="#6366f1" stroke="white" strokeWidth="1.5" />
                       <circle cx="0" cy="0" r="1.5" fill="white" />
                     </g>
                   ))}
                 </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">Instantly Access 100+ Pro-Level Dropmaps</h3>
                <p className="text-zinc-400 leading-relaxed font-medium">Stop losing fights off-spawn. Unlock our exclusive library of professionally crafted Dropmaps and start every match with a winning advantage. We've done the homework so you can focus on the fight.</p>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-32 relative overflow-hidden bg-zinc-950 border-t border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-violet-950/20 pointer-events-none"></div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent pointer-events-none"></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto px-6 text-center relative z-10"
        >
          <div className="w-24 h-24 mx-auto mb-8 bg-[#09090b] rounded-2xl border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden relative">
             <div className="absolute inset-0 bg-violet-500/20 blur-xl pointer-events-none"></div>
             <Logo className="w-16 h-16 object-contain relative z-10" />
          </div>
          
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-8">
            Ready to Drop Smarter?
          </h2>
          <p className="text-xl text-zinc-400 mb-12 leading-relaxed">
            Join the players who stopped guessing and started dominating their drops. It's completely free.
          </p>
          <a href="/app" className="inline-flex h-16 px-12 bg-white hover:bg-zinc-200 text-zinc-950 text-lg font-black rounded-2xl items-center justify-center transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] hover:-translate-y-1">
            Open the Calculator Now
          </a>
        </motion.div>
      </section>
      
      {/* Footer */}
      <footer className="bg-[#050505] py-12 text-center text-sm text-zinc-600 font-medium border-t border-white/5 relative z-10">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Logo className="w-10 h-10 object-contain" />
          <span className="text-lg font-black tracking-tight">DropIQ</span>
        </div>
        <p>&copy; {new Date().getFullYear()} DropIQ. All rights reserved.</p>
      </footer>
    </div>
  );
}

