import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Import từ file cấu hình
import {
  User, Lock, LogOut, RefreshCcw,
  CheckCircle2, Circle, Clock, FileText, Send, Loader2
} from 'lucide-react';

// --- DỮ LIỆU CẤU HÌNH ---
const USERS = {
  admin: { name: "Quản Lý", role: "admin" },
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
  const [sendingTaskIndex, setSendingTaskIndex] = useState(null); // Theo dõi task nào đang gửi
  const [notification, setNotification] = useState({ msg: '', type: '' });

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
      if(user) showNotify("Đã đồng bộ dữ liệu mới nhất");
    } catch (err) {
      console.error(err);
      showNotify("Lỗi tải dữ liệu", "error");
    } finally {
      setLoadingGlobal(false);
    }
  };

  // Hàm gửi dữ liệu cho 1 Task cụ thể
  const sendSingleTask = async (taskIndex) => {
    if (!user) return;

    // 1. Lấy dữ liệu hiện tại
    const currentRoleData = { ...(checklistData[user.role] || {}) };
    const taskItem = currentRoleData[taskIndex];

    if (!taskItem || !taskItem.done) {
      showNotify("Vui lòng hoàn thành công việc trước khi gửi!", "error");
      return;
    }
    if (taskItem.sent) return; // Đã gửi rồi thì thôi

    setSendingTaskIndex(taskIndex); // Bật loading cho nút này

    try {
      // 2. Cập nhật trạng thái 'sent' cho task này
      taskItem.sent = true;
      currentRoleData[taskIndex] = taskItem;

      // 3. Gửi toàn bộ object JSON lên (Supabase lưu JSONB)
      const today = getTodayISO();
      const { error } = await supabase
        .from('checklist_logs')
        .upsert({
          report_date: today,
          role: user.role,
          data: currentRoleData
        }, { onConflict: 'report_date, role' });

      if (error) throw error;

      // 4. Cập nhật UI
      setChecklistData({ ...checklistData, [user.role]: currentRoleData });
      showNotify("Đã gửi báo cáo thành công!");
    } catch (err) {
      console.error(err);
      showNotify("Gửi thất bại, vui lòng thử lại", "error");

      // Revert trạng thái sent nếu lỗi
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
      showNotify("Sai thông tin đăng nhập!", "error");
    }
  };

  const handleTaskToggle = (idx) => {
    const currentRoleData = { ...(checklistData[user.role] || {}) };
    const taskItem = currentRoleData[idx] || {};

    if (taskItem.sent) return; // Đã gửi thì khóa

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

  // --- RENDER ---
  if (!user) return <LoginScreen loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} notification={notification} />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Toast Notification */}
      {notification.msg && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-lg shadow-xl transform transition-all animate-in slide-in-from-top-5 fade-in duration-300 flex items-center gap-2 font-medium ${notification.type === 'error' ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'}`}>
          {notification.type === 'error' ? <CheckCircle2 className="rotate-45" /> : <CheckCircle2 />}
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
              {user.name.charAt(0)}
            </div>
            <div>
              <h1 className="font-bold text-slate-800 leading-tight">{user.name}</h1>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Clock size={12} /> {getTodayISO()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchTodayData} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all">
              <RefreshCcw size={20} className={loadingGlobal ? "animate-spin text-blue-600" : ""} />
            </button>
            <button onClick={() => setUser(null)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-all">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {user.role === 'admin' ? (
          <AdminView data={checklistData} />
        ) : (
          <StaffView
            config={CHECKLISTS[user.role]}
            data={checklistData[user.role] || {}}
            onToggle={handleTaskToggle}
            onInput={handleInputChange}
            onSend={sendSingleTask}
            sendingIndex={sendingTaskIndex}
          />
        )}
      </main>
    </div>
  );
}

// --- SUB COMPONENTS ---

const LoginScreen = ({ loginForm, setLoginForm, handleLogin, notification }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
          <CheckCircle2 size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Đăng nhập hệ thống</h1>
        <p className="text-slate-500 mt-1">Quản lý công việc & báo cáo</p>
      </div>

      <div className="space-y-5">
        <div className="group">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Tên đăng nhập</label>
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <User className="text-slate-400 mr-3" size={20} />
            <input
              type="text"
              className="bg-transparent w-full outline-none text-slate-800 font-medium"
              placeholder="Ví dụ: nam_np"
              value={loginForm.username}
              onChange={e => setLoginForm({...loginForm, username: e.target.value})}
            />
          </div>
        </div>

        <div className="group">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Mật khẩu</label>
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Lock className="text-slate-400 mr-3" size={20} />
            <input
              type="password"
              className="bg-transparent w-full outline-none text-slate-800 font-medium"
              placeholder="••••••"
              value={loginForm.password}
              onChange={e => setLoginForm({...loginForm, password: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
        </div>

        {notification.msg && (
          <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2 border border-rose-100">
            <Circle size={16} className="fill-current" /> {notification.msg}
          </div>
        )}

        <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-600/30 transition-all transform active:scale-[0.98]">
          Truy cập Dashboard
        </button>
      </div>
    </div>
  </div>
);

const StaffView = ({ config, data, onToggle, onInput, onSend, sendingIndex }) => {
  if (!config) return <div className="text-center p-8 text-slate-400">Chưa có cấu hình công việc</div>;

  const total = config.tasks.length;
  const done = Object.values(data).filter(i => i.done).length;
  const percent = Math.round((done / total) * 100) || 0;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-end mb-2">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{config.title}</h2>
            <p className="text-slate-500 text-sm mt-1">Tiến độ công việc hôm nay</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-blue-600">{percent}%</span>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${percent}%` }}
          ></div>
        </div>
      </div>

      {/* Task List */}
      <div className="grid gap-4">
        {config.tasks.map((task, idx) => {
          const item = data[idx] || {};
          const isDone = item.done;
          const isSent = item.sent;
          const isSending = sendingIndex === idx;

          return (
            <div
              key={idx}
              className={`group bg-white p-4 sm:p-5 rounded-2xl border transition-all duration-200
                ${isSent
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : (isDone ? 'border-blue-200 shadow-md ring-1 ring-blue-50' : 'border-slate-200 hover:border-blue-300 hover:shadow-sm')
                }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Left: Checkbox & Info */}
                <div className="flex items-start gap-4 flex-1 cursor-pointer" onClick={() => !isSent && onToggle(idx)}>
                  <div className={`mt-1 p-0.5 rounded-full transition-colors ${isDone ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-400'}`}>
                     {isDone ? <CheckCircle2 size={28} className="fill-blue-50" /> : <Circle size={28} />}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold text-base sm:text-lg ${isDone ? 'text-slate-700' : 'text-slate-900'}`}>
                      {task.d}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-md border border-slate-200">
                        {item.time || task.t}
                      </span>
                      {isSent && (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-100 px-2 py-1 rounded-md">
                          <CheckCircle2 size={12} /> Đã gửi
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Input & Action */}
                <div className="flex items-center gap-3 w-full sm:w-auto pl-11 sm:pl-0">
                  {task.input && (
                    <div className={`flex-1 sm:flex-none relative ${!isDone ? 'opacity-50 pointer-events-none' : ''}`}>
                      <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input
                        type="text"
                        disabled={!isDone || isSent}
                        value={item.val || ''}
                        onChange={(e) => onInput(idx, e.target.value)}
                        placeholder="Nhập số liệu..."
                        className="w-full sm:w-40 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all"
                      />
                    </div>
                  )}

                  {/* Send Button - Chỉ hiện khi Done và chưa Sent */}
                  {isDone && !isSent && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSend(idx); }}
                      disabled={isSending}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-90 flex-shrink-0"
                      title="Gửi báo cáo này"
                    >
                      {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                  )}

                  {/* Disabled Button Placeholder khi chưa Done để layout không bị nhảy (tùy chọn) */}
                  {(!isDone && !isSent) && <div className="w-10 h-10"></div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AdminView = ({ data }) => (
  <div className="grid gap-6 md:grid-cols-2">
    {Object.keys(CHECKLISTS).map(roleKey => {
      const roleTasks = data[roleKey] || {};
      const config = CHECKLISTS[roleKey];
      const sentCount = Object.values(roleTasks).filter(t => t.sent).length;

      return (
        <div key={roleKey} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">{config.title}</h3>
            <span className="text-xs font-bold bg-white border px-2 py-1 rounded-full text-slate-500">
              {sentCount}/{config.tasks.length}
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto p-2">
            {config.tasks.map((task, idx) => {
              const item = roleTasks[idx];
              if (!item || !item.sent) return null; // Chỉ hiện cái đã gửi
              return (
                <div key={idx} className="p-3 hover:bg-slate-50 rounded-lg flex justify-between items-start gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{task.d}</p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock size={10} /> Hoàn thành lúc {item.time}
                    </p>
                  </div>
                  {item.val && (
                    <span className="font-mono text-sm bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 rounded">
                      {item.val}
                    </span>
                  )}
                </div>
              );
            })}
            {sentCount === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm italic">Chưa có báo cáo nào được gửi</div>
            )}
          </div>
        </div>
      );
    })}
  </div>
);