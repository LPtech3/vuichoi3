import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  User, Lock, LogOut, RefreshCcw,
  CheckCircle2, Circle, Clock, FileText, Send, Loader2,
  LayoutDashboard, Menu, X, ChevronRight, ShieldCheck
} from 'lucide-react';

// --- DỮ LIỆU CẤU HÌNH ---
const USERS = {
  admin: { name: "Quản Lý Tổng", role: "admin" },
  nam_np: { name: "Nam Nhà Phao", role: "nam_np" },
  nu_np: { name: "Nữ Nhà Phao", role: "nu_np" },
  nam_xd: { name: "Nam Xe Điện", role: "nam_xd" },
  nu_xd: { name: "Nữ Xe Điện", role: "nu_xd" }
};

const CHECKLISTS = {
  nam_np: { title: "Khu Nhà Phao (Nam)", tasks: [
      {t:"15:30", d:"Check-in, Dọn xe"}, {t:"16:00", d:"Dán ống, bơm, gỡ bạt"}, {t:"16:00", d:"Dọn hồ cá, bơm nước"},
      {t:"Khi đầy", d:"Lau nhà hơi"}, {t:"17:30", d:"Treo đèn"}, {t:"18:30", d:"Nhặt rác"},
      {t:"20:00", d:"Xả nhà phao, gấp bạt"}, {t:"Cuối ca", d:"Báo số nước", input:true},
      {t:"Cuối ca", d:"Tắt đèn, rút điện"}, {t:"21:00", d:"Check-out", input:true}
  ]},
  nu_np: { title: "Khu Nhà Phao (Nữ)", tasks: [
      {t:"15:30", d:"Check-in, Phụ dọn"}, {t:"Đầu ca", d:"Kiểm kê nước đầu ca", input:true},
      {t:"18:00", d:"Đốt nhang muỗi"}, {t:"18:30", d:"Nhặt rác"}, {t:"20:00", d:"Dọn dẹp, kéo bạt"},
      {t:"Cuối ca", d:"Kiểm kê nước cuối ca", input:true}, {t:"Cuối ca", d:"Sạc đèn"}, {t:"21:00", d:"Check-out"}
  ]},
};

// --- COMPONENT CHÍNH ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [checklistData, setChecklistData] = useState({});
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [sendingTaskIndex, setSendingTaskIndex] = useState(null);
  const [notification, setNotification] = useState({ msg: '', type: '' });
  const [isSidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar toggle

  // --- UTILS ---
  const getTodayISO = () => {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
  };

  const showNotify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification({ msg: '', type: '' }), 3000);
  };

  // --- LOGIC SUPABASE ---
  const fetchTodayData = async () => {
    setLoadingGlobal(true);
    const today = getTodayISO();
    try {
      let { data, error } = await supabase
        .from('checklist_logs')
        .select('role, data')
        .eq('report_date', today);

      if (error) throw error;

      const newData = {};
      if (data?.length) {
        data.forEach(row => { newData[row.role] = row.data; });
      }
      setChecklistData(newData);
      if(user) showNotify("Đã đồng bộ dữ liệu");
    } catch (err) {
      console.error(err);
      showNotify("Lỗi tải dữ liệu", "error");
    } finally {
      setLoadingGlobal(false);
    }
  };

  const sendSingleTask = async (taskIndex) => {
    if (!user) return;
    const currentRoleData = { ...(checklistData[user.role] || {}) };
    const taskItem = currentRoleData[taskIndex];

    if (!taskItem || !taskItem.done) {
      showNotify("Chưa hoàn thành công việc!", "error");
      return;
    }
    if (taskItem.sent) return;

    setSendingTaskIndex(taskIndex);
    try {
      taskItem.sent = true;
      currentRoleData[taskIndex] = taskItem;

      const today = getTodayISO();
      const { error } = await supabase
        .from('checklist_logs')
        .upsert({
          report_date: today,
          role: user.role,
          data: currentRoleData
        }, { onConflict: 'report_date, role' });

      if (error) throw error;
      setChecklistData({ ...checklistData, [user.role]: currentRoleData });
      showNotify("Đã gửi báo cáo!");
    } catch (err) {
      console.error(err);
      showNotify("Gửi thất bại", "error");
      taskItem.sent = false;
      currentRoleData[taskIndex] = taskItem;
      setChecklistData({ ...checklistData, [user.role]: currentRoleData });
    } finally {
      setSendingTaskIndex(null);
    }
  };

  useEffect(() => {
    if (user) fetchTodayData();
  }, [user]);

  // --- HANDLERS ---
  const handleLogin = () => {
    const { username, password } = loginForm;
    if (USERS[username] && password === '123') {
      setUser({ ...USERS[username], username });
    } else {
      showNotify("Sai thông tin!", "error");
    }
  };

  const handleTaskToggle = (idx) => {
    const currentRoleData = { ...(checklistData[user.role] || {}) };
    const taskItem = currentRoleData[idx] || {};
    if (taskItem.sent) return;

    const isDone = !taskItem.done;
    currentRoleData[idx] = {
      ...taskItem,
      done: isDone,
      time: isDone ? new Date().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : ''
    };
    setChecklistData({ ...checklistData, [user.role]: currentRoleData });
  };

  const handleInputChange = (idx, val) => {
    const currentRoleData = { ...(checklistData[user.role] || {}) };
    if (currentRoleData[idx]?.sent) return;
    currentRoleData[idx] = { ...currentRoleData[idx], val };
    setChecklistData({ ...checklistData, [user.role]: currentRoleData });
  };

  // --- RENDER UI ---
  if (!user) return <ModernLogin loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} notification={notification} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100">
      {/* Toast */}
      {notification.msg && (
        <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-lg shadow-xl border flex items-center gap-3 animate-bounce-short ${notification.type === 'error' ? 'bg-white border-red-100 text-red-600' : 'bg-white border-emerald-100 text-emerald-600'}`}>
          {notification.type === 'error' ? <X size={20} /> : <CheckCircle2 size={20} />}
          <span className="font-medium">{notification.msg}</span>
        </div>
      )}

      {/* Sidebar / Header Layout */}
      <div className="flex flex-col lg:flex-row min-h-screen">

        {/* Sidebar (Desktop) & Header (Mobile) */}
        <aside className="lg:w-72 bg-white border-r border-slate-200 lg:h-screen lg:sticky lg:top-0 z-40 flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 backdrop-blur-md lg:bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/30">
                {user.name.charAt(0)}
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-sm lg:text-base">{user.name}</h1>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                   {user.role === 'admin' ? 'Administrator' : 'Staff'}
                </span>
              </div>
            </div>
            {/* Mobile Toggle */}
            <button className="lg:hidden p-2 text-slate-500" onClick={() => setSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <X /> : <Menu />}
            </button>
          </div>

          {/* Navigation Menu */}
          <div className={`absolute lg:static w-full bg-white border-b lg:border-none border-slate-200 p-4 transition-all duration-300 ease-in-out z-30 ${isSidebarOpen ? 'top-20 opacity-100 visible shadow-xl' : 'top-[-400px] opacity-0 invisible lg:opacity-100 lg:visible'}`}>
             <nav className="space-y-2">
                <div className="p-3 rounded-xl bg-blue-50 text-blue-700 font-medium flex items-center gap-3">
                  <LayoutDashboard size={20} />
                  Dashboard
                </div>
                <div className="px-4 py-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Thông tin hôm nay</p>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                    <Clock size={16} className="text-slate-400"/> {getTodayISO()}
                  </div>
                </div>
             </nav>
             <div className="mt-auto pt-4 border-t border-slate-100 lg:absolute lg:bottom-0 lg:w-full lg:left-0 lg:p-4">
                <button onClick={() => fetchTodayData()} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-slate-600 hover:bg-slate-50 transition-all mb-2 border border-slate-200">
                  <RefreshCcw size={18} className={loadingGlobal ? "animate-spin" : ""} /> Đồng bộ
                </button>
                <button onClick={() => setUser(null)} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all font-medium">
                  <LogOut size={18} /> Đăng xuất
                </button>
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-slate-50/50 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            {user.role === 'admin' ? (
              <ModernAdminView data={checklistData} />
            ) : (
              <ModernStaffView
                config={CHECKLISTS[user.role]}
                data={checklistData[user.role] || {}}
                onToggle={handleTaskToggle}
                onInput={handleInputChange}
                onSend={sendSingleTask}
                sendingIndex={sendingTaskIndex}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// --- MODERN SUB COMPONENTS ---

const ModernLogin = ({ loginForm, setLoginForm, handleLogin, notification }) => (
  <div className="min-h-screen flex bg-slate-50">
    {/* Left Side - Decorative (Hidden on Mobile) */}
    <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 to-indigo-900 items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      <div className="text-center text-white p-12 relative z-10">
        <div className="w-24 h-24 bg-white/20 backdrop-blur-lg rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl">
           <ShieldCheck size={48} />
        </div>
        <h1 className="text-4xl font-bold mb-4">Hệ Thống Quản Lý</h1>
        <p className="text-blue-100 text-lg max-w-md mx-auto">Theo dõi tiến độ, báo cáo công việc và quản lý vận hành khu vui chơi hiệu quả.</p>
      </div>
    </div>

    {/* Right Side - Form */}
    <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-800">Xin chào,</h2>
          <p className="text-slate-500 mt-2">Vui lòng đăng nhập để bắt đầu ca làm việc.</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Tên đăng nhập</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                className="w-full bg-white border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                placeholder="Nhập username..."
                value={loginForm.username}
                onChange={e => setLoginForm({...loginForm, username: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="password"
                className="w-full bg-white border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                placeholder="•••••••"
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>

          {notification.msg && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
              <X size={16} /> {notification.msg}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-[0.99]"
          >
            Đăng nhập hệ thống
          </button>
        </div>
      </div>
    </div>
  </div>
);

const ModernStaffView = ({ config, data, onToggle, onInput, onSend, sendingIndex }) => {
  if (!config) return null;

  const total = config.tasks.length;
  const doneCount = Object.values(data).filter(i => i.done).length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header Card */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">{config.title}</h2>
            <p className="text-slate-500 mt-1">Hoàn thành công việc để gửi báo cáo</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">{percent}%</div>
              <div className="text-xs text-slate-400 font-medium uppercase">Tiến độ</div>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-slate-100 flex items-center justify-center bg-white shadow-inner relative">
               <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent transform -rotate-45" style={{ clipPath: `polygon(0 0, 100% 0, 100% ${percent}%, 0 ${percent}%)` }}></div> {/* Simple CSS visual trick, replace with SVG circle for accuracy if needed */}
               <CheckCircle2 className="text-blue-600" size={24}/>
            </div>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="mt-6 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
           <div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]" style={{ width: `${percent}%` }}></div>
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
        {config.tasks.map((task, idx) => {
          const item = data[idx] || {};
          const isDone = item.done;
          const isSent = item.sent;

          return (
            <div
              key={idx}
              onClick={() => !isSent && onToggle(idx)}
              className={`group relative bg-white rounded-2xl p-4 lg:p-5 border-2 transition-all cursor-pointer overflow-hidden hover:shadow-md
                ${isSent
                  ? 'border-emerald-100 bg-emerald-50/20'
                  : isDone
                    ? 'border-blue-100 shadow-sm'
                    : 'border-transparent hover:border-slate-200 shadow-sm'
                }
              `}
            >
              {/* Status Indicator Strip */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors
                ${isSent ? 'bg-emerald-500' : isDone ? 'bg-blue-500' : 'bg-slate-200'}
              `}></div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pl-3">
                {/* Checkbox */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all
                   ${isDone ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-300 group-hover:bg-slate-200'}
                   ${isSent ? '!bg-emerald-100 !text-emerald-600' : ''}
                `}>
                   {isSent ? <CheckCircle2 size={20} strokeWidth={3}/> : isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded text-slate-500 bg-slate-100 border border-slate-200">
                        {task.t}
                      </span>
                      {item.time && (
                        <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                           <Clock size={10} /> {item.time}
                        </span>
                      )}
                   </div>
                   <h3 className={`font-semibold text-lg truncate pr-4 ${isSent || isDone ? 'text-slate-700' : 'text-slate-900'}`}>
                     {task.d}
                   </h3>
                </div>

                {/* Actions (Input & Send) */}
                <div className="w-full sm:w-auto flex items-center justify-end gap-3 mt-2 sm:mt-0 pl-12 sm:pl-0">
                  {task.input && (
                    <div onClick={e => e.stopPropagation()} className="relative w-full sm:w-32">
                      <input
                        type="text"
                        disabled={!isDone || isSent}
                        value={item.val || ''}
                        onChange={(e) => onInput(idx, e.target.value)}
                        placeholder="..."
                        className={`w-full bg-slate-50 border-slate-200 border rounded-lg py-2 px-3 text-center font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all
                          ${!isDone ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                      />
                    </div>
                  )}

                  {isDone && !isSent && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSend(idx); }}
                      disabled={sendingIndex === idx}
                      className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-90 transition-all"
                    >
                      {sendingIndex === idx ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  )}

                  {isSent && (
                    <div className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 size={14} /> Đã gửi
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ModernAdminView = ({ data }) => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-bold text-slate-800">Tổng quan báo cáo</h2>
            <p className="text-slate-500">Theo dõi trạng thái các khu vực</p>
         </div>
         {/* Filter or Summary can go here */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.keys(CHECKLISTS).map(roleKey => {
          const roleTasks = data[roleKey] || {};
          const config = CHECKLISTS[roleKey];
          const sentCount = Object.values(roleTasks).filter(t => t.sent).length;
          const total = config.tasks.length;
          const progress = Math.round((sentCount / total) * 100);

          return (
            <div key={roleKey} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${progress === 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                      {progress === 100 ? <ShieldCheck size={20}/> : <LayoutDashboard size={20}/>}
                   </div>
                   <div>
                      <h3 className="font-bold text-slate-800">{config.title}</h3>
                      <div className="h-1.5 w-24 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{width: `${progress}%`}}></div>
                      </div>
                   </div>
                </div>
                <span className={`text-sm font-bold px-3 py-1 rounded-full border ${progress === 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {sentCount}/{total}
                </span>
              </div>

              <div className="p-0 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                {sentCount === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                    <Clock size={32} className="mb-2 opacity-20"/>
                    <p className="text-sm">Chưa có dữ liệu báo cáo</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {config.tasks.map((task, idx) => {
                      const item = roleTasks[idx];
                      if (!item || !item.sent) return null;
                      return (
                        <div key={idx} className="p-4 flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                           <div className="flex items-start gap-3">
                              <CheckCircle2 size={16} className="text-emerald-500 mt-1 shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-slate-700">{task.d}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{item.time}</p>
                              </div>
                           </div>
                           {item.val && (
                             <span className="font-mono font-bold text-sm bg-amber-50 text-amber-700 px-3 py-1 rounded border border-amber-100">
                               {item.val}
                             </span>
                           )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer Link */}
              <div className="bg-slate-50 p-3 text-center border-t border-slate-100">
                 <button className="text-xs font-bold text-blue-600 flex items-center justify-center gap-1 hover:underline">
                    Xem chi tiết <ChevronRight size={12}/>
                 </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};