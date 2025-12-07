import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
import {
  User, Lock, LogOut, RefreshCcw, Camera, Trash2, Plus,
  CheckCircle2, Clock, Send, Loader2,
  LayoutDashboard, Menu, X, ShieldCheck,
  Users, ListTodo, Image as ImageIcon, MapPin, Briefcase,
  CalendarClock, AlertTriangle, AlertCircle,
  Edit3, Copy, Key, Save, XCircle, BarChart3, TrendingUp, DollarSign, Calendar, Filter, ChevronRight,
  Eye, EyeOff, UserCog, Layers, CheckSquare
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
    /* Hide file input default style */
    input[type="file"] {
        display: none;
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

// --- Hàm lấy vị trí (ĐÃ SỬA LẠI: Thêm timeout và độ chính xác cao) ---
const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    // 1. Kiểm tra trình duyệt có hỗ trợ không
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không hỗ trợ GPS."));
      return;
    }

    // 2. Cấu hình quan trọng để không bị treo
    const options = {
      enableHighAccuracy: true, // Bắt buộc dùng chip GPS để chính xác nhất
      timeout: 15000,           // Chỉ chờ tối đa 15 giây (tránh treo app mãi mãi)
      maximumAge: 0             // Không lấy lại vị trí cũ lưu trong cache
    };

    // 3. Gọi hàm lấy vị trí
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Thành công
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        // Thất bại - Báo lỗi rõ ràng hơn để bạn biết nguyên nhân
        let msg = "Lỗi không xác định.";
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            msg = "Bạn đã chặn quyền Vị trí. Hãy vào cài đặt trình duyệt để Bật lại.";
            break;
          case 2: // POSITION_UNAVAILABLE
            msg = "Thiết bị không bắt được sóng GPS. Hãy ra chỗ thoáng hơn.";
            break;
          case 3: // TIMEOUT
            msg = "Hết thời gian chờ (mạng hoặc GPS quá yếu). Hãy thử lại.";
            break;
          default:
            msg = error.message;
        }
        reject(new Error(msg));
      },
      options // <--- QUAN TRỌNG: Phải truyền tham số này vào
    );
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
// --- UTILS BỔ SUNG ---
const checkTaskVisibleToday = (task) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 (CN) - 6 (T7)
    const currentDate = today.getDate(); // 1 - 31

    if (!task.repeat_type || task.repeat_type === 'daily') return true;
    if (task.repeat_type === 'weekly') return parseInt(task.repeat_on) === currentDay;
    if (task.repeat_type === 'monthly') return parseInt(task.repeat_on) === currentDate;
    return true;
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

// --- NEW UTIL: COMPRESS IMAGE TO < 300KB ---
const processImageInput = (file, maxSizeMB = 0.3) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Resize logic: Max width 1024px to reduce size drastically first
                const MAX_WIDTH = 1024;
                const scaleSize = MAX_WIDTH / img.width;
                const width = (scaleSize < 1) ? MAX_WIDTH : img.width;
                const height = (scaleSize < 1) ? img.height * scaleSize : img.height;

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG with quality adjustment
                // Start with 0.7 quality
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
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
      if (data.role === 'admin') {
         fetchAllDataAdmin();
      } else if (data.role.includes('manager')) {
         fetchAllDataManager();
      } else {
         // Staff: Role có thể là "bep,phucvu" -> Cần fetch tất cả task của các role này
         fetchTasksConfig(data.role);
         fetchTodayReport(data.role);
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

  const fetchTasksConfig = async (roleString) => {
    // roleString có thể là "bep,bar". Cần split ra
    const roles = roleString.split(',').map(r => r.trim());
    const { data } = await supabase.from('task_definitions').select('*').in('role', roles).order('time_label', { ascending: true });
    if(data) setTasksConfig(data);
  };

  const fetchTodayReport = async (roleString) => {
    const today = getTodayISO();
    const roles = roleString.split(',').map(r => r.trim());
    // Fetch logs cho tất cả role mà user đảm nhận
    const { data } = await supabase.from('checklist_logs').select('role, data').eq('report_date', today).in('role', roles);

    const combinedData = {};
    if (data) {
        data.forEach(item => {
            combinedData[item.role] = item.data || {};
        });
    }
    setChecklistData(combinedData);
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

  const fetchAllDataManager = async () => {
     try {
        const today = getTodayISO();
        // Manager thấy mọi user trừ admin
        const { data: uData } = await supabase.from('app_users').select('*').neq('role', 'admin').order('name');
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
        showNotify(setNotification, "Lỗi tải dữ liệu quản lý", "error");
     }
  };

  if (!user) return <ModernLogin loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} notification={notification} loading={loading} />;

  // Xử lý Role hiển thị trên UI
  const displayRole = user.role === 'admin' ? 'Quản Trị Viên' : (user.role.includes('manager') ? 'Quản Lý' : 'Nhân Viên');

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
                   {displayRole}
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
            ) : user.role.includes('manager') ? (
              <ManagerDashboard
                 users={usersList}
                 roles={rolesList}
                 allTasks={tasksConfig}
                 initialReports={checklistData}
                 onRefresh={fetchAllDataManager}
                 setNotify={(m, t) => showNotify(setNotification, m, t)}
              />
            ) : (
              <StaffDashboard
                user={user}
                tasks={tasksConfig}
                checklistData={checklistData}
                onUpdateLocal={setChecklistData}
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
// LOGIN COMPONENT
// ==========================================
const ModernLogin = ({ loginForm, setLoginForm, handleLogin, notification, loading }) => (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
           <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/30">
              <ShieldCheck size={32}/>
           </div>
           <h1 className="text-2xl font-bold text-slate-800">Đăng Nhập Hệ Thống</h1>
        </div>
        <div className="space-y-4">
           <div className="relative">
              <User className="absolute left-4 top-3.5 text-slate-400" size={20}/>
              <input type="text" placeholder="Tên đăng nhập" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})}/>
           </div>
           <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-slate-400" size={20}/>
              <input type="password" placeholder="Mật khẩu" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleLogin()}/>
           </div>
           {notification.msg && <div className={`text-sm text-center font-medium ${notification.type==='error'?'text-red-500':'text-emerald-500'}`}>{notification.msg}</div>}
           <button onClick={handleLogin} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
             {loading ? <Loader2 className="animate-spin" /> : "Đăng Nhập"}
           </button>
        </div>
      </div>
    </div>
);

// ==========================================
// STAFF COMPONENTS (MULTI-ROLE & IMAGE COMPRESSION)
// ==========================================
const StaffDashboard = ({ user, tasks, checklistData, onUpdateLocal, setNotify }) => {
    const userRoles = user.role.split(',').map(r => r.trim());
    const [activeRole, setActiveRole] = useState(userRoles[0]);

    // Switch role logic
    // TRONG StaffDashboard
    // Tìm dòng: const displayedTasks = tasks.filter(t => t.role === activeRole);
    // Sửa thành:n
    const displayedTasks = tasks.filter(t => t.role === activeRole && checkTaskVisibleToday(t));
    const reportData = checklistData[activeRole] || {};

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
      setNotify("Đang xử lý ảnh và GPS...", "info");

      try {
         const location = await getCurrentLocation();

         // NÉN ẢNH
         const compressedBlob = await processImageInput(file);
         const fileExt = "jpg";
         const fileName = `attendance/${user.username}_${type}_${Date.now()}.${fileExt}`;

         const { error: uploadError } = await supabase.storage.from('task-images').upload(fileName, compressedBlob, { contentType: 'image/jpeg' });
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

       // Update nested state
       const newRoleData = { ...reportData, [taskDefId]: updatedItem };
       onUpdateLocal(prev => ({ ...prev, [activeRole]: newRoleData }));
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

         // Optimistic Update
         onUpdateLocal(prev => ({ ...prev, [activeRole]: newReportData }));

         const { error } = await supabase.from('checklist_logs').upsert({ report_date: getTodayISO(), role: activeRole, data: newReportData }, { onConflict: 'report_date, role' });
         if(error) throw error;

         setNotify("Đã gửi báo cáo!");
       } catch (err) {
         setNotify("Gửi lỗi, vui lòng thử lại", "error");
       } finally { setLoadingSend(null); }
    };

    const handleImageUpload = async (e, taskDefId) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        setNotify("Đang nén và tải ảnh...", "info");

        // NÉN ẢNH
        const compressedBlob = await processImageInput(file);
        const fileName = `${user.username}_${taskDefId}_${Date.now()}.jpg`;

        const { error } = await supabase.storage.from('task-images').upload(fileName, compressedBlob, { contentType: 'image/jpeg' });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('task-images').getPublicUrl(fileName);
        handleTaskAction(taskDefId, 'image', publicUrl);
        setNotify("Tải ảnh thành công");
      } catch (error) { setNotify("Lỗi tải ảnh: " + error.message, "error"); }
    };

    const totalTasks = displayedTasks.length;
    const completedTasks = displayedTasks.filter(t => reportData[t.id]?.sent).length;
    const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return (
      <div className="space-y-6">
        {/* TAB ROLE SWITCHER */}
        {userRoles.length > 1 && (
            <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                {userRoles.map(r => (
                    <button
                        key={r}
                        onClick={() => setActiveRole(r)}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeRole === r ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                       <Layers size={16}/> {r.toUpperCase()}
                    </button>
                ))}
            </div>
        )}

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-end mb-2">
              <span className="font-bold text-slate-700">Tiến độ ({activeRole})</span>
              <span className="text-blue-600 font-bold text-lg">{progressPercent}%</span>
           </div>
           <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
           </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
           <div><h2 className="text-xl font-bold text-slate-800">Chấm công</h2><p className="text-slate-500 text-sm">Chụp ảnh selfie để vào/ra ca</p></div>

           {attLoading ? (
             <div className="flex items-center gap-2 text-blue-600 font-bold bg-blue-50 px-6 py-3 rounded-xl animate-pulse">
               <Loader2 className="animate-spin"/> Đang xử lý...
             </div>
           ) : (
             <div className="flex gap-3">
                <div className="relative">
                   {/* CAPTURE="USER" forces Front Camera on mobile */}
                   <input type="file" accept="image/*" capture="user" id="att-in" disabled={!!attendance.in} onChange={(e) => handleAttendanceCapture(e, 'check_in')} />
                   <label htmlFor="att-in" className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all ${attendance.in ? 'bg-slate-100 text-slate-400 cursor-not-allowed pointer-events-none' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30'}`}>
                     <MapPin size={18} /> {attendance.in ? `Vào: ${attendance.in}` : 'Check In'}
                   </label>
                </div>
                <div className="relative">
                   <input type="file" accept="image/*" capture="user" id="att-out" disabled={!attendance.in || !!attendance.out} onChange={(e) => handleAttendanceCapture(e, 'check_out')} />
                   <label htmlFor="att-out" className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all ${attendance.out ? 'bg-slate-100 text-slate-400 pointer-events-none' : (!attendance.in ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100')}`}>
                     <LogOut size={18} /> {attendance.out ? `Ra: ${attendance.out}` : 'Check Out'}
                   </label>
                </div>
             </div>
           )}
        </div>

        <div className="grid gap-4">
          {displayedTasks.map((task) => {
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
                        {task.require_image && (
                           <div className="relative">
                              {/* CAPTURE="ENVIRONMENT" forces Back Camera on mobile */}
                              <input type="file" id={`file-${task.id}`} className="hidden" accept="image/*" capture="environment" disabled={!isDone || isSent} onChange={(e) => handleImageUpload(e, task.id)}/>
                              <label htmlFor={`file-${task.id}`} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer ${!isDone || isSent ? 'bg-slate-100' : 'bg-white'}`}>
                                 {item.imageUrl ? <span className="text-indigo-600 flex gap-1"><ImageIcon size={16}/>Đã chụp</span> : <span><Camera size={16}/>Chụp</span>}
                              </label>
                           </div>
                        )}
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
// --- COMPONENT MỚI: LỊCH SỬ HOẠT ĐỘNG (BỘ LỌC NÂNG CAO) ---
const AdminHistoryLog = ({ users, roles }) => {
  // State quản lý bộ lọc
  const [filterType, setFilterType] = useState('date'); // 'date' | 'month' | 'range'
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [filterRole, setFilterRole] = useState('');
  const [filterUserId, setFilterUserId] = useState('');

  // State dữ liệu
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Xử lý thay đổi loại lọc thời gian
  const handleFilterTypeChange = (type) => {
    setFilterType(type);
    const today = new Date().toISOString().split('T')[0];
    if (type === 'date') {
      setDateRange({ start: today, end: today });
    } else if (type === 'month') {
      const d = new Date();
      handleMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    } else {
      setDateRange({ start: today, end: today });
    }
  };

  // Xử lý khi chọn tháng
  const handleMonthChange = (monthStr) => {
    if (!monthStr) return;
    const [y, m] = monthStr.split('-');
    const start = `${monthStr}-01`;
    // Lấy ngày cuối tháng
    const end = new Date(y, m, 0).toISOString().split('T')[0];
    setDateRange({ start, end });
  };

  // Hàm tải dữ liệu
  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Query cơ bản vào bảng time_logs
      // Lưu ý: Dùng !inner để lọc được theo bảng app_users nếu cần
      let query = supabase
        .from('time_logs')
        .select('*, app_users!inner(name, role, username)')
        .order('log_time', { ascending: false });

      // 2. Áp dụng lọc thời gian
      if (dateRange.start) query = query.gte('report_date', dateRange.start);
      if (dateRange.end) query = query.lte('report_date', dateRange.end);

      // 3. Áp dụng lọc nhân viên (nếu có chọn)
      if (filterUserId) {
        query = query.eq('user_id', filterUserId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // 4. Áp dụng lọc Khu vực (Role) ở phía Client (vì quan hệ N-N string khó lọc query chuẩn)
      let result = data || [];
      if (filterRole && !filterUserId) {
        // Nếu chọn Role mà chưa chọn User -> lọc những log của user có role đó
        result = result.filter(log => log.app_users?.role?.includes(filterRole));
      }

      setLogs(result);
    } catch (err) {
      console.error("Lỗi tải lịch sử:", err);
    } finally {
      setLoading(false);
    }
  };

  // Tự động tải khi thay đổi filter (có thể bỏ nếu muốn bấm nút mới tải)
  useEffect(() => {
    fetchLogs();
  }, [dateRange, filterUserId, filterRole]); // Dependency: Chạy lại khi bộ lọc đổi

  // Lọc danh sách user theo Role đã chọn (để hiển thị trong dropdown)
  const filteredUsers = filterRole
    ? users.filter(u => u.role.includes(filterRole))
    : users;

  return (
    <div className="space-y-4">
      {/* --- THANH BỘ LỌC --- */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">

        {/* Dòng 1: Chọn kiểu thời gian */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
            <button onClick={() => handleFilterTypeChange('date')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'date' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Ngày</button>
            <button onClick={() => handleFilterTypeChange('range')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'range' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Khoảng</button>
            <button onClick={() => handleFilterTypeChange('month')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'month' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Tháng</button>
          </div>

          {/* Input Thời gian linh hoạt */}
          <div className="flex items-center gap-2">
             {filterType === 'date' && (
               <input type="date" value={dateRange.start} onChange={e => setDateRange({start: e.target.value, end: e.target.value})} className="border rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700"/>
             )}
             {filterType === 'month' && (
               <input type="month" onChange={e => handleMonthChange(e.target.value)} defaultValue={dateRange.start.slice(0,7)} className="border rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700"/>
             )}
             {filterType === 'range' && (
               <div className="flex items-center gap-2">
                 <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="border rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700"/>
                 <span className="text-slate-400">-</span>
                 <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="border rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700"/>
               </div>
             )}
          </div>
        </div>

        {/* Dòng 2: Chọn Khu vực & Nhân viên */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Lọc Role */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400"/>
            <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setFilterUserId(''); }} className="border rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 min-w-[150px]">
              <option value="">-- Tất cả Khu vực --</option>
              {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          </div>

          {/* Lọc User */}
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-400"/>
            <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 min-w-[150px]">
              <option value="">-- Tất cả Nhân viên --</option>
              {filteredUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <button onClick={fetchLogs} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30">
            {loading ? <Loader2 className="animate-spin" size={16}/> : <RefreshCcw size={16}/>} Tải dữ liệu
          </button>
        </div>
      </div>

      {/* --- BẢNG KẾT QUẢ --- */}
      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
         <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between">
            <span>Tìm thấy {logs.length} lượt hoạt động</span>
            <span>{dateRange.start} <span className="mx-1">→</span> {dateRange.end}</span>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b">
                <tr>
                  <th className="p-4">Thời gian</th>
                  <th className="p-4">Nhân viên</th>
                  <th className="p-4">Khu vực</th>
                  <th className="p-4">Hành động</th>
                  <th className="p-4">Hình ảnh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.length === 0 ? (
                   <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Không có dữ liệu nào trong khoảng thời gian này.</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                       <div className="font-mono font-bold text-slate-700">{new Date(log.log_time).toLocaleTimeString('vi-VN')}</div>
                       <div className="text-xs text-slate-400">{log.report_date}</div>
                    </td>
                    <td className="p-4 font-bold text-slate-700">{log.app_users?.name}</td>
                    <td className="p-4">
                       {/* Hiển thị các role của user này */}
                       <div className="flex gap-1">
                          {log.app_users?.role.split(',').map(r => (
                             <span key={r} className="text-[10px] uppercase bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">{r}</span>
                          ))}
                       </div>
                    </td>
                    <td className="p-4">
                      {log.action_type === 'check_in' ? (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold flex w-fit items-center gap-1 border border-emerald-200"><MapPin size={12}/> VÀO CA</span>
                      ) : (
                        <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold flex w-fit items-center gap-1 border border-rose-200"><LogOut size={12}/> TAN CA</span>
                      )}
                    </td>
                    <td className="p-4">
                       {log.image_url ? (
                         <a href={log.image_url} target="_blank" rel="noreferrer" className="block w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:scale-110 transition-transform">
                            <img src={log.image_url} alt="check" className="w-full h-full object-cover"/>
                         </a>
                       ) : <span className="text-slate-300 text-xs">Không ảnh</span>}
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
// MANAGER DASHBOARD
// ==========================================
const ManagerDashboard = ({ users, roles, allTasks, initialReports, onRefresh, setNotify }) => {
   const [tab, setTab] = useState('monitor'); // Default monitor
   return (
      <div>
         <div className="flex gap-4 mb-6 border-b border-slate-200 pb-1">
             <button onClick={() => setTab('monitor')} className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 ${tab === 'monitor' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
               <LayoutDashboard size={18}/> Giám Sát Tiến Độ
            </button>
            <button onClick={() => setTab('assign')} className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 ${tab === 'assign' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
               <UserCog size={18}/> Phân Công & Nhân Sự
            </button>
            <button onClick={onRefresh} className="ml-auto p-2 text-slate-400 hover:text-blue-600"><RefreshCcw size={18}/></button>
         </div>

         {/* Sử dụng component dành riêng cho Manager */}
         {tab === 'assign' && <ManagerTaskAssignment users={users} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />}
         {/* Giữ lại AdminReports nhưng có thêm props users để lọc */}
         {tab === 'monitor' && <AdminHistoryLog users={users} roles={roles} />}
      </div>
   );
};

// --- NEW COMPONENT: MANAGER TASK ASSIGNMENT ---
// Chỉ phân công công việc, không sửa user/pass
const ManagerTaskAssignment = ({ users, roles, onRefresh, setNotify }) => {
    // Local state để quản lý checkbox thay đổi trước khi bấm lưu
    const [userRolesState, setUserRolesState] = useState({});
    const [loadingSave, setLoadingSave] = useState(null);

    // Init state từ props users
    useEffect(() => {
        const init = {};
        users.forEach(u => {
            init[u.id] = u.role.split(',').map(r => r.trim());
        });
        setUserRolesState(init);
    }, [users]);

    const toggleRole = (userId, roleCode) => {
        setUserRolesState(prev => {
            const currentRoles = prev[userId] || [];
            if (currentRoles.includes(roleCode)) {
                return { ...prev, [userId]: currentRoles.filter(r => r !== roleCode) };
            } else {
                return { ...prev, [userId]: [...currentRoles, roleCode] };
            }
        });
    };

    const handleSaveUser = async (user) => {
        const selectedRoles = userRolesState[user.id];
        if (!selectedRoles || selectedRoles.length === 0) return setNotify("Phải chọn ít nhất 1 công việc!", "error");

        setLoadingSave(user.id);
        const roleString = selectedRoles.join(',');

        try {
            const { error } = await supabase.from('app_users').update({ role: roleString }).eq('id', user.id);
            if (error) throw error;
            setNotify("Đã cập nhật phân công cho " + user.name);
            onRefresh();
        } catch (err) {
            setNotify("Lỗi: " + err.message, "error");
        } finally {
            setLoadingSave(null);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b">
                    <tr>
                        <th className="p-4 w-1/4">Nhân viên</th>
                        <th className="p-4 w-1/2">Phân công Khu vực / Công việc</th>
                        <th className="p-4 w-1/4 text-right">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {users.map(u => {
                         // Manager không được sửa admin
                         if(u.role === 'admin') return null;
                         const currentSelected = userRolesState[u.id] || [];

                         return (
                            <tr key={u.id} className="hover:bg-slate-50">
                                <td className="p-4 align-top">
                                    <div className="font-bold text-slate-700 text-base">{u.name}</div>
                                    <div className="text-slate-400 text-xs font-mono mt-1">@{u.username}</div>
                                </td>
                                <td className="p-4">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {roles.map(r => {
                                            const isChecked = currentSelected.includes(r.code);
                                            return (
                                                <div key={r.code}
                                                     onClick={() => toggleRole(u.id, r.code)}
                                                     className={`cursor-pointer border rounded-lg px-3 py-2 flex items-center gap-2 transition-all select-none ${isChecked ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                                                        {isChecked && <CheckCircle2 size={12}/>}
                                                    </div>
                                                    <span className="font-medium text-xs">{r.name}</span>
                                                </div>
                                            )
                                        })}
                                        {/* Tùy chọn Manager (nếu manager muốn cấp quyền manager cho người khác - tuỳ business logic, ở đây cho phép) */}
                                        <div onClick={() => toggleRole(u.id, 'manager')}
                                             className={`cursor-pointer border rounded-lg px-3 py-2 flex items-center gap-2 transition-all select-none ${currentSelected.includes('manager') ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-500'}`}
                                        >
                                             <div className={`w-4 h-4 rounded border flex items-center justify-center ${currentSelected.includes('manager') ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-slate-300'}`}>
                                                 {currentSelected.includes('manager') && <CheckCircle2 size={12}/>}
                                             </div>
                                             <span className="font-medium text-xs">Quản Lý (Manager)</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 align-top text-right">
                                    <button
                                        onClick={() => handleSaveUser(u)}
                                        disabled={loadingSave === u.id}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 ml-auto"
                                    >
                                        {loadingSave === u.id ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Lưu
                                    </button>
                                </td>
                            </tr>
                         )
                    })}
                </tbody>
            </table>
        </div>
    );
}
const AdminShiftScheduling = ({ users, roles, setNotify }) => {
    const [viewDate, setViewDate] = useState(getTodayISO());
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Load ca làm việc theo ngày chọn
    useEffect(() => {
        const fetchShifts = async () => {
            setLoading(true);
            const { data } = await supabase.from('work_shifts').select('*').eq('shift_date', viewDate);
            setShifts(data || []);
            setLoading(false);
        };
        fetchShifts();
    }, [viewDate]);

    const handleAssignShift = async (userId, areaCode, startTime) => {
        if (!areaCode || !startTime) return;
        try {
            const { error } = await supabase.from('work_shifts').upsert({
                user_id: userId,
                shift_date: viewDate,
                area_code: areaCode,
                start_time: startTime
            }, { onConflict: 'user_id, shift_date' });

            if (error) throw error;
            setNotify("Đã lưu ca làm việc", "success");

            // Refresh local state
            const { data } = await supabase.from('work_shifts').select('*').eq('shift_date', viewDate);
            setShifts(data || []);
        } catch (err) {
            setNotify("Lỗi lưu ca: " + err.message, "error");
        }
    };

    const handleDeleteShift = async (id) => {
        if(!window.confirm("Xóa ca này?")) return;
        await supabase.from('work_shifts').delete().eq('id', id);
        setShifts(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
                <span className="font-bold text-slate-700">Chọn ngày sắp ca:</span>
                <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} className="border rounded-lg px-3 py-2 font-bold text-blue-600"/>
                {loading && <Loader2 className="animate-spin text-blue-600"/>}
            </div>

            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b">
                        <tr>
                            <th className="p-4 w-1/3">Nhân viên</th>
                            <th className="p-4 w-1/3">Khu vực làm việc</th>
                            <th className="p-4 w-1/3">Giờ bắt đầu</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {users.filter(u => u.role !== 'admin').map(u => {
                            const userShift = shifts.find(s => s.user_id === u.id);
                            return (
                                <tr key={u.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-bold text-slate-700">
                                        {u.name}
                                        <div className="text-xs text-slate-400 font-normal">@{u.username}</div>
                                    </td>
                                    <td className="p-4">
                                        <select
                                            className={`w-full border rounded p-2 font-medium ${userShift ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50'}`}
                                            value={userShift?.area_code || ''}
                                            onChange={(e) => handleAssignShift(u.id, e.target.value, userShift?.start_time || '08:00')}
                                        >
                                            <option value="">-- Nghỉ --</option>
                                            {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-4 flex items-center gap-2">
                                        <input
                                            type="time"
                                            className="border rounded p-2 font-bold text-slate-700"
                                            value={userShift?.start_time || '08:00'}
                                            onChange={(e) => handleAssignShift(u.id, userShift?.area_code, e.target.value)}
                                        />
                                        {userShift && (
                                            <button onClick={() => handleDeleteShift(userShift.id)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                                                <X size={16}/>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
// --- ADMIN DASHBOARD ---
const AdminDashboard = ({ users, roles, allTasks, initialReports, onRefresh, setNotify }) => {
  const [tab, setTab] = useState('timesheet');
  return (
    <div>
      <div className="flex gap-4 mb-6 border-b border-slate-200 pb-1 overflow-x-auto">
        {[
           {id: 'timesheet', icon: CalendarClock, label: 'Giám Sát'},
           {id: 'statistics', icon: BarChart3, label: 'Thống Kê & Lương'},
           {id: 'reports', icon: LayoutDashboard, label: 'Tiến Độ (Ảnh)'},
           {id: 'users', icon: Users, label: 'Nhân Sự'},
           {id: 'tasks', icon: ListTodo, label: 'Cấu Hình Việc'},
           {id: 'shifts', icon: Calendar, label: 'Sắp Ca'}, // <--- THÊM DÒNG NÀY
           {id: 'roles', icon: Briefcase, label: 'Khu Vực'}
        ].map(t => (
           <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-3 font-bold text-sm whitespace-nowrap transition-all border-b-2 ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><t.icon size={18}/> {t.label}</button>
        ))}
        <button onClick={onRefresh} className="ml-auto p-2 text-slate-400 hover:text-blue-600"><RefreshCcw size={18}/></button>
      </div>
      {tab === 'timesheet' && <AdminTimesheet users={users} />}
      {tab === 'statistics' && <AdminStatistics users={users} />}
      {tab === 'reports' && <AdminReports allTasks={allTasks} roles={roles} users={users} />}
      {tab === 'users' && <AdminUserManager users={users} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />}
      {tab === 'tasks' && <AdminTaskManager allTasks={allTasks} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />}
      {tab === 'shifts' && <AdminShiftScheduling users={users} roles={roles} setNotify={setNotify} />}
      {tab === 'roles' && <AdminRoleManager roles={roles} allTasks={allTasks} onRefresh={onRefresh} setNotify={setNotify} />}
    </div>
  );
};

// ==========================================
// COMPONENT: THỐNG KÊ & TÍNH LƯƠNG (ĐÃ SỬA LỌC & ĐA VAI TRÒ)
// ==========================================
// --- COMPONENT THỐNG KÊ LƯƠNG (GIAO DIỆN GIỐNG SAO1) ---
const AdminStatistics = ({ users }) => {
  const [statsData, setStatsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [salaryConfig, setSalaryConfig] = useState({
    baseShift: 200000, // Lương cơ bản 1 ca
    perTask: 5000      // Thưởng task (tạm tính)
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      // 1. Xác định ngày đầu và cuối tháng
      const [year, month] = selectedMonth.split('-');
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

      // 2. Lấy dữ liệu từ time_logs (Thay vì work_shifts bị lỗi)
      const { data: timeLogs, error } = await supabase
        .from('time_logs')
        .select('user_id, report_date, action_type')
        .gte('report_date', startDate)
        .lte('report_date', endDate);

      if (error) throw error;

      // 3. Tính số ngày làm việc (Unique theo ngày)
      const workDaysMap = {};
      if (timeLogs) {
        timeLogs.forEach(log => {
          if (log.action_type === 'check_in') {
             const key = `${log.user_id}_${log.report_date}`;
             // Đánh dấu user này đã đi làm ngày này
             if (!workDaysMap[log.user_id]) workDaysMap[log.user_id] = new Set();
             workDaysMap[log.user_id].add(log.report_date);
          }
        });
      }

      // 4. Tổng hợp dữ liệu ra bảng
      const aggregated = users
        .filter(u => u.role !== 'admin') // Ẩn admin
        .map(u => {
          const days = workDaysMap[u.id] ? workDaysMap[u.id].size : 0;
          const tasks = 0; // Tạm thời chưa tính task riêng
          const total = (days * salaryConfig.baseShift) + (tasks * salaryConfig.perTask);

          return {
            id: u.id,
            name: u.name,
            role: u.role,
            workDays: days,
            completedTasks: tasks,
            totalSalary: total
          };
        });

      // Sắp xếp theo lương giảm dần
      aggregated.sort((a, b) => b.totalSalary - a.totalSalary);
      setStatsData(aggregated);

    } catch (err) {
      console.error("Lỗi thống kê:", err);
    } finally {
      setLoading(false);
    }
  };

  // Tự động tải khi đổi tháng
  useEffect(() => {
    fetchStats();
  }, [selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Header chọn tháng */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
             <BarChart3 className="text-blue-600" /> Bảng Lương Chi Tiết
           </h2>
           <p className="text-slate-500 text-sm mt-1">Thống kê ngày công và thu nhập nhân viên</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
           <Calendar className="text-slate-400" size={20}/>
           <input
             type="month"
             value={selectedMonth}
             onChange={(e) => setSelectedMonth(e.target.value)}
             className="bg-transparent font-bold text-slate-700 outline-none"
           />
           <div className="h-6 w-px bg-slate-300 mx-2"></div>
           <button onClick={fetchStats} className="p-2 hover:bg-white hover:shadow rounded-lg transition-all text-blue-600">
             {loading ? <Loader2 className="animate-spin" size={20}/> : <RefreshCcw size={20}/>}
           </button>
        </div>
      </div>

      {/* Bảng lương */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="p-4 border-b">Nhân viên</th>
                <th className="p-4 border-b">Chức vụ</th>
                <th className="p-4 border-b text-center">Số công</th>
                <th className="p-4 border-b text-center">Thưởng Task</th>
                <th className="p-4 border-b text-right">Tổng Lương</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {statsData.map(stat => (
                <tr key={stat.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-bold text-slate-700">{stat.name}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-xs font-bold uppercase border border-slate-200">
                      {stat.role}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-bold text-sm">
                      {stat.workDays}
                    </span>
                  </td>
                  <td className="p-4 text-center font-mono text-slate-600">
                     {stat.completedTasks}
                  </td>
                  <td className="p-4 text-right">
                    <div className="font-bold text-emerald-600 text-lg">
                      {stat.totalSalary.toLocaleString('vi-VN')} đ
                    </div>
                    <div className="text-xs text-slate-400">Tạm tính</div>
                  </td>
                </tr>
              ))}
              {statsData.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 italic">
                    Chưa có dữ liệu chấm công cho tháng này
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
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
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchLogs();
  }, [viewDate]);

  return (
    <div className="space-y-4">
       <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <span className="text-slate-500 font-bold text-sm">Xem ngày:</span>
          <input type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm font-bold"/>
          {loading && <span className="text-blue-600 text-xs font-bold animate-pulse">Đang tải...</span>}
       </div>
       <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
         <table className="w-full text-sm text-left">
           <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b">
             <tr>
               <th className="p-4">Thời gian</th>
               <th className="p-4">Nhân viên</th>
               <th className="p-4">Hành động</th>
               <th className="p-4">Ảnh Check-in</th>
               <th className="p-4">Vị trí (Map)</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-50">
             {logs.map(log => (
               <tr key={log.id} className="hover:bg-slate-50">
                 <td className="p-4 font-mono text-slate-600">{new Date(log.log_time).toLocaleTimeString('vi-VN')}</td>
                 <td className="p-4 font-bold">{log.app_users?.name}</td>
                 <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${log.action_type==='check_in'?'bg-blue-100 text-blue-600':'bg-rose-100 text-rose-600'}`}>
                       {log.action_type==='check_in' ? 'VÀO CA' : 'TAN CA'}
                    </span>
                 </td>
                 <td className="p-4">
                    {log.image_url ? (
                        <a href={log.image_url} target="_blank" rel="noreferrer" className="block w-12 h-12 rounded overflow-hidden border border-slate-200 hover:scale-150 transition-transform">
                             <img src={log.image_url} alt="checkin" className="w-full h-full object-cover" />
                        </a>
                    ) : '-'}
                 </td>
                 <td className="p-4">
                    {log.lat ? (
                       <a href={`http://maps.google.com/?q=${log.lat},${log.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 font-bold hover:underline">
                          <MapPin size={14}/> Xem Map
                       </a>
                    ) : <span className="text-slate-400 text-xs">Không có GPS</span>}
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
};

// --- UPDATE: ADMIN REPORTS WITH USER FILTER ---
const AdminReports = ({ allTasks, roles, users }) => {
   const [viewDate, setViewDate] = useState(getTodayISO());
   const [reportData, setReportData] = useState({});
   const [loading, setLoading] = useState(false);
   const [previewImage, setPreviewImage] = useState(null);
   const [filterUserId, setFilterUserId] = useState(''); // NEW FILTER STATE

   useEffect(() => {
     const fetchData = async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from('checklist_logs').select('role, data').eq('report_date', viewDate);
            const newMap = {};
            if(data) data.forEach(item => newMap[item.role] = item.data);
            setReportData(newMap);
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
     };
     fetchData();
   }, [viewDate]);

   const sortedTasks = sortTasksByTime([...allTasks]);

   // Logic lọc Roles hiển thị
   let displayedRoleKeys = roles.length > 0 ? roles.map(r => r.code) : [...new Set(sortedTasks.map(t => t.role))];

   // Nếu có chọn nhân viên, chỉ hiển thị Role mà nhân viên đó đảm nhận
   if (filterUserId && users) {
       const selectedUser = users.find(u => u.id === parseInt(filterUserId) || u.id === filterUserId);
       if (selectedUser) {
           const userRoles = selectedUser.role.split(',').map(r => r.trim());
           displayedRoleKeys = displayedRoleKeys.filter(key => userRoles.includes(key));
       }
   }

   return (
      <div className="space-y-6 relative">
          {previewImage && (
              <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
                  <img src={previewImage} alt="Preview" className="max-w-full max-h-full rounded shadow-xl" />
                  <button className="absolute top-4 right-4 text-white p-2"><X size={32}/></button>
              </div>
          )}

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold text-sm">Xem ngày:</span>
                <input type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm font-bold"/>
              </div>

              {/* USER FILTER DROPDOWN */}
              {users && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-slate-500 font-bold text-sm whitespace-nowrap"><Filter size={14} className="inline mr-1"/>Lọc nhân viên:</span>
                      <select
                        className="border rounded-lg px-3 py-1.5 text-sm font-bold w-full sm:w-48"
                        value={filterUserId}
                        onChange={(e) => setFilterUserId(e.target.value)}
                      >
                          <option value="">-- Tất cả --</option>
                          {users.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                      </select>
                  </div>
              )}

              {loading && <span className="text-blue-600 text-xs font-bold animate-pulse ml-auto">Đang tải dữ liệu...</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayedRoleKeys.map(roleKey => {
               const roleObj = roles.find(r => r.code === roleKey);
               const roleName = roleObj ? roleObj.name : roleKey;
               const roleTasks = sortedTasks.filter(t => t.role === roleKey);

               if (roleTasks.length === 0) return null;

               const roleReport = reportData[roleKey] || {};
               const sentCount = Object.values(roleReport).filter(i => i.sent).length;
               const percent = roleTasks.length > 0 ? Math.round((sentCount/roleTasks.length)*100) : 0;

               return (
                  <div key={roleKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700">{roleName}</h3>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${percent===100?'bg-emerald-100 text-emerald-600':'bg-blue-100 text-blue-600'}`}>{percent}%</span>
                     </div>
                     <div className="divide-y divide-slate-50">
                        {roleTasks.map(t => {
                           const item = roleReport[t.id] || {};
                           return (
                              <div key={t.id} className="p-3 flex items-center justify-between text-sm hover:bg-slate-50">
                                 <div className="flex-1">
                                     <span className={item.sent ? 'text-slate-500 font-medium' : 'text-slate-400'}>{t.title}</span>
                                     <div className="flex gap-2 text-xs mt-1">
                                         {item.time && <span className="text-blue-500">{item.time}</span>}
                                         {item.val && <span className="bg-slate-100 px-1 rounded">Số: {item.val}</span>}
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-3">
                                     {/* IMAGE PREVIEW BOX */}
                                     {item.imageUrl && (
                                         <div
                                            onClick={() => setPreviewImage(item.imageUrl)}
                                            className="w-10 h-10 bg-slate-100 rounded border border-slate-200 overflow-hidden cursor-pointer hover:ring-2 ring-blue-500 transition-all"
                                         >
                                             <img src={item.imageUrl} alt="img" className="w-full h-full object-cover" />
                                         </div>
                                     )}

                                     {item.sent ? <CheckCircle2 size={18} className="text-emerald-500"/> : <span className="w-4 h-4 rounded-full border border-slate-300"></span>}
                                 </div>
                              </div>
                           )
                        })}
                     </div>
                  </div>
               )
            })}
             {displayedRoleKeys.length === 0 && (
                <div className="col-span-full text-center py-10 text-slate-400 italic">
                    Không có công việc nào hoặc nhân viên này chưa được phân công.
                </div>
            )}
          </div>
      </div>
   )
};
const AdminUserList = ({ users, roles, onRefresh, setNotify }) => {
  const [editingUser, setEditingUser] = useState(null);
  const [filterRole, setFilterRole] = useState(''); // State cho bộ lọc khu vực
  const [showPass, setShowPass] = useState(false);

  // State form
  const [formData, setFormData] = useState({
      name: '',
      username: '',
      password: '',
      role: ''
  });

  // Khi bấm sửa user, tự động điền dữ liệu vào form
  useEffect(() => {
    if (editingUser) {
      setFormData({
        name: editingUser.name,
        username: editingUser.username,
        password: editingUser.password,
        role: editingUser.role
      });
    } else {
      // Mặc định chọn role đầu tiên nếu thêm mới
      setFormData({
          name: '',
          username: '',
          password: '',
          role: roles.length > 0 ? roles[0].code : ''
      });
    }
  }, [editingUser, roles]);

  // Xử lý Lưu (Thêm mới hoặc Cập nhật)
  const handleSave = async () => {
    if (!formData.username || !formData.password || !formData.name) {
        return setNotify("Vui lòng nhập đủ thông tin", "error");
    }

    try {
        if (editingUser) {
            // Update
            const { error } = await supabase.from('app_users').update(formData).eq('id', editingUser.id);
            if (error) throw error;
            setNotify("Đã cập nhật nhân viên");
        } else {
            // Insert
            const { error } = await supabase.from('app_users').insert(formData);
            if (error) throw error;
            setNotify("Đã thêm nhân viên mới");
        }

        setEditingUser(null);
        onRefresh();
    } catch (err) {
        setNotify("Lỗi: " + err.message, "error");
    }
  };

  // Xử lý Xóa
  const handleDelete = async (id) => {
    if (window.confirm("Bạn có chắc muốn xóa nhân viên này? Dữ liệu lịch sử làm việc cũng sẽ bị xóa.")) {
        try {
            const { error } = await supabase.from('app_users').delete().eq('id', id);
            if (error) throw error;
            setNotify("Đã xóa nhân viên");
            onRefresh();
        } catch (err) {
            setNotify("Lỗi xóa: " + err.message, "error");
        }
    }
  };

  // Logic lọc danh sách hiển thị
  const filteredUsers = filterRole
    ? users.filter(u => u.role.includes(filterRole))
    : users;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* CỘT TRÁI: FORM NHẬP LIỆU */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 h-fit sticky top-4 shadow-sm">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-slate-800">
                {editingUser ? 'Sửa Thông Tin' : 'Thêm Nhân Sự'}
            </h3>
            {editingUser && (
                <button onClick={() => setEditingUser(null)} className="text-xs text-red-500 font-bold hover:underline">
                    Hủy sửa
                </button>
            )}
        </div>

        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Họ và tên</label>
                <input
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Khu vực / Chức vụ</label>
                <select
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                >
                    <option value="admin">Admin (Quản trị viên)</option>
                    {roles.map(r => (
                        <option key={r.code} value={r.code}>{r.name}</option>
                    ))}
                    {/* Thêm option Manager nếu cần quản lý vùng */}
                    {roles.map(r => (
                        <option key={`manager_${r.code}`} value={`manager,${r.code}`}>Quản lý - {r.name}</option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 italic">
                    * Chọn khu vực để phân quyền cho nhân viên đó.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên đăng nhập</label>
                    <input
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu</label>
                    <input
                        type="text"
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                </div>
            </div>

            <div className="pt-2">
                <button
                    onClick={handleSave}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                    <Save size={18} />
                    {editingUser ? 'Cập Nhật Nhân Sự' : 'Thêm Nhân Sự Mới'}
                </button>
            </div>
        </div>
      </div>

      {/* CỘT PHẢI: DANH SÁCH NHÂN SỰ */}
      <div className="lg:col-span-2 space-y-4">
        {/* THANH CÔNG CỤ & BỘ LỌC */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
                <Filter size={18} className="text-slate-500"/>
                <span className="text-sm font-bold text-slate-600 hidden sm:inline">Lọc theo khu vực:</span>
                <select
                    className="border-none bg-transparent font-bold text-blue-600 focus:ring-0 cursor-pointer text-sm outline-none"
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                >
                    <option value="">-- Tất cả nhân viên --</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                    {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                </select>
            </div>

            <button
                onClick={() => setShowPass(!showPass)}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors"
            >
                {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                {showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            </button>
        </div>

        {/* BẢNG DANH SÁCH */}
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-100">
                    <tr>
                        <th className="p-4">Nhân viên</th>
                        <th className="p-4">Khu vực / Vai trò</th>
                        <th className="p-4 hidden sm:table-cell">Tài khoản</th>
                        <th className="p-4 text-right">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredUsers.length === 0 ? (
                        <tr><td colSpan="4" className="p-6 text-center text-slate-400">Không tìm thấy nhân viên nào.</td></tr>
                    ) : (
                        filteredUsers.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-4">
                                    <div className="font-bold text-slate-700 text-base">{u.name}</div>
                                    <div className="text-xs text-slate-400 font-mono sm:hidden mt-1">@{u.username}</div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-wrap gap-1">
                                        {u.role.split(',').map(r => {
                                            const roleName = roles.find(item => item.code === r.trim())?.name || r;
                                            const isAdmin = r.includes('admin');
                                            const isManager = r.includes('manager');

                                            return (
                                                <span key={r} className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                                                    isAdmin
                                                        ? 'bg-purple-50 text-purple-600 border-purple-100'
                                                        : (isManager
                                                            ? 'bg-orange-50 text-orange-600 border-orange-100'
                                                            : 'bg-blue-50 text-blue-600 border-blue-100')
                                                }`}>
                                                    {isAdmin ? 'Quản Trị Viên' : roleName}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </td>
                                <td className="p-4 hidden sm:table-cell">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-slate-600 font-bold">@{u.username}</span>
                                        <span className="text-xs text-slate-400 font-mono mt-0.5">
                                            {showPass ? u.password : '••••••'}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setEditingUser(u)}
                                            className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                            title="Sửa thông tin"
                                        >
                                            <Edit3 size={16}/>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                            title="Xóa nhân viên"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
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
  );
};
const AdminTaskManager = ({ allTasks, roles, onRefresh, setNotify }) => {
  // State quản lý form thêm/sửa
  const [editing, setEditing] = useState({
      id: null,
      role: '',
      title: '',
      time_label: '',
      late_buffer: 15,
      require_input: false,
      require_image: false,
      repeat_type: 'daily', // daily, weekly, monthly
      repeat_on: ''         // lưu thứ (0-6) hoặc ngày (1-31)
  });

  // State bộ lọc khu vực bên phải (để dễ quản lý khi có nhiều khu vực)
  const [filterRole, setFilterRole] = useState('');

  // Tự động chọn khu vực đầu tiên khi mở form nếu chưa chọn
  useEffect(() => {
    if(roles.length > 0 && !editing.role && !editing.id) {
        setEditing(prev => ({...prev, role: roles[0].code}));
    }
  }, [roles]);

  // Xử lý lưu công việc
  const handleSave = async () => {
    if(!editing.title) return setNotify("Chưa nhập tên việc", "error");

    // Chuẩn bị dữ liệu gửi đi
    const payload = {
        role: editing.role,
        title: editing.title,
        time_label: editing.time_label,
        late_buffer: editing.late_buffer,
        require_input: editing.require_input,
        require_image: editing.require_image,
        repeat_type: editing.repeat_type,
        // Nếu là daily thì repeat_on là null, ngược lại thì lấy giá trị số
        repeat_on: editing.repeat_type === 'daily' ? null : parseInt(editing.repeat_on || 0)
    };

    try {
        if (editing.id) {
            // Cập nhật
            const { error } = await supabase.from('task_definitions').update(payload).eq('id', editing.id);
            if (error) throw error;
            setNotify("Đã cập nhật công việc");
        } else {
            // Thêm mới
            const { error } = await supabase.from('task_definitions').insert(payload);
            if (error) throw error;
            setNotify("Đã thêm công việc mới");
        }

        onRefresh(); // Tải lại danh sách
        // Reset form về mặc định (giữ lại khu vực đang chọn để nhập tiếp cho nhanh)
        setEditing({
            ...editing,
            id: null,
            title: '',
            time_label: '',
            repeat_type: 'daily',
            repeat_on: ''
        });
    } catch (err) {
        setNotify("Lỗi lưu dữ liệu: " + err.message, "error");
    }
  };

  // Xử lý xóa công việc
  const handleDelete = async (id) => {
    if(window.confirm("Bạn chắc chắn muốn xóa công việc này?")) {
        const { error } = await supabase.from('task_definitions').delete().eq('id', id);
        if (error) setNotify("Lỗi xóa: " + error.message, "error");
        else {
            setNotify("Đã xóa công việc");
            onRefresh();
        }
    }
  };

  // Hàm hỗ trợ hiển thị tên ngày/thứ
  const getRepeatLabel = (type, val) => {
      if (type === 'daily') return '';
      if (type === 'weekly') {
          const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
          return <span className="text-purple-600 font-bold text-xs ml-2 bg-purple-50 px-2 py-0.5 rounded">Lặp: {days[val]}</span>;
      }
      if (type === 'monthly') {
          return <span className="text-orange-600 font-bold text-xs ml-2 bg-orange-50 px-2 py-0.5 rounded">Ngày {val} hàng tháng</span>;
      }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* CỘT TRÁI: FORM THÊM/SỬA */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 h-fit sticky top-4 shadow-sm">
        <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-lg text-slate-800">{editing.id ? 'Sửa Công Việc' : 'Thêm Việc Mới'}</h3>
             {editing.id && <button onClick={() => setEditing({ ...editing, id: null, title: '' })} className="text-xs text-red-500 font-bold hover:underline">Hủy sửa</button>}
        </div>

        <div className="space-y-4">
            {/* Chọn Khu Vực */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Khu vực / Bộ phận</label>
                <select
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editing.role}
                    onChange={e => setEditing({...editing, role: e.target.value})}
                >
                    {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                </select>
            </div>

            {/* Tên việc & Giờ */}
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên công việc</label>
                    <input
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ví dụ: Kiểm tra tủ lạnh..."
                        value={editing.title}
                        onChange={e => setEditing({...editing, title: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Giờ Deadline</label>
                    <input
                        type="time"
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none"
                        value={editing.time_label}
                        onChange={e => setEditing({...editing, time_label: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trễ cho phép (phút)</label>
                    <input
                        type="number"
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none"
                        value={editing.late_buffer}
                        onChange={e => setEditing({...editing, late_buffer: e.target.value})}
                    />
                </div>
            </div>

            {/* CẤU HÌNH LẶP LẠI (MỚI) */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tần suất lặp lại</label>
                <div className="flex gap-2">
                    <select
                        className="flex-1 border rounded p-2 text-sm outline-none"
                        value={editing.repeat_type}
                        onChange={e => setEditing({...editing, repeat_type: e.target.value})}
                    >
                        <option value="daily">Hàng ngày</option>
                        <option value="weekly">Hàng tuần</option>
                        <option value="monthly">Hàng tháng</option>
                    </select>

                    {/* Chọn Thứ (Nếu là Weekly) */}
                    {editing.repeat_type === 'weekly' && (
                        <select
                            className="flex-1 border rounded p-2 text-sm outline-none font-bold text-purple-600"
                            value={editing.repeat_on || 1}
                            onChange={e => setEditing({...editing, repeat_on: e.target.value})}
                        >
                            <option value="1">Thứ 2</option>
                            <option value="2">Thứ 3</option>
                            <option value="3">Thứ 4</option>
                            <option value="4">Thứ 5</option>
                            <option value="5">Thứ 6</option>
                            <option value="6">Thứ 7</option>
                            <option value="0">Chủ nhật</option>
                        </select>
                    )}

                    {/* Chọn Ngày (Nếu là Monthly) */}
                    {editing.repeat_type === 'monthly' && (
                         <div className="flex items-center gap-1 w-24">
                            <span className="text-sm font-bold text-slate-500">Ngày</span>
                            <input
                                type="number" min="1" max="31"
                                className="w-full border rounded p-2 text-sm font-bold text-orange-600 outline-none"
                                value={editing.repeat_on || 1}
                                onChange={e => setEditing({...editing, repeat_on: e.target.value})}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Tùy chọn yêu cầu */}
            <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4" checked={editing.require_input} onChange={e => setEditing({...editing, require_input: e.target.checked})}/>
                    <span className="text-sm font-medium text-slate-700">Yêu cầu nhập số</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4" checked={editing.require_image} onChange={e => setEditing({...editing, require_image: e.target.checked})}/>
                    <span className="text-sm font-medium text-slate-700">Yêu cầu chụp ảnh</span>
                </label>
            </div>

            {/* Nút Action */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                 {editing.id && (
                     <button onClick={() => setEditing({ ...editing, id: null, title: '' })} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                        Hủy Bỏ
                     </button>
                 )}
                 <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors">
                    {editing.id ? 'Cập Nhật' : 'Thêm Mới'}
                 </button>
            </div>
        </div>
      </div>

      {/* CỘT PHẢI: DANH SÁCH CÔNG VIỆC */}
      <div className="lg:col-span-2 space-y-4">
         {/* Filter Khu Vực */}
         <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
            <Filter size={18} className="text-slate-500"/>
            <span className="text-sm font-bold text-slate-600">Lọc theo khu vực:</span>
            <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
                className="border-none bg-transparent font-bold text-blue-600 focus:ring-0 cursor-pointer text-sm outline-none"
            >
                <option value="">-- Hiển thị tất cả --</option>
                {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
         </div>

         {/* Danh sách */}
         <div className="space-y-6">
            {roles
                .filter(role => !filterRole || role.code === filterRole) // Logic lọc khu vực
                .map(role => {
                    // Lấy task của role này
                    const tasks = allTasks.filter(t => t.role === role.code);
                    if(tasks.length === 0 && filterRole) return <div key={role.id} className="text-center text-slate-400 py-4">Chưa có công việc nào.</div>;
                    if(tasks.length === 0) return null;

                    return (
                        <div key={role.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 px-4 py-3 font-bold text-slate-700 flex justify-between items-center border-b border-slate-100">
                                <span className="flex items-center gap-2"><Briefcase size={16} className="text-slate-400"/> {role.name}</span>
                                <span className="text-xs font-normal bg-white px-2 py-1 rounded border text-slate-500">{tasks.length} đầu việc</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {tasks.map(t => (
                                    <div key={t.id} className="p-4 flex justify-between items-center hover:bg-slate-50 group transition-colors">
                                        <div className="flex-1 pr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-slate-800 text-sm">{t.title}</span>
                                                {getRepeatLabel(t.repeat_type, t.repeat_on)}
                                            </div>
                                            <div className="flex gap-2 text-xs text-slate-500">
                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock size={10}/> {t.time_label}</span>
                                                {t.require_image && <span className="text-indigo-500 flex items-center gap-1"><ImageIcon size={10}/> Ảnh</span>}
                                                {t.require_input && <span className="text-emerald-500 flex items-center gap-1"><ListTodo size={10}/> Số liệu</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditing(t)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Sửa">
                                                <Edit3 size={18}/>
                                            </button>
                                            <button onClick={() => handleDelete(t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
            })}
         </div>
      </div>
    </div>
  );
};

const AdminRoleManager = ({ roles, onRefresh, setNotify }) => {
   const [newRole, setNewRole] = useState({ code: '', name: '' });
   const handleAdd = async () => {
      if(!newRole.code || !newRole.name) return setNotify("Nhập đủ mã và tên", "error");
      const { error } = await supabase.from('job_roles').insert(newRole);
      if(error) setNotify("Lỗi: " + error.message, "error");
      else { setNotify("Đã thêm khu vực"); onRefresh(); setNewRole({ code: '', name: '' }); }
   };
   return (
      <div className="bg-white p-4 rounded-xl border border-slate-200">
         <h3 className="font-bold text-slate-700 mb-4">Thêm Khu Vực Mới</h3>
         <div className="flex gap-3 mb-6">
            <input className="border rounded p-2 flex-1" placeholder="Mã (vd: bep_chinh)" value={newRole.code} onChange={e => setNewRole({...newRole, code: e.target.value})}/>
            <input className="border rounded p-2 flex-1" placeholder="Tên hiển thị (vd: Bếp Chính)" value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})}/>
            <button onClick={handleAdd} className="bg-emerald-600 text-white px-4 rounded font-bold">Thêm</button>
         </div>
         <div className="space-y-2">
            {roles.map(r => (
               <div key={r.code} className="flex justify-between p-3 bg-slate-50 rounded border">{r.name} <span className="text-slate-400 text-sm font-mono">{r.code}</span></div>
            ))}
         </div>
      </div>
   )
};

// --- ADMIN USER MANAGER (FULL ACCESS) ---
const AdminUserManager = ({ users, roles, onRefresh, setNotify }) => {
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', name: '', role: [] });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
     if(editingUser) {
        // Chuyển role string "a,b" thành array ["a","b"]
        const roleArray = editingUser.role.split(',').map(r => r.trim());
        setFormData({
            username: editingUser.username,
            password: editingUser.password,
            name: editingUser.name,
            role: roleArray
        });
     } else {
        setFormData({ username: '', password: '', name: '', role: [] });
     }
  }, [editingUser]);

  const handleRoleChange = (roleCode) => {
      setFormData(prev => {
          if (prev.role.includes(roleCode)) {
              return { ...prev, role: prev.role.filter(r => r !== roleCode) };
          } else {
              return { ...prev, role: [...prev.role, roleCode] };
          }
      });
  };

  const handleSubmit = async () => {
    if(!formData.username || !formData.password || !formData.name) return setNotify("Thiếu thông tin!", "error");
    if(formData.role.length === 0) return setNotify("Chọn ít nhất 1 role", "error");

    const roleString = formData.role.join(',');

    if (editingUser) {
        const { error } = await supabase.from('app_users').update({
            password: formData.password,
            name: formData.name,
            role: roleString
        }).eq('id', editingUser.id);
        if(error) setNotify("Lỗi cập nhật: " + error.message, "error");
        else { setNotify("Đã cập nhật nhân viên"); setEditingUser(null); onRefresh(); }
    } else {
        const { error } = await supabase.from('app_users').insert({...formData, role: roleString});
        if(error) setNotify("Lỗi thêm: " + error.message, "error");
        else { setNotify("Đã thêm nhân viên"); onRefresh(); }
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm("Xóa nhân viên này?")) {
        await supabase.from('app_users').delete().eq('id', id);
        onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-xl border border-slate-200 transition-colors ${editingUser ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
         <h3 className="font-bold text-slate-700 mb-4">{editingUser ? 'Sửa Thông Tin Nhân Viên' : 'Thêm Nhân Viên Mới'}</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                 <input className="w-full border rounded p-2 text-sm mb-3" placeholder="Tên đăng nhập" disabled={!!editingUser} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})}/>
                 <input className="w-full border rounded p-2 text-sm mb-3" placeholder="Mật khẩu" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}/>
                 <input className="w-full border rounded p-2 text-sm" placeholder="Họ và Tên" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/>
             </div>

             <div className="border rounded p-3 bg-white h-40 overflow-y-auto">
                 <label className="text-xs font-bold text-slate-500 mb-2 block">Chọn Khu Vực / Chức Vụ (Đa chọn):</label>
                 <div className="space-y-2">
                     <label className="flex items-center gap-2 text-sm font-bold text-purple-600">
                         <input type="checkbox" checked={formData.role.includes('admin')} onChange={() => handleRoleChange('admin')}/> Admin
                     </label>
                     <label className="flex items-center gap-2 text-sm font-bold text-orange-600">
                         <input type="checkbox" checked={formData.role.includes('manager')} onChange={() => handleRoleChange('manager')}/> Manager
                     </label>
                     <div className="border-t my-1"></div>
                     {roles.map(r => (
                         <label key={r.code} className="flex items-center gap-2 text-sm">
                             <input type="checkbox" checked={formData.role.includes(r.code)} onChange={() => handleRoleChange(r.code)}/> {r.name}
                         </label>
                     ))}
                 </div>
             </div>
         </div>
         <div className="flex gap-3 mt-4 justify-end">
             {editingUser && <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded">Hủy</button>}
             <button onClick={handleSubmit} className={`px-6 py-2 text-white font-bold rounded shadow-lg ${editingUser ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                 {editingUser ? 'Lưu Thay Đổi' : 'Thêm Mới'}
             </button>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
         <div className="p-2 border-b flex justify-end">
             <button onClick={() => setShowPass(!showPass)} className="text-xs flex items-center gap-1 text-slate-500 hover:text-blue-600 font-bold px-3 py-1 rounded hover:bg-slate-100">
                {showPass ? <EyeOff size={14}/> : <Eye size={14}/>} {showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
             </button>
         </div>
         <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b">
               <tr>
                  <th className="p-4">Nhân viên</th>
                  <th className="p-4">Khu vực (Role)</th>
                  <th className="p-4">Username</th>
                  <th className="p-4 text-blue-600">Mật khẩu</th>
                  <th className="p-4 text-right">Thao tác</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
               {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                     <td className="p-4 font-bold text-slate-700">{u.name}</td>
                     <td className="p-4">
                         <div className="flex flex-wrap gap-1">
                             {u.role.split(',').map(r => (
                                <span key={r} className={`px-2 py-1 rounded text-xs font-bold uppercase ${r.includes('admin') ? 'bg-purple-100 text-purple-600' : (r.includes('manager') ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500')}`}>
                                    {r}
                                </span>
                             ))}
                         </div>
                     </td>
                     <td className="p-4 font-mono text-slate-500">{u.username}</td>
                     <td className="p-4 font-mono text-slate-600">{showPass ? u.password : '••••••'}</td>
                     <td className="p-4 text-right flex justify-end gap-2">
                        <button onClick={() => setEditingUser(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit3 size={18}/></button>
                        <button onClick={() => handleDelete(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={18}/></button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};