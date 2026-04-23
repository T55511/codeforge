import React, { useState, useEffect } from 'react';
import { 
  Users, BookOpen, Trash2, ShieldCheck, ChevronLeft, 
  Edit3, Plus, X, Save, BarChart3, History, Tags, Globe, 
  Sparkles, Loader2, Check, Send 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

type AdminTab = 'stats' | 'problems' | 'tags' | 'langs';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');
  const [stats, setStats] = useState<any>(null);
  const [problems, setProblems] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [langs, setLangs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'stats') {
        const res = await api.get('/admin/stats');
        setStats(res.data);
      } else if (activeTab === 'problems') {
        const res = await api.get('/admin/problems');
        setProblems(res.data);
      } else if (activeTab === 'tags') {
        const res = await api.get('/admin/tags');
        setTags(res.data);
      } else if (activeTab === 'langs') {
        const res = await api.get('/admin/languages');
        setLangs(res.data);
      }
    } catch (e) {
      console.error("Admin Fetch Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteItem = async (type: string, id: string | number) => {
    if (!window.confirm("このデータを完全に削除しますか？")) return;
    try {
      await api.delete(`/admin/${type}/${id}`);
      fetchData();
    } catch (e) {
      alert("削除に失敗しました。");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 bg-gray-900 rounded-xl hover:bg-gray-800 transition">
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-3xl font-black italic flex items-center gap-3 tracking-tighter uppercase">
              <ShieldCheck className="text-red-500" size={32} /> Admin Control
            </h1>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 mb-8 bg-gray-900/40 p-1.5 rounded-2xl border border-gray-800 w-fit">
          <TabBtn id="stats" active={activeTab} set={setActiveTab} icon={<BarChart3 size={16}/>} label="Overview" />
          <TabBtn id="problems" active={activeTab} set={setActiveTab} icon={<BookOpen size={16}/>} label="Missions" />
          <TabBtn id="tags" active={activeTab} set={setActiveTab} icon={<Tags size={16}/>} label="Skills" />
          <TabBtn id="langs" active={activeTab} set={setActiveTab} icon={<Globe size={16}/>} label="Langs" />
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-[2.5rem] p-8 shadow-2xl min-h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-500" size={48} /></div>
          ) : (
            <>
              {activeTab === 'stats' && stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatCard label="Total Users" val={stats.user_count || 0} color="blue" />
                  <StatCard label="Total Missions" val={stats.problem_count || 0} color="purple" />
                  <StatCard label="Skill Tags" val={stats.tag_count || 0} color="yellow" />
                </div>
              )}

              {activeTab === 'problems' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase text-gray-500 tracking-widest italic">Mission Management</h3>
                    <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition">
                      <Plus size={14}/> Create Mission
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {problems.map(p => (
                      <div key={p.id} className="bg-black/30 border border-gray-800 p-6 rounded-3xl flex justify-between items-center group">
                        <div>
                          <div className="text-[9px] font-black text-blue-500 uppercase mb-1">{p.difficulty_level} / {p.language_id}</div>
                          <h4 className="font-bold text-lg leading-tight">{p.title}</h4>
                        </div>
                        <div className="flex gap-1">
                          <button className="p-2 text-gray-500 hover:text-white transition"><Edit3 size={18}/></button>
                          <button onClick={() => deleteItem('problems', p.id)} className="p-2 text-gray-500 hover:text-red-500 transition"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'tags' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase text-gray-500 tracking-widest italic">Skill Tree Nodes</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {tags.map(t => (
                      <div key={t.id} className="bg-black/40 border border-gray-800 p-6 rounded-3xl flex justify-between items-start group">
                        <div>
                          <h4 className="font-bold tracking-tight">{t.name}</h4>
                          <p className="text-[10px] text-gray-500 mt-1 italic">{t.description || "No description."}</p>
                        </div>
                        <button onClick={() => deleteItem('tags', t.id)} className="p-2 text-gray-700 hover:text-red-500 transition"><Trash2 size={18}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'langs' && (
                <div className="space-y-6">
                  <div className="flex justify-end">
                    <button className="flex items-center gap-2 px-6 py-3 bg-purple-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                      <Plus size={14}/> Add Language
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {langs.map(l => (
                      <div key={l.id} className="bg-black/40 border border-gray-800 p-6 rounded-3xl flex justify-between items-center group">
                        <span className="font-black uppercase tracking-widest text-blue-400 text-sm italic">{l.display_name}</span>
                        <button onClick={() => deleteItem('languages', l.id)} className="p-2 text-gray-700 hover:text-red-500 transition"><Trash2 size={18}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ id, active, set, icon, label }: any) {
  return (
    <button 
      onClick={() => set(id)} 
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition ${active === id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
    >
      {icon} {label}
    </button>
  );
}

function StatCard({ label, val, color }: any) {
  const colors: any = { blue: 'text-blue-500', purple: 'text-purple-500', yellow: 'text-yellow-500' };
  return (
    <div className="bg-black/30 border border-gray-800 p-8 rounded-[2.5rem] text-center transition duration-500 hover:border-blue-900/30 shadow-lg">
      <div className="text-[9px] font-black uppercase text-gray-600 tracking-[0.3em] mb-3">{label}</div>
      <div className={`text-5xl font-black tracking-tighter ${colors[color]}`}>{val}</div>
    </div>
  );
}
