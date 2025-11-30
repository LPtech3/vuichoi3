import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  User, Lock, LogOut, RefreshCcw, Camera, Trash2, Plus,
  CheckCircle2, Clock, Send, Loader2,
  LayoutDashboard, Menu, X, ShieldCheck,
  Users, ListTodo, Image as ImageIcon, MapPin, Briefcase,
  CalendarClock, AlertTriangle, AlertCircle,
  Edit3, Copy, Key, Save, XCircle, BarChart3, TrendingUp, DollarSign, Calendar, Filter
} from 'lucide-react';

// --- STYLES ---
const CustomStyles = () => (
  <style>{`
    @keyframes blink-red {
      0%, 100% { background-color: #fff; border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      50% { background-color: #fef2f2; border-color: #b91c1c; box-shadow: 0 0 10px 2px rgba(239, 68, 68, 0.3); }
    }
    .urgent-blink {
      animation: blink-red 1.5s infinite;
      border-width: 2px;
    }
    .animate-bounce-short {
      animation: bounce 0.5s 1;
    }
  `}</style>
);

// --- UTILS ---
const getTodayISO = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
};

const showNotify = (setter, msg, type = 'success') => {
  setter({ msg, type });
  setTimeout(() => setter({ msg: '', type: '' }), 3000);
};

const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không hỗ trợ định vị."));
    } else {
      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      };
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) => {
          let msg = "Không thể lấy vị trí.";
          if (error.code === 1) msg = "Bạn đã chặn quyền truy cập vị trí.";
          else if (error.code === 2) msg = "Không bắt được sóng GPS.";
          else if (error.code === 3) msg = "Hết thời gian chờ GPS (Timeout).";
          reject(new Error(msg));
        },
        options
      );
    }
  });
};

const checkIsDue = (timeLabel, isDone = false) => {
  if (isDone || !timeLabel || typeof timeLabel !== 'string' || !timeLabel.includes(':')) return false;
  try {
      const now = new Date();
      const [h, m] = timeLabel.split(':').map(Number);
      const taskTime = new Date();
      taskTime.setHours(h, m, 0, 0);
      return now >= taskTime;
  } catch (e) { return false; }
};

const checkIsLateWithBuffer = (timeLabel, bufferMins = 0, isDone = false) => {
    if (isDone || !timeLabel || typeof timeLabel !== 'string' || !timeLabel.includes(':')) return false;
    try {
        const now = new Date();
        const [h, m] = timeLabel.split(':').map(Number);
        const taskTime = new Date();
        taskTime.setHours(h, m, 0, 0);
        const buffer = parseInt(bufferMins) || 0;
        const deadline = new Date(taskTime.getTime() + (buffer * 60000));
        return now > deadline;
    } catch (e) { return false; }
}

const sortTasksByTime = (tasks) => {
    if(!tasks || !Array.isArray(tasks)) return [];
    return tasks.sort((a, b) => {
        const timeA = a.time_label || '23:59';
        const timeB = b.time_label || '23:59';
        return timeA.localeCompare(timeB);
    });
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // Data States
  const [tasksConfig, setTasksConfig] = useState([]);
  const [checklistData, setChecklistData] = useState({});
  const [usersList, setUsersList] = useState([]);
  const [rolesList, setRolesList] = useState([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ msg: '', type: '' });
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', loginForm.username)
        .eq('password', loginForm.password)
        .single();

      if (error || !data) throw new Error("Sai thông tin đăng nhập");

      setUser(data);
      if(data.role !== 'admin') {
         fetchTasksConfig(data.role);
         fetchTodayReport(data.role);
      } else {
         fetchAllDataAdmin();
      }
    } catch (err) {
      showNotify(setNotification, err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (newPass) => {
    if(!newPass || newPass.length < 3) return showNotify(setNotification, "Mật khẩu quá ngắn", "error");
    setLoading(true);
    try {
      const { error } = await supabase.from('app_users').update({ password: newPass }).eq('id', user.id);
      if(error) throw error;
      showNotify(setNotification, "Đổi mật khẩu thành công!");
      setShowChangePass(false);
    } catch (err) {
      showNotify(setNotification, "Lỗi đổi mật khẩu", "error");
    } finally {
      setLoading(false);
    }
  }

  const fetchTasksConfig = async (role) => {
    const { data } = await supabase.from('task_definitions').select('*').eq('role', role).order('time_label', { ascending: true });
    if(data) setTasksConfig(data);
  };

  const fetchTodayReport = async (role) => {
    const today = getTodayISO();
    const { data } = await supabase.from('checklist_logs').select('data').eq('report_date', today).eq('role', role).single();
    if (data) setChecklistData(prev => ({...prev, [role]: data.data || {}}));
  };

  const fetchAllDataAdmin = async () => {
    try {
        const today = getTodayISO();
        const { data: uData } = await supabase.from('app_users').select('*').order('created_at');
        setUsersList(uData || []);
        const { data: rData } = await supabase.from('job_roles').select('*').order('created_at');
        setRolesList(rData || []);
        const { data: tData } = await supabase.from('task_definitions').select('*').order('time_label', { ascending: true });
        setTasksConfig(tData || []);
        const { data: repData } = await supabase.from('checklist_logs').select('role, data').eq('report_date', today);
        const reportMap = {};
        if(repData) repData.forEach(r => reportMap[r.role] = r.data);
        setChecklistData(reportMap);
    } catch (error) {
        showNotify(setNotification, "Lỗi tải dữ liệu admin", "error");
    }
  };

  if (!user) return <ModernLogin loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} notification={notification} loading={loading} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <CustomStyles />
      {showChangePass && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="font-bold text-lg mb-4">Đổi mật khẩu mới</h3>
              <input type="password" id="newPassInput" className="w-full border p-3 rounded-lg mb-4" placeholder="Nhập mật khẩu mới..." />
              <div className="flex justify-end gap-3">
                 <button onClick={() => setShowChangePass(false)} className="px-4 py-2 text-slate-500 font-medium">Hủy</button>
                 <button onClick={() => handleChangePassword(document.getElementById('newPassInput').value)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Lưu</button>
              </div>
           </div>
        </div>
      )}

      {notification.msg && (
        <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-lg shadow-xl border flex items-center gap-3 animate-bounce-short ${notification.type === 'error' ? 'bg-white border-red-100 text-red-600' : 'bg-white border-emerald-100 text-emerald-600'}`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="font-medium">{notification.msg}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-screen">
        <aside className="lg:w-72 bg-white border-r border-slate-200 lg:h-screen lg:sticky lg:top-0 z-40 flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                {user.name ? user.name.charAt(0) : 'U'}
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-sm lg:text-base">{user.name}</h1>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                   {user.role}
                </span>
              </div>
            </div>
            <button className="lg:hidden p-2 text-slate-500" onClick={() => setSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <X /> : <Menu />}
            </button>
          </div>
          <div className={`absolute lg:static w-full bg-white border-b lg:border-none border-slate-200 p-4 transition-all duration-300 z-30 ${isSidebarOpen ? 'top-20 opacity-100 visible shadow-xl' : 'top-[-400px] opacity-0 invisible lg:opacity-100 lg:visible'}`}>
             <div className="mt-4 space-y-2">
                <button onClick={() => setShowChangePass(true)} className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50 transition-all font-medium">
                   <Key size={18} /> Đổi mật khẩu
                </button>
             </div>
             <div className="mt-auto pt-4 lg:absolute lg:bottom-0 lg:w-full lg:left-0 lg:p-4 border-t border-slate-100">
                <button onClick={() => { setUser(null); setChecklistData({}); }} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all font-medium">
                  <LogOut size={18} /> Đăng xuất
                </button>
             </div>
          </div>
        </aside>

        <main className="flex-1 bg-slate-50/50 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {user.role === 'admin' ? (
              <AdminDashboard
                users={usersList}
                roles={rolesList}
                allTasks={tasksConfig}
                initialReports={checklistData}
                onRefresh={fetchAllDataAdmin}
                setNotify={(m, t) => showNotify(setNotification, m, t)}
              />
            ) : (
              <StaffDashboard
                user={user}
                tasks={tasksConfig}
                reportData={checklistData[user.role] || {}}
                onUpdateLocal={(newData) => setChecklistData({...checklistData, [user.role]: newData})}
                setNotify={(m, t) => showNotify(setNotification, m, t)}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ==========================================
// STAFF COMPONENTS
// ==========================================
const StaffDashboard = ({ user, tasks, reportData, onUpdateLocal, setNotify }) => {
    const [attendance, setAttendance] = useState({ in: null, out: null });
    const [loadingSend, setLoadingSend] = useState(null);
    const [attLoading, setAttLoading] = useState(false);
    const [, setTick] = useState(0);

    useEffect(() => {
        checkAttendanceStatus();
        const timer = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(timer);
    }, []);

    const checkAttendanceStatus = async () => {
      try {
          const today = getTodayISO();
          const { data } = await supabase.from('time_logs').select('*').eq('user_id', user.id).eq('report_date', today);
          if (data) {
            const checkIn = data.find(x => x.action_type === 'check_in');
            const checkOut = data.find(x => x.action_type === 'check_out');
            setAttendance({
              in: checkIn ? new Date(checkIn.log_time).toLocaleTimeString('vi-VN') : null,
              out: checkOut ? new Date(checkOut.log_time).toLocaleTimeString('vi-VN') : null
            });
          }
      } catch (e) { console.error(e); }
    };

    const handleAttendanceCapture = async (e, type) => {
      const file = e.target.files[0];
      if (!file) return;

      setAttLoading(true);
      setNotify("Đang định vị và tải ảnh (Vui lòng chờ)...", "info");

      try {
         const location = await getCurrentLocation();
         const fileExt = file.name.split('.').pop();
         const fileName = `attendance/${user.username}_${type}_${Date.now()}.${fileExt}`;

         const { error: uploadError } = await supabase.storage.from('task-images').upload(fileName, file);
         if (uploadError) throw uploadError;

         const { data: { publicUrl } } = supabase.storage.from('task-images').getPublicUrl(fileName);

         const { error } = await supabase.from('time_logs').insert({
             user_id: user.id,
             action_type: type,
             report_date: getTodayISO(),
             image_url: publicUrl,
             lat: location.lat,
             lng: location.lng
         });

         if (error) throw error;
         setNotify(`Đã ${type === 'check_in' ? 'Check-in' : 'Check-out'} thành công!`);
         checkAttendanceStatus();

      } catch (err) {
         setNotify(err.message || "Lỗi. Hãy kiểm tra GPS và mạng.", "error");
      } finally {
         setAttLoading(false);
      }
    };

    const handleTaskAction = async (taskDefId, actionType, value) => {
       const currentTaskData = reportData[taskDefId] || {};
       if (currentTaskData.sent) return;
       let updatedItem = { ...currentTaskData };
       if (actionType === 'toggle') {
          const isDone = !updatedItem.done;
          updatedItem = { ...updatedItem, done: isDone, time: isDone ? new Date().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : '' };
       } else if (actionType === 'input') updatedItem.val = value;
       else if (actionType === 'image') updatedItem.imageUrl = value;
       onUpdateLocal({ ...reportData, [taskDefId]: updatedItem });
    };

    const sendSingleTask = async (taskDefId) => {
       const item = reportData[taskDefId];
       if(!item || !item.done) return setNotify("Chưa hoàn thành!", "error");
       const taskDef = tasks.find(t => t.id === taskDefId);
       if(taskDef?.require_input && !item.val) return setNotify("Thiếu thông tin!", "error");
       if(taskDef?.require_image && !item.imageUrl) return setNotify("Thiếu ảnh!", "error");

       setLoadingSend(taskDefId);
       try {
         const newItem = { ...item, sent: true };
         const newReportData = { ...reportData, [taskDefId]: newItem };
         onUpdateLocal(newReportData);

         const { error } = await supabase.from('checklist_logs').upsert({ report_date: getTodayISO(), role: user.role, data: newReportData }, { onConflict: 'report_date, role' });
         if(error) throw error;

         setNotify("Đã gửi báo cáo!");
       } catch (err) {
         const revertedItem = { ...item, sent: false };
         onUpdateLocal({ ...reportData, [taskDefId]: revertedItem });
         setNotify("Gửi lỗi, vui lòng thử lại", "error");
       } finally { setLoadingSend(null); }
    };

    const handleImageUpload = async (e, taskDefId) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        setNotify("Đang tải ảnh...", "info");
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.username}_${taskDefId}_${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('task-images').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('task-images').getPublicUrl(fileName);
        handleTaskAction(taskDefId, 'image', publicUrl);
        setNotify("Tải ảnh thành công");
      } catch (error) { setNotify("Lỗi tải ảnh", "error"); }
    };

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => reportData[t.id]?.sent).length;
    const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-end mb-2">
              <span className="font-bold text-slate-700">Tiến độ hôm nay</span>
              <span className="text-blue-600 font-bold text-lg">{progressPercent}%</span>
           </div>
           <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
           </div>
           <p className="text-xs text-slate-400 mt-2 text-right">{completedTasks}/{totalTasks} công việc đã gửi</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
           <div><h2 className="text-xl font-bold text-slate-800">Chấm công</h2><p className="text-slate-500 text-sm">Chụp ảnh để vào/ra ca</p></div>

           {attLoading ? (
             <div className="flex items-center gap-2 text-blue-600 font-bold bg-blue-50 px-6 py-3 rounded-xl animate-pulse">
               <Loader2 className="animate-spin"/> Đang xử lý GPS...
             </div>
           ) : (
             <div className="flex gap-3">
                <div className="relative">
                   <input type="file" accept="image/*" capture="user" id="att-in" className="hidden" disabled={!!attendance.in} onChange={(e) => handleAttendanceCapture(e, 'check_in')} />
                   <label htmlFor="att-in" className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all ${attendance.in ? 'bg-slate-100 text-slate-400 cursor-not-allowed pointer-events-none' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30'}`}>
                     <MapPin size={18} /> {attendance.in ? `Vào: ${attendance.in}` : 'Check In'}
                   </label>
                </div>
                <div className="relative">
                   <input type="file" accept="image/*" capture="user" id="att-out" className="hidden" disabled={!attendance.in || !!attendance.out} onChange={(e) => handleAttendanceCapture(e, 'check_out')} />
                   <label htmlFor="att-out" className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all ${attendance.out ? 'bg-slate-100 text-slate-400 pointer-events-none' : (!attendance.in ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100')}`}>
                     <LogOut size={18} /> {attendance.out ? `Ra: ${attendance.out}` : 'Check Out'}
                   </label>
                </div>
             </div>
           )}
        </div>

        <div className="grid gap-4">
          {tasks.map((task) => {
            const item = reportData[task.id] || {};
            const isDone = item.done;
            const isSent = item.sent;

            const isDue = checkIsDue(task.time_label, isDone);
            const isLate = checkIsLateWithBuffer(task.time_label, task.late_buffer, isDone);

            const cardClass = isSent
                ? 'border-emerald-100 bg-emerald-50/20'
                : (isDue && !isDone)
                    ? 'urgent-blink text-red-800'
                    : isDone
                        ? 'border-blue-100 bg-white'
                        : 'border-transparent shadow-sm bg-white';

            return (
               <div key={task.id} className={`p-4 rounded-xl border-2 transition-all ${cardClass}`}>
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                     <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => !isSent && handleTaskAction(task.id, 'toggle')}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDone ? (isSent ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600') : (isDue ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-300')}`}>{isDue && !isDone ? <AlertTriangle size={20}/> : <CheckCircle2 size={20}/>}</div>
                        <div>
                           <div className="flex items-center gap-2 text-xs mb-1">
                               <span className={`font-bold px-2 py-0.5 rounded ${isLate && !isDone ? 'bg-red-600 text-white' : (isDue && !isDone ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500')}`}>
                                   {task.time_label} {isLate && !isDone ? '(TRỄ)' : (isDue && !isDone ? '(ĐẾN GIỜ)' : '')}
                               </span>
                               {item.time && <span className="text-blue-600 font-medium"><Clock size={10} className="inline mr-1"/>{item.time}</span>}
                           </div>
                           <h3 className={`font-semibold ${isDue && !isDone ? 'text-red-700' : 'text-slate-800'}`}>{task.title}</h3>
                        </div>
                     </div>
                     <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center mt-2 md:mt-0 pl-12 md:pl-0">
                        {task.require_input && <input disabled={!isDone || isSent} value={item.val || ''} onChange={(e) => handleTaskAction(task.id, 'input', e.target.value)} placeholder="Nhập số..." className="w-full sm:w-24 px-3 py-2 text-sm border rounded-lg text-center bg-slate-50"/>}
                        {task.require_image && (<div className="relative"><input type="file" id={`file-${task.id}`} className="hidden" accept="image/*" disabled={!isDone || isSent} onChange={(e) => handleImageUpload(e, task.id)}/><label htmlFor={`file-${task.id}`} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer ${!isDone || isSent ? 'bg-slate-100' : 'bg-white'}`}>{item.imageUrl ? <span className="text-indigo-600 flex gap-1"><ImageIcon size={16}/>Xem</span> : <span><Camera size={16}/>Ảnh</span>}</label></div>)}
                        {isDone && !isSent && <button onClick={() => sendSingleTask(task.id)} disabled={loadingSend === task.id} className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg">{loadingSend === task.id ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}</button>}
                        {isSent && <span className="text-emerald-600 font-bold text-xs bg-emerald-100 px-3 py-2 rounded-lg"><CheckCircle2 size={14} className="inline"/> Đã gửi</span>}
                     </div>
                  </div>
               </div>
            );
          })}
        </div>
      </div>
    );
  };

// ==========================================
// ADMIN DASHBOARD
// ==========================================
const AdminDashboard = ({ users, roles, allTasks, initialReports, onRefresh, setNotify }) => {
  const [tab, setTab] = useState('timesheet');
  return (
    <div>
      <div className="flex gap-4 mb-6 border-b border-slate-200 pb-1 overflow-x-auto">
        {[
           {id: 'timesheet', icon: CalendarClock, label: 'Giám Sát'},
           {id: 'statistics', icon: BarChart3, label: 'Thống Kê & Lương'},
           {id: 'reports', icon: LayoutDashboard, label: 'Tiến Độ'},
           {id: 'users', icon: Users, label: 'Nhân Sự'},
           {id: 'tasks', icon: ListTodo, label: 'Cấu Hình Việc'},
           {id: 'roles', icon: Briefcase, label: 'Khu Vực'}
        ].map(t => (
           <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-3 font-bold text-sm whitespace-nowrap transition-all border-b-2 ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><t.icon size={18}/> {t.label}</button>
        ))}
        <button onClick={onRefresh} className="ml-auto p-2 text-slate-400 hover:text-blue-600"><RefreshCcw size={18}/></button>
      </div>
      {tab === 'timesheet' && <AdminTimesheet users={users} />}
      {tab === 'statistics' && <AdminStatistics users={users} roles={roles} />}
      {tab === 'reports' && <AdminReports initialReports={initialReports} allTasks={allTasks} roles={roles} />}
      {tab === 'users' && <AdminUserManager users={users} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />}
      {tab === 'tasks' && <AdminTaskManager allTasks={allTasks} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />}
      {tab === 'roles' && <AdminRoleManager roles={roles} allTasks={allTasks} onRefresh={onRefresh} setNotify={setNotify} />}
    </div>
  );
};

// --- FIX TOÀN DIỆN: TÍNH LƯƠNG DỰA TRÊN LOG_TIME (HỖ TRỢ DATA CŨ + CHECK CÙNG NGÀY) ---
// --- ADMIN STATISTICS (NÂNG CẤP CHI TIẾT NHÂN SỰ) ---
const AdminStatistics = ({ users, roles }) => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filterRole, setFilterRole] = useState('');
  const [stats, setStats] = useState([]);
  const [rawLogs, setRawLogs] = useState([]); // Lưu log thô để dùng cho chi tiết
  const [rawChecklists, setRawChecklists] = useState([]); // Lưu checklist thô
  const [loading, setLoading] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(25000);

  // State cho chế độ xem chi tiết
  const [selectedUser, setSelectedUser] = useState(null);

  const calculateStats = async () => {
    setLoading(true);
    setSelectedUser(null); // Reset khi load lại
    try {
      const startDate = `${month}-01T00:00:00`;
      const nextMonth = new Date(month);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = nextMonth.toISOString().slice(0, 10) + 'T00:00:00';

      // 1. Lấy dữ liệu Time Logs
      const { data: logsData } = await supabase.from('time_logs')
        .select('*')
        .gte('log_time', startDate)
        .lt('log_time', endDate)
        .order('log_time', { ascending: true });

      const logs = logsData || [];
      setRawLogs(logs);

      // 2. Lấy dữ liệu Checklists
      const { data: checkData } = await supabase.from('checklist_logs')
        .select('*')
        .ilike('report_date', `${month}%`);

      const checkLists = checkData || [];
      setRawChecklists(checkLists);

      // 3. Tính toán tổng hợp cho bảng chính
      const processed = users.map(user => {
        if (filterRole && user.role !== filterRole) return null;

        const userLogs = logs.filter(l => l.user_id === user.id);

        // Tính giờ làm
        let totalMillis = 0;
        let validWorkDays = new Set();
        let currentCheckIn = null;

        userLogs.forEach(log => {
             const type = (log.action_type || '').toLowerCase();
             const time = new Date(log.log_time);

             if (type.includes('check_in')) {
                 currentCheckIn = time;
             } else if (type.includes('check_out')) {
                 if (currentCheckIn) {
                     const inDateStr = currentCheckIn.toISOString().split('T')[0];
                     const outDateStr = time.toISOString().split('T')[0];
                     if (inDateStr === outDateStr && time > currentCheckIn) {
                        totalMillis += (time - currentCheckIn);
                        validWorkDays.add(inDateStr);
                     }
                     currentCheckIn = null;
                 }
             }
        });

        const totalHours = (totalMillis / (1000 * 60 * 60));

        // Tính hiệu suất công việc
        const userChecklists = checkLists.filter(c => c.role === user.role);
        let totalTasksAssigned = 0;
        let totalTasksDone = 0;

        userChecklists.forEach(cl => {
           const tasks = Object.values(cl.data || {});
           totalTasksAssigned += tasks.length;
           totalTasksDone += tasks.filter(t => t.sent).length;
        });
        const completionRate = totalTasksAssigned === 0 ? 0 : Math.round((totalTasksDone / totalTasksAssigned) * 100);

        return {
           id: user.id,
           name: user.name,
           role: user.role,
           username: user.username,
           workDays: validWorkDays.size,
           totalHours: totalHours.toFixed(1),
           rawHours: totalHours,
           completionRate
        };
      }).filter(Boolean);

      setStats(processed);

    } catch (error) {
      console.error("Stats Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
     calculateStats();
  }, [month, filterRole]);

  // --- SUB-COMPONENT: CHI TIẾT NHÂN VIÊN ---
  const UserDetailView = ({ user }) => {
     // Tạo danh sách các ngày trong tháng
     const daysInMonth = [];
     const date = new Date(month);
     const y = date.getFullYear();
     const m = date.getMonth();
     const daysCount = new Date(y, m + 1, 0).getDate();

     for(let i = 1; i <= daysCount; i++) {
        const d = new Date(y, m, i);
        // Bỏ qua tương lai
        if (d > new Date()) break;

        const dateStr = d.toISOString().split('T')[0];
        daysInMonth.push(dateStr);
     }

     // Lấy log của user này
     const userLogs = rawLogs.filter(l => l.user_id === user.id);

     // Dữ liệu chi tiết từng ngày
     const dailyStats = daysInMonth.reverse().map(dateStr => {
         // 1. Tính giờ làm ngày đó
         const daysLogs = userLogs.filter(l => l.report_date === dateStr || l.log_time.startsWith(dateStr));
         daysLogs.sort((a,b) => new Date(a.log_time) - new Date(b.log_time));

         let dayMillis = 0;
         let checkInTime = null;
         let checkOutTime = null;

         // Logic tính giờ đơn giản cho ngày: Lấy In đầu tiên và Out cuối cùng (hoặc cặp)
         // Ở đây dùng logic ghép cặp chính xác
         let tempIn = null;
         daysLogs.forEach(log => {
             const t = new Date(log.log_time);
             if(log.action_type === 'check_in') {
                 if(!checkInTime) checkInTime = t.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'});
                 tempIn = t;
             } else if (log.action_type === 'check_out' && tempIn) {
                 checkOutTime = t.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'});
                 dayMillis += (t - tempIn);
                 tempIn = null;
             }
         });
         const hours = (dayMillis / (1000 * 60 * 60)).toFixed(1);

         // 2. Tính công việc ngày đó
         const checklistLog = rawChecklists.find(c => c.report_date === dateStr && c.role === user.role);
         const tasks = checklistLog ? Object.values(checklistLog.data || {}) : [];
         const totalTask = tasks.length;
         const doneTask = tasks.filter(t => t.sent).length;

         // Kiểm tra độ trễ (dựa vào logic checkIsLateWithBuffer ở App chính, nhưng ở đây ta check field sent và time)
         // Giả sử logic trễ đã được xử lý khi lưu, hoặc ta check thủ công nếu cần.
         // Ở đây ta đếm số task done nhưng có 'TRỄ' (cần logic phức tạp hơn nếu muốn chính xác tuyệt đối từ data lưu)
         // Tạm thời ta hiển thị số lượng hoàn thành.

         let rating = "Chưa làm";
         let ratingColor = "text-slate-400";
         if (totalTask > 0) {
             const p = (doneTask / totalTask) * 100;
             if(p >= 100) { rating = "Xuất sắc"; ratingColor = "text-emerald-600 font-bold"; }
             else if(p >= 80) { rating = "Tốt"; ratingColor = "text-blue-600 font-bold"; }
             else if(p >= 50) { rating = "Khá"; ratingColor = "text-amber-600"; }
             else { rating = "Kém"; ratingColor = "text-red-600"; }
         } else if (hours > 0) {
             rating = "Không có việc"; ratingColor = "text-slate-500";
         }

         return {
             date: dateStr,
             dayName: new Date(dateStr).toLocaleDateString('vi-VN', {weekday: 'long'}),
             checkIn: checkInTime || '--:--',
             checkOut: checkOutTime || '--:--',
             hours: hours,
             taskProgress: `${doneTask}/${totalTask}`,
             rating,
             ratingColor,
             hasWork: hours > 0 || totalTask > 0
         };
     });

     return (
         <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="flex items-center gap-4 mb-6">
                 <button onClick={() => setSelectedUser(null)} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
                     <TrendingUp className="rotate-180" size={24}/> {/* Back Icon hack */}
                 </button>
                 <div>
                     <h2 className="text-2xl font-bold text-slate-800">{user.name}</h2>
                     <p className="text-slate-500 text-sm">Bảng chi tiết công & lương tháng {month}</p>
                 </div>
                 <div className="ml-auto flex gap-3">
                      <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                          <span className="block text-xs text-blue-500 font-bold uppercase">Tổng giờ</span>
                          <span className="block text-xl font-bold text-blue-700">{user.totalHours}h</span>
                      </div>
                      <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                          <span className="block text-xs text-emerald-500 font-bold uppercase">Lương dự kiến</span>
                          <span className="block text-xl font-bold text-emerald-700">{(user.rawHours * hourlyRate).toLocaleString()}đ</span>
                      </div>
                 </div>
             </div>

             <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                 <table className="w-full text-sm text-left">
                     <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs border-b">
                         <tr>
                             <th className="p-4">Ngày</th>
                             <th className="p-4 text-center">Vào / Ra</th>
                             <th className="p-4 text-center">Số giờ</th>
                             <th className="p-4">Tiến độ việc</th>
                             <th className="p-4">Đánh giá</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                         {dailyStats.map((day, idx) => (
                             <tr key={idx} className={`hover:bg-slate-50 transition-colors ${!day.hasWork ? 'opacity-50 grayscale' : ''}`}>
                                 <td className="p-4">
                                     <div className="font-bold text-slate-700">{day.date.split('-').reverse().join('/')}</div>
                                     <div className="text-xs text-slate-400 uppercase">{day.dayName}</div>
                                 </td>
                                 <td className="p-4 text-center font-mono text-slate-600">
                                     {day.checkIn} - {day.checkOut}
                                 </td>
                                 <td className="p-4 text-center">
                                     {parseFloat(day.hours) > 0 ? (
                                         <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">{day.hours}h</span>
                                     ) : '-'}
                                 </td>
                                 <td className="p-4">
                                     <div className="flex items-center gap-2">
                                         <span className="font-mono font-bold text-slate-700">{day.taskProgress}</span>
                                         {day.taskProgress !== '0/0' && (
                                              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                  <div className="bg-emerald-500 h-full" style={{width: `${(parseInt(day.taskProgress.split('/')[0]) / parseInt(day.taskProgress.split('/')[1]) * 100)}%`}}></div>
                                              </div>
                                         )}
                                     </div>
                                 </td>
                                 <td className="p-4">
                                     <span className={day.ratingColor}>{day.rating}</span>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
                 {dailyStats.length === 0 && <div className="p-8 text-center text-slate-400">Không có dữ liệu ngày nào</div>}
             </div>
         </div>
     )
  }

  // --- MAIN RENDER ---
  if (selectedUser) {
      return <UserDetailView user={selectedUser} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
       <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
             <CalendarClock className="text-blue-600"/>
             <span className="font-bold text-slate-700">Tháng:</span>
             <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:ring-2 ring-blue-500"/>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
             <Briefcase className="text-slate-400" size={18}/>
             <select className="border rounded-lg px-3 py-2 text-sm w-full md:w-48 outline-none" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                <option value="">-- Tất cả khu vực --</option>
                {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
             </select>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto ml-auto md:ml-0 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
             <DollarSign className="text-emerald-600" size={18}/>
             <span className="font-bold text-emerald-800 text-sm">Lương/giờ:</span>
             <input
                type="number"
                value={hourlyRate}
                onChange={e => setHourlyRate(Number(e.target.value))}
                className="w-24 bg-white border border-emerald-200 rounded px-2 py-1 text-sm font-bold text-right outline-none focus:ring-2 ring-emerald-500"
             />
             <span className="text-xs text-emerald-600 font-bold">đ</span>
          </div>

          <button onClick={calculateStats} className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-500/30">
             {loading ? <Loader2 className="animate-spin" size={16}/> : <RefreshCcw size={16}/>} Tính Toán
          </button>
       </div>

       {/* CARD TỔNG QUAN */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-start mb-2">
                 <div>
                    <p className="text-slate-400 text-xs font-bold uppercase">Tổng Giờ Toàn Team</p>
                    <h3 className="text-2xl font-bold text-slate-800">{stats.reduce((acc, curr) => acc + parseFloat(curr.totalHours), 0).toFixed(1)}h</h3>
                 </div>
                 <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Clock size={20}/></div>
             </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-start mb-2">
                 <div>
                    <p className="text-slate-400 text-xs font-bold uppercase">Tổng Chi Lương (Ước tính)</p>
                    <h3 className="text-2xl font-bold text-emerald-600">
                        {(stats.reduce((acc, curr) => acc + (curr.rawHours * hourlyRate), 0)).toLocaleString('vi-VN')} đ
                    </h3>
                 </div>
                 <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign size={20}/></div>
             </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-start mb-2">
                 <div>
                    <p className="text-slate-400 text-xs font-bold uppercase">Hiệu Suất TB</p>
                    <h3 className="text-2xl font-bold text-slate-800">
                        {stats.length > 0 ? Math.round(stats.reduce((acc, curr) => acc + curr.completionRate, 0) / stats.length) : 0}%
                    </h3>
                 </div>
                 <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><TrendingUp size={20}/></div>
             </div>
          </div>
       </div>

       <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <h3 className="font-bold text-slate-700">Danh Sách Nhân Viên (Nhấn vào để xem chi tiết)</h3>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
                <thead className="bg-white text-slate-500 uppercase font-bold text-xs border-b">
                   <tr>
                      <th className="p-4">Nhân Viên</th>
                      <th className="p-4">Khu Vực</th>
                      <th className="p-4 text-center">Số Ngày</th>
                      <th className="p-4 text-center">Tổng Giờ</th>
                      <th className="p-4 text-right">Lương Tạm Tính</th>
                      <th className="p-4">Mức Độ Hoàn Thành</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {stats.length === 0 ? (
                      <tr><td colSpan="6" className="p-8 text-center text-slate-400">Không có dữ liệu cho tháng này</td></tr>
                   ) : (
                      stats.map(s => (
                         <tr key={s.id} onClick={() => setSelectedUser(s)} className="hover:bg-blue-50 cursor-pointer transition-colors group">
                            <td className="p-4 font-bold text-slate-700 group-hover:text-blue-600">{s.name}</td>
                            <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-500">{s.role}</span></td>
                            <td className="p-4 text-center font-bold">{s.workDays}</td>
                            <td className="p-4 text-center text-blue-600 font-bold">{s.totalHours}</td>
                            <td className="p-4 text-right font-bold text-emerald-600">
                                {Math.round(s.rawHours * hourlyRate).toLocaleString('vi-VN')} đ
                            </td>
                            <td className="p-4">
                               <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full max-w-[100px]">
                                     <div className={`h-2 rounded-full ${s.completionRate >= 80 ? 'bg-emerald-500' : s.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: `${s.completionRate}%`}}></div>
                                  </div>
                                  <span className="text-xs font-bold">{s.completionRate}%</span>
                               </div>
                            </td>
                         </tr>
                      ))
                   )}
                </tbody>
             </table>
          </div>
       </div>
    </div>
  )
};

const AdminTimesheet = ({ users }) => {
    const [viewDate, setViewDate] = useState(getTodayISO());
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('time_logs')
                    .select('*, app_users(name, role)')
                    .eq('report_date', viewDate)
                    .order('log_time', { ascending: false });

                if (error) throw error;
                setLogs(data || []);
            } catch (err) {
                console.error("Lỗi tải timesheet:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [viewDate]);

    return (
        <div className="space-y-4">
             <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <span className="text-slate-500 font-bold text-sm"><Filter size={18} className="inline mr-1"/> Xem ngày:</span>
                <input
                    type="date"
                    value={viewDate}
                    onChange={(e) => setViewDate(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 ring-blue-500"
                />
                {loading && <span className="text-blue-600 text-xs font-bold flex items-center"><Loader2 className="animate-spin mr-1" size={14}/> Đang tải...</span>}
             </div>

             <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                 <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                     <h3 className="font-bold text-slate-700">Nhật ký Chấm Công ({viewDate})</h3>
                 </div>
                 <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-white text-slate-500 uppercase font-bold text-xs border-b">
                        <tr>
                            <th className="p-4">Thời gian</th>
                            <th className="p-4">Nhân viên</th>
                            <th className="p-4">Hành động</th>
                            <th className="p-4">Ảnh Xác Thực</th>
                            <th className="p-4">Định Vị (Map)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {logs.length === 0 ? (
                            <tr><td colSpan="5" className="p-6 text-center text-slate-400">Không có dữ liệu chấm công ngày này</td></tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-mono text-slate-500">{new Date(log.log_time).toLocaleTimeString('vi-VN')}</td>
                                    <td className="p-4">
                                        <p className="font-bold text-slate-700">{log.app_users?.name || 'Unknown'}</p>
                                        <p className="text-xs text-slate-400 uppercase">{log.app_users?.role}</p>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${log.action_type==='check_in'?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>
                                            {log.action_type === 'check_in' ? 'VÀO CA' : 'RA CA'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {log.image_url ? (
                                            <a href={log.image_url} target="_blank" rel="noreferrer" className="block w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:scale-105 transition-transform">
                                                <img src={log.image_url} alt="checkin" className="w-full h-full object-cover"/>
                                            </a>
                                        ) : <span className="text-xs text-slate-300">Không có ảnh</span>}
                                    </td>
                                    <td className="p-4">
                                        {log.lat && log.lng ? (
                                            <a href={`http://googleusercontent.com/maps.google.com/2{log.lat},${log.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                                                <MapPin size={14}/> Xem bản đồ
                                            </a>
                                        ) : <span className="text-xs text-slate-300">Không có GPS</span>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                 </table>
                 </div>
            </div>
        </div>
    )
}

const AdminReports = ({ initialReports, allTasks, roles }) => {
   const [viewDate, setViewDate] = useState(getTodayISO());
   const [reports, setReports] = useState(initialReports);
   const [loading, setLoading] = useState(false);

   useEffect(() => {
       if (viewDate === getTodayISO()) {
           setReports(initialReports);
       }
   }, [initialReports]);

   useEffect(() => {
       const fetchReportsByDate = async () => {
           setLoading(true);
           try {
               const { data: repData } = await supabase.from('checklist_logs').select('role, data').eq('report_date', viewDate);
               const reportMap = {};
               if(repData) repData.forEach(r => reportMap[r.role] = r.data);
               setReports(reportMap);
           } catch (error) {
               console.error(error);
           } finally {
               setLoading(false);
           }
       };
       fetchReportsByDate();
   }, [viewDate]);

   const sortedTasks = sortTasksByTime([...allTasks]);
   const roleKeys = roles.length > 0 ? roles.map(r => r.code) : [...new Set(sortedTasks.map(t => t.role))];

   return (
     <div className="space-y-4">
         <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
                <span className="text-slate-500 font-bold text-sm"><Calendar size={18} className="inline mr-2"/>Xem tiến độ ngày:</span>
                <input
                    type="date"
                    value={viewDate}
                    onChange={(e) => setViewDate(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 ring-blue-500"
                />
            </div>
            {loading && <div className="text-blue-600 flex items-center gap-2 text-sm font-bold"><Loader2 className="animate-spin" size={16}/> Đang tải...</div>}
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {roleKeys.map(roleKey => {
              const roleObj = roles.find(r => r.code === roleKey);
              const roleName = roleObj ? roleObj.name : roleKey;
              const roleTasks = sortedTasks.filter(t => t.role === roleKey);
              if (roleTasks.length === 0 && !roleObj) return null;
              const roleReport = reports[roleKey] || {};
              const sentCount = Object.values(roleReport).filter(i => i.sent).length;
              const percent = roleTasks.length > 0 ? Math.round((sentCount/roleTasks.length)*100) : 0;

              return (
                 <div key={roleKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100">
                       <div className="flex justify-between items-center mb-2">
                           <h3 className="font-bold text-slate-800">{roleName}</h3>
                           <span className={`text-xs font-bold border px-2 py-1 rounded-full ${percent === 100 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white'}`}>
                               {sentCount}/{roleTasks.length}
                           </span>
                       </div>
                       <div className="w-full bg-slate-200 rounded-full h-1.5">
                           <div className={`h-1.5 rounded-full ${percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }}></div>
                       </div>
                    </div>
                    <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                       {roleTasks.length === 0 ? <p className="p-4 text-center text-slate-400 text-sm">Chưa có công việc nào</p> :
                       roleTasks.map(task => {
                          const item = roleReport[task.id];
                          const isLate = checkIsLateWithBuffer(task.time_label, task.late_buffer, item?.sent);
                          if(!item || !item.sent) return (
                              <div key={task.id} className="p-3 text-sm flex justify-between gap-3 text-slate-400 bg-slate-50/50">
                                  <span>{task.title} <span className="text-xs">({task.time_label})</span></span>
                                  {(viewDate === getTodayISO() && isLate) && <span className="text-red-500 text-xs font-bold flex items-center gap-1"><AlertCircle size={12}/> Trễ</span>}
                              </div>
                          );
                          return (
                              <div key={task.id} className="p-3 text-sm flex items-start justify-between gap-3 hover:bg-slate-50 bg-white">
                                  <div>
                                      <p className="font-medium text-slate-700">{task.title}</p>
                                      <p className="text-xs text-slate-400">{item.time}</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                      {item.val && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-xs font-mono">{item.val}</span>}
                                      {item.imageUrl && (<a href={item.imageUrl} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs flex items-center gap-1 hover:underline"><ImageIcon size={12}/> Ảnh</a>)}
                                  </div>
                              </div>
                          )
                       })}
                    </div>
                 </div>
              )
           })}
         </div>
     </div>
   )
}

const AdminTaskManager = ({ allTasks, roles, onRefresh, setNotify }) => {
  const [editing, setEditing] = useState({ id: null, role: '', title: '', time_label: '', late_buffer: 15, require_input: false, require_image: false });
  const formRef = useRef(null);

  useEffect(() => {
      if(roles.length > 0 && !editing.role && !editing.id) {
          setEditing(prev => ({...prev, role: roles[0].code}));
      }
  }, [roles]);

  const resetForm = () => setEditing({ id: null, role: roles[0]?.code || '', title: '', time_label: '', late_buffer: 15, require_input: false, require_image: false });

  const handleSaveTask = async () => {
     if(!editing.title) return setNotify("Chưa nhập tên việc", "error");
     const payload = {
         role: editing.role, title: editing.title, time_label: editing.time_label,
         late_buffer: editing.late_buffer, require_input: editing.require_input,
         require_image: editing.require_image
     };

     if (editing.id) {
         const { error } = await supabase.from('task_definitions').update(payload).eq('id', editing.id);
         if(error) setNotify("Lỗi cập nhật", "error"); else { setNotify("Đã cập nhật"); onRefresh(); resetForm(); }
     } else {
         const { error } = await supabase.from('task_definitions').insert(payload);
         if(error) setNotify("Lỗi tạo việc", "error"); else { setNotify("Đã thêm công việc"); onRefresh(); resetForm(); }
     }
  };

  const handleEdit = (task) => {
      setEditing({ ...task });
      if(formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleDeleteTask = async (id) => { if(!window.confirm("Xóa việc này?")) return; const { error } = await supabase.from('task_definitions').delete().eq('id', id); if(!error) { setNotify("Đã xóa"); onRefresh(); } };

  return (
     <div className="space-y-6">
        <div ref={formRef} className={`p-4 rounded-xl border grid grid-cols-2 md:grid-cols-6 gap-3 transition-all ${editing.id ? 'bg-orange-50 border-orange-200 shadow-lg ring-2 ring-orange-100' : 'bg-indigo-50 border-indigo-100'}`}>
           {editing.id && <div className="col-span-2 md:col-span-6 text-orange-700 font-bold flex items-center gap-2 mb-2"><Edit3 size={16}/> Đang chỉnh sửa: {editing.title}</div>}

           <div className="col-span-2 md:col-span-1"><label className="text-xs font-bold text-indigo-800 block mb-1">Khu vực</label><select className="w-full p-2 rounded border text-sm bg-white" value={editing.role} onChange={e => setEditing({...editing, role: e.target.value})}>{roles.map(r => ( <option key={r.code} value={r.code}>{r.name}</option> ))}</select></div>
           <div className="col-span-2 md:col-span-2"><label className="text-xs font-bold text-indigo-800 block mb-1">Tên công việc</label><input className="w-full p-2 rounded border text-sm" placeholder="VD: Dọn hồ cá" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})}/></div>
           <div className="col-span-1"><label className="text-xs font-bold text-indigo-800 block mb-1">Giờ (VD: 15:30)</label><input className="w-full p-2 rounded border text-sm" placeholder="15:30" value={editing.time_label} onChange={e => setEditing({...editing, time_label: e.target.value})}/></div>
           <div className="col-span-1"><label className="text-xs font-bold text-indigo-800 block mb-1">Cho trễ (phút)</label><input type="number" className="w-full p-2 rounded border text-sm" placeholder="15" value={editing.late_buffer} onChange={e => setEditing({...editing, late_buffer: parseInt(e.target.value)||0})}/></div>
           <div className="col-span-2 md:col-span-1 flex flex-col justify-center gap-2"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.require_input} onChange={e => setEditing({...editing, require_input: e.target.checked})} /> Nhập số liệu?</label><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.require_image} onChange={e => setEditing({...editing, require_image: e.target.checked})} /> Chụp ảnh?</label></div>
           <div className="col-span-2 md:col-span-6 flex items-end gap-2 pt-2 border-t border-black/5 mt-2">
               {editing.id && <button onClick={resetForm} className="flex items-center gap-2 bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-300"><XCircle size={16}/> Hủy Bỏ</button>}
               <button onClick={handleSaveTask} className={`flex-1 flex items-center justify-center gap-2 text-white px-4 py-2 rounded-lg font-bold shadow-lg text-sm ${editing.id ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{editing.id ? <><Save size={16}/> Cập nhật Thay Đổi</> : <><Plus size={16}/> Thêm Mới</>}</button>
           </div>
        </div>

        <div className="space-y-4">
            {roles.map(role => {
                const tasks = sortTasksByTime(allTasks.filter(t => t.role === role.code));
                if(tasks.length === 0) return null;
                return (
                    <div key={role.code} className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 p-3 border-b border-slate-100 font-bold text-slate-700 flex justify-between">{role.name} <span className="text-xs font-normal bg-white border px-2 rounded flex items-center">{role.code}</span></div>
                        {tasks.map((t) => (
                            <div key={t.id} className={`p-3 border-b border-slate-50 last:border-0 flex items-center justify-between hover:bg-slate-50 ${editing.id === t.id ? 'bg-orange-50' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 text-center text-xs font-bold text-blue-600 bg-blue-50 py-1 rounded">
                                        {t.time_label || '00:00'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-slate-700">{t.title}</p>
                                        <p className="text-xs text-slate-400">
                                            Cho phép trễ {t.late_buffer}p
                                            {t.require_input && ' • 🔢 Nhập số'}
                                            {t.require_image && ' • 📸 Chụp ảnh'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEdit(t)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-all"><Edit3 size={18}/></button>
                                    <button onClick={() => handleDeleteTask(t.id)} className="text-slate-400 hover:bg-red-50 hover:text-red-500 p-2 rounded-lg transition-all"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            })}
        </div>
     </div>
  )
}

const AdminRoleManager = ({ roles, allTasks, onRefresh, setNotify }) => {
    const [newRole, setNewRole] = useState({ code: '', name: '' });
    const [cloneData, setCloneData] = useState({ from: '', toCode: '', toName: '' });

    const handleAddRole = async () => { if(!newRole.code || !newRole.name) return setNotify("Vui lòng nhập", "error"); const cleanCode = newRole.code.toLowerCase().replace(/\s/g, '_'); const { error } = await supabase.from('job_roles').insert({ code: cleanCode, name: newRole.name }); if(error) setNotify("Lỗi: " + error.message, "error"); else { setNotify("Đã thêm"); setNewRole({ code: '', name: '' }); onRefresh(); } };

    const handleDeleteRole = async (code) => { if(code === 'admin') return; if(!window.confirm(`Xóa ${code}?`)) return; const { error } = await supabase.from('job_roles').delete().eq('code', code); if(!error) { setNotify("Đã xóa"); onRefresh(); } };

    const handleCloneRole = async () => {
        if (!cloneData.from || !cloneData.toCode || !cloneData.toName) return setNotify("Thiếu thông tin nhân bản", "error");
        const cleanToCode = cloneData.toCode.toLowerCase().replace(/\s/g, '_');
        const { error: rErr } = await supabase.from('job_roles').insert({ code: cleanToCode, name: cloneData.toName });
        if (rErr) return setNotify("Lỗi tạo Role: " + rErr.message, "error");
        const sourceTasks = allTasks.filter(t => t.role === cloneData.from);
        if (sourceTasks.length === 0) return setNotify("Khu vực nguồn không có việc nào", "info");
        const newTasks = sourceTasks.map(t => ({
            role: cleanToCode,
            title: t.title,
            time_label: t.time_label,
            late_buffer: t.late_buffer,
            require_input: t.require_input,
            require_image: t.require_image
        }));
        const { error: tErr } = await supabase.from('task_definitions').insert(newTasks);
        if (tErr) setNotify("Lỗi copy việc: " + tErr.message, "error");
        else { setNotify("Đã nhân bản thành công!"); onRefresh(); setCloneData({ from: '', toCode: '', toName: '' }); }
    };

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-sm font-bold mb-2 uppercase text-slate-500">Thêm Khu Vực Mới</h3>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
                    <input className="p-2 rounded border border-amber-200 text-sm flex-1" placeholder="Mã (vd: be_boi)" value={newRole.code} onChange={e => setNewRole({...newRole, code: e.target.value})}/>
                    <input className="p-2 rounded border border-amber-200 text-sm flex-[2]" placeholder="Tên (vd: Bể Bơi)" value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})}/>
                    <button onClick={handleAddRole} className="bg-amber-600 text-white px-4 rounded font-bold hover:bg-amber-700 text-sm">Thêm</button>
                </div>
            </div>

            <div>
                 <h3 className="text-sm font-bold mb-2 uppercase text-slate-500">Copy Cấu Hình (Nhân Bản)</h3>
                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select className="p-2 rounded border border-blue-200 text-sm" value={cloneData.from} onChange={e => setCloneData({...cloneData, from: e.target.value})}>
                        <option value="">-- Sao chép từ --</option>
                        {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                    </select>
                    <input className="p-2 rounded border border-blue-200 text-sm" placeholder="Mã Mới (vd: be_boi_2)" value={cloneData.toCode} onChange={e => setCloneData({...cloneData, toCode: e.target.value})}/>
                    <input className="p-2 rounded border border-blue-200 text-sm" placeholder="Tên Mới (vd: Bể Bơi 2)" value={cloneData.toName} onChange={e => setCloneData({...cloneData, toName: e.target.value})}/>
                    <button onClick={handleCloneRole} className="bg-blue-600 text-white px-4 rounded font-bold hover:bg-blue-700 text-sm flex items-center justify-center gap-2"><Copy size={16}/> Nhân bản</button>
                 </div>
            </div>

            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-slate-100">
                        {roles.map(r => (
                            <tr key={r.code} className="hover:bg-slate-50">
                                <td className="p-4 font-mono text-slate-500">{r.code}</td>
                                <td className="p-4 font-bold text-slate-700">{r.name}</td>
                                <td className="p-4 text-right"><button onClick={() => handleDeleteRole(r.code)} className="text-red-400 p-2"><Trash2 size={16}/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

const AdminUserManager = ({ users, roles, onRefresh, setNotify }) => {
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: '' });
  useEffect(() => { if(roles.length > 0 && !newUser.role) setNewUser(prev => ({...prev, role: roles[0].code})); }, [roles]);

  const handleAddUser = async () => { if(!newUser.username || !newUser.password) return setNotify("Thiếu thông tin", "error"); const roleToSave = newUser.role || 'staff'; const { error } = await supabase.from('app_users').insert({...newUser, role: roleToSave}); if(error) setNotify("Lỗi: " + error.message, "error"); else { setNotify("Đã thêm"); onRefresh(); } };
  const handleDeleteUser = async (id) => { if(!window.confirm("Xóa user?")) return; const { error } = await supabase.from('app_users').delete().eq('id', id); if(!error) { setNotify("Đã xóa"); onRefresh(); } };

  return (
    <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col md:flex-row gap-3">
            <input className="p-2 rounded border border-blue-200 text-sm" placeholder="User" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})}/>
            <input className="p-2 rounded border border-blue-200 text-sm" placeholder="Pass" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}/>
            <input className="p-2 rounded border border-blue-200 text-sm flex-1" placeholder="Họ Tên" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})}/>
            <select className="p-2 rounded border border-blue-200 text-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option value="admin">Quản lý (Admin)</option>
                {roles.map(r => ( <option key={r.code} value={r.code}>{r.name}</option> ))}</select>
            <button onClick={handleAddUser} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 text-sm">Thêm</button>
        </div>
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                    <tr>
                        <th className="p-4">Họ Tên</th>
                        <th className="p-4">Username</th>
                        <th className="p-4 text-red-400">Password</th>
                        <th className="p-4">Vai trò</th>
                        <th className="p-4 text-right">Xóa</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50">
                            <td className="p-4 font-bold text-slate-700">{u.name}</td>
                            <td className="p-4 text-slate-500">{u.username}</td>
                            <td className="p-4 text-red-500 font-mono">{u.password}</td>
                            <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{u.role}</span></td>
                            <td className="p-4 text-right"><button onClick={() => handleDeleteUser(u.id)} className="text-red-500 p-2"><Trash2 size={16}/></button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  )
}

const ModernLogin = ({ loginForm, setLoginForm, handleLogin, loading, notification }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4"><div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100"><div className="text-center mb-8"><div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/30"><ShieldCheck size={32}/></div><h1 className="text-2xl font-bold text-slate-800">Đăng Nhập Hệ Thống</h1></div><div className="space-y-4"><div className="relative"><User className="absolute left-4 top-3.5 text-slate-400" size={20}/><input type="text" placeholder="Tên đăng nhập" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})}/></div><div className="relative"><Lock className="absolute left-4 top-3.5 text-slate-400" size={20}/><input type="password" placeholder="Mật khẩu" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleLogin()}/></div>{notification.msg && <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">{notification.msg}</div>}<button onClick={handleLogin} disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex justify-center">{loading ? <Loader2 className="animate-spin"/> : 'Vào ca làm việc'}</button></div></div></div>
);