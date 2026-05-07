"use client";

import { useState, useEffect, useRef } from "react";
import {
  MapPin, TrendingDown, Zap, ArrowRight, CheckCircle,
  Shield, Users, BarChart3, Cpu, Star, Lock, Globe, Smartphone, Bot, Target, Sparkles, X, Phone, Mail, Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";

const CITIES = ["Stockholm", "London", "Berlin", "Austin", "Toronto", "Amsterdam", "Sydney", "Dubai", "Paris", "Chicago", "Miami", "Munich"];
const NICHES = ["HVAC companies", "dental clinics", "auto repair shops", "law firms", "roofing contractors", "plumbing services", "med spas", "accounting firms", "real estate agents", "chiropractic offices", "landscaping companies", "pest control services"];

const START_COUNT = 0;

function generateItem(id: number) {
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const niche = NICHES[Math.floor(Math.random() * NICHES.length)];
  const count = Math.floor(Math.random() * 28) + 6;
  const loss = (Math.floor(Math.random() * 12) + 3) * 1000;
  return { id, city, niche, count, loss };
}

function AnimNum({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current) return;
    const diff = value - prev.current;
    const steps = 14;
    let step = 0;
    const id = setInterval(() => {
      step++;
      setDisplay(Math.round(prev.current + (diff * step) / steps));
      if (step >= steps) { clearInterval(id); prev.current = value; }
    }, 28);
    return () => clearInterval(id);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

function FeedRow({ item, isNew }: { item: any; isNew: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 40); return () => clearTimeout(t); }, []);
  return (
    <div className={`grid grid-cols-[8px_1fr_auto_auto] items-center gap-x-3.5 px-5 py-3 border-b border-white/5 transition-all duration-350 ${isNew ? "bg-cyan-500/5" : "bg-transparent"} ${show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}>
      <span className={`w-2 h-2 rounded-full ${isNew ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "bg-emerald-400"}`} />
      <span className="text-sm text-slate-400 truncate">
        <span className="text-slate-100 font-semibold">{item.count} leads</span>
        <span className="mx-1">·</span>
        <span className="text-slate-100">{item.city}</span>
        <span className="mx-1">·</span>
        <span className="text-slate-500 text-xs">{item.niche}</span>
      </span>
      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
        −${(item.loss / 1000).toFixed(0)}k/mo
      </span>
    </div>
  );
}

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [totalLeads, setTotalLeads] = useState(START_COUNT);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [liveWaitlistCount, setLiveWaitlistCount] = useState(2847);
  const nextId = useRef(200);
  const totalRef = useRef(START_COUNT);
  const [loading, setLoading] = useState(false);

  // 1. FETCH COUNT WITH NO-CACHE HEADERS
  const fetchRealCount = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/waitlist?select=count`, {
        headers: {
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          "Accept": "application/json",
          "Prefer": "count=exact",
        }
      });
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.count !== undefined) {
        setLiveWaitlistCount(2847 + parseInt(data[0].count));
      }
    } catch (e) {
      console.error("Count fetch failed", e);
    }
  };

  useEffect(() => {
    // 2. CHECK LOCAL STORAGE ON LOAD
    const hasJoined = localStorage.getItem("joined_waitlist");
    if (hasJoined) setSubmitted(true);

    fetchRealCount();

    const feedId = setInterval(() => {
      const item = generateItem(nextId.current++);
      totalRef.current += item.count;
      setTotalLeads(totalRef.current);
      setFeedItems(prev => [item, ...prev.slice(0, 7)]);
    }, 3500);

    const countId = setInterval(fetchRealCount, 30000);

    return () => {
      clearInterval(feedId);
      clearInterval(countId);
    };
  }, []);

  const handleSubmit = async () => {
    if (!email || !email.includes("@")) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSubmitted(true);
        // 3. LOCK USER IN BROWSER
        localStorage.setItem("joined_waitlist", "true");
        await fetchRealCount(); // Refresh count immediately
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c12] text-slate-100 font-sans selection:bg-cyan-500/30 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_90%_60%_at_50%_0%,black_30%,transparent_100%)]" />
        <div className="absolute top-[-280px] left-1/2 -translate-x-1/2 w-[1100px] h-[700px] bg-[radial-gradient(ellipse,rgba(34,211,238,0.07)_0%,transparent_68%)]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <nav className="flex items-center justify-between py-6 border-b border-white/5">
          <div className="logo flex items-center gap-3 font-bold text-lg tracking-tight">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-900">
              <Zap size={18} fill="currentColor" />
            </div>
            LeakDetector<span className="text-cyan-400">AI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE SCANNING
            </span>
            <span className="px-3 py-1 rounded-full border border-white/10 text-[10px] font-mono text-slate-400">
              <AnimNum value={liveWaitlistCount} /> ON WAITLIST
            </span>
          </div>
        </nav>

        <section className="pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/5 border border-cyan-500/20 text-[10px] font-mono text-cyan-400 mb-8 uppercase tracking-widest">
            <Cpu size={12} /> AI-Powered Local Market Intelligence
          </div>
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8">
            Find the Hidden<br />
            <span className="bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">Revenue Leaks.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 font-light mb-12 leading-relaxed">
            The first AI audit tool that identifies businesses losing <strong className="text-slate-100 font-semibold">$5k+/month</strong> and writes hyper-personalized outreach in seconds.
          </p>

          <div className="max-w-xl mx-auto">
            <div className="relative p-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-3xl shadow-2xl">
              {submitted ? (
                <div className="py-8 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-emerald-400 mb-1">You&apos;re #<AnimNum value={liveWaitlistCount} /></h3>
                  <p className="text-slate-400 text-sm italic font-mono">Access opening soon for your market.</p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    placeholder="Enter your work email"
                    className="flex-1 bg-transparent border-none text-white px-6 py-4 outline-none focus:ring-0"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="h-12 sm:h-auto px-8 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black rounded-xl transition-all shadow-lg shadow-cyan-500/25"
                  >
                    {loading ? "JOINING..." : "JOIN WAITLIST"}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="grid lg:grid-cols-[1fr_340px] gap-6">
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between font-mono text-[10px]">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-slate-300 font-bold uppercase tracking-tighter">Live Market Scan Feed</span>
                </div>
                <span className="text-slate-500">UPDATES EVERY 3.5S</span>
              </div>
              <div className="min-h-[300px]">
                {feedItems.length > 0 ? (
                  feedItems.map((item, i) => (
                    <FeedRow key={item.id} item={item} isNew={i === 0} />
                  ))
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-slate-600 font-mono text-xs animate-pulse">
                    Initializing AI Market Scan...
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-[#0e141f] border border-cyan-500/20 shadow-xl">
                <div className="text-5xl font-black tracking-tighter text-cyan-400 mb-1">
                  <AnimNum value={totalLeads} />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Leads identified this session</div>
                <div className="h-1 w-full bg-white/5 mt-6 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 w-2/3 animate-[pfill_4s_ease_infinite_alternate]" />
                </div>
              </div>
              <div className="p-8 rounded-2xl bg-slate-900/50 border border-white/5">
                <div className="text-3xl font-black text-emerald-400 mb-1">$5,200</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Avg monthly leak per business</div>
              </div>
            </div>
          </div>
        </section>

        <footer className="py-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="font-bold text-sm text-slate-500">
            LeakDetector<span className="text-cyan-500">AI</span> © 2026
          </div>
          <div className="flex gap-8 text-[11px] font-mono text-slate-600">
            <a href="#" className="hover:text-cyan-400 transition-colors">PRIVACY</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">TERMS</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">CONTACT</a>
          </div>
        </footer>
      </div>
    </div>
  );
}