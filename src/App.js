import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
import {
  User, Lock, LogOut, RefreshCcw, Camera, Trash2, Plus,
  CheckCircle2, Clock, Send, Loader2,
  LayoutDashboard, Menu, X, ShieldCheck,
  Users, ListTodo, Image as ImageIcon, MapPin, Briefcase,
  CalendarClock, AlertTriangle, AlertCircle,
  Edit3, Copy, Key, Save, XCircle, BarChart3, TrendingUp, DollarSign, Calendar, Filter, ChevronRight,
  Eye, EyeOff, UserCog, Layers, CheckSquare, Settings // <--- Thêm vào đây
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
// ... (Giữ nguyên phần Imports và Utils ở trên)

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

  // --- STATE MỚI: CHẾ ĐỘ QUẢN LÝ ---
  // false: Xem checklist chấm công (mặc định)
  // true: Xem dashboard quản lý
  const [isManagerMode, setManagerMode] = useState(false);

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

      // Reset chế độ manager mỗi khi đăng nhập lại
      setManagerMode(false);

      if (data.role === 'admin') {
         fetchAllDataAdmin();
      } else if (data.role.includes('manager')) {
         // Manager vẫn load đủ data để khi chuyển mode không cần load lại
         fetchAllDataManager();
      } else {
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
    const roles = roleString.split(',').map(r => r.trim());
    const { data } = await supabase.from('task_definitions').select('*').in('role', roles).order('time_label', { ascending: true });
    if(data) setTasksConfig(data);
  };

  const fetchTodayReport = async (roleString) => {
    const today = getTodayISO();
    const roles = roleString.split(',').map(r => r.trim());
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
          {/* --- SIDEBAR HEADER --- */}
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

            <div className="flex items-center gap-2">
                {/* --- NÚT BÁNH RĂNG (CHỈ HIỆN CHO MANAGER) --- */}
                {user.role.includes('manager') && (
                    <button
                        onClick={() => setManagerMode(!isManagerMode)}
                        className={`p-2 rounded-lg transition-all ${isManagerMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600'}`}
                        title="Chuyển chế độ Quản lý / Chấm công"
                    >
                        <Settings size={20} />
                    </button>
                )}

                <button className="lg:hidden p-2 text-slate-500" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                  {isSidebarOpen ? <X /> : <Menu />}
                </button>
            </div>
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
            {/* --- LOGIC HIỂN THỊ DASHBOARD --- */}
            {user.role === 'admin' ? (
              // Admin: Luôn hiện AdminDashboard
              <AdminDashboard
                users={usersList}
                roles={rolesList}
                allTasks={tasksConfig}
                initialReports={checklistData}
                onRefresh={fetchAllDataAdmin}
                setNotify={(m, t) => showNotify(setNotification, m, t)}
              />
            ) : (user.role.includes('manager') && isManagerMode) ? (
              // Manager + Đang bật chế độ Manager: Hiện Dashboard Quản lý
              <ManagerDashboard
                 user={user} // <--- QUAN TRỌNG: Thêm dòng này
                 users={usersList}
                 roles={rolesList}
                 allTasks={tasksConfig}
                 initialReports={checklistData}
                 onRefresh={fetchAllDataManager}
                 setNotify={(m, t) => showNotify(setNotification, m, t)}
              />
            ) : (
              // Mặc định (Staff hoặc Manager tắt chế độ quản lý): Hiện Checklist chấm công
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
// ... (Các component con bên dưới giữ nguyên)

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
    // --- SỬA: Lọc bỏ 'manager' khỏi danh sách hiển thị Tabs ---
    const allRoles = user.role.split(',').map(r => r.trim());

    // Chỉ lấy các role không chứa chữ 'manager' để hiện tab công việc
    const workRoles = allRoles.filter(r => !r.toLowerCase().includes('manager'));

    // (Phòng hờ trường hợp user chỉ có đúng 1 quyền manager thì vẫn hiện để không lỗi,
    // còn bình thường sẽ ưu tiên workRoles)
    const displayRoles = workRoles.length > 0 ? workRoles : allRoles;

    const [activeRole, setActiveRole] = useState(displayRoles[0]);

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
        {/* Chỉ hiện Tabs nếu có nhiều hơn 1 công việc thực tế */}
        {displayRoles.length > 1 && (
            <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                {displayRoles.map(r => (
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
// --- MANAGER DASHBOARD (ĐÃ CẬP NHẬT) ---
// Thêm tab: Phân công nhân sự & Sắp ca làm việc
// --- MANAGER DASHBOARD (ĐÃ CẬP NHẬT FILTER & PERMISSION) ---
const ManagerDashboard = ({ user, users, roles, allTasks, initialReports, onRefresh, setNotify }) => {
  const [activeTab, setActiveTab] = useState('assignment');

  // --- LOGIC LỌC: Chỉ hiển thị Nhân viên & Khu vực được phân quyền ---
  // 1. Lấy danh sách ID nhân viên & Mã khu vực từ user hiện tại
  const allowedUserIds = useMemo(() =>
    user.managed_users ? user.managed_users.split(',').map(id => parseInt(id)) : []
  , [user.managed_users]);

  const allowedRoleCodes = useMemo(() =>
    user.managed_roles ? user.managed_roles.split(',') : []
  , [user.managed_roles]);

  // 2. Lọc danh sách Users & Roles
  const filteredUsers = useMemo(() => {
    if (user.role === 'admin') return users; // Admin thấy hết (phòng hờ)
    // Manager chỉ thấy nhân viên có trong danh sách được gán
    return users.filter(u => allowedUserIds.includes(u.id));
  }, [users, allowedUserIds, user.role]);

  const filteredRoles = useMemo(() => {
    if (user.role === 'admin') return roles;
    // Manager chỉ thấy các khu vực được gán
    return roles.filter(r => allowedRoleCodes.includes(r.code));
  }, [roles, allowedRoleCodes, user.role]);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex">
        <button onClick={() => setActiveTab('assignment')} className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'assignment' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
          <UserCog size={18} /> Phân Công Nhân Sự
        </button>
        <button onClick={() => setActiveTab('shift')} className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'shift' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
          <CalendarClock size={18} /> Sắp Ca Làm Việc
        </button>
      </div>

      <div className="transition-all duration-300">
        {activeTab === 'assignment' ? (
          <ManagerTaskAssignment
             users={filteredUsers}  // Chỉ truyền user được phép
             roles={filteredRoles}  // Chỉ truyền role được phép
             onRefresh={onRefresh}
             setNotify={setNotify}
          />
        ) : (
          <AdminShiftManager
             users={filteredUsers}
             roles={filteredRoles}
             setNotify={setNotify}
          />
        )}
      </div>
    </div>
  );
};

// --- NEW COMPONENT: MANAGER TASK ASSIGNMENT ---
// Chỉ phân công công việc, không sửa user/pass
// --- MANAGER TASK ASSIGNMENT (ĐÃ CẬP NHẬT: BỎ QUYỀN CHỈNH MANAGER) ---
const ManagerTaskAssignment = ({ users, roles, onRefresh, setNotify }) => {
  const [userRolesState, setUserRolesState] = useState({});
  const [loadingSave, setLoadingSave] = useState(null);

  useEffect(() => {
    const init = {};
    users.forEach(u => { init[u.id] = u.role.split(',').map(r => r.trim()); });
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
    // Manager không được để trống role, ít nhất phải có 1 role (hoặc rỗng nếu muốn tước hết quyền làm việc, tuỳ logic)
    const roleString = selectedRoles ? selectedRoles.join(',') : '';

    setLoadingSave(user.id);
    try {
      const { error } = await supabase.from('app_users').update({ role: roleString }).eq('id', user.id);
      if (error) throw error;
      setNotify(`Đã cập nhật công việc cho ${user.name}`);
      onRefresh();
    } catch (err) {
      setNotify("Lỗi cập nhật: " + err.message, "error");
    } finally {
      setLoadingSave(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b">
            <tr>
              <th className="p-4">Nhân viên</th>
              <th className="p-4">Phân công công việc (Khu vực)</th>
              <th className="p-4 w-32">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.length === 0 ? (
               <tr><td colSpan="3" className="p-8 text-center text-slate-400 italic">Bạn chưa được phân quyền quản lý nhân viên nào.</td></tr>
            ) : users.map(u => {
              const currentSelected = userRolesState[u.id] || [];
              const isUnsaved = JSON.stringify(currentSelected.sort()) !== JSON.stringify(u.role.split(',').map(r=>r.trim()).sort());

              return (
                <tr key={u.id} className="hover:bg-slate-50">
                   <td className="p-4 font-bold text-slate-700">
                     <div>{u.name}</div>
                     <div className="text-xs text-slate-400 font-normal">{u.username}</div>
                   </td>
                   <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {/* Chỉ hiện các Roles được phép quản lý */}
                        {roles.map(r => (
                          <div
                             key={r.code}
                             onClick={() => toggleRole(u.id, r.code)}
                             className={`cursor-pointer border rounded-lg px-3 py-2 flex items-center gap-2 transition-all select-none ${currentSelected.includes(r.code) ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'}`}
                          >
                             <div className={`w-4 h-4 rounded border flex items-center justify-center ${currentSelected.includes(r.code) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                {currentSelected.includes(r.code) && <CheckSquare size={12} className="text-white"/>}
                             </div>
                             <span className="font-medium text-xs">{r.name}</span>
                          </div>
                        ))}
                      </div>
                   </td>
                   <td className="p-4">
                      {isUnsaved && (
                        <button
                          onClick={() => handleSaveUser(u)}
                          disabled={loadingSave === u.id}
                          className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg font-bold text-xs shadow-lg shadow-blue-500/30 hover:bg-blue-700 flex items-center justify-center gap-2"
                        >
                          {loadingSave === u.id ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} Lưu
                        </button>
                      )}
                   </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
// ==========================================
// COMPONENT: SẮP CA LÀM VIỆC (MULTI-DAY & MULTI-ROLE)
// ==========================================
const AdminShiftScheduler = ({ users, roles }) => {
  // State form
  const [fromDate, setFromDate] = useState(getTodayISO());
  const [toDate, setToDate] = useState(getTodayISO());
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]); // Array roles
  const [note, setNote] = useState('');

  // State lọc thứ (Mặc định chọn hết cả tuần)
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState([0,1,2,3,4,5,6]); // 0=CN, 1=T2...

  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [viewDate, setViewDate] = useState(getTodayISO()); // Để xem lịch

  // Danh sách thứ
  const daysOfWeek = [
    { val: 1, label: 'T2' },
    { val: 2, label: 'T3' },
    { val: 3, label: 'T4' },
    { val: 4, label: 'T5' },
    { val: 5, label: 'T6' },
    { val: 6, label: 'T7' },
    { val: 0, label: 'CN' },
  ];

  // Load lịch làm việc để hiển thị bên dưới
  const fetchShifts = async () => {
    const { data, error } = await supabase
      .from('work_shifts')
      .select('*')
      .eq('date', viewDate);
    if (!error) setShifts(data || []);
  };

  useEffect(() => {
    fetchShifts();
  }, [viewDate]);

  // Xử lý chọn Role (Multi-select)
  const toggleRole = (roleCode) => {
    setSelectedRoles(prev =>
      prev.includes(roleCode)
        ? prev.filter(r => r !== roleCode)
        : [...prev, roleCode]
    );
  };

  // Xử lý chọn Thứ (Multi-select)
  const toggleDay = (dayVal) => {
    setSelectedDaysOfWeek(prev =>
      prev.includes(dayVal)
        ? prev.filter(d => d !== dayVal)
        : [...prev, dayVal]
    );
  };

  // HÀM LƯU CA (QUAN TRỌNG)
  const handleSaveShift = async () => {
    if (!selectedUser || selectedRoles.length === 0) {
      alert("Vui lòng chọn Nhân viên và ít nhất 1 Công việc.");
      return;
    }

    setLoading(true);
    try {
      const inserts = [];

      // 1. Tạo danh sách các ngày trong khoảng From - To
      let currentDate = new Date(fromDate);
      const end = new Date(toDate);

      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay(); // 0-6

        // 2. Chỉ tạo lịch nếu ngày đó nằm trong danh sách thứ đã chọn
        if (selectedDaysOfWeek.includes(dayOfWeek)) {
           const dateStr = currentDate.toISOString().split('T')[0];

           // 3. Với mỗi ngày, tạo record cho từng Role đã chọn
           selectedRoles.forEach(roleCode => {
             inserts.push({
               user_id: selectedUser,
               role: roleCode,
               date: dateStr,
               shift_name: 'Ca hành chính', // Mặc định hoặc bỏ
               start_time: null, // Đã bỏ nhập giờ theo yêu cầu
               end_time: null,
               note: note
             });
           });
        }
        // Tăng thêm 1 ngày
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (inserts.length === 0) {
        alert("Không có ngày nào được chọn trong khoảng thời gian này.");
        setLoading(false);
        return;
      }

      // 4. Gửi lên Supabase (Upsert để đè nếu trùng, hoặc Insert)
      // Lưu ý: Cần cấu hình UNIQUE(user_id, date, role) trong DB nếu muốn tránh trùng lặp
      const { error } = await supabase.from('work_shifts').insert(inserts);

      if (error) throw error;

      alert(`Đã xếp thành công ${inserts.length} lượt ca!`);
      // Reset form
      setNote('');
      fetchShifts(); // Refresh list

    } catch (error) {
      console.error("Lỗi lưu ca:", error);
      alert("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Hàm xóa ca
  const handleDeleteShift = async (id) => {
    if(!window.confirm("Xóa ca làm việc này?")) return;
    await supabase.from('work_shifts').delete().eq('id', id);
    fetchShifts();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* --- FORM SẮP CA --- */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
           <CalendarClock className="text-blue-600"/> Sắp Xếp Lịch Làm Việc
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CỘT TRÁI: Thời gian & Nhân sự */}
          <div className="space-y-4">
             {/* Chọn khoảng ngày */}
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Khoảng thời gian áp dụng</label>
               <div className="flex items-center gap-2">
                 <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 font-bold text-slate-700"/>
                 <span className="text-slate-400">➔</span>
                 <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 font-bold text-slate-700"/>
               </div>
             </div>

             {/* Lọc Thứ trong tuần */}
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Lặp lại vào các thứ</label>
                <div className="flex gap-2">
                   {daysOfWeek.map(day => (
                      <button
                        key={day.val}
                        onClick={() => toggleDay(day.val)}
                        className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${selectedDaysOfWeek.includes(day.val) ? 'bg-blue-600 text-white shadow-md scale-110' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                        {day.label}
                      </button>
                   ))}
                </div>
             </div>

             {/* Chọn Nhân viên */}
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nhân viên</label>
               <select
                  value={selectedUser}
                  onChange={e => setSelectedUser(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 font-bold text-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
               >
                  <option value="">-- Chọn nhân viên --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
               </select>
             </div>
          </div>

          {/* CỘT PHẢI: Công việc & Ghi chú */}
          <div className="space-y-4">
             {/* Chọn Công việc (Multi-select) */}
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Phân công vị trí (Chọn nhiều)</label>
               <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto p-2 border rounded-lg bg-slate-50">
                  {roles.map(r => (
                     <label key={r.code} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors border ${selectedRoles.includes(r.code) ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:bg-slate-100'}`}>
                        <input
                           type="checkbox"
                           checked={selectedRoles.includes(r.code)}
                           onChange={() => toggleRole(r.code)}
                           className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className={`text-sm font-semibold ${selectedRoles.includes(r.code) ? 'text-blue-700' : 'text-slate-600'}`}>{r.name}</span>
                     </label>
                  ))}
               </div>
             </div>

             {/* Ghi chú */}
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ghi chú (Tùy chọn)</label>
               <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Ví dụ: Làm ca sáng, hỗ trợ tiệc..."
                  className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none outline-none focus:ring-2 focus:ring-blue-500"
               />
             </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
           <button
              onClick={handleSaveShift}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-blue-200 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
           >
              {loading ? <Loader2 className="animate-spin"/> : <Save size={18}/>}
              Lưu Lịch Làm Việc
           </button>
        </div>
      </div>

      {/* --- DANH SÁCH ĐÃ XẾP (Preview) --- */}
      <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
         <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-700">Lịch đã xếp ngày: {new Date(viewDate).toLocaleDateString('vi-VN')}</h3>
            <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} className="border rounded px-2 py-1 text-sm"/>
         </div>

         <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                  <tr>
                     <th className="p-3">Nhân viên</th>
                     <th className="p-3">Vị trí</th>
                     <th className="p-3">Ghi chú</th>
                     <th className="p-3 text-right">Hành động</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {shifts.length === 0 ? (
                     <tr><td colSpan="4" className="p-8 text-center text-slate-400 italic">Chưa có lịch làm việc cho ngày này</td></tr>
                  ) : (
                     shifts.map(s => {
                        const u = users.find(user => user.id === s.user_id) || { name: 'Unknown' };
                        const r = roles.find(role => role.code === s.role) || { name: s.role };
                        return (
                           <tr key={s.id} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-700">{u.name}</td>
                              <td className="p-3"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">{r.name}</span></td>
                              <td className="p-3 text-slate-500 italic">{s.note || '-'}</td>
                              <td className="p-3 text-right">
                                 <button onClick={() => handleDeleteShift(s.id)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                              </td>
                           </tr>
                        )
                     })
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
// --- COMPONENT: ADMIN SHIFT MANAGER (Quản lý/Sắp ca làm việc) ---
// Thêm component này vào trước ManagerDashboard hoặc AdminDashboard
const AdminShiftManager = ({ users, roles, setNotify }) => {
  const [fromDate, setFromDate] = useState(getTodayISO());
  const [toDate, setToDate] = useState(getTodayISO());
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState([1, 2, 3, 4, 5]); // Mặc định T2-T6
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState([]);

  const daysOfWeek = [
    { val: 1, label: 'T2' }, { val: 2, label: 'T3' }, { val: 3, label: 'T4' },
    { val: 4, label: 'T5' }, { val: 5, label: 'T6' }, { val: 6, label: 'T7' }, { val: 0, label: 'CN' }
  ];

  // Fetch shifts logic
  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from('work_shifts')
        .select('*')
        .gte('date', fromDate)
        .lte('date', toDate)
        .order('date');
      if (error) throw error;
      setShifts(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [fromDate, toDate]);

  const toggleDay = (dayVal) => {
    setSelectedDaysOfWeek(prev => prev.includes(dayVal) ? prev.filter(d => d !== dayVal) : [...prev, dayVal]);
  };

  const toggleRole = (roleCode) => {
    setSelectedRoles(prev => prev.includes(roleCode) ? prev.filter(r => r !== roleCode) : [...prev, roleCode]);
  };

  const handleSaveShift = async () => {
    if (!selectedUser || selectedRoles.length === 0) {
      setNotify("Vui lòng chọn Nhân viên và ít nhất 1 Khu vực!", "error");
      return;
    }
    setLoading(true);
    try {
      const inserts = [];
      let currentDate = new Date(fromDate);
      const end = new Date(toDate);

      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay(); // 0-6
        if (selectedDaysOfWeek.includes(dayOfWeek)) {
          const dateStr = currentDate.toISOString().split('T')[0];
          selectedRoles.forEach(roleCode => {
            inserts.push({
              user_id: parseInt(selectedUser),
              role: roleCode,
              date: dateStr,
              shift_name: 'Ca làm việc',
              note: note
            });
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (inserts.length === 0) {
        setNotify("Không có ngày nào phù hợp trong khoảng đã chọn.", "error");
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('work_shifts').insert(inserts);
      if (error) throw error;

      setNotify(`Đã xếp thành công ${inserts.length} ca!`);
      fetchShifts();
      setNote('');
    } catch (err) {
      setNotify("Lỗi lưu ca (có thể trùng): " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShift = async (id) => {
      if(!window.confirm("Xóa ca làm việc này?")) return;
      const { error } = await supabase.from('work_shifts').delete().eq('id', id);
      if (error) setNotify("Lỗi xóa: " + error.message, "error");
      else {
          setNotify("Đã xóa ca làm việc");
          fetchShifts();
      }
  };

  return (
    <div className="space-y-6">
        {/* FORM NHẬP LIỆU */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* LEFT: Date, Day, User */}
             <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-3">
                     <div>
                         <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Từ ngày</label>
                         <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-bold text-slate-700"/>
                     </div>
                     <div>
                         <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Đến ngày</label>
                         <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-bold text-slate-700"/>
                     </div>
                 </div>

                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Áp dụng thứ</label>
                    <div className="flex gap-1.5 flex-wrap">
                        {daysOfWeek.map(d => (
                            <button key={d.val} onClick={() => toggleDay(d.val)} className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${selectedDaysOfWeek.includes(d.val) ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                                {d.label}
                            </button>
                        ))}
                    </div>
                 </div>

                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nhân viên</label>
                    <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-bold text-slate-700">
                        <option value="">-- Chọn nhân viên --</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                 </div>
             </div>

             {/* RIGHT: Role, Note, Save */}
             <div className="space-y-4 flex flex-col">
                 <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Khu vực / Công việc</label>
                    <div className="flex flex-wrap gap-2">
                        {roles.map(r => (
                            <div key={r.code} onClick={() => toggleRole(r.code)} className={`cursor-pointer border px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all ${selectedRoles.includes(r.code) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedRoles.includes(r.code) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                    {selectedRoles.includes(r.code) && <CheckSquare size={12} className="text-white"/>}
                                </div>
                                {r.name}
                            </div>
                        ))}
                    </div>
                 </div>

                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ghi chú (Tùy chọn)</label>
                    <input type="text" value={note} onChange={e => setNote(e.target.value)} className="w-full border rounded-lg p-2 text-sm" placeholder="Ghi chú cho ca này..." />
                 </div>

                 <button onClick={handleSaveShift} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={18}/> : <Plus size={18}/>}
                    Lưu Lịch Làm Việc
                 </button>
             </div>
        </div>

        {/* LIST */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500 uppercase">
                 Danh sách ca ({shifts.length})
             </div>
             <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white text-slate-500 font-bold text-xs border-b">
                        <tr>
                            <th className="p-3">Ngày</th>
                            <th className="p-3">Nhân viên</th>
                            <th className="p-3">Khu vực</th>
                            <th className="p-3">Ghi chú</th>
                            <th className="p-3 text-right">#</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {shifts.map(s => {
                            const u = users.find(x => x.id === s.user_id);
                            const r = roles.find(x => x.code === s.role);
                            return (
                                <tr key={s.id} className="hover:bg-slate-50">
                                    <td className="p-3 font-mono text-slate-600">{s.date.split('-').reverse().join('/')}</td>
                                    <td className="p-3 font-bold text-slate-700">{u?.name || s.user_id}</td>
                                    <td className="p-3"><span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-bold uppercase">{r?.name || s.role}</span></td>
                                    <td className="p-3 text-slate-500 italic">{s.note}</td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => handleDeleteShift(s.id)} className="text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            );
                        })}
                        {shifts.length === 0 && (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Chưa có lịch nào trong khoảng này.</td></tr>
                        )}
                    </tbody>
                </table>
             </div>
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
      {tab === 'statistics' && <AdminStatistics users={users} roles={roles} />}
      {tab === 'reports' && <AdminReports allTasks={allTasks} roles={roles} users={users} />}
      {tab === 'users' && <AdminUserManager users={users} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />}
      {tab === 'tasks' && <AdminTaskManager allTasks={allTasks} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />}
      {tab === 'shifts' && <AdminShiftScheduler users={users} roles={roles} setNotify={setNotify} />}
      {tab === 'roles' && <AdminRoleManager roles={roles} allTasks={allTasks} onRefresh={onRefresh} setNotify={setNotify} />}
    </div>
  );
};

// ==========================================
// COMPONENT: THỐNG KÊ & TÍNH LƯƠNG (ĐÃ SỬA LỌC & ĐA VAI TRÒ)
// ==========================================
// ==========================================
// COMPONENT: THỐNG KÊ & TÍNH LƯƠNG (NÂNG CẤP BỘ LỌC)
// ==========================================
const AdminStatistics = ({ users, roles }) => {
  // --- STATE BỘ LỌC ---
  const [filterType, setFilterType] = useState('month'); // 'date', 'range', 'month', 'year'

  // Các giá trị thời gian
  const [selectedDate, setSelectedDate] = useState(getTodayISO());
  const [selectedRange, setSelectedRange] = useState({ start: getTodayISO(), end: getTodayISO() });
  const [selectedMonth, setSelectedMonth] = useState(getTodayISO().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // Bộ lọc đối tượng
  const [filterUserId, setFilterUserId] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Data & UI State
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null); // Để xem chi tiết

  // --- HÀM TÍNH TOÁN NGÀY BẮT ĐẦU - KẾT THÚC ---
  const getDateRange = () => {
    let start, end;
    switch (filterType) {
      case 'date':
        start = selectedDate;
        end = selectedDate;
        break;
      case 'range':
        start = selectedRange.start;
        end = selectedRange.end;
        break;
      case 'month':
        // Đầu tháng đến cuối tháng
        const [y, m] = selectedMonth.split('-');
        start = `${y}-${m}-01`;
        // Lấy ngày cuối tháng
        const lastDay = new Date(y, m, 0).getDate();
        end = `${y}-${m}-${lastDay}`;
        break;
      case 'year':
        start = `${selectedYear}-01-01`;
        end = `${selectedYear}-12-31`;
        break;
      default:
        start = getTodayISO();
        end = getTodayISO();
    }
    return { start, end };
  };

  const calculateStats = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      // 1. Lấy dữ liệu CHẤM CÔNG trong khoảng thời gian
      const { data: logsData, error: logError } = await supabase
        .from('time_logs')
        .select('*')
        .gte('report_date', start)
        .lte('report_date', end)
        .order('log_time', { ascending: true });

      if(logError) throw logError;

      // 2. Lấy dữ liệu CÔNG VIỆC (Checklist) trong khoảng thời gian
      const { data: checkData, error: checkError } = await supabase
        .from('checklist_logs')
        .select('*')
        .gte('report_date', start)
        .lte('report_date', end);

      if(checkError) throw checkError;

      // 3. Lọc danh sách nhân viên cần tính
      let targetUsers = users;

      // Lọc theo Role
      if (filterRole) {
        targetUsers = targetUsers.filter(u => u.role.includes(filterRole));
      }
      // Lọc theo Tên nhân viên cụ thể
      if (filterUserId) {
        targetUsers = targetUsers.filter(u => u.id === filterUserId);
      }

      // 4. Tính toán chi tiết cho từng user
      const processed = targetUsers.map(user => {
        // Lọc logs của user này
        const userLogs = (logsData || []).filter(l => l.user_id === user.id);

        // Tính tổng giờ làm & Số ngày có đi làm
        let totalMillis = 0;
        const validWorkDays = new Set();

        // Group log theo ngày để tính giờ vào/ra
        const logsByDate = {};
        userLogs.forEach(log => {
          if (!logsByDate[log.report_date]) logsByDate[log.report_date] = [];
          logsByDate[log.report_date].push(log);
        });

        // Duyệt từng ngày để cộng giờ
        Object.keys(logsByDate).forEach(dateStr => {
           const dayLogs = logsByDate[dateStr].sort((a,b) => new Date(a.log_time) - new Date(b.log_time));
           let currentCheckIn = null;

           dayLogs.forEach(log => {
              if(log.action_type === 'check_in') {
                  currentCheckIn = new Date(log.log_time);
              } else if (log.action_type === 'check_out' && currentCheckIn) {
                  const time = new Date(log.log_time);
                  // Chỉ tính nếu check-out cùng ngày (hoặc xử lý qua đêm tùy logic, ở đây giữ đơn giản)
                  if (time > currentCheckIn) {
                      totalMillis += (time - currentCheckIn);
                      validWorkDays.add(dateStr);
                  }
                  currentCheckIn = null;
              }
           });
        });

        const totalHours = (totalMillis / (1000 * 60 * 60));

        // Tính % Hoàn thành công việc
        // Lấy checklist của user này (theo role của họ) trong khoảng thời gian
        const userChecklists = (checkData || []).filter(c => c.role === user.role);

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
      });

      setStats(processed);
    } catch (error) {
      console.error("Stats Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Tự động tính lại khi thay đổi bất kỳ bộ lọc nào
  useEffect(() => {
    calculateStats();
  }, [filterType, selectedDate, selectedRange, selectedMonth, selectedYear, filterUserId, filterRole]);


  // --- SUB-COMPONENT: CHI TIẾT NHÂN VIÊN (Giữ nguyên logic hiển thị nhưng lọc theo ngày range) ---
  const UserDetailView = ({ user }) => {
     // Chúng ta cần query lại chi tiết từng ngày trong khoảng đã chọn để hiển thị bảng chi tiết
     const [dailyStats, setDailyStats] = useState([]);
     const { start, end } = getDateRange();

     useEffect(() => {
        const fetchDetail = async () => {
           // Lấy logs và checklist của user này trong range
           const { data: logs } = await supabase.from('time_logs').select('*').eq('user_id', user.id).gte('report_date', start).lte('report_date', end);
           const { data: checks } = await supabase.from('checklist_logs').select('*').eq('role', user.role).gte('report_date', start).lte('report_date', end);

           // Tạo danh sách các ngày trong range để hiển thị
           const dateArray = [];
           let currentDate = new Date(start);
           const endDate = new Date(end);

           while (currentDate <= endDate) {
               dateArray.push(currentDate.toISOString().split('T')[0]);
               currentDate.setDate(currentDate.getDate() + 1);
           }

           const details = dateArray.map(dateStr => {
               const dayLogs = (logs || []).filter(l => l.report_date === dateStr).sort((a,b) => new Date(a.log_time) - new Date(b.log_time));

               // Tìm giờ vào/ra đầu/cuối
               const inLog = dayLogs.find(l => l.action_type === 'check_in');
               const outLog = [...dayLogs].reverse().find(l => l.action_type === 'check_out'); // Lấy cái cuối cùng

               const checkInTime = inLog ? new Date(inLog.log_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : null;
               const checkOutTime = outLog ? new Date(outLog.log_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : null;

               // Tính giờ làm thô
               let h = 0;
               if(inLog && outLog) {
                   h = (new Date(outLog.log_time) - new Date(inLog.log_time)) / (1000 * 60 * 60);
               }

               // Task
               const cl = (checks || []).find(c => c.report_date === dateStr);
               const tasks = cl ? Object.values(cl.data || {}) : [];
               const done = tasks.filter(t => t.sent).length;
               const total = tasks.length;

               // Rating đơn giản
               let rating = "Không làm";
               let ratingClass = "text-slate-300";
               if (h > 0 || total > 0) {
                   if (total > 0 && done/total === 1) { rating = "Tốt"; ratingClass = "text-emerald-600 font-bold"; }
                   else if (h > 8) { rating = "Đủ công"; ratingClass = "text-blue-600 font-bold"; }
                   else { rating = "Bình thường"; ratingClass = "text-slate-600"; }
               }

               return {
                   date: dateStr,
                   dayName: new Date(dateStr).toLocaleDateString('vi-VN', {weekday: 'long'}),
                   checkIn: checkInTime || '--:--',
                   checkOut: checkOutTime || '--:--',
                   hours: h.toFixed(1),
                   taskStr: total > 0 ? `${done}/${total}` : '-',
                   rating,
                   ratingClass,
                   hasWork: h > 0 || total > 0
               };
           });
           // Chỉ hiện những ngày có dữ liệu hoặc user muốn xem full thì bỏ filter
           // Ở đây mình hiện full
           setDailyStats(details);
        }
        fetchDetail();
     }, [user]);

     return (
        <div className="animate-in fade-in slide-in-from-right duration-300">
           <button onClick={() => setSelectedUser(null)} className="mb-4 flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold">
              <ChevronRight className="rotate-180" size={20}/> Quay lại danh sách
           </button>
           <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
               <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                   <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">{user.name.charAt(0)}</div>
                       <div>
                           <h3 className="font-bold text-slate-800">{user.name}</h3>
                           <p className="text-xs text-slate-500">{user.role}</p>
                       </div>
                   </div>
                   <div className="text-right">
                       <div className="text-sm font-bold text-slate-700">Tổng: {user.totalHours}h</div>
                       <div className="text-xs text-slate-500">{user.workDays} ngày làm việc</div>
                   </div>
               </div>
               <div className="max-h-[500px] overflow-y-auto">
                   <table className="w-full text-sm text-left">
                       <thead className="bg-white text-slate-500 font-bold text-xs uppercase border-b sticky top-0 shadow-sm">
                           <tr>
                               <th className="p-3">Ngày</th>
                               <th className="p-3 text-center">Vào - Ra</th>
                               <th className="p-3 text-center">Giờ làm</th>
                               <th className="p-3 text-center">Việc</th>
                               <th className="p-3">Đánh giá</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                           {dailyStats.map((day, idx) => (
                               <tr key={idx} className={`hover:bg-slate-50 ${!day.hasWork ? 'opacity-50' : ''}`}>
                                   <td className="p-3">
                                       <div className="font-bold text-slate-700">{day.date.split('-').reverse().join('/')}</div>
                                       <div className="text-[10px] text-slate-400 uppercase">{day.dayName}</div>
                                   </td>
                                   <td className="p-3 text-center font-mono text-slate-600">{day.checkIn} - {day.checkOut}</td>
                                   <td className="p-3 text-center font-bold text-blue-600">{parseFloat(day.hours) > 0 ? day.hours : '-'}</td>
                                   <td className="p-3 text-center">{day.taskStr}</td>
                                   <td className="p-3"><span className={day.ratingClass}>{day.rating}</span></td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           </div>
        </div>
     )
  }

  // --- MAIN RENDER ---
  if (selectedUser) return <UserDetailView user={selectedUser} />;

  // Tạo list năm (ví dụ 5 năm gần đây)
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 5}, (_, i) => currentYear - i);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* --- THANH CÔNG CỤ BỘ LỌC --- */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">

          {/* Hàng 1: Loại thời gian & Giá trị thời gian */}
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                  <Filter size={18} className="text-blue-600"/>
                  <span className="font-bold text-slate-700">Xem theo:</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                      <option value="date">Một ngày</option>
                      <option value="range">Khoảng ngày</option>
                      <option value="month">Tháng</option>
                      <option value="year">Năm</option>
                  </select>
              </div>

              {/* Input thay đổi dựa trên filterType */}
              <div className="flex items-center gap-2 animate-in fade-in">
                  {filterType === 'date' && (
                      <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"/>
                  )}
                  {filterType === 'range' && (
                      <div className="flex items-center gap-2">
                          <input type="date" value={selectedRange.start} onChange={e => setSelectedRange({...selectedRange, start: e.target.value})} className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700"/>
                          <span className="text-slate-400">-</span>
                          <input type="date" value={selectedRange.end} onChange={e => setSelectedRange({...selectedRange, end: e.target.value})} className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700"/>
                      </div>
                  )}
                  {filterType === 'month' && (
                      <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"/>
                  )}
                  {filterType === 'year' && (
                      <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
                          {years.map(y => <option key={y} value={y}>Năm {y}</option>)}
                      </select>
                  )}
              </div>
          </div>

          {/* Hàng 2: Lọc Nhân viên & Khu vực */}
          <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                  <Users size={18} className="text-slate-400"/>
                  <select
                    value={filterUserId}
                    onChange={(e) => setFilterUserId(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700 min-w-[200px] outline-none focus:ring-2 focus:ring-blue-500"
                  >
                      <option value="">-- Tất cả nhân viên --</option>
                      {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                  </select>
              </div>

              <div className="flex items-center gap-2">
                  <Briefcase size={18} className="text-slate-400"/>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700 min-w-[150px] outline-none focus:ring-2 focus:ring-blue-500"
                  >
                      <option value="">-- Tất cả khu vực --</option>
                      {roles.map(r => (
                          <option key={r.code} value={r.code}>{r.name}</option>
                      ))}
                  </select>
              </div>

              <div className="ml-auto">
                 {loading && <span className="flex items-center gap-2 text-blue-600 font-bold text-sm animate-pulse"><Loader2 className="animate-spin" size={16}/> Đang tính toán...</span>}
              </div>
          </div>
      </div>

      {/* --- DASHBOARD TỔNG QUAN (Chỉ hiện khi không chọn user cụ thể) --- */}
      {!filterUserId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-start mb-2">
                <div><p className="text-slate-400 text-xs font-bold uppercase">Tổng Giờ Làm</p><h3 className="text-2xl font-bold text-slate-800">{stats.reduce((acc, curr) => acc + curr.rawHours, 0).toFixed(1)}h</h3></div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Clock size={20}/></div>
             </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-start mb-2">
                <div><p className="text-slate-400 text-xs font-bold uppercase">Ước Tính Lương (Cơ bản)</p><h3 className="text-2xl font-bold text-slate-800">{(stats.reduce((acc, curr) => acc + curr.rawHours, 0) * 25000).toLocaleString()}đ</h3></div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign size={20}/></div>
             </div>
             <p className="text-[10px] text-slate-400 mt-1">*Ví dụ: 25k/h (Chưa cấu hình)</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-start mb-2">
                <div><p className="text-slate-400 text-xs font-bold uppercase">Hiệu Suất TB</p><h3 className="text-2xl font-bold text-slate-800">{stats.length > 0 ? Math.round(stats.reduce((acc, curr) => acc + curr.completionRate, 0) / stats.length) : 0}%</h3></div>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><TrendingUp size={20}/></div>
             </div>
          </div>
        </div>
      )}

      {/* --- BẢNG DỮ LIỆU --- */}
      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h3 className="font-bold text-slate-700">Kết quả thống kê</h3></div>
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
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Không tìm thấy dữ liệu phù hợp</td></tr>
              ) : (
                stats.map(s => (
                  <tr key={s.id} onClick={() => setSelectedUser(s)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                    <td className="p-4 font-bold text-slate-700 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs">{s.name.charAt(0)}</div>
                        <div>
                            <div>{s.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal group-hover:text-blue-500">Bấm để xem chi tiết</div>
                        </div>
                    </td>
                    <td className="p-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold uppercase">{s.role}</span></td>
                    <td className="p-4 text-center font-bold text-slate-600">{s.workDays}</td>
                    <td className="p-4 text-center font-bold text-blue-600">{s.totalHours}h</td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-600">{(s.rawHours * 25000).toLocaleString()}đ</td>
                    <td className="p-4">
                       <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1">
                          <div className={`h-2.5 rounded-full ${s.completionRate >= 80 ? 'bg-emerald-500' : (s.completionRate >= 50 ? 'bg-blue-500' : 'bg-orange-500')}`} style={{width: `${s.completionRate}%`}}></div>
                       </div>
                       <div className="text-xs text-slate-400 font-bold text-right">{s.completionRate}%</div>
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
// ==========================================
// COMPONENT: BÁO CÁO TIẾN ĐỘ (NÂNG CẤP LỌC KHU VỰC)
// ==========================================
const AdminReports = ({ allTasks, roles, users }) => {
  const [reportDate, setReportDate] = useState(getTodayISO());
  const [reportData, setReportData] = useState({});
  const [loading, setLoading] = useState(false);

  // --- BỘ LỌC ---
  const [filterUserId, setFilterUserId] = useState('');
  const [filterRole, setFilterRole] = useState(''); // <-- Mới thêm: Lọc theo Khu vực

  // Tải dữ liệu báo cáo theo ngày đã chọn
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('checklist_logs')
          .select('role, data')
          .eq('report_date', reportDate);

        if (error) throw error;

        const map = {};
        if (data) {
           data.forEach(item => {
              map[item.role] = item.data || {};
           });
        }
        setReportData(map);
      } catch (err) {
        console.error("Fetch report error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [reportDate]);

  // Logic quyết định hiển thị những Khu vực nào
  const getDisplayedRoles = () => {
     let list = roles;

     // 1. Lọc theo Khu vực (Nếu có chọn)
     if (filterRole) {
        list = list.filter(r => r.code === filterRole);
     }

     // 2. Lọc theo Nhân viên (Nếu có chọn -> chỉ hiện khu vực nhân viên đó làm)
     if (filterUserId) {
        const selectedUser = users.find(u => u.id === filterUserId);
        if (selectedUser) {
           const userRoles = selectedUser.role.split(',').map(r => r.trim());
           list = list.filter(r => userRoles.includes(r.code));
        }
     }

     // 3. Chỉ hiện những khu vực có công việc (Tasks) được cấu hình
     return list.filter(r => allTasks.some(t => t.role === r.code));
  };

  const displayedRoles = getDisplayedRoles();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
       {/* --- THANH CÔNG CỤ BỘ LỌC --- */}
       <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-10">
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
              {/* Chọn Ngày */}
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                 <div className="p-2 text-blue-600"><Calendar size={20}/></div>
                 <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none focus:ring-0 w-[130px]"
                 />
              </div>

              <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

              {/* Lọc Khu Vực (MỚI) */}
              <div className="flex items-center gap-2">
                 <Briefcase className="text-slate-400" size={18}/>
                 <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm min-w-[160px]"
                 >
                    <option value="">-- Tất cả khu vực --</option>
                    {roles.map(r => (
                       <option key={r.code} value={r.code}>{r.name}</option>
                    ))}
                 </select>
              </div>

              {/* Lọc Nhân Viên */}
              <div className="flex items-center gap-2">
                 <Users className="text-slate-400" size={18}/>
                 <select
                    value={filterUserId}
                    onChange={(e) => setFilterUserId(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm min-w-[180px]"
                 >
                    <option value="">-- Tất cả nhân viên --</option>
                    {users.map(u => (
                       <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                 </select>
              </div>
          </div>

          {loading && <div className="flex items-center gap-2 text-blue-600 font-bold text-sm animate-pulse"><Loader2 className="animate-spin" size={16}/> Đang tải...</div>}
       </div>

       {/* --- DANH SÁCH TIẾN ĐỘ --- */}
       <div className="grid grid-cols-1 gap-6">
          {displayedRoles.length === 0 ? (
             <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-400 italic">Không tìm thấy dữ liệu phù hợp với bộ lọc.</p>
             </div>
          ) : (
             displayedRoles.map(role => {
                const roleTasks = allTasks.filter(t => t.role === role.code);
                const roleData = reportData[role.code] || {};

                // Tính toán %
                const total = roleTasks.length;
                const done = roleTasks.filter(t => roleData[t.id]?.sent).length;
                const percent = total > 0 ? Math.round((done/total)*100) : 0;

                return (
                   <div key={role.code} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* Header Khu vực */}
                      <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
                         <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm text-blue-600">
                               <Briefcase size={20} />
                            </div>
                            <div>
                               <h3 className="font-bold text-slate-800 text-lg">{role.name}</h3>
                               <p className="text-xs text-slate-500 font-semibold">{total} đầu việc cần làm</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-4 min-w-[200px]">
                            <div className="w-full text-right">
                               <div className="flex justify-between text-xs font-bold mb-1">
                                  <span className="text-slate-500">Tiến độ</span>
                                  <span className={percent === 100 ? "text-emerald-600" : "text-blue-600"}>{percent}%</span>
                               </div>
                               <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-700 ${percent===100?'bg-emerald-500':'bg-blue-600'}`} style={{width: `${percent}%`}}></div>
                               </div>
                            </div>
                         </div>
                      </div>

                      {/* Danh sách Task chi tiết */}
                      <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                         {roleTasks.map(task => {
                            const item = roleData[task.id] || {};
                            const isDone = item.sent;
                            return (
                               <div key={task.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isDone ? 'bg-emerald-50/30' : 'hover:bg-slate-50'}`}>
                                  <div className="flex items-start gap-3">
                                     <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border transition-all ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-transparent'}`}>
                                        <CheckCircle2 size={14}/>
                                     </div>
                                     <div>
                                        <div className={`font-medium ${isDone ? 'text-slate-600 line-through decoration-slate-300' : 'text-slate-800'}`}>{task.title}</div>
                                        <div className="flex items-center gap-2 text-xs mt-1">
                                           <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold border border-slate-200">{task.time_label}</span>
                                           {item.time && <span className="text-blue-600 flex items-center gap-1 font-bold"><Clock size={12}/> {item.time}</span>}
                                        </div>
                                     </div>
                                  </div>

                                  <div className="flex items-center gap-3 pl-8 sm:pl-0 ml-auto sm:ml-0">
                                     {/* Dữ liệu nhập */}
                                     {task.require_input && (
                                        <div className="text-sm font-mono font-bold bg-white border px-2 py-1 rounded text-slate-700 shadow-sm min-w-[60px] text-center">
                                           {item.val || '-'}
                                        </div>
                                     )}

                                     {/* Ảnh báo cáo */}
                                     {task.require_image && (
                                        item.imageUrl ? (
                                           <a href={item.imageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors">
                                              <ImageIcon size={14}/> Ảnh
                                           </a>
                                        ) : <span className="text-xs text-slate-400 italic px-2">Thiếu ảnh</span>
                                     )}

                                     {/* Badge trạng thái */}
                                     <div className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap border ${isDone ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                        {isDone ? 'Hoàn thành' : 'Đang chờ'}
                                     </div>
                                  </div>
                               </div>
                            )
                         })}
                      </div>
                   </div>
                )
             })
          )}
       </div>
    </div>
  );
};
// --- ADMIN USER LIST (CẬP NHẬT: THÊM FORM PHÂN QUYỀN MANAGER) ---
// --- ADMIN USER LIST (Cập nhật lại để hiện ô Phân quyền) ---
// --- ADMIN USER LIST (PHIÊN BẢN FIX LỖI HIỂN THỊ) ---
// --- COMPONENT MỚI: DROPDOWN CHỌN NHIỀU (Đặt component này bên trên AdminUserList) ---
const MultiSelectDropdown = ({ label, options, selected, onChange, placeholder = "-- Chọn --" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const toggleOption = (val) => {
    const newSelected = selected.includes(val)
      ? selected.filter(item => item !== val) // Bỏ chọn
      : [...selected, val]; // Chọn thêm
    onChange(newSelected);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left border rounded-lg p-2.5 text-sm bg-white flex justify-between items-center shadow-sm hover:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
      >
        <span className={`truncate ${selected.length ? 'text-blue-700 font-bold' : 'text-slate-400'}`}>
          {selected.length > 0 ? `Đã chọn ${selected.length} mục` : placeholder}
        </span>
        <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto p-2 space-y-1 animate-in fade-in zoom-in-95 duration-200">
          {options.length > 0 ? (
            options.map(opt => (
              <div
                key={opt.value}
                onClick={() => toggleOption(opt.value)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selected.includes(opt.value) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selected.includes(opt.value) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                  {selected.includes(opt.value) && <CheckSquare size={14} className="text-white" />}
                </div>
                <span className="text-sm font-medium">{opt.label}</span>
              </div>
            ))
          ) : (
            <div className="text-center text-xs text-slate-400 py-2">Không có dữ liệu</div>
          )}
        </div>
      )}
    </div>
  );
};

// --- CẬP NHẬT: ADMIN USER LIST ---
const AdminUserList = ({ users, roles, onRefresh, setNotify }) => {
  const [editingUser, setEditingUser] = useState(null);

  // State form
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'staff',
    managed_roles: [], // Lưu dưới dạng mảng []
    managed_users: []  // Lưu dưới dạng mảng []
  });

  const [showPass, setShowPass] = useState(false);
  const [filterRole, setFilterRole] = useState('');

  // Reset form khi bấm sửa hoặc tạo mới
  useEffect(() => {
    if (editingUser) {
      setFormData({
        username: editingUser.username,
        password: editingUser.password,
        name: editingUser.name,
        role: editingUser.role || 'staff',
        // Chuyển chuỗi CSV từ DB thành mảng để dùng trong MultiSelect
        managed_roles: editingUser.managed_roles ? editingUser.managed_roles.split(',').filter(x => x) : [],
        managed_users: editingUser.managed_users ? editingUser.managed_users.split(',').filter(x => x) : []
      });
    } else {
      setFormData({ username: '', password: '', name: '', role: 'staff', managed_roles: [], managed_users: [] });
    }
  }, [editingUser]);

  // Kiểm tra role để hiện form Manager (Sửa lại logic so sánh)
  const isManager = formData.role === 'manager';

  const handleSave = async () => {
    if (!formData.username || !formData.password || !formData.name) return setNotify("Vui lòng nhập đủ thông tin!", "error");

    // Chuẩn bị dữ liệu gửi đi (Chuyển mảng về chuỗi CSV)
    const submitData = {
      username: formData.username,
      password: formData.password,
      name: formData.name,
      role: formData.role,
      // Nếu là manager thì lưu chuỗi, nếu không thì null
      managed_roles: isManager ? formData.managed_roles.join(',') : null,
      managed_users: isManager ? formData.managed_users.join(',') : null
    };

    try {
      if (editingUser) {
        const { error } = await supabase.from('app_users').update(submitData).eq('id', editingUser.id);
        if (error) throw error;
        setNotify("Đã cập nhật nhân sự!");
      } else {
        const { error } = await supabase.from('app_users').insert([submitData]);
        if (error) throw error;
        setNotify("Đã thêm nhân sự mới!");
      }
      setEditingUser(null);
      onRefresh();
    } catch (err) {
      setNotify("Lỗi: " + err.message, "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa?")) return;
    try {
      const { error } = await supabase.from('app_users').delete().eq('id', id);
      if (error) throw error;
      setNotify("Đã xóa nhân sự!");
      onRefresh();
    } catch (err) {
      setNotify("Lỗi xóa: " + err.message, "error");
    }
  };

  // Tạo danh sách options cho dropdown
  const roleOptions = roles.map(r => ({ value: r.code, label: r.name }));
  // Lọc danh sách user để chọn (trừ admin ra cho gọn)
  const userOptions = users
    .filter(u => u.role !== 'admin' && u.id !== editingUser?.id) // Không chọn chính mình
    .map(u => ({ value: u.id.toString(), label: `${u.name} (${u.role})` }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* CỘT TRÁI: FORM */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 h-fit sticky top-4 shadow-sm z-10">
        <h3 className="font-bold text-lg text-slate-800 mb-4">{editingUser ? 'Sửa Thông Tin' : 'Thêm Nhân Sự'}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Họ và tên</label>
            <input className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="VD: Nguyễn Văn A" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên đăng nhập</label>
            <input className="w-full border rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="user123" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} className="w-full border rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none pr-10" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              <button onClick={() => setShowPass(!showPass)} className="absolute right-2 top-2.5 text-slate-400 hover:text-blue-600">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vai trò hệ thống</label>
            <select
              className="w-full border rounded-lg p-2.5 text-sm font-bold bg-slate-50 text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="staff">Nhân viên (Staff)</option>
              <option value="manager">Quản lý (Manager)</option>
              <option value="admin">Quản trị viên (Admin)</option>
            </select>
          </div>

          {/* --- KHUNG PHÂN QUYỀN (HIỆN NẾU LÀ MANAGER) --- */}
          {isManager && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 space-y-4 relative animate-in slide-in-from-top-2">
              <div className="absolute -top-2 left-8 w-4 h-4 bg-blue-50 border-t border-l border-blue-200 transform rotate-45"></div>

              <p className="text-xs font-bold text-blue-700 uppercase flex items-center gap-2">
                <ShieldCheck size={16} /> Cấu hình quyền Quản lý
              </p>

              {/* 1. Chọn Khu vực (MultiSelect) */}
              <MultiSelectDropdown
                label="Quản lý khu vực (Managed Roles)"
                options={roleOptions}
                selected={formData.managed_roles}
                onChange={(newRoles) => setFormData({ ...formData, managed_roles: newRoles })}
                placeholder="-- Chọn khu vực --"
              />

              {/* 2. Chọn Nhân viên (MultiSelect) */}
              <MultiSelectDropdown
                label="Quản lý nhân viên (Managed Users)"
                options={userOptions}
                selected={formData.managed_users}
                onChange={(newUsers) => setFormData({ ...formData, managed_users: newUsers })}
                placeholder="-- Chọn nhân viên --"
              />

              <p className="text-[10px] text-blue-600 italic">
                * Manager chỉ có thể xem báo cáo và chấm công của các Khu vực và Nhân viên được chọn ở trên.
              </p>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            {editingUser && (
              <button onClick={() => setEditingUser(null)} className="flex-1 py-2.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-all">
                Hủy
              </button>
            )}
            <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all flex justify-center items-center gap-2">
              <Save size={18} /> {editingUser ? 'Lưu Thay Đổi' : 'Tạo Mới'}
            </button>
          </div>
        </div>
      </div>

      {/* CỘT PHẢI: DANH SÁCH */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
        {/* (Giữ nguyên phần bảng danh sách nhân sự như cũ) */}
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <span className="font-bold text-slate-700">Danh sách nhân sự ({users.length})</span>
          <div className="flex gap-1">
            {['', 'manager', 'staff'].map(r => (
              <button key={r} onClick={() => setFilterRole(r)} className={`px-3 py-1 text-xs rounded-lg font-bold capitalize transition-all ${filterRole === r ? 'bg-blue-600 text-white shadow' : 'hover:bg-slate-200 text-slate-500'}`}>
                {r || 'Tất cả'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 uppercase font-bold text-xs border-b sticky top-0 z-10">
              <tr>
                <th className="p-4 bg-slate-50">Tên</th>
                <th className="p-4 bg-slate-50">Vai trò</th>
                <th className="p-4 bg-slate-50 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users
                .filter(u => !filterRole || u.role === filterRole)
                .map(u => (
                  <tr key={u.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-slate-700">{u.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{u.username}</div>
                    </td>
                    <td className="p-4">
                       <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : (u.role.includes('manager') ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500')}`}>
                          {u.role}
                       </span>
                       {u.role === 'manager' && (
                         <div className="mt-1 text-[10px] text-slate-400 max-w-[150px] truncate">
                           QL: {u.managed_roles ? u.managed_roles.split(',').length : 0} khu vực, {u.managed_users ? u.managed_users.split(',').length : 0} nv
                         </div>
                       )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setEditingUser(u)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"><Edit3 size={16} /></button>
                         <button onClick={() => handleDelete(u.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={16} /></button>
                      </div>
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