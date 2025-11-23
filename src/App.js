import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  User, Lock, LogOut, RefreshCcw, Camera, Trash2, Plus,
  CheckCircle2, Circle, Clock, FileText, Send, Loader2,
  LayoutDashboard, Menu, X, ChevronRight, ShieldCheck,
  Users, ListTodo, Upload, Image as ImageIcon, MapPin
} from 'lucide-react';

// --- UTILS ---
const getTodayISO = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
};

const showNotify = (setter, msg, type = 'success') => {
  setter({ msg, type });
  setTimeout(() => setter({ msg: '', type: '' }), 3000);
};

// --- COMPONENT CHÍNH ---
export default function App() {
  const [user, setUser] = useState(null); // User object từ DB
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // Data States
  const [tasksConfig, setTasksConfig] = useState([]); // List danh sách việc (Metadata)
  const [checklistData, setChecklistData] = useState({}); // Dữ liệu báo cáo hôm nay
  const [usersList, setUsersList] = useState([]); // Dành cho Admin quản lý user

  // UI States
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ msg: '', type: '' });
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // --- LOGIC KHỞI TẠO & LOGIN ---
  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', loginForm.username)
        .eq('password', loginForm.password) // Lưu ý: Nên dùng hash password ở prd
        .single();

      if (error || !data) throw new Error("Sai thông tin đăng nhập");

      setUser(data);
      if(data.role !== 'admin') {
         fetchTasksConfig(data.role); // Load cấu hình việc của role này
         fetchTodayReport(data.role); // Load báo cáo hôm nay
      } else {
         fetchAllDataAdmin();
      }
    } catch (err) {
      showNotify(setNotification, err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchTasksConfig = async (role) => {
    const { data } = await supabase.from('task_definitions').select('*').eq('role', role).order('sort_order');
    if(data) setTasksConfig(data);
  };

  const fetchTodayReport = async (role) => {
    const today = getTodayISO();
    const { data } = await supabase.from('checklist_logs').select('data').eq('report_date', today).eq('role', role).single();
    if (data) setChecklistData(prev => ({...prev, [role]: data.data || {}}));
  };

  const fetchAllDataAdmin = async () => {
    // 1. Load users
    const { data: uData } = await supabase.from('app_users').select('*').order('created_at');
    setUsersList(uData || []);

    // 2. Load all task configs
    const { data: tData } = await supabase.from('task_definitions').select('*').order('sort_order');
    setTasksConfig(tData || []);

    // 3. Load today reports
    const today = getTodayISO();
    const { data: rData } = await supabase.from('checklist_logs').select('role, data').eq('report_date', today);
    const reportMap = {};
    if(rData) rData.forEach(r => reportMap[r.role] = r.data);
    setChecklistData(reportMap);
  };

  // --- RENDER ---
  if (!user) return <ModernLogin loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} notification={notification} loading={loading} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Global Notification */}
      {notification.msg && (
        <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-lg shadow-xl border flex items-center gap-3 animate-bounce-short ${notification.type === 'error' ? 'bg-white border-red-100 text-red-600' : 'bg-white border-emerald-100 text-emerald-600'}`}>
          {notification.type === 'error' ? <X size={20} /> : <CheckCircle2 size={20} />}
          <span className="font-medium">{notification.msg}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Sidebar */}
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
             <div className="mt-auto pt-4 lg:absolute lg:bottom-0 lg:w-full lg:left-0 lg:p-4">
                <button onClick={() => { setUser(null); setChecklistData({}); }} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all font-medium">
                  <LogOut size={18} /> Đăng xuất
                </button>
             </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-slate-50/50 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {user.role === 'admin' ? (
              <AdminDashboard
                users={usersList}
                allTasks={tasksConfig}
                reports={checklistData}
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
// STAFF COMPONENTS (CHECK-IN, CHECKLIST)
// ==========================================

const StaffDashboard = ({ user, tasks, reportData, onUpdateLocal, setNotify }) => {
  const [attendance, setAttendance] = useState({ in: null, out: null });
  const [loadingSend, setLoadingSend] = useState(null);

  useEffect(() => {
    checkAttendanceStatus();
  }, []);

  const checkAttendanceStatus = async () => {
    const today = getTodayISO();
    const { data } = await supabase.from('time_logs')
      .select('*').eq('user_id', user.id).eq('report_date', today);

    if (data) {
      const checkIn = data.find(x => x.action_type === 'check_in');
      const checkOut = data.find(x => x.action_type === 'check_out');
      setAttendance({
        in: checkIn ? new Date(checkIn.log_time).toLocaleTimeString('vi-VN') : null,
        out: checkOut ? new Date(checkOut.log_time).toLocaleTimeString('vi-VN') : null
      });
    }
  };

  const handleAttendance = async (type) => {
    try {
       const { error } = await supabase.from('time_logs').insert({
         user_id: user.id,
         action_type: type,
         report_date: getTodayISO()
       });
       if (error) throw error;
       setNotify(`Đã ${type === 'check_in' ? 'Check-in' : 'Check-out'} thành công!`);
       checkAttendanceStatus();
    } catch (err) {
      setNotify("Lỗi chấm công", "error");
    }
  };

  const handleTaskAction = async (taskDefId, actionType, value) => {
     // taskDefId là key trong object reportData
     const currentTaskData = reportData[taskDefId] || {};

     if (currentTaskData.sent) return; // Đã gửi thì ko sửa

     let updatedItem = { ...currentTaskData };

     if (actionType === 'toggle') {
        const isDone = !updatedItem.done;
        updatedItem = {
          ...updatedItem,
          done: isDone,
          time: isDone ? new Date().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : ''
        };
     } else if (actionType === 'input') {
        updatedItem.val = value;
     } else if (actionType === 'image') {
        updatedItem.imageUrl = value; // value is URL here
     }

     const newReportData = { ...reportData, [taskDefId]: updatedItem };
     onUpdateLocal(newReportData);
  };

  const sendSingleTask = async (taskDefId) => {
     const item = reportData[taskDefId];
     if(!item || !item.done) return setNotify("Chưa hoàn thành!", "error");

     // Check requirements
     const taskDef = tasks.find(t => t.id === taskDefId);
     if(taskDef?.require_input && !item.val) return setNotify("Thiếu thông tin nhập liệu!", "error");
     if(taskDef?.require_image && !item.imageUrl) return setNotify("Thiếu hình ảnh minh chứng!", "error");

     setLoadingSend(taskDefId);
     try {
       item.sent = true;
       const newReportData = { ...reportData, [taskDefId]: item };

       const { error } = await supabase.from('checklist_logs').upsert({
         report_date: getTodayISO(),
         role: user.role,
         data: newReportData
       }, { onConflict: 'report_date, role' });

       if(error) throw error;
       onUpdateLocal(newReportData);
       setNotify("Đã gửi báo cáo!");
     } catch (err) {
       console.error(err);
       item.sent = false;
       onUpdateLocal({ ...reportData, [taskDefId]: item });
       setNotify("Gửi lỗi", "error");
     } finally {
       setLoadingSend(null);
     }
  };

  // Upload ảnh lên Supabase Storage
  const handleImageUpload = async (e, taskDefId) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setNotify("Đang tải ảnh...", "info");
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.username}_${taskDefId}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('task-images')
        .getPublicUrl(filePath);

      handleTaskAction(taskDefId, 'image', publicUrl);
      setNotify("Tải ảnh thành công");
    } catch (error) {
      console.error(error);
      setNotify("Lỗi tải ảnh", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Attendance Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
         <div>
            <h2 className="text-xl font-bold text-slate-800">Chấm công ca làm việc</h2>
            <p className="text-slate-500 text-sm">Ghi nhận thời gian vào/ra ca chính xác</p>
         </div>
         <div className="flex gap-3">
            <button
              disabled={!!attendance.in}
              onClick={() => handleAttendance('check_in')}
              className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${attendance.in ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30'}`}
            >
              <MapPin size={18} /> {attendance.in ? `Vào: ${attendance.in}` : 'Check In'}
            </button>
            <button
              disabled={!attendance.in || !!attendance.out}
              onClick={() => handleAttendance('check_out')}
              className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${attendance.out ? 'bg-slate-100 text-slate-400' : (!attendance.in ? 'opacity-50' : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100')}`}
            >
              <LogOut size={18} /> {attendance.out ? `Ra: ${attendance.out}` : 'Check Out'}
            </button>
         </div>
      </div>

      <div className="grid gap-4">
        {tasks.length === 0 && <div className="text-center text-slate-400 py-10">Chưa có công việc nào được giao.</div>}
        {tasks.map((task) => {
          const item = reportData[task.id] || {};
          const isDone = item.done;
          const isSent = item.sent;

          return (
             <div key={task.id} className={`bg-white p-4 rounded-xl border-2 transition-all ${isSent ? 'border-emerald-100 bg-emerald-50/20' : isDone ? 'border-blue-100' : 'border-transparent hover:border-slate-200 shadow-sm'}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                   <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => !isSent && handleTaskAction(task.id, 'toggle')}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isDone ? (isSent ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600') : 'bg-slate-100 text-slate-300'}`}>
                         {isSent ? <CheckCircle2 size={20}/> : <CheckCircle2 size={20} className={isDone ? 'opacity-100' : 'opacity-0'}/>}
                      </div>
                      <div>
                         <div className="flex items-center gap-2 text-xs mb-1">
                            <span className="font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{task.time_label}</span>
                            {item.time && <span className="text-blue-600 font-medium"><Clock size={10} className="inline mr-1"/>{item.time}</span>}
                         </div>
                         <h3 className="font-semibold text-slate-800">{task.title}</h3>
                      </div>
                   </div>

                   {/* Inputs Zone */}
                   <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center w-full md:w-auto mt-2 md:mt-0 pl-12 md:pl-0">

                      {/* Text Input */}
                      {task.require_input && (
                        <input
                           disabled={!isDone || isSent}
                           value={item.val || ''}
                           onChange={(e) => handleTaskAction(task.id, 'input', e.target.value)}
                           placeholder="Nhập số liệu..."
                           className="w-full sm:w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-center"
                        />
                      )}

                      {/* Image Input */}
                      {task.require_image && (
                         <div className="relative">
                            <input
                              type="file"
                              id={`file-${task.id}`}
                              className="hidden"
                              accept="image/*"
                              disabled={!isDone || isSent}
                              onChange={(e) => handleImageUpload(e, task.id)}
                            />
                            {item.imageUrl ? (
                               <a href={item.imageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-100">
                                  <ImageIcon size={16}/> Xem ảnh
                               </a>
                            ) : (
                               <label htmlFor={`file-${task.id}`} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer ${!isDone || isSent ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 text-slate-600 hover:bg-white border-slate-200'}`}>
                                  <Camera size={16}/> Chụp ảnh
                               </label>
                            )}
                         </div>
                      )}

                      {/* Send Button */}
                      {isDone && !isSent && (
                        <button onClick={() => sendSingleTask(task.id)} disabled={loadingSend === task.id} className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-blue-700">
                           {loadingSend === task.id ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                        </button>
                      )}

                      {isSent && <span className="text-emerald-600 font-bold text-xs bg-emerald-100 px-3 py-2 rounded-lg flex gap-1"><CheckCircle2 size={14}/> Đã gửi</span>}
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

const AdminDashboard = ({ users, allTasks, reports, onRefresh, setNotify }) => {
  const [tab, setTab] = useState('reports'); // reports | users | tasks

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-slate-200 pb-1 overflow-x-auto">
        {[
          {id: 'reports', icon: LayoutDashboard, label: 'Báo Cáo'},
          {id: 'users', icon: Users, label: 'Nhân Sự'},
          {id: 'tasks', icon: ListTodo, label: 'Cấu Hình Việc'},
        ].map(t => (
           <button
             key={t.id}
             onClick={() => setTab(t.id)}
             className={`flex items-center gap-2 px-4 py-3 font-bold text-sm whitespace-nowrap transition-all border-b-2 ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
           >
             <t.icon size={18}/> {t.label}
           </button>
        ))}
        <button onClick={onRefresh} className="ml-auto p-2 text-slate-400 hover:text-blue-600"><RefreshCcw size={18}/></button>
      </div>

      {tab === 'reports' && <AdminReports reports={reports} allTasks={allTasks} />}
      {tab === 'users' && <AdminUserManager users={users} onRefresh={onRefresh} setNotify={setNotify} />}
      {tab === 'tasks' && <AdminTaskManager allTasks={allTasks} onRefresh={onRefresh} setNotify={setNotify} />}
    </div>
  );
};

// --- ADMIN SUB-COMPONENTS ---

const AdminReports = ({ reports, allTasks }) => {
   const roles = [...new Set(allTasks.map(t => t.role))];

   return (
     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
       {roles.map(role => {
          const roleTasks = allTasks.filter(t => t.role === role);
          const roleReport = reports[role] || {};
          const sentCount = Object.values(roleReport).filter(i => i.sent).length;

          return (
             <div key={role} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                   <h3 className="font-bold text-slate-800 uppercase">{role}</h3>
                   <span className="text-xs font-bold bg-white border px-2 py-1 rounded-full">{sentCount}/{roleTasks.length}</span>
                </div>
                <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                   {roleTasks.map(task => {
                      const item = roleReport[task.id];
                      if(!item || !item.sent) return null;
                      return (
                         <div key={task.id} className="p-3 text-sm flex items-start justify-between gap-3 hover:bg-slate-50">
                            <div>
                               <p className="font-medium text-slate-700">{task.title}</p>
                               <p className="text-xs text-slate-400">{item.time}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                               {item.val && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-xs font-mono">{item.val}</span>}
                               {item.imageUrl && (
                                  <a href={item.imageUrl} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs flex items-center gap-1 hover:underline">
                                    <ImageIcon size={12}/> Ảnh
                                  </a>
                               )}
                            </div>
                         </div>
                      )
                   })}
                   {sentCount === 0 && <p className="p-4 text-center text-slate-400 text-sm">Chưa có báo cáo</p>}
                </div>
             </div>
          )
       })}
     </div>
   )
}

const AdminUserManager = ({ users, onRefresh, setNotify }) => {
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'nam_np' });

  const handleAddUser = async () => {
    if(!newUser.username || !newUser.password) return setNotify("Thiếu thông tin", "error");
    const { error } = await supabase.from('app_users').insert(newUser);
    if(error) setNotify("Lỗi thêm user: " + error.message, "error");
    else {
      setNotify("Đã thêm nhân viên");
      setNewUser({ username: '', password: '', name: '', role: 'nam_np' });
      onRefresh();
    }
  };

  const handleDeleteUser = async (id) => {
    if(!window.confirm("Xóa user này?")) return;
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if(!error) { setNotify("Đã xóa"); onRefresh(); }
  };

  return (
    <div className="space-y-6">
       <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col md:flex-row gap-3">
          <input className="p-2 rounded border border-blue-200 text-sm" placeholder="Tên đăng nhập" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})}/>
          <input className="p-2 rounded border border-blue-200 text-sm" placeholder="Mật khẩu" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}/>
          <input className="p-2 rounded border border-blue-200 text-sm flex-1" placeholder="Họ tên hiển thị" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})}/>
          <select className="p-2 rounded border border-blue-200 text-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
             <option value="nam_np">Nam Nhà Phao</option>
             <option value="nu_np">Nữ Nhà Phao</option>
             <option value="nam_xd">Nam Xe Điện</option>
             <option value="admin">Quản lý (Admin)</option>
          </select>
          <button onClick={handleAddUser} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 text-sm">Thêm User</button>
       </div>

       <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left">
             <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                <tr>
                   <th className="p-4">Tên</th>
                   <th className="p-4">Username</th>
                   <th className="p-4">Role</th>
                   <th className="p-4 text-right">Action</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                   <tr key={u.id} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-700">{u.name}</td>
                      <td className="p-4 text-slate-500">{u.username}</td>
                      <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{u.role}</span></td>
                      <td className="p-4 text-right">
                         <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  )
}

const AdminTaskManager = ({ allTasks, onRefresh, setNotify }) => {
  const [editing, setEditing] = useState({ role: 'nam_np', title: '', time_label: '', require_input: false, require_image: false, sort_order: 1 });

  const handleAddTask = async () => {
     if(!editing.title) return;
     const { error } = await supabase.from('task_definitions').insert(editing);
     if(error) setNotify("Lỗi tạo việc", "error");
     else {
        setNotify("Đã tạo công việc mới");
        onRefresh();
     }
  };

  const handleDeleteTask = async (id) => {
     if(!window.confirm("Xóa việc này?")) return;
     const { error } = await supabase.from('task_definitions').delete().eq('id', id);
     if(!error) { setNotify("Đã xóa"); onRefresh(); }
  };

  return (
     <div className="space-y-6">
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 grid grid-cols-2 md:grid-cols-6 gap-3">
           <div className="col-span-2 md:col-span-1">
             <label className="text-xs font-bold text-indigo-800 block mb-1">Khu vực (Role)</label>
             <select className="w-full p-2 rounded border text-sm" value={editing.role} onChange={e => setEditing({...editing, role: e.target.value})}>
                <option value="nam_np">Nam Nhà Phao</option>
                <option value="nu_np">Nữ Nhà Phao</option>
                <option value="nam_xd">Nam Xe Điện</option>
                <option value="nu_xd">Nữ Xe Điện</option>
             </select>
           </div>
           <div className="col-span-2 md:col-span-2">
             <label className="text-xs font-bold text-indigo-800 block mb-1">Tên công việc</label>
             <input className="w-full p-2 rounded border text-sm" placeholder="VD: Dọn hồ cá" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})}/>
           </div>
           <div className="col-span-1">
             <label className="text-xs font-bold text-indigo-800 block mb-1">Giờ (Text)</label>
             <input className="w-full p-2 rounded border text-sm" placeholder="15:30" value={editing.time_label} onChange={e => setEditing({...editing, time_label: e.target.value})}/>
           </div>
           <div className="col-span-2 md:col-span-1 flex flex-col justify-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                 <input type="checkbox" checked={editing.require_input} onChange={e => setEditing({...editing, require_input: e.target.checked})} /> Nhập số?
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                 <input type="checkbox" checked={editing.require_image} onChange={e => setEditing({...editing, require_image: e.target.checked})} /> Chụp ảnh?
              </label>
           </div>
           <div className="col-span-2 md:col-span-1 flex items-end">
              <button onClick={handleAddTask} className="w-full bg-indigo-600 text-white p-2 rounded font-bold hover:bg-indigo-700 text-sm">Thêm</button>
           </div>
        </div>

        <div className="bg-white rounded-xl shadow border border-slate-200">
           {allTasks.map(t => (
              <div key={t.id} className="p-3 border-b border-slate-50 last:border-0 flex items-center justify-between hover:bg-slate-50">
                 <div className="flex items-center gap-3">
                    <span className="text-xs font-bold bg-slate-100 text-slate-500 w-16 text-center py-1 rounded">{t.role}</span>
                    <div>
                       <p className="font-bold text-sm text-slate-700">{t.title}</p>
                       <p className="text-xs text-slate-400">Time: {t.time_label} | {t.require_input ? 'Nhập số' : ''} {t.require_image ? 'Có ảnh' : ''}</p>
                    </div>
                 </div>
                 <button onClick={() => handleDeleteTask(t.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
              </div>
           ))}
        </div>
     </div>
  )
}

// Simple Login UI (Reuse logic)
const ModernLogin = ({ loginForm, setLoginForm, handleLogin, loading, notification }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
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
          {notification.msg && <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">{notification.msg}</div>}
          <button onClick={handleLogin} disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex justify-center">
             {loading ? <Loader2 className="animate-spin"/> : 'Vào ca làm việc'}
          </button>
       </div>
    </div>
  </div>
);