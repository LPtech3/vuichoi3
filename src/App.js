import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  User, Lock, LogOut, RefreshCcw, Camera, Trash2, Plus,
  CheckCircle2, Clock, Send, Loader2, Search,
  LayoutDashboard, Menu, X, ShieldCheck,
  Users, ListTodo, Image as ImageIcon, MapPin, Briefcase,
  CalendarClock, AlertTriangle, AlertCircle, ExternalLink,
  Edit3, ArrowUp, ArrowDown, Copy, Key, Save, XCircle
} from 'lucide-react';

// --- STYLES CHO HIỆU ỨNG NHẤP NHÁY ---
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
    @keyframes bounce {
        0%, 100% { transform: translateY(-5%); }
        50% { transform: translateY(0); }
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

// Hàm lấy vị trí GPS (Cải thiện timeout để tránh treo)
const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không hỗ trợ định vị."));
    } else {
      const options = {
        enableHighAccuracy: true,
        timeout: 10000, // 10 giây timeout
        maximumAge: 0
      };
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
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

const checkIsLate = (timeLabel, bufferMins = 0, isDone = false) => {
  if (isDone || !timeLabel || !timeLabel.includes(':')) return false;
  const now = new Date();
  const [h, m] = timeLabel.split(':').map(Number);
  const taskTime = new Date();
  taskTime.setHours(h, m, 0, 0);
  // Nếu bufferMins chưa có giá trị, mặc định là 0
  const buffer = parseInt(bufferMins) || 0;
  const deadline = new Date(taskTime.getTime() + (buffer * 60000));
  return now > deadline;
};

// --- COMPONENT CHÍNH ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // Data States
  const [tasksConfig, setTasksConfig] = useState([]);
  const [checklistData, setChecklistData] = useState({});
  const [usersList, setUsersList] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ msg: '', type: '' });
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);

  useEffect(() => {
    // Auto refresh timer if needed
  }, []);

  // --- LOGIC ---
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
    const { data } = await supabase.from('task_definitions').select('*').eq('role', role).order('sort_order', { ascending: true });
    if(data) setTasksConfig(data);
  };

  const fetchTodayReport = async (role) => {
    const today = getTodayISO();
    const { data } = await supabase.from('checklist_logs').select('data').eq('report_date', today).eq('role', role).single();
    if (data) setChecklistData(prev => ({...prev, [role]: data.data || {}}));
  };

  const fetchAllDataAdmin = async () => {
    const today = getTodayISO();
    // Fetch users
    const { data: uData } = await supabase.from('app_users').select('*').order('created_at');
    setUsersList(uData || []);
    // Fetch roles
    const { data: rData } = await supabase.from('job_roles').select('*').order('created_at');
    setRolesList(rData || []);
    // Fetch tasks sorted by sort_order
    const { data: tData } = await supabase.from('task_definitions').select('*').order('sort_order', { ascending: true });
    setTasksConfig(tData || []);
    // Fetch reports
    const { data: repData } = await supabase.from('checklist_logs').select('role, data').eq('report_date', today);
    const reportMap = {};
    if(repData) repData.forEach(r => reportMap[r.role] = r.data);
    setChecklistData(reportMap);
    // Fetch logs
    const { data: logData } = await supabase.from('time_logs')
        .select('*, app_users(name, role)')
        .eq('report_date', today)
        .order('log_time', { ascending: false });
    setTimeLogs(logData || []);
  };

  if (!user) return <ModernLogin loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} notification={notification} loading={loading} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <CustomStyles />
      {/* Change Pass Modal */}
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
                {user.name.charAt(0)}
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
                reports={checklistData}
                timeLogs={timeLogs}
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

    useEffect(() => { checkAttendanceStatus(); }, []);

    const checkAttendanceStatus = async () => {
      const today = getTodayISO();
      const { data } = await supabase.from('time_logs').select('*').eq('user_id', user.id).eq('report_date', today);
      if (data) {
        const checkIn = data.find(x => x.action_type === 'check_in');
        const checkOut = data.find(x => x.action_type === 'check_out');
        setAttendance({
          in: checkIn ? new Date(checkIn.log_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : null,
          out: checkOut ? new Date(checkOut.log_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : null
        });
      }
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
         console.error(err);
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
       // Kiểm tra giá trị đầu vào
       if(!item || !item.done) return setNotify("Chưa hoàn thành!", "error");
       const taskDef = tasks.find(t => t.id === taskDefId);
       if(taskDef?.require_input && (!item.val || item.val.toString().trim() === '')) return setNotify("Thiếu thông tin số liệu!", "error"); // Cải thiện kiểm tra
       if(taskDef?.require_image && !item.imageUrl) return setNotify("Thiếu ảnh xác thực!", "error");
       setLoadingSend(taskDefId);
       try {
         item.sent = true;
         const newReportData = { ...reportData, [taskDefId]: item };
         const { error } = await supabase.from('checklist_logs').upsert({ report_date: getTodayISO(), role: user.role, data: newReportData }, { onConflict: 'report_date, role' });
         if(error) throw error;
         onUpdateLocal(newReportData);
         setNotify("Đã gửi báo cáo thành công!");
       } catch (err) {
         item.sent = false; onUpdateLocal({ ...reportData, [taskDefId]: item });
         setNotify("Gửi báo cáo lỗi, vui lòng thử lại.", "error");
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
        {/* Progress Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-end mb-2">
              <span className="font-bold text-slate-700">Tiến độ công việc hôm nay</span>
              <span className="text-blue-600 font-bold text-lg">{progressPercent}%</span>
           </div>
           <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
           </div>
           <p className="text-xs text-slate-400 mt-2 text-right">{completedTasks}/{totalTasks} công việc đã gửi</p>
        </div>

        {/* Check In/Out */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
           <div><h2 className="text-xl font-bold text-slate-800">Quản lý Chấm công</h2><p className="text-slate-500 text-sm">Chụp ảnh có định vị để vào/ra ca</p></div>

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
            const isDone = item.done; const isSent = item.sent;
            const isLate = checkIsLate(task.time_label, task.late_buffer, isDone);

            // Xử lý class nhấp nháy nếu trễ và chưa làm xong
            const cardClass = isSent
                ? 'border-emerald-100 bg-emerald-50/20'
                : (isLate && !isDone)
                    ? 'urgent-blink text-red-800' // Class urgent-blink định nghĩa ở trên
                    : isDone
                        ? 'border-blue-100 bg-white'
                        : 'border-transparent shadow-sm bg-white';

            return (
               <div key={task.id} className={`p-4 rounded-xl border-2 transition-all ${cardClass}`}>
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                     <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => !isSent && handleTaskAction(task.id, 'toggle')}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDone ? (isSent ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600') : (isLate ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-300')}`}>{isLate && !isDone ? <AlertTriangle size={20}/> : <CheckCircle2 size={20}/>}</div>
                        <div>
                           <div className="flex items-center gap-2 text-xs mb-1">
                               <span className={`font-bold px-2 py-0.5 rounded ${isLate && !isDone ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                   {task.time_label} {isLate && !isDone ? '(TRỄ)' : ''}
                               </span>
                               {item.time && <span className="text-blue-600 font-medium"><Clock size={10} className="inline mr-1"/>{item.time}</span>}
                           </div>
                           <h3 className={`font-semibold ${isLate && !isDone ? 'text-red-700' : 'text-slate-800'}`}>{task.title}</h3>
                        </div>
                     </div>
                     <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center mt-2 md:mt-0 pl-12 md:pl-0">
                        {task.require_input && <input type="text" disabled={!isDone || isSent} value={item.val || ''} onChange={(e) => handleTaskAction(task.id, 'input', e.target.value)} placeholder="Nhập số..." className="w-full sm:w-24 px-3 py-2 text-sm border rounded-lg text-center bg-slate-50"/>}
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
const AdminDashboard = ({ users, roles, allTasks, reports, timeLogs, onRefresh, setNotify }) => {
  const [tab, setTab] = useState('timesheet');
  return (
    <div>
      <div className="flex gap-4 mb-6 border-b border-slate-200 pb-1 overflow-x-auto">
        {[
            {id: 'timesheet', icon: CalendarClock, label: 'Chấm Công & Định Vị'},
            {id: 'reports', icon: LayoutDashboard, label: 'Tiến Độ Hôm Nay'},
            {id: 'history', icon: Clock, label: 'Lịch Sử & Thống Kê'}, // TAB MỚI
            {id: 'users', icon: Users, label: 'Nhân Sự'},
            {id: 'tasks', icon: ListTodo, label: 'Cấu Hình Công Việc'},
            {id: 'roles', icon: Briefcase, label: 'Quản Lý Khu Vực'}
        ].map(t => (
           <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-3 font-bold text-sm whitespace-nowrap transition-all border-b-2 ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><t.icon size={18}/> {t.label}</button>
        ))}
        <button onClick={onRefresh} className="ml-auto p-2 text-slate-400 hover:text-blue-600"><RefreshCcw size={18}/></button>
      </div>
      {tab === 'timesheet' && <AdminTimesheet timeLogs={timeLogs} users={users} />}
      {tab === 'reports' && <AdminReports reports={reports} allTasks={allTasks} roles={roles} />}
      {tab === 'history' && <AdminHistoryReports users={users} roles={roles} allTasks={allTasks} setNotify={setNotify}/>} {/* RENDER COMPONENT MỚI */}
      {tab === 'users' && <AdminUserManager users={users} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />}
      {tab === 'tasks' && <AdminTaskManager allTasks={allTasks} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />}
      {tab === 'roles' && <AdminRoleManager roles={roles} allTasks={allTasks} onRefresh={onRefresh} setNotify={setNotify} />}
    </div>
  );
};

// --- CÁC COMPONENT CON CỦA ADMIN ---
const AdminTimesheet = ({ timeLogs, users }) => {
    return (
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
             <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                 <h3 className="font-bold text-slate-700">Nhật ký Chấm Công ({getTodayISO()})</h3>
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
                    {timeLogs.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-slate-400">Chưa có dữ liệu</td></tr>}
                    {timeLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                            <td className="p-4 font-mono text-slate-500">{new Date(log.log_time).toLocaleTimeString('vi-VN')}</td>
                            <td className="p-4">
                                <p className="font-bold text-slate-700">{log.app_users?.name}</p>
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
                                    <a href={`https://maps.google.com/?q=${log.lat},${log.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                                        <MapPin size={14}/> Xem bản đồ
                                    </a>
                                ) : <span className="text-xs text-slate-300">Không có GPS</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
             </div>
        </div>
    )
}

const AdminReports = ({ reports, allTasks, roles }) => {
   const roleKeys = roles.length > 0 ? roles.map(r => r.code) : [...new Set(allTasks.map(t => t.role))];
   return (
     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
       {roleKeys.map(roleKey => {
          const roleObj = roles.find(r => r.code === roleKey);
          const roleName = roleObj ? roleObj.name : roleKey;
          const roleTasks = allTasks.filter(t => t.role === roleKey);
          if (roleTasks.length === 0 && !roleObj) return null;
          const roleReport = reports[roleKey] || {};
          const sentCount = Object.values(roleReport).filter(i => i.sent).length;
          const percent = roleTasks.length > 0 ? Math.round((sentCount/roleTasks.length)*100) : 0;
          return (
             <div key={roleKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                   <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-slate-800">Tiến độ Khu vực: {roleName}</h3><span className="text-xs font-bold bg-white border px-2 py-1 rounded-full">{sentCount}/{roleTasks.length}</span></div>
                   <div className="w-full bg-slate-200 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }}></div></div>
                </div>
                <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                   {roleTasks.map(task => {
                      const item = roleReport[task.id];
                      const isLate = checkIsLate(task.time_label, task.late_buffer, item?.sent);
                      // Hiển thị nội dung công việc giống với bên nhân viên để đồng nhất
                      if(!item || !item.sent) return (<div key={task.id} className="p-3 text-sm flex justify-between gap-3 text-slate-400 bg-slate-50/50"><span>{task.title} <span className="text-xs">({task.time_label})</span></span>{isLate && <span className="text-red-500 text-xs font-bold flex items-center gap-1"><AlertCircle size={12}/> Trễ</span>}</div>);
                      return (<div key={task.id} className="p-3 text-sm flex items-start justify-between gap-3 hover:bg-slate-50 bg-white"><div><p className="font-medium text-slate-700">{task.title}</p><p className="text-xs text-slate-400">{item.time}</p></div><div className="flex flex-col items-end gap-1">{item.val && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-xs font-mono">{item.val}</span>}{item.imageUrl && (<a href={item.imageUrl} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs flex items-center gap-1 hover:underline"><ImageIcon size={12}/> Ảnh</a>)}</div></div>)
                   })}
                </div>
             </div>
          )
       })}
     </div>
   )
}

const AdminTaskManager = ({ allTasks, roles, onRefresh, setNotify }) => {
  const [editing, setEditing] = useState({ id: null, role: '', title: '', time_label: '', late_buffer: 15, require_input: false, require_image: false, sort_order: 1 });
  const [moveLoading, setMoveLoading] = useState(false);
  const formRef = useRef(null); // Ref để cuộn trang

  useEffect(() => {
      // Chỉ set mặc định khi chưa có editing.role và không đang ở chế độ edit
      if(roles.length > 0 && !editing.role && !editing.id) {
          setEditing(prev => ({...prev, role: roles[0].code}));
      }
  }, [roles]);

  const resetForm = () => setEditing({ id: null, role: roles[0]?.code || '', title: '', time_label: '', late_buffer: 15, require_input: false, require_image: false, sort_order: 1 });

  const handleSaveTask = async () => {
     if(!editing.title) return setNotify("Chưa nhập tên công việc", "error");
     const payload = {
         role: editing.role, title: editing.title, time_label: editing.time_label,
         late_buffer: editing.late_buffer, require_input: editing.require_input,
         require_image: editing.require_image
     };

     if (editing.id) {
         // Update
         const { error } = await supabase.from('task_definitions').update(payload).eq('id', editing.id);
         if(error) setNotify("Lỗi cập nhật cấu hình công việc", "error"); else { setNotify("Đã cập nhật cấu hình"); onRefresh(); resetForm(); }
     } else {
         // Create new (get max order first)
         const maxOrder = allTasks.filter(t => t.role === editing.role).length + 1;
         const { error } = await supabase.from('task_definitions').insert({...payload, sort_order: maxOrder});
         if(error) setNotify("Lỗi tạo công việc", "error"); else { setNotify("Đã thêm công việc mới"); onRefresh(); resetForm(); }
     }
  };

  const handleEdit = (task) => {
      // Sửa lỗi Edit: Set toàn bộ state và cuộn lên đầu
      setEditing({ ...task });
      if(formRef.current) {
          formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  };

  const handleDeleteTask = async (id) => { if(!window.confirm("Xác nhận xóa công việc này?")) return; const { error } = await supabase.from('task_definitions').delete().eq('id', id); if(!error) { setNotify("Đã xóa công việc"); onRefresh(); } };

  // Logic đổi vị trí (Swap Order) - Đã đảm bảo chỉ dựa vào sort_order
  const handleMove = async (task, direction) => {
      if (moveLoading) return;
      setMoveLoading(true);

      const roleTasks = allTasks.filter(t => t.role === task.role).sort((a,b) => a.sort_order - b.sort_order);
      const index = roleTasks.findIndex(t => t.id === task.id);

      if ((direction === 'up' && index === 0) || (direction === 'down' && index === roleTasks.length - 1)) {
          setMoveLoading(false);
          return;
      }

      const swapTask = direction === 'up' ? roleTasks[index - 1] : roleTasks[index + 1];

      try {
          // Swap values
          await supabase.from('task_definitions').update({ sort_order: swapTask.sort_order }).eq('id', task.id);
          await supabase.from('task_definitions').update({ sort_order: task.sort_order }).eq('id', swapTask.id);
          await onRefresh(); // Chờ refresh xong mới cho bấm tiếp
      } catch (err) {
          setNotify("Lỗi sắp xếp", "error");
      } finally {
          setMoveLoading(false);
      }
  };

  return (
     <div className="space-y-6">
        {/* Form Nhập Liệu - Có ref để scroll tới */}
        <div ref={formRef} className={`p-4 rounded-xl border grid grid-cols-2 md:grid-cols-6 gap-3 transition-all ${editing.id ? 'bg-orange-50 border-orange-200 shadow-lg ring-2 ring-orange-100' : 'bg-indigo-50 border-indigo-100'}`}>
           {editing.id && <div className="col-span-2 md:col-span-6 text-orange-700 font-bold flex items-center gap-2 mb-2"><Edit3 size={16}/> Đang chỉnh sửa: {editing.title}</div>}

           <div className="col-span-2 md:col-span-1"><label className="text-xs font-bold text-indigo-800 block mb-1">Khu vực</label><select className="w-full p-2 rounded border text-sm bg-white" value={editing.role} onChange={e => setEditing({...editing, role: e.target.value})}>{roles.map(r => ( <option key={r.code} value={r.code}>{r.name}</option> ))}</select></div>
           <div className="col-span-2 md:col-span-2"><label className="text-xs font-bold text-indigo-800 block mb-1">Tên công việc</label><input className="w-full p-2 rounded border text-sm" placeholder="VD: Dọn hồ cá" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})}/></div>
           <div className="col-span-1"><label className="text-xs font-bold text-indigo-800 block mb-1">Giờ Deadline (VD: 15:30)</label><input className="w-full p-2 rounded border text-sm" placeholder="15:30" value={editing.time_label} onChange={e => setEditing({...editing, time_label: e.target.value})}/></div>
           <div className="col-span-1"><label className="text-xs font-bold text-indigo-800 block mb-1">Cho trễ tối đa (phút)</label><input type="number" className="w-full p-2 rounded border text-sm" placeholder="15" value={editing.late_buffer} onChange={e => setEditing({...editing, late_buffer: parseInt(e.target.value)||0})}/></div>
           <div className="col-span-2 md:col-span-1 flex flex-col justify-center gap-2 text-indigo-800"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.require_input} onChange={e => setEditing({...editing, require_input: e.target.checked})} /> Yêu cầu Nhập số liệu?</label><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.require_image} onChange={e => setEditing({...editing, require_image: e.target.checked})} /> Yêu cầu Chụp ảnh?</label></div>
           <div className="col-span-2 md:col-span-6 flex items-end gap-2 pt-2 border-t border-black/5 mt-2">
               {editing.id && <button onClick={resetForm} className="flex items-center gap-2 bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-300"><XCircle size={16}/> Hủy Bỏ</button>}
               <button onClick={handleSaveTask} className={`flex-1 flex items-center justify-center gap-2 text-white px-4 py-2 rounded-lg font-bold shadow-lg text-sm ${editing.id ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{editing.id ? <><Save size={16}/> Cập nhật Thay Đổi</> : <><Plus size={16}/> Thêm Mới</>}</button>
           </div>
        </div>

        <div className="space-y-4">
            {roles.map(role => {
                const tasks = allTasks.filter(t => t.role === role.code).sort((a,b) => a.sort_order - b.sort_order); // Đảm bảo sắp xếp theo sort_order
                if(tasks.length === 0) return null;
                return (
                    <div key={role.code} className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 p-3 border-b border-slate-100 font-bold text-slate-700 flex justify-between">Cấu hình công việc Khu vực: {role.name} <span className="text-xs font-normal bg-white border px-2 rounded flex items-center">{role.code}</span></div>
                        {tasks.map((t, idx) => (
                            <div key={t.id} className={`p-3 border-b border-slate-50 last:border-0 flex items-center justify-between hover:bg-slate-50 ${editing.id === t.id ? 'bg-orange-50' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => handleMove(t, 'up')} disabled={idx === 0 || moveLoading} className="text-slate-300 hover:text-blue-600 disabled:opacity-0 p-1 hover:bg-slate-100 rounded"><ArrowUp size={16}/></button>
                                        <button onClick={() => handleMove(t, 'down')} disabled={idx === tasks.length - 1 || moveLoading} className="text-slate-300 hover:text-blue-600 disabled:opacity-0 p-1 hover:bg-slate-100 rounded"><ArrowDown size={16}/></button>
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-slate-700">{t.title}</p>
                                        <p className="text-xs text-slate-400">
                                            {t.time_label ? `⏰ Deadline: ${t.time_label}` : 'Không giờ'} (+{t.late_buffer} phút trễ)
                                            {t.require_input && ' • 🔢 Nhập số liệu'}
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

    const handleAddRole = async () => { if(!newRole.code || !newRole.name) return setNotify("Vui lòng nhập Mã và Tên Khu vực", "error"); const cleanCode = newRole.code.toLowerCase().replace(/\s/g, '_'); const { error } = await supabase.from('job_roles').insert({ code: cleanCode, name: newRole.name }); if(error) setNotify("Lỗi: " + error.message, "error"); else { setNotify("Đã thêm Khu vực mới"); setNewRole({ code: '', name: '' }); onRefresh(); } };

    const handleDeleteRole = async (code) => { if(code === 'admin') return setNotify("Không thể xóa Role Admin", "error"); if(!window.confirm(`Xác nhận xóa Khu vực ${code}?`)) return; const { error } = await supabase.from('job_roles').delete().eq('code', code); if(!error) { setNotify("Đã xóa Khu vực"); onRefresh(); } };

    const handleCloneRole = async () => {
        if (!cloneData.from || !cloneData.toCode || !cloneData.toName) return setNotify("Thiếu thông tin nhân bản", "error");
        const cleanToCode = cloneData.toCode.toLowerCase().replace(/\s/g, '_');

        // 1. Tạo role mới
        const { error: rErr } = await supabase.from('job_roles').insert({ code: cleanToCode, name: cloneData.toName });
        if (rErr) return setNotify("Lỗi tạo Role: " + rErr.message, "error");

        // 2. Lấy tasks cũ
        const sourceTasks = allTasks.filter(t => t.role === cloneData.from);
        if (sourceTasks.length === 0) {
             setNotify("Đã tạo Role mới nhưng Khu vực nguồn không có công việc nào để copy", "info");
             onRefresh(); // Refresh để hiển thị role mới
             return;
        }

        // 3. Insert tasks mới
        const newTasks = sourceTasks.map(t => ({
            role: cleanToCode,
            title: t.title,
            time_label: t.time_label,
            late_buffer: t.late_buffer,
            require_input: t.require_input,
            require_image: t.require_image,
            sort_order: t.sort_order
        }));

        const { error: tErr } = await supabase.from('task_definitions').insert(newTasks);
        if (tErr) setNotify("Lỗi copy công việc: " + tErr.message, "error");
        else { setNotify("Đã nhân bản Khu vực thành công!"); onRefresh(); setCloneData({ from: '', toCode: '', toName: '' }); }
    };

    return (
        <div className="space-y-8">
            {/* THÊM MỚI */}
            <div>
                <h3 className="text-sm font-bold mb-2 uppercase text-slate-500">Thêm Khu Vực Mới</h3>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
                    <input className="p-2 rounded border border-amber-200 text-sm flex-1" placeholder="Mã (vd: be_boi)" value={newRole.code} onChange={e => setNewRole({...newRole, code: e.target.value})}/>
                    <input className="p-2 rounded border border-amber-200 text-sm flex-[2]" placeholder="Tên (vd: Bể Bơi)" value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})}/>
                    <button onClick={handleAddRole} className="bg-amber-600 text-white px-4 rounded font-bold hover:bg-amber-700 text-sm">Thêm Khu Vực</button>
                </div>
            </div>

            {/* NHÂN BẢN */}
            <div>
                 <h3 className="text-sm font-bold mb-2 uppercase text-slate-500">Sao Chép Cấu Hình (Nhân Bản)</h3>
                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select className="p-2 rounded border border-blue-200 text-sm" value={cloneData.from} onChange={e => setCloneData({...cloneData, from: e.target.value})}>
                        <option value="">-- Sao chép từ Khu vực --</option>
                        {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                    </select>
                    <input className="p-2 rounded border border-blue-200 text-sm" placeholder="Mã Mới (vd: be_boi_2)" value={cloneData.toCode} onChange={e => setCloneData({...cloneData, toCode: e.target.value})}/>
                    <input className="p-2 rounded border border-blue-200 text-sm" placeholder="Tên Mới (vd: Bể Bơi 2)" value={cloneData.toName} onChange={e => setCloneData({...cloneData, toName: e.target.value})}/>
                    <button onClick={handleCloneRole} className="bg-blue-600 text-white px-4 rounded font-bold hover:bg-blue-700 text-sm flex items-center justify-center gap-2"><Copy size={16}/> Nhân bản</button>
                 </div>
            </div>

            {/* DANH SÁCH */}
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-slate-100">
                        {roles.map(r => (
                            <tr key={r.code} className="hover:bg-slate-50">
                                <td className="p-4 font-mono text-slate-500">{r.code}</td>
                                <td className="p-4 font-bold text-slate-700">{r.name}</td>
                                <td className="p-4 text-right"><button onClick={() => handleDeleteRole(r.code)} className="text-red-400 p-2 hover:text-red-600"><Trash2 size={16}/></button></td>
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

  const handleAddUser = async () => { if(!newUser.username || !newUser.password) return setNotify("Thiếu thông tin tên đăng nhập/mật khẩu", "error"); const roleToSave = newUser.role || 'staff'; const { error } = await supabase.from('app_users').insert({...newUser, role: roleToSave}); if(error) setNotify("Lỗi: " + error.message, "error"); else { setNotify("Đã thêm người dùng mới"); onRefresh(); } };
  const handleDeleteUser = async (id) => { if(!window.confirm("Xác nhận xóa người dùng này?")) return; const { error } = await supabase.from('app_users').delete().eq('id', id); if(!error) { setNotify("Đã xóa người dùng"); onRefresh(); } };

  return (
    <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col md:flex-row gap-3">
            <input className="p-2 rounded border border-blue-200 text-sm" placeholder="Tên đăng nhập" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})}/>
            <input className="p-2 rounded border border-blue-200 text-sm" placeholder="Mật khẩu" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}/>
            <input className="p-2 rounded border border-blue-200 text-sm flex-1" placeholder="Họ Tên" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})}/>
            <select className="p-2 rounded border border-blue-200 text-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option value="admin">Quản lý (Admin)</option>
                {roles.map(r => ( <option key={r.code} value={r.code}>{r.name}</option> ))}</select>
            <button onClick={handleAddUser} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 text-sm">Thêm Người Dùng</button>
        </div>
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                    <tr>
                        <th className="p-4">Họ Tên</th>
                        <th className="p-4">Username</th>
                        <th className="p-4">Mật khẩu</th> {/* Cải thiện câu từ */}
                        <th className="p-4">Vai trò</th>
                        <th className="p-4 text-right">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50">
                            <td className="p-4 font-bold text-slate-700">{u.name}</td>
                            <td className="p-4 text-slate-500">{u.username}</td>
                            <td className="p-4 text-slate-500 font-mono">********</td> {/* Sửa lỗi bảo mật: Che giấu mật khẩu */}
                            <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{u.role}</span></td>
                            <td className="p-4 text-right"><button onClick={() => handleDeleteUser(u.id)} className="text-red-500 p-2 hover:text-red-700"><Trash2 size={16}/></button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  )
}

// ==========================================
// COMPONENT MỚI: THỐNG KÊ & LỊCH SỬ BÁO CÁO
// ==========================================

// Modal Chi Tiết Báo Cáo
const ReportDetailsModal = ({ report, allTasks, roles, users }) => {
    const [isOpen, setIsOpen] = useState(false);
    const roleTasks = allTasks.filter(t => t.role === report.role).sort((a,b) => a.sort_order - b.sort_order);
    const roleName = roles.find(r => r.code === report.role)?.name || report.role;
    const reportData = report.data || {};

    // Tạm thời bỏ qua việc tìm user cho báo cáo này vì cấu trúc DB hiện tại không lưu user_id trong checklist_logs
    // const userReported = users.find(u => u.role === report.role);

    return (
        <>
            <button onClick={() => setIsOpen(true)} className="text-blue-600 hover:underline text-xs font-bold px-3 py-1 bg-blue-50 rounded-lg"><ExternalLink size={14} className="inline mr-1"/> Xem chi tiết</button>
            {isOpen && (
                <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
                   <div className="bg-white rounded-xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                      <h3 className="font-bold text-xl mb-4 text-slate-800 border-b pb-2 flex items-center justify-between">
                        Chi Tiết Báo Cáo Công Việc
                        <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-800"><X size={20}/></button>
                      </h3>
                      <div className="mb-4 text-sm font-medium grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <p>Ngày Báo Cáo: <span className="font-mono text-slate-600 font-bold">{report.report_date}</span></p>
                          <p>Khu Vực: <span className="font-bold text-blue-600">{roleName} ({report.role})</span></p>
                          <p>Tiến Độ: <span className="font-bold text-emerald-600">{report.sentCount}/{report.totalTasks}</span></p>
                          {/* <p>Người Thực Hiện: <span className="text-slate-500">{userReported?.name || "Chưa xác định"}</span></p> */}
                      </div>

                      <div className="space-y-3 max-h-80 overflow-y-auto pr-2 border p-3 rounded-lg">
                        <p className="font-bold text-sm uppercase text-slate-600 border-b pb-1">Danh sách công việc chi tiết</p>
                          {roleTasks.map(task => {
                             const item = reportData[task.id];
                             const isSent = item?.sent;
                             const isLate = checkIsLate(task.time_label, task.late_buffer, isSent);

                             return (
                                <div key={task.id} className={`p-3 rounded-lg border flex justify-between items-start gap-4 ${isSent ? 'bg-emerald-50 border-emerald-200' : (isLate ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200')}`}>
                                    <div className='flex-1'>
                                        <p className="font-bold text-sm text-slate-800">{task.title}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Deadline: {task.time_label} (+{task.late_buffer}p)
                                            {isLate && <span className="text-red-600 font-bold ml-2">(TRỄ)</span>}
                                            {isSent && item.time && ` • Hoàn thành: ${item.time}`}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 min-w-[120px]">
                                       {item?.val && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-mono font-bold">SL: {item.val}</span>}
                                       {item?.imageUrl && (<a href={item.imageUrl} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs flex items-center gap-1 hover:underline"><ImageIcon size={12}/> Ảnh đính kèm</a>)}
                                       {isSent ? <span className="text-emerald-600 font-bold text-xs"><CheckCircle2 size={14} className="inline"/> Đã gửi</span> : <span className="text-slate-400 text-xs font-medium"><Clock size={14} className="inline"/> Chưa gửi</span>}
                                    </div>
                                </div>
                             )
                          })}
                      </div>

                      <div className="flex justify-end mt-6">
                         <button onClick={() => setIsOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold">Đóng</button>
                      </div>
                   </div>
                </div>
            )}
        </>
    );
};

// Component chính Thống kê
const AdminHistoryReports = ({ users, roles, allTasks, setNotify }) => {
    // Khởi tạo filter với ngày hôm nay và loại lọc theo ngày
    const [filter, setFilter] = useState({ date: getTodayISO(), role: '', user_id: '', type: 'day' });
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch khi component load lần đầu
    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        setFilteredData([]);

        // Lấy tất cả dữ liệu logs
        let query = supabase.from('checklist_logs').select('id, report_date, role, data');

        // Lọc theo thời gian
        if (filter.date) {
            if (filter.type === 'day') {
                query = query.eq('report_date', filter.date);
            } else if (filter.type === 'month') {
                // Lọc theo tháng: YYYY-MM
                const [year, month] = filter.date.split('-');
                query = query.like('report_date', `${year}-${month}%`);
            } else if (filter.type === 'year') {
                // Lọc theo năm: YYYY
                const [year] = filter.date.split('-');
                query = query.like('report_date', `${year}%`);
            }
        }

        // Lọc theo Khu vực
        if (filter.role) {
            query = query.eq('role', filter.role);
        }

        // Tạm thời bỏ qua lọc theo user_id vì logs lưu theo role, không theo user.

        const { data, error } = await query.order('report_date', { ascending: false });

        if (error) {
            setNotify("Lỗi tải dữ liệu thống kê: " + error.message, "error");
        } else {
            // Xử lý dữ liệu để tính toán tiến độ
            let processedData = (data || []).map(log => {
                const roleTasks = allTasks.filter(t => t.role === log.role);
                const totalTasks = roleTasks.length;
                const sentCount = Object.values(log.data || {}).filter(item => item.sent).length;
                return {
                    ...log,
                    roleName: roles.find(r => r.code === log.role)?.name || log.role,
                    totalTasks,
                    sentCount,
                    progress: totalTasks > 0 ? Math.round((sentCount / totalTasks) * 100) : 0,
                };
            }).filter(item => item.totalTasks > 0); // Chỉ hiển thị logs có công việc được cấu hình

            setFilteredData(processedData);
        }

        setLoading(false);
    };

    const handleFilterChange = (key, value) => {
        let newFilter = { ...filter, [key]: value };
        // Tự động điều chỉnh input date format khi đổi loại lọc
        if (key === 'type') {
            const today = new Date().toISOString().split('T')[0];
            newFilter.date = today.substring(0, value === 'year' ? 4 : (value === 'month' ? 7 : 10));
        }
        setFilter(newFilter);
    };

    const dateInputType = filter.type === 'day' ? 'date' : (filter.type === 'month' ? 'month' : 'text');

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Clock size={20}/> Lịch Sử & Thống Kê Báo Cáo</h2>
            {/* Thanh Lọc */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-2 md:grid-cols-5 gap-3">

                {/* Lọc theo Loại Thời gian */}
                <select className="p-2 rounded border text-sm" value={filter.type} onChange={e => handleFilterChange('type', e.target.value)}>
                    <option value="day">Theo Ngày</option>
                    <option value="month">Theo Tháng</option>
                    <option value="year">Theo Năm</option>
                </select>

                {/* Input Thời gian */}
                <input type={dateInputType}
                    placeholder={filter.type === 'day' ? 'YYYY-MM-DD' : (filter.type === 'month' ? 'YYYY-MM' : 'YYYY')}
                    className="p-2 rounded border text-sm"
                    value={filter.date}
                    onChange={e => setFilter({ ...filter, date: e.target.value })}
                    // Cho phép nhập tự do khi lọc theo năm
                    readOnly={filter.type === 'year'}
                />

                {/* Lọc theo Khu vực */}
                <select className="p-2 rounded border text-sm" value={filter.role} onChange={e => setFilter({...filter, role: e.target.value})}>
                    <option value="">-- Tất cả Khu vực --</option>
                    {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                </select>

                {/* Lọc theo User (Tạm ẩn vì DB logs theo Role)
                <select className="p-2 rounded border text-sm" value={filter.user_id} onChange={e => setFilter({...filter, user_id: e.target.value})}>
                    <option value="">-- Tất cả Nhân sự --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select> */}

                <button onClick={fetchReports} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 text-sm col-span-2 md:col-span-1 flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>} Tìm kiếm
                </button>
            </div>

            {/* Bảng Kết quả */}
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Kết quả ({filteredData.length} báo cáo)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-slate-500 uppercase font-bold text-xs border-b">
                            <tr>
                                <th className="p-4 w-1/5">Ngày Báo Cáo</th>
                                <th className="p-4 w-1/5">Khu Vực</th>
                                <th className="p-4 w-2/5">Tiến Độ Hoàn Thành</th>
                                <th className="p-4 w-1/5">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading && <tr><td colSpan="4" className="p-6 text-center text-blue-600"><Loader2 className="animate-spin inline mr-2"/> Đang tải dữ liệu lịch sử...</td></tr>}
                            {!loading && filteredData.length === 0 && <tr><td colSpan="4" className="p-6 text-center text-slate-400">Không tìm thấy báo cáo nào theo bộ lọc.</td></tr>}
                            {filteredData.map((report) => (
                                <tr key={report.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-mono text-slate-500">{report.report_date}</td>
                                    <td className="p-4 font-bold text-slate-700">{report.roleName}</td>
                                    <td className="p-4">
                                        <div className="w-full bg-slate-200 rounded-full h-2.5">
                                            <div className="h-2.5 rounded-full bg-blue-600" style={{ width: `${report.progress}%` }}></div>
                                        </div>
                                        <span className="text-xs text-slate-500 mt-1 block font-medium">{report.progress}% ({report.sentCount}/{report.totalTasks} công việc)</span>
                                    </td>
                                    <td className="p-4">
                                        <ReportDetailsModal report={report} allTasks={allTasks} roles={roles} users={users}/>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


const ModernLogin = ({ loginForm, setLoginForm, handleLogin, loading, notification }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4"><div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100"><div className="text-center mb-8"><div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/30"><ShieldCheck size={32}/></div><h1 className="text-2xl font-bold text-slate-800">Đăng Nhập Hệ Thống</h1></div><div className="space-y-4"><div className="relative"><User className="absolute left-4 top-3.5 text-slate-400" size={20}/><input type="text" placeholder="Tên đăng nhập" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})}/></div><div className="relative"><Lock className="absolute left-4 top-3.5 text-slate-400" size={20}/><input type="password" placeholder="Mật khẩu" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleLogin()}/></div>{notification.msg && <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">{notification.msg}</div>}<button onClick={handleLogin} disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex justify-center">{loading ? <Loader2 className="animate-spin"/> : 'Vào ca làm việc'}</button></div></div></div>
);
}